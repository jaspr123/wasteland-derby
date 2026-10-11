// Zero-setup development store: everything in memory, flushed to a JSON file.
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Repository, UserRecord } from './repository.js';

interface Store { users: UserRecord[] }

export class JsonRepository implements Repository {
  readonly kind = 'json' as const;
  private users = new Map<string, UserRecord>();
  private file: string;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(dir: string) { this.file = path.join(dir, 'db.json'); }

  async init() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      const s = JSON.parse(await fs.readFile(this.file, 'utf8')) as Store;
      s.users.forEach((u) => this.users.set(u.id, u));
    } catch { /* fresh store */ }
  }

  private dirty() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => { this.flushTimer = null; void this.flush(); }, 750);
  }

  async flush() {
    const store: Store = { users: [...this.users.values()].filter((u) => !u.bot) };
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store));
    await fs.rename(tmp, this.file);
  }

  async close() { if (this.flushTimer) clearTimeout(this.flushTimer); await this.flush(); }

  async getUser(id: string) { return this.users.get(id); }
  async getUserByTokenHash(hash: string) { return [...this.users.values()].find((u) => u.tokenHash === hash || (u.sessions ?? []).includes(hash)); }
  async getUserByName(name: string) { const n = name.toLowerCase(); return [...this.users.values()].find((u) => u.name.toLowerCase() === n); }
  async saveUser(u: UserRecord) { if (u.bot) return; this.users.set(u.id, u); this.dirty(); }
  async topUsers(limit: number) { return [...this.users.values()].filter((u) => !u.bot && u.stats.races > 0).sort((a, b) => b.credits - a.credits).slice(0, limit); }
}
