// Identity, accounts and punter statistics.
import crypto from 'node:crypto';
import { DERBY_START_CREDITS, type PunterStats, type SelfProfile } from '@derby/shared';
import { config } from '../config.js';
import type { Repository } from '../db/index.js';
import type { UserRecord } from '../db/repository.js';

export const AVATARS = ['horseshoe', 'skull', 'gasmask', 'crown', 'wolf', 'raven', 'bolt', 'flame', 'eye', 'dice'];

export function emptyStats(): PunterStats {
  return { races: 0, betsPlaced: 0, betsWon: 0, totalWon: 0, biggestWin: 0, peakBank: DERBY_START_CREDITS };
}

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export const newId = (prefix = '') => `${prefix}${crypto.randomBytes(9).toString('base64url')}`;

export class ProfileManager {
  private cache = new Map<string, UserRecord>();

  constructor(private repo: Repository) {}

  /** Resume a session by token, or create a new guest identity. Returns the plaintext token once. */
  async authenticate(token: string | undefined, name: string | undefined): Promise<{ user: UserRecord; token?: string }> {
    if (token) {
      const u = this.cache.get(this.byTokenKey(token)) ?? (await this.repo.getUserByTokenHash(hash(token)));
      if (u) {
        u.lastSeen = Date.now();
        this.cache.set(u.id, u);
        return { user: u };
      }
    }
    const fresh = crypto.randomBytes(24).toString('base64url');
    const desired = (name ?? `Survivor${Math.floor(Math.random() * 9000 + 1000)}`).trim();
    const user: UserRecord = {
      id: newId('u_'), name: await this.uniqueName(desired), avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], tokenHash: hash(fresh),
      createdAt: Date.now(), lastSeen: Date.now(), isAdmin: config.adminNames.includes(desired.toLowerCase()), bot: false,
      credits: DERBY_START_CREDITS, stats: emptyStats(),
    };
    await this.repo.saveUser(user);
    this.cache.set(user.id, user);
    return { user, token: fresh };
  }

  /** Look up an existing user by session token (HTTP endpoints). Never creates accounts. */
  async findByToken(token: string): Promise<UserRecord | undefined> {
    const cachedId = this.byTokenKey(token);
    return (cachedId && this.cache.get(cachedId)) || (await this.repo.getUserByTokenHash(hash(token)));
  }

  private byTokenKey(token: string) {
    const h = hash(token);
    for (const u of this.cache.values()) if (u.tokenHash === h || (u.sessions ?? []).includes(h)) return u.id;
    return '';
  }

  async uniqueName(desired: string): Promise<string> {
    let name = desired.slice(0, 20);
    for (let i = 0; i < 50; i++) {
      const taken = [...this.cache.values()].some((u) => u.name.toLowerCase() === name.toLowerCase()) || (await this.repo.getUserByName(name));
      if (!taken) return name;
      name = `${desired.slice(0, 16)}${Math.floor(Math.random() * 900 + 100)}`;
    }
    return `${desired.slice(0, 12)}${Date.now() % 100000}`;
  }

  // ------------------------------------------------------------------ accounts
  private failures = new Map<string, { n: number; until: number }>();

  /** Create a password-protected account outright (no guest step). Returns a session token. */
  async createAccount(name: string, password: string): Promise<{ user: UserRecord; token: string }> {
    checkPassword(password);
    const clean = name.trim();
    if (!/^[\w\- .]{2,20}$/.test(clean)) throw new Error('bad_name');
    if ((await this.repo.getUserByName(clean)) || [...this.cache.values()].some((u) => u.name.toLowerCase() === clean.toLowerCase())) throw new Error('name_taken');
    const token = crypto.randomBytes(24).toString('base64url');
    const user: UserRecord = {
      id: newId('u_'), name: clean, avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], tokenHash: hash(token),
      createdAt: Date.now(), lastSeen: Date.now(), isAdmin: config.adminNames.includes(clean.toLowerCase()), bot: false,
      credits: DERBY_START_CREDITS, stats: emptyStats(),
      passwordHash: await hashPassword(password), sessions: [],
    };
    await this.repo.saveUser(user);
    this.cache.set(user.id, user);
    return { user, token };
  }

  /** Put a password on the current (guest) identity so it can be used from any device. */
  async setPassword(u: UserRecord, password: string, current?: string) {
    checkPassword(password);
    if (u.passwordHash && !(current && (await verifyPassword(current, u.passwordHash)))) throw new Error('wrong_password');
    u.passwordHash = await hashPassword(password);
    await this.save(u);
  }

  /** Log in with callsign + password; issues a new per-device session token. */
  async login(name: string, password: string): Promise<{ user: UserRecord; token: string }> {
    const key = name.trim().toLowerCase();
    const f = this.failures.get(key);
    if (f && f.until > Date.now()) throw new Error('too_many_attempts');
    const cached = [...this.cache.values()].find((u) => u.name.toLowerCase() === key);
    const u = cached ?? (await this.repo.getUserByName(name.trim()));
    const ok = !!u && !u.bot && !!u.passwordHash && (await verifyPassword(password, u.passwordHash));
    if (!ok || !u) {
      const n = (f && f.until > Date.now() - 600_000 ? f.n : 0) + 1;
      this.failures.set(key, { n, until: n >= 6 ? Date.now() + 10 * 60_000 : 0 });
      throw new Error('bad_credentials');
    }
    this.failures.delete(key);
    const token = crypto.randomBytes(24).toString('base64url');
    u.sessions = [...(u.sessions ?? []), hash(token)].slice(-8);
    u.lastSeen = Date.now();
    await this.save(u);
    return { user: u, token };
  }

  /** Forget one device's session (logout). */
  async logout(u: UserRecord, token: string) {
    const h = hash(token);
    u.sessions = (u.sessions ?? []).filter((x) => x !== h);
    if (u.tokenHash === h) u.tokenHash = hash(crypto.randomBytes(24).toString('base64url'));
    await this.save(u);
  }

  register(u: UserRecord) { this.cache.set(u.id, u); }
  forget(id: string) { this.cache.delete(id); }
  cached(id: string) { return this.cache.get(id); }
  async get(id: string) { return this.cache.get(id) ?? (await this.repo.getUser(id)); }
  async save(u: UserRecord) { this.cache.set(u.id, u); await this.repo.saveUser(u); }

  async rename(u: UserRecord, name: string) {
    if (name.toLowerCase() === u.name.toLowerCase()) return u.name;
    const existing = await this.repo.getUserByName(name);
    if (existing && existing.id !== u.id) throw new Error('name_taken');
    u.name = name;
    await this.save(u);
    return name;
  }

  self(u: UserRecord): SelfProfile {
    return { id: u.id, name: u.name, avatar: u.avatar, stats: u.stats, isAdmin: u.isAdmin || config.devTools, credits: u.credits, hasPassword: !!u.passwordHash };
  }
}

// ------------------------------------------------------------------ password hashing (scrypt, per-user salt)
const scrypt = (pw: string, salt: Buffer) => new Promise<Buffer>((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));

function checkPassword(pw: string) {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 128) throw new Error('weak_password');
}

export async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${(await scrypt(pw, salt)).toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [kind, salt, key] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !key) return false;
  const want = Buffer.from(key, 'base64');
  const got = await scrypt(pw, Buffer.from(salt, 'base64'));
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
