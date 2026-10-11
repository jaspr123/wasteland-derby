import { useEffect, useState, type ReactNode } from 'react';
import { AudioManager } from '../core/AudioManager';

export const AVATAR_GLYPHS: Record<string, string> = { skull: '☠', gasmask: '⛑', gear: '⚙', crown: '♛', wolf: '🐺', raven: '🜲', bolt: '⚡', flame: '🔥', eye: '◉', helm: '⛨', horseshoe: 'Ω', dice: '⚄' };

export function Avatar({ id, size = 34 }: { id?: string; size?: number }) {
  return <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.5 }}>{AVATAR_GLYPHS[id ?? 'skull'] ?? '☠'}</div>;
}

export function Panel({ title, right, children, className = '', style, bodyClass = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties; bodyClass?: string }) {
  return (
    <section className={`panel ${className}`} style={style}>
      {title !== undefined && (
        <div className="panel-head">
          <h3>{title}</h3>
          {right}
        </div>
      )}
      <div className={`panel-body ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: 'small' | 'big'; block?: boolean }) {
  const { variant = '', size, block, className = '', onClick, onMouseEnter, ...rest } = props;
  return (
    <button
      {...rest}
      className={`btn ${variant} ${size ?? ''} ${block ? 'block' : ''} ${className}`}
      onMouseEnter={(e) => { AudioManager.play('ui_hover'); onMouseEnter?.(e); }}
      onClick={(e) => { AudioManager.unlock(); AudioManager.play('ui_click'); onClick?.(e); }}
    />
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode; disabled?: boolean }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} disabled={o.disabled} onClick={() => { AudioManager.play('ui_click'); onChange(o.value); }}>{o.label}</button>
      ))}
    </div>
  );
}

export function formatClock(ms: number) {
  if (!Number.isFinite(ms)) return '∞';
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000), s = Math.floor((t % 60000) / 1000);
  if (t < 10_000) return `${s}.${Math.floor((t % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function useNow(intervalMs = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}

export function Modal({ title, onClose, children, width }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="panel modal" style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}>
        <div className="panel-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="panel-body">{children}</div>
      </section>
    </div>
  );
}
