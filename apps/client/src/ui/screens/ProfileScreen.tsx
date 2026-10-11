// Punter profile: bank, betting record, the richest punters on the track, and
// account security (password, log out).

import { useEffect, useState } from 'react';
import type { LeaderboardRow } from '@derby/shared';
import { NetworkManager } from '../../core/NetworkManager';
import { useApp } from '../../core/store';
import { AVATAR_GLYPHS, Avatar, Btn, Panel } from '../common';
import { TopBar } from '../TopBar';

export function ProfileScreen() {
  const profile = useApp((s) => s.profile);
  const previous = useApp((s) => s.previous);
  const go = useApp((s) => s.go);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  useEffect(() => { void NetworkManager.call('leaderboard:get', {}, { quiet: true }).then((r) => setBoard(r as LeaderboardRow[])).catch(() => {}); }, []);
  const back = () => go(previous === 'profile' || previous === 'boot' ? 'track' : previous);
  if (!profile) return <div className="screen"><TopBar back={back} title="Profile" /></div>;
  const s = profile.stats;
  const hitRate = s.betsPlaced ? Math.round((s.betsWon / s.betsPlaced) * 100) : 0;
  const stat = (label: string, value: string | number, cls = '') => (
    <div className="col" style={{ gap: 2 }}>
      <span className="eyebrow">{label}</span>
      <b className={`mono ${cls}`} style={{ fontSize: 22 }}>{value}</b>
    </div>
  );

  return (
    <div className="screen">
      <TopBar back={back} title="Profile" />
      <div className="scroll" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignContent: 'start' }}>
        <div className="col" style={{ gap: 16 }}>
          <Panel title="Punter">
            <div className="row" style={{ gap: 14 }}>
              <Avatar id={profile.avatar} size={56} />
              <div className="col" style={{ gap: 2 }}>
                <h2 style={{ margin: 0 }}>{profile.name}</h2>
                <span className="mono amber" style={{ fontSize: 18 }}>{profile.credits.toLocaleString()} cr in the bank</span>
              </div>
            </div>
            <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
              {Object.entries(AVATAR_GLYPHS).map(([id, g]) => (
                <button key={id} className={`icon-btn ${profile.avatar === id ? 'on' : ''}`} title={id}
                  onClick={() => void NetworkManager.call('profile:update', { avatar: id }).then((p) => useApp.setState({ profile: p as never })).catch(() => {})}>{g}</button>
              ))}
            </div>
          </Panel>
          <Panel title="Track record">
            <div className="grid3" style={{ rowGap: 14 }}>
              {stat('Races', s.races)}
              {stat('Bets', s.betsPlaced)}
              {stat('Hit rate', `${hitRate}%`)}
              {stat('Total won', s.totalWon.toLocaleString(), 'green')}
              {stat('Biggest win', s.biggestWin.toLocaleString(), 'amber')}
              {stat('Peak bank', s.peakBank.toLocaleString())}
            </div>
          </Panel>
          <AccountPanel hasPassword={profile.hasPassword} />
        </div>
        <Panel title="Richest punters" right={<span className="faint mono" style={{ fontSize: 11 }}>by bank</span>}>
          {!board.length ? <div className="empty">Nobody has finished a race yet.</div> : (
            <div className="col" style={{ gap: 4 }}>
              {board.map((r, i) => (
                <div key={r.id} className="list-item" style={{ display: 'grid', gridTemplateColumns: '28px 32px 1fr auto', gap: 10, alignItems: 'center', padding: '6px 8px', border: r.id === profile.id ? '1px solid var(--cyan)' : undefined }}>
                  <b className="mono faint">{i + 1}</b>
                  <Avatar id={r.avatar} size={28} />
                  <div className="col" style={{ gap: 0, minWidth: 0 }}>
                    <b className="truncate">{r.name}</b>
                    <span className="faint" style={{ fontSize: 11 }}>{r.races} races · best win {r.biggestWin.toLocaleString()}</span>
                  </div>
                  <b className="mono amber">{r.credits.toLocaleString()}</b>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Protect a guest identity with a password (or change it), and log out of this device. */
function AccountPanel({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const p = await NetworkManager.call('account:password', { password: pw, current: hasPassword ? current : undefined });
      useApp.setState({ profile: p as never });
      useApp.getState().toast('success', hasPassword ? 'Password changed.' : 'Account secured. Log in with your callsign and password on any device.');
      setPw(''); setCurrent('');
    } catch { /* toast shown */ } finally { setBusy(false); }
  };
  return (
    <Panel title="Account" right={<span className={`chip ${hasPassword ? 'green' : 'amber'}`}>{hasPassword ? 'secured' : 'guest'}</span>}>
      <div className="col" style={{ gap: 8 }}>
        {!hasPassword && <div className="faint" style={{ fontSize: 12 }}>This guest identity only lives on this device. Set a password to log in anywhere and keep your bank.</div>}
        <div className="row wrap" style={{ gap: 6 }}>
          {hasPassword && <input className="input" type="password" placeholder="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} style={{ flex: 1, minWidth: 140 }} />}
          <input className="input" type="password" placeholder={hasPassword ? 'New password' : 'Password (8+ characters)'} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <Btn size="small" variant="primary" disabled={busy || pw.length < 8 || (hasPassword && !current)} onClick={() => void save()}>{hasPassword ? 'Change' : 'Secure account'}</Btn>
        </div>
        <div><Btn size="small" variant="ghost" onClick={() => { void NetworkManager.logout().then(() => location.reload()); }}>Log out of this device</Btn></div>
      </div>
    </Panel>
  );
}
