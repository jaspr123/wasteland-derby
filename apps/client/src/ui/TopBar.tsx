import { useApp } from '../core/store';
import { Avatar } from './common';

export function TopBar({ back, title }: { back?: () => void; title?: string }) {
  const profile = useApp((s) => s.profile);
  const connection = useApp((s) => s.connection);
  const latency = useApp((s) => s.latency);
  const go = useApp((s) => s.go);
  return (
    <header className="topbar">
      {back && <button className="icon-btn" onClick={back} aria-label="Back">←</button>}
      <div className="brand"><span className="logo">WASTELAND <b>DERBY</b></span><span className="ver">v0.1 · {title ?? 'The Track'}</span></div>
      <div className="grow" />
      <span className="chip" title="Connection">
        <span className={`dot ${connection === 'online' ? 'st-idle' : connection === 'connecting' ? 'st-queued pulse' : 'st-playing'}`} style={connection === 'online' ? { background: 'var(--green)' } : undefined} />
        {connection === 'online' ? `${latency} ms` : connection}
      </span>
      {profile && (
        <button className="row" style={{ background: 'none', border: 'none', cursor: 'pointer', gap: 10 }} onClick={() => go('profile')}>
          <Avatar id={profile.avatar} size={32} />
          <div className="col" style={{ gap: 0, alignItems: 'flex-start' }}>
            <b style={{ fontSize: 15 }}>{profile.name}</b>
            <span className="mono faint" style={{ fontSize: 11 }}><span className="amber">{profile.credits.toLocaleString()} cr</span> · {profile.stats.races} races</span>
          </div>
        </button>
      )}
      <button className="icon-btn" title="Settings" onClick={() => go('settings')}>⚙</button>
    </header>
  );
}
