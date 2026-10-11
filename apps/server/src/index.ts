// Wasteland Derby server entry point.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { config } from './config.js';
import { createRepository } from './db/index.js';
import { DerbyManager } from './game/DerbyManager.js';
import { ProfileManager } from './game/ProfileManager.js';
import { createRegulars } from './game/TrackRegulars.js';
import { attachSocketServer, createHub } from './net/socketServer.js';

const repo = await createRepository();
const app = express();
app.disable('x-powered-by');
// Behind a reverse proxy (Traefik) in production: trust its X-Forwarded-For for rate limits.
if (config.production) app.set('trust proxy', 1);
app.use(cors({ origin: config.corsOrigin }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.corsOrigin }, maxHttpBufferSize: 1e5, pingInterval: 10_000, pingTimeout: 8_000 });

const hub = createHub(io);
const profiles = new ProfileManager(repo);
const derby = new DerbyManager(hub, profiles, config.derbyFast ? { timing: { betting: 6000, gates: 1500, results: 3000 }, pricingSims: 24 } : {});
const regulars = createRegulars(profiles, config.regulars);
derby.botSource = () => regulars;
derby.start();

attachSocketServer(io, hub, { repo, profiles, derby });

// ------------------------------------------------------------------ HTTP
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: repo.kind, online: hub.sockets.size, race: derby.summary()?.phase ?? null });
});

// ------------------------------------------------------------------ accounts
const authHits = new Map<string, number[]>();
const authLimited = (ip: string) => {
  const now = Date.now();
  const hits = (authHits.get(ip) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  authHits.set(ip, hits);
  return hits.length > 20;
};
const authRoute = (fn: (body: Record<string, unknown>, token: string) => Promise<unknown>) => async (req: express.Request, res: express.Response) => {
  if (authLimited(req.ip ?? 'x')) { res.status(429).json({ ok: false, error: 'rate_limited' }); return; }
  try {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    res.json({ ok: true, data: await fn(req.body ?? {}, token) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error && /^[a-z_]+$/.test(e.message) ? e.message : 'failed' });
  }
};
const str = (v: unknown) => (typeof v === 'string' ? v : '');
app.post('/api/register', express.json({ limit: '4kb' }), authRoute(async (b) => {
  const { user, token } = await profiles.createAccount(str(b.name), str(b.password));
  return { token, name: user.name };
}));
app.post('/api/login', express.json({ limit: '4kb' }), authRoute(async (b) => {
  const { user, token } = await profiles.login(str(b.name), str(b.password));
  return { token, name: user.name };
}));
app.post('/api/logout', express.json({ limit: '4kb' }), authRoute(async (_b, token) => {
  const u = token ? await profiles.findByToken(token) : undefined;
  if (u) await profiles.logout(u, token);
  return null;
}));

// Serve the built client in production (single-process deploy).
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

server.listen(config.port, () => {
  console.log(`[wasteland-derby] server on :${config.port} — db=${repo.kind} devTools=${config.devTools}`);
});

const shutdown = async () => {
  console.log('[wasteland-derby] shutting down');
  derby.dispose();
  io.close();
  await repo.close().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
