// Socket.IO wiring: authentication, schema validation, rate limiting and
// routing of client intents to the managers. Every handler receives an
// already-validated payload and the authenticated user — never raw input.

import crypto from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { C2S, type C2SEvent, type C2SPayload, type LeaderboardRow } from '@derby/shared';
import { config } from '../config.js';
import type { Repository } from '../db/index.js';
import type { UserRecord } from '../db/repository.js';
import type { DerbyManager } from '../game/DerbyManager.js';
import type { Hub } from '../game/hub.js';
import type { ProfileManager } from '../game/ProfileManager.js';
import { bucketsFor } from './rateLimiter.js';

export interface Services {
  repo: Repository;
  profiles: ProfileManager;
  derby: DerbyManager;
}

type AckFn = (res: { ok: boolean; data?: unknown; error?: string }) => void;
type Handler<E extends C2SEvent> = (user: UserRecord, payload: C2SPayload<E>, socket: Socket) => Promise<unknown> | unknown;

export function createHub(io: Server): Hub & { sockets: Map<string, number> } {
  const sockets = new Map<string, number>();
  return {
    sockets,
    emitUser: (userId, event, ...args) => { io.to(`user:${userId}`).emit(event, ...(args as unknown as [])); },
    emitRoom: (room, event, ...args) => { io.to(room).emit(event, ...(args as unknown as [])); },
    emitAll: (event, ...args) => { io.to('authed').emit(event, ...(args as unknown as [])); },
    joinRoom: (userId, room) => { io.in(`user:${userId}`).socketsJoin(room); },
    leaveRoom: (userId, room) => { io.in(`user:${userId}`).socketsLeave(room); },
    isOnline: (userId) => (sockets.get(userId) ?? 0) > 0,
  };
}

export function attachSocketServer(io: Server, hub: ReturnType<typeof createHub>, s: Services) {
  io.on('connection', (socket) => {
    const buckets = bucketsFor();
    let user: UserRecord | null = null;
    const authTimeout = setTimeout(() => { if (!user) socket.disconnect(true); }, 15_000);

    function on<E extends C2SEvent>(event: E, handler: Handler<E>, opts: { auth?: boolean; bucket?: keyof typeof buckets } = {}) {
      socket.on(event as string, async (raw: unknown, ack?: AckFn) => {
        const reply: AckFn = typeof ack === 'function' ? ack : () => {};
        if (!buckets.general.take() || (opts.bucket && !buckets[opts.bucket].take())) return reply({ ok: false, error: 'rate_limited' });
        if (opts.auth !== false && !user) return reply({ ok: false, error: 'not_authenticated' });
        const parsed = C2S[event].safeParse(raw ?? {});
        if (!parsed.success) return reply({ ok: false, error: 'invalid_payload' });
        try {
          const data = await handler(user!, parsed.data as C2SPayload<E>, socket);
          reply({ ok: true, data });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!/^[a-z_:\w.-]+$/i.test(msg)) console.error(`[${event}]`, e);
          reply({ ok: false, error: msg.length > 120 ? 'server_error' : msg });
        }
      });
    }

    // ------------------------------------------------------------ session
    on('auth', async (_u, p) => {
      if (user) return { profile: s.profiles.self(user) };
      const res = await s.profiles.authenticate(p.token, p.name);
      user = res.user;
      clearTimeout(authTimeout);
      socket.join(`user:${user.id}`);
      socket.join('authed');
      hub.sockets.set(user.id, (hub.sockets.get(user.id) ?? 0) + 1);
      return { token: res.token, profile: s.profiles.self(user) };
    }, { auth: false });

    on('profile:update', async (u, p) => {
      if (p.name) await s.profiles.rename(u, p.name);
      if (p.avatar) { u.avatar = p.avatar; await s.profiles.save(u); }
      return s.profiles.self(u);
    });
    on('account:claim-admin', async (u, p) => {
      const want = Buffer.from(config.adminCode), got = Buffer.from(p.code);
      if (!config.adminCode || want.length !== got.length || !crypto.timingSafeEqual(want, got)) throw new Error('bad_admin_code');
      u.isAdmin = true;
      await s.profiles.save(u);
      return s.profiles.self(u);
    }, { bucket: 'chat' });
    on('account:password', async (u, p) => {
      await s.profiles.setPassword(u, p.password, p.current);
      return s.profiles.self(u);
    }, { bucket: 'chat' });
    on('leaderboard:get', async (): Promise<LeaderboardRow[]> => (await s.repo.topUsers(25)).map((u) => ({
      id: u.id, name: u.name, avatar: u.avatar, credits: u.credits, peakBank: u.stats.peakBank, biggestWin: u.stats.biggestWin, races: u.stats.races,
    })));

    // ------------------------------------------------------------ the track
    on('derby:watch', (u, p) => s.derby.watch(u, p.on));
    on('derby:bet', (u, p) => s.derby.bet(u, p), { bucket: 'game' });
    on('derby:cancel', (u, p) => s.derby.cancel(u, p), { bucket: 'game' });
    on('derby:upgrade', (u, p) => s.derby.upgrade(u, p), { bucket: 'game' });
    on('derby:chat', (u, p) => s.derby.chat(u, p.text), { bucket: 'chat' });

    on('ping', (_u, p) => { socket.emit('pong', { t: p.t, serverNow: Date.now() }); }, { auth: false });

    socket.on('disconnect', () => {
      clearTimeout(authTimeout);
      if (!user) return;
      const id = user.id;
      const n = (hub.sockets.get(id) ?? 1) - 1;
      if (n > 0) { hub.sockets.set(id, n); return; }
      hub.sockets.delete(id);
      s.derby.watch(user, false);
    });
  });
}
