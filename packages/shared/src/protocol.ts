// Network protocol. Every client -> server payload has a zod schema that the
// server validates before touching state. Server -> client payloads are plain
// typed objects.

import { z } from 'zod';
import type { DerbyState } from './derby/data.js';

const id = z.string().min(1).max(64);
const callsign = z.string().min(2).max(20).regex(/^[\w\- .]+$/);

export const C2S = {
  auth: z.object({ token: z.string().max(128).optional(), name: callsign.optional() }),
  'profile:update': z.object({ name: callsign.optional(), avatar: z.string().max(32).optional() }),
  'account:password': z.object({ password: z.string().min(8).max(128), current: z.string().max(128).optional() }),
  'account:claim-admin': z.object({ code: z.string().min(8).max(128) }),
  'leaderboard:get': z.object({}),
  'derby:watch': z.object({ on: z.boolean() }),
  'derby:chat': z.object({ text: z.string().min(1).max(200) }),
  'derby:bet': z.object({ raceId: id, runnerId: id, kind: z.enum(['win', 'place', 'show']), stake: z.number().int().min(1).max(100_000) }),
  'derby:cancel': z.object({ raceId: id, betId: id }),
  'derby:upgrade': z.object({ raceId: id, runnerId: id, upgradeId: z.enum(['nitro_oats', 'plated_barding', 'iron_lungs', 'spiked_shoes', 'scattergun', 'smoke_bombs', 'grapple_hook', 'field_medic', 'trick_rider']) }),
  ping: z.object({ t: z.number() }),
} as const;

export type C2SEvent = keyof typeof C2S;
export type C2SPayload<E extends C2SEvent> = z.infer<(typeof C2S)[E]>;

// ------------------------------------------------------------------ server -> client

/** A punter's track record (all races, all time). */
export interface PunterStats {
  races: number;
  betsPlaced: number;
  betsWon: number;
  /** Total credits returned by winning bets. */
  totalWon: number;
  /** Largest single payout. */
  biggestWin: number;
  /** Highest bank balance ever held. */
  peakBank: number;
}

export interface SelfProfile {
  id: string;
  name: string;
  avatar: string;
  stats: PunterStats;
  isAdmin: boolean;
  credits: number;
  /** True once the account is protected by a password (can log in elsewhere). */
  hasPassword: boolean;
}

export interface LeaderboardRow { id: string; name: string; avatar: string; credits: number; peakBank: number; biggestWin: number; races: number }

export interface S2CEvents {
  'profile:self': (p: SelfProfile) => void;
  notify: (n: { kind: 'info' | 'warn' | 'error' | 'success'; text: string }) => void;
  pong: (p: { t: number; serverNow: number }) => void;
  'derby:state': (s: DerbyState) => void;
  'derby:chat': (m: { from: string; name: string; text: string; at: number }) => void;
}

export type Ack<T = unknown> = (res: { ok: true; data?: T } | { ok: false; error: string }) => void;
