import { useEffect } from 'react';
import { useFX, closeBanner } from '../game/core/fx';
import { Icon } from './icons';

export function PhotoOverlay() {
  const p = useFX((s) => s.photo);
  if (!p) return null;
  return (
    <div key={p.id} className="pfx" aria-hidden>
      <div className="pfx-frame" />
      <div className="pfx-shutter top" />
      <div className="pfx-shutter bottom" />
      <div className="pfx-flash" />
      <div className="pfx-polaroid">
        <img src={p.thumb} />
        <div className="kid">{p.label}</div>
      </div>
    </div>
  );
}

export function Banner() {
  const b = useFX((s) => s.banner);
  useEffect(() => {
    if (!b) return;
    const id = setTimeout(closeBanner, 3600);
    return () => clearTimeout(id);
  }, [b?.id]);
  if (!b) return null;
  return (
    <div key={b.id} className="banner" onClick={closeBanner}>
      <div className="banner-rays" />
      <div className="banner-box">
        <div className="banner-stars">
          {Array.from({ length: b.stars }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${0.35 + i * 0.22}s` }}><Icon name="star" size={i === 1 ? 64 : 48} color="#ffd166" /></span>
          ))}
        </div>
        <div className="banner-title">{b.title}</div>
        <div className="banner-sub">{b.sub}</div>
        <div className="banner-tap">click to continue</div>
      </div>
      <div className="dc-confetti">
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i} style={{ left: `${(i * 23) % 100}%`, background: ['#4fd1c5', '#f0a830', '#a78bfa', '#6ee7a0', '#ff7a45', '#ffd166'][i % 6], animationDelay: `${(i % 9) * 0.07}s`, animationDuration: `${1.6 + (i % 5) * 0.25}s` }} />
        ))}
      </div>
    </div>
  );
}
