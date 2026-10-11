// Simulated punters who hang around the track and bet every few races, so the
// bet board and bookings feel alive even when you are the only person online.
// They live in memory only (never persisted, never on the leaderboard).
import { DERBY_START_CREDITS } from '@derby/shared';
import type { UserRecord } from '../db/repository.js';
import { emptyStats, newId, type ProfileManager } from './ProfileManager.js';

const NAMES = ['One-Eyed Sal', 'Gravel Gus', 'Madame Ruin', 'Tick-Tock', 'Lucky Vance', 'Dusty Rhodes', 'The Accountant', 'Big Marge', 'Static', 'Old Bones'];
const AVATARS = ['skull', 'gasmask', 'crown', 'wolf', 'raven', 'bolt', 'flame', 'eye', 'dice', 'horseshoe'];

export function createRegulars(profiles: ProfileManager, count: number): UserRecord[] {
  return NAMES.slice(0, Math.max(0, Math.min(count, NAMES.length))).map((name, i) => {
    const u: UserRecord = {
      id: newId('bot_'), name, avatar: AVATARS[i % AVATARS.length], tokenHash: newId('nologin_'), createdAt: Date.now(), lastSeen: Date.now(),
      isAdmin: false, bot: true, credits: DERBY_START_CREDITS * (0.5 + Math.random()), stats: emptyStats(),
    };
    u.credits = Math.round(u.credits / 10) * 10;
    profiles.register(u);
    return u;
  });
}
