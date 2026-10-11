import type { PunterStats } from '@derby/shared';

export interface UserRecord {
  id: string;
  name: string;
  avatar: string;
  tokenHash: string;
  createdAt: number;
  lastSeen: number;
  isAdmin: boolean;
  /** Simulated track regulars live in memory only and are never persisted. */
  bot: boolean;
  /** Bank balance. */
  credits: number;
  stats: PunterStats;
  /** scrypt$<salt>$<hash> once the player sets a password (guest accounts have none). */
  passwordHash?: string;
  /** Extra session token hashes (one per logged-in device), newest last. */
  sessions?: string[];
}

/**
 * Persistence boundary. Two implementations: PostgreSQL (production) and a
 * JSON file store (zero-setup development). Managers only see this interface.
 */
export interface Repository {
  readonly kind: 'postgres' | 'json';
  init(): Promise<void>;
  close(): Promise<void>;

  getUser(id: string): Promise<UserRecord | undefined>;
  getUserByTokenHash(hash: string): Promise<UserRecord | undefined>;
  getUserByName(name: string): Promise<UserRecord | undefined>;
  saveUser(u: UserRecord): Promise<void>;
  /** Richest punters first. */
  topUsers(limit: number): Promise<UserRecord[]>;
}
