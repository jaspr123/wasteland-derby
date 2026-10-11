// PostgreSQL implementation of the Repository (schema in schema.sql).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { DERBY_START_CREDITS } from '@derby/shared';
import { emptyStats } from '../game/ProfileManager.js';
import type { Repository, UserRecord } from './repository.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export class PgRepository implements Repository {
  readonly kind = 'postgres' as const;
  private pool: pg.Pool;

  constructor(url: string) { this.pool = new pg.Pool({ connectionString: url, max: 10 }); }

  async init() { await this.pool.query(await fs.readFile(path.join(here, 'schema.sql'), 'utf8')); }
  async close() { await this.pool.end(); }

  private toUser(r: Record<string, any>): UserRecord {
    return {
      id: r.id, name: r.name, avatar: r.avatar, tokenHash: r.token_hash, isAdmin: r.is_admin, bot: false,
      createdAt: new Date(r.created_at).getTime(), lastSeen: new Date(r.last_seen).getTime(),
      passwordHash: r.password_hash ?? undefined, sessions: r.sessions ?? [],
      credits: r.credits ?? DERBY_START_CREDITS, stats: { ...emptyStats(), ...(r.stats ?? {}) },
    };
  }

  private async one(where: string, arg: unknown) {
    const r = await this.pool.query(`SELECT * FROM users WHERE ${where}`, [arg]);
    return r.rows[0] ? this.toUser(r.rows[0]) : undefined;
  }
  getUser(id: string) { return this.one('id = $1', id); }
  getUserByTokenHash(h: string) { return this.one('token_hash = $1 OR sessions ? $1', h); }
  getUserByName(n: string) { return this.one('lower(name) = lower($1)', n); }
  async topUsers(limit: number) {
    const r = await this.pool.query(`SELECT * FROM users WHERE (stats->>'races')::int > 0 ORDER BY credits DESC LIMIT $1`, [limit]);
    return r.rows.map((x) => this.toUser(x));
  }

  async saveUser(u: UserRecord) {
    if (u.bot) return;
    await this.pool.query(
      `INSERT INTO users (id, name, avatar, token_hash, is_admin, created_at, last_seen, password_hash, sessions, credits, stats)
       VALUES ($1,$2,$3,$4,$5,to_timestamp($6/1000.0),to_timestamp($7/1000.0),$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, avatar=EXCLUDED.avatar, token_hash=EXCLUDED.token_hash, is_admin=EXCLUDED.is_admin,
         last_seen=EXCLUDED.last_seen, password_hash=EXCLUDED.password_hash, sessions=EXCLUDED.sessions, credits=EXCLUDED.credits, stats=EXCLUDED.stats`,
      [u.id, u.name, u.avatar, u.tokenHash, u.isAdmin, u.createdAt, u.lastSeen, u.passwordHash ?? null, JSON.stringify(u.sessions ?? []), u.credits, u.stats],
    );
  }
}
