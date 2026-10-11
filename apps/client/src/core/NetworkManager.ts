// Socket.IO client: persistent identity (token in localStorage), automatic
// reconnect + re-auth, promise-based calls with server acks, latency probe.

import { io, type Socket } from 'socket.io-client';
import type { C2SEvent, C2SPayload, S2CEvents, SelfProfile } from '@derby/shared';
import { useDerby } from './derbyStore';
import { describeError, useApp } from './store';
import { BASE, withBase } from './base';

const TOKEN_KEY = 'derby.token';
const NAME_KEY = 'derby.name';

type Listener<E extends keyof S2CEvents> = S2CEvents[E];

class NetworkManagerImpl {
  socket: Socket | null = null;
  private pingTimer: number | null = null;

  get token() { try { return localStorage.getItem(TOKEN_KEY) ?? undefined; } catch { return undefined; } }
  get savedName() { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } }

  connect(name?: string) {
    if (name) try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
    if (this.socket) { void this.auth(); return; }
    const s = io({ path: `${BASE}socket.io`, transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
    this.socket = s;
    const app = useApp.getState;
    s.on('connect', () => void this.auth());
    s.on('disconnect', () => useApp.setState({ connection: 'offline' }));
    s.io.on('reconnect_attempt', () => useApp.setState({ connection: 'connecting' }));
    s.on('profile:self', (p) => useApp.setState({ profile: p }));
    s.on('notify', (n) => app().toast(n.kind, n.text));
    s.on('pong', (p) => useApp.setState({ latency: Math.round(performance.now() - p.t) }));
    s.on('derby:state', (d) => useDerby.getState().receive(d));
    s.on('derby:chat', (m) => useDerby.getState().pushChat(m));
    this.pingTimer = window.setInterval(() => { if (s.connected) s.emit('ping', { t: performance.now() }); }, 4000);
  }

  private async auth() {
    try {
      const res = await this.call('auth', { token: this.token, name: this.token ? undefined : this.savedName || undefined }) as { token?: string; profile: SelfProfile };
      if (res.token) try { localStorage.setItem(TOKEN_KEY, res.token); } catch { /* ignore */ }
      useApp.setState({ profile: res.profile, connection: 'online' });
    } catch (e) {
      useApp.getState().toast('error', `Sign-in failed: ${(e as Error).message}`);
    }
  }

  /** Emit with acknowledgement; rejects with a readable error. */
  call<E extends C2SEvent>(event: E, payload: C2SPayload<E>, opts: { quiet?: boolean } = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const s = this.socket;
      if (!s || !s.connected) { reject(new Error('offline')); return; }
      const timer = window.setTimeout(() => reject(new Error('timeout')), 10_000);
      s.emit(event, payload, (r: { ok: boolean; data?: unknown; error?: string }) => {
        clearTimeout(timer);
        if (r.ok) resolve(r.data);
        else {
          if (!opts.quiet) useApp.getState().toast('error', describeError(r.error ?? 'error'));
          reject(new Error(r.error));
        }
      });
    });
  }

  on<E extends keyof S2CEvents>(event: E, fn: Listener<E>) {
    this.socket?.on(event as string, fn as never);
    return () => { this.socket?.off(event as string, fn as never); };
  }

  /** Log in / create an account over HTTP; stores the session token for the socket to use. */
  async account(kind: 'login' | 'register', name: string, password: string): Promise<string> {
    const res = await fetch(withBase(`/api/${kind}`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password }) });
    const json = await res.json().catch(() => ({ ok: false, error: 'server_unreachable' }));
    if (!json.ok) throw new Error(json.error ?? 'failed');
    try { localStorage.setItem(TOKEN_KEY, json.data.token); localStorage.setItem(NAME_KEY, json.data.name); } catch { /* private mode */ }
    return json.data.name as string;
  }

  /** End this device's session and drop back to the boot screen. */
  async logout() {
    const token = this.token;
    if (token) await fetch(withBase('/api/logout'), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
    this.forgetIdentity();
  }

  forgetIdentity() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
    this.socket?.disconnect();
    this.socket = null;
    if (this.pingTimer) clearInterval(this.pingTimer);
  }
}

export const NetworkManager = new NetworkManagerImpl();
