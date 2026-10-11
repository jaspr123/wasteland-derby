-- Wasteland Derby — PostgreSQL schema. Idempotent: safe to run repeatedly.
-- Run with: npm run db:migrate -w @derby/server   (requires DATABASE_URL)

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  avatar        TEXT NOT NULL DEFAULT 'horseshoe',
  token_hash    TEXT NOT NULL UNIQUE,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  password_hash TEXT,
  sessions      JSONB NOT NULL DEFAULT '[]',
  credits       INTEGER NOT NULL DEFAULT 5000,
  stats         JSONB NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS users_name_lower ON users (lower(name));
CREATE INDEX IF NOT EXISTS users_credits ON users (credits DESC);
