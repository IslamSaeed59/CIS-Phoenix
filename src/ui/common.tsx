import { useEffect, useState } from 'react';
import { useUI } from '../game/core/ui';
import type { Status } from '../data/scientific-checklist/categories';
import { useGame } from '../game/core/store';

export function RadioFeed({ style }: { style?: React.CSSProperties }) {
  const radio = useUI((s) => s.radio);
  const subs = useGame((s) => s.settings.subtitles);
  if (!subs) return null;
  return (
    <div className="radio-box" style={style}>
      {radio.map((m) => (
        <div key={m.id} className={`radio-msg panel ${m.level}`}>
          <div className="from" style={{ color: m.level === 'alert' ? 'var(--red)' : m.level === 'warn' ? 'var(--amber)' : 'var(--teal)' }}>{m.from}</div>
          <Typewriter text={m.text} />
        </div>
      ))}
    </div>
  );
}

export function Typewriter({ text, speed = 22 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((x) => (x >= text.length ? (clearInterval(id), x) : x + 2)), speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span>{text.slice(0, n)}</span>;
}

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast panel ${t.kind}`}>
          <div className="t" style={{ color: t.kind === 'evidence' ? 'var(--green)' : t.kind === 'warn' ? 'var(--amber)' : 'var(--teal)' }}>{t.title}</div>
          {t.text && <div style={{ lineHeight: 1.45 }}>{t.text}</div>}
        </div>
      ))}
    </div>
  );
}

export function FadeLayer() {
  const fade = useUI((s) => s.fade);
  return <div className="fade-layer" style={{ opacity: fade }} />;
}

export function StatusChip({ s }: { s: Status }) {
  return <span className={`status st-${s.split(' ')[0]}`}>{s}</span>;
}

export function Bar({ v, color }: { v: number; color?: string }) {
  return (
    <div className="progress">
      <div style={{ width: `${Math.max(0, Math.min(100, v * 100))}%`, background: color }} />
    </div>
  );
}

export function fmtTime(t: number) {
  const d = new Date(t);
  return d.toTimeString().slice(0, 8);
}

/** Mission clock in the fictional 2077 frame. */
export function useMissionClock() {
  const start = useGame((s) => s.missionStart);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const el = Math.max(0, now - start);
  const h = Math.floor(el / 3600000), m = Math.floor((el % 3600000) / 60000), s = Math.floor((el % 60000) / 1000);
  return `T+${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
