import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..', '..');

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3002),
  production: env.NODE_ENV === 'production',
  /** postgres://user:pass@host:5432/db — when unset, a JSON file store is used. */
  databaseUrl: env.DATABASE_URL ?? '',
  dataDir: env.DATA_DIR ?? path.join(SERVER_ROOT, 'data'),
  clientDist: env.CLIENT_DIST ?? path.join(REPO_ROOT, 'apps', 'client', 'dist'),
  corsOrigin: env.CORS_ORIGIN ?? '*',
  /** Dev tools (admin rights for everyone) — on by default outside production. */
  devTools: env.DEV_TOOLS ? env.DEV_TOOLS === '1' : env.NODE_ENV !== 'production',
  /** Comma-separated usernames that always get admin rights. */
  adminNames: (env.ADMIN_NAMES ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  /** Secret that promotes the signed-in account to admin (Profile -> Admin access). Empty = disabled. */
  adminCode: env.ADMIN_CODE ?? '',
  /** Short race phases + cheap odds pricing (tests). */
  derbyFast: env.DERBY_FAST === '1',
  /** Simulated punters who bet alongside real players (0 disables). */
  regulars: Number(env.REGULARS ?? 6),
};
