import { create } from 'zustand';
import type { SelfProfile } from '@derby/shared';

export type Screen = 'boot' | 'track' | 'profile' | 'settings';

export interface Toast { id: number; kind: 'info' | 'warn' | 'error' | 'success'; text: string }

interface AppState {
  screen: Screen;
  /** Where "back" goes from sub-screens. */
  previous: Screen;
  connection: 'connecting' | 'online' | 'offline';
  latency: number;
  profile: SelfProfile | null;
  toasts: Toast[];
  go(screen: Screen): void;
  toast(kind: Toast['kind'], text: string): void;
  dismiss(id: number): void;
}

let toastId = 0;

export const useApp = create<AppState>((set, get) => ({
  screen: 'boot',
  previous: 'track',
  connection: 'connecting',
  latency: 0,
  profile: null,
  toasts: [],
  go: (screen) => set({ previous: get().screen, screen }),
  toast: (kind, text) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-4), { id, kind, text }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Human-readable messages for server error codes. */
export function describeError(code: string): string {
  const map: Record<string, string> = {
    rate_limited: 'Slow down.', name_taken: 'That callsign is taken.', not_authenticated: 'Not signed in yet.',
    bad_admin_code: 'That admin code is not right.',
    bad_credentials: 'Wrong callsign or password.', too_many_attempts: 'Too many attempts — try again in 10 minutes.', weak_password: 'Password must be at least 8 characters.',
    wrong_password: 'Current password is incorrect.', bad_name: 'Callsigns are 2–20 letters, numbers, spaces, dots or dashes.', server_unreachable: 'Cannot reach the server.',
    not_trackside: 'Go track-side first.',
    insufficient_credits: 'Not enough credits in your bank.', betting_closed: 'Betting has closed for this race.', race_closed: 'That race is over.',
    back_the_horse_first: 'Back the horse with a bet before paying for upgrades.', already_bought: 'You already bought that for this horse.',
    upgrade_limit: 'Four back-room deals per race, max.', bad_stake: 'Stake is outside the track limits.', too_many_bets: 'Twelve bets per race, max.',
  };
  const key = code.split(':')[0];
  return map[key] ?? code.replace(/_/g, ' ');
}
