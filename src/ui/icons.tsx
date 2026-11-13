// Hand-drawn style SVG icon set (consistent stroke, rounded) used across the UI.
import type { CSSProperties } from 'react';

export type IconName =
  | 'camera' | 'thermo' | 'wheel' | 'arm' | 'spectrum' | 'air' | 'star' | 'battery' | 'home' | 'rover'
  | 'check' | 'photos' | 'compare' | 'report' | 'lock' | 'reverse' | 'flag' | 'pin' | 'crater' | 'sand'
  | 'rock' | 'pit' | 'sparkle' | 'play';

const P: Record<IconName, JSX.Element> = {
  camera: (<><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M8 7l1.6-2.5h4.8L16 7" /><circle cx="12" cy="13.5" r="3.6" /><circle cx="17.6" cy="10" r=".6" fill="currentColor" /></>),
  thermo: (<><path d="M10 4a2 2 0 014 0v9.5a4 4 0 11-4 0z" /><path d="M12 9v7" /><circle cx="12" cy="17" r="1.6" fill="currentColor" /></>),
  wheel: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 4v5.5M12 14.5V20M4 12h5.5M14.5 12H20" /></>),
  arm: (<><path d="M4 20h6" /><path d="M7 20v-5l5-6 5 2" /><circle cx="7" cy="15" r="1.4" /><circle cx="12" cy="9" r="1.4" /><path d="M17 11l2.5 3.5M17 11l3-1.5" /></>),
  spectrum: (<><path d="M3 18a9 9 0 0118 0" /><path d="M6 18a6 6 0 0112 0" /><path d="M9 18a3 3 0 016 0" /></>),
  air: (<><path d="M3 9h11a3 3 0 10-3-3" /><path d="M3 14h15a3 3 0 11-3 3" /><path d="M3 19h6" /></>),
  star: (<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z" fill="currentColor" stroke="none" />),
  battery: (<><rect x="3" y="7" width="16" height="10" rx="2.5" /><path d="M21 10.5v3" /><rect x="5.5" y="9.5" width="8" height="5" rx="1" fill="currentColor" stroke="none" /></>),
  home: (<><path d="M4 11l8-6.5 8 6.5" /><path d="M6.5 9.5V19h11V9.5" /><path d="M10.5 19v-4.5h3V19" /></>),
  rover: (<><rect x="5" y="9" width="14" height="5" rx="1.5" /><path d="M15 9V5.5h3" /><circle cx="7" cy="17.5" r="2" /><circle cx="12" cy="17.5" r="2" /><circle cx="17" cy="17.5" r="2" /></>),
  check: (<path d="M5 12.5l4.5 4.5L19 7.5" />),
  photos: (<><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M3.5 17l5-5 4 4 3-3 5 5" /></>),
  compare: (<><path d="M12 4v16" /><path d="M5 8h14" /><path d="M5 8l-2.5 6a2.8 2.8 0 005 0z" /><path d="M19 8l-2.5 6a2.8 2.8 0 005 0z" /><path d="M8 20h8" /></>),
  report: (<><path d="M6 3.5h8l4 4V20.5H6z" /><path d="M14 3.5v4h4" /><path d="M9 12h6M9 15.5h6" /></>),
  lock: (<><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></>),
  reverse: (<><path d="M11 6l-6 6 6 6" /><path d="M19 6l-6 6 6 6" /></>),
  flag: (<><path d="M6 21V4" /><path d="M6 4.5h11l-2.5 4 2.5 4H6" /></>),
  pin: (<><path d="M12 21s-6-6.2-6-11a6 6 0 0112 0c0 4.8-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>),
  crater: (<><ellipse cx="12" cy="15" rx="9" ry="4.5" /><ellipse cx="12" cy="15" rx="4.5" ry="2" /><path d="M18 6l2-2M16 7l1-3" /></>),
  sand: (<><path d="M3 15c3-3 6 3 9 0s6 3 9 0" /><path d="M3 19c3-3 6 3 9 0s6 3 9 0" /><path d="M3 11c3-3 6 3 9 0s6 3 9 0" /></>),
  rock: (<path d="M4 18l2.5-7 5-4 6 2.5L20 18z" />),
  pit: (<><ellipse cx="12" cy="12" rx="9" ry="5" /><ellipse cx="12" cy="13" rx="5" ry="2.5" fill="currentColor" stroke="none" /></>),
  sparkle: (<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" stroke="none" />),
  play: (<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />),
};

export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', color, ...style }}>
      {P[name]}
    </svg>
  );
}

/** Large illustrated scene art for discovery cards (replaces emoji). */
export function SceneArt({ anim }: { anim: string }) {
  const s = { width: 120, height: 120 } as const;
  switch (anim) {
    case 'salt':
      return (<svg {...s} viewBox="0 0 120 120"><path d="M10 90 L40 70 L70 82 L100 66 L112 88 Z" fill="#f4f1ea" stroke="#cfc6b4" strokeWidth="3" /><path d="M40 70 L44 88 M70 82 L66 96 M100 66 L96 86" stroke="#cfc6b4" strokeWidth="3" /><rect x="50" y="30" width="16" height="16" rx="2" fill="#fff" stroke="#bcd" strokeWidth="2" transform="rotate(20 58 38)" /><rect x="72" y="40" width="10" height="10" rx="1.5" fill="#fff" stroke="#bcd" strokeWidth="2" transform="rotate(-12 77 45)" /></svg>);
    case 'water':
    case 'microbe':
      return (<svg {...s} viewBox="0 0 120 120"><path d="M60 14 C78 40 88 54 88 70 a28 28 0 01-56 0 C32 54 42 40 60 14z" fill="#62c3ff" stroke="#2f8fd1" strokeWidth="3" />{anim === 'microbe' && (<><circle cx="52" cy="72" r="7" fill="#9be38f" stroke="#3e9a4a" strokeWidth="2" /><circle cx="70" cy="62" r="5" fill="#9be38f" stroke="#3e9a4a" strokeWidth="2" /><circle cx="66" cy="82" r="4" fill="#9be38f" stroke="#3e9a4a" strokeWidth="2" /></>)}<path d="M48 58 a14 14 0 0010-14" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>);
    case 'heat':
      return (<svg {...s} viewBox="0 0 120 120"><circle cx="34" cy="34" r="14" fill="#ffd166" /><g stroke="#ffd166" strokeWidth="4" strokeLinecap="round"><path d="M34 8v6M34 54v6M8 34h6M54 34h6M16 16l4 4M48 48l4 4M16 52l4-4M48 20l4-4" /></g><rect x="68" y="20" width="18" height="62" rx="9" fill="#fff" stroke="#556" strokeWidth="3" /><circle cx="77" cy="88" r="14" fill="#ff6b4a" stroke="#556" strokeWidth="3" /><rect x="73" y="44" width="8" height="40" rx="4" fill="#ff6b4a" /></svg>);
    case 'wind':
    case 'sand':
      return (<svg {...s} viewBox="0 0 120 120"><path d="M8 92 Q30 50 60 64 T112 54 L112 104 L8 104Z" fill="#d9a066" stroke="#a8743f" strokeWidth="3" /><g stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none"><path d="M14 30h50a10 10 0 10-10-10" /><path d="M24 46h70a10 10 0 11-10 10" /></g></svg>);
    case 'map':
    case 'radar':
      return (<svg {...s} viewBox="0 0 120 120"><circle cx="60" cy="60" r="44" fill="#123" stroke="#4fd1c5" strokeWidth="3" /><circle cx="60" cy="60" r="28" fill="none" stroke="#4fd1c5" strokeWidth="2" opacity=".6" /><circle cx="60" cy="60" r="12" fill="none" stroke="#4fd1c5" strokeWidth="2" opacity=".6" /><path d="M60 60 L96 36" stroke="#4fd1c5" strokeWidth="4" strokeLinecap="round" /><circle cx="82" cy="70" r="5" fill="#f0a830" /></svg>);
    case 'crater':
      return (<svg {...s} viewBox="0 0 120 120"><ellipse cx="60" cy="80" rx="52" ry="22" fill="#b4643f" stroke="#7a3d22" strokeWidth="3" /><ellipse cx="60" cy="82" rx="28" ry="10" fill="#7a3d22" /><circle cx="92" cy="24" r="10" fill="#8a7a6a" stroke="#555" strokeWidth="3" /><path d="M84 32 L66 52" stroke="#ffb347" strokeWidth="5" strokeLinecap="round" /></svg>);
    case 'arm':
      return (<svg {...s} viewBox="0 0 120 120"><rect x="10" y="84" width="100" height="22" rx="4" fill="#c79c78" stroke="#8d5c40" strokeWidth="3" /><path d="M20 84 L40 40 L80 30" stroke="#dfe5ea" strokeWidth="9" strokeLinecap="round" fill="none" /><rect x="72" y="30" width="20" height="26" rx="4" fill="#fff" stroke="#556" strokeWidth="3" /><path d="M82 56 v22" stroke="#4fd1c5" strokeWidth="4" strokeDasharray="4 4" /></svg>);
    case 'scan':
      return (<svg {...s} viewBox="0 0 120 120"><rect x="16" y="60" width="88" height="40" rx="4" fill="#c79c78" stroke="#8d5c40" strokeWidth="3" />{['#ff5a4e', '#f0a830', '#ffe066', '#6ee7a0', '#4fd1c5', '#a78bfa'].map((c, i) => <rect key={i} x={20 + i * 14} y="20" width="12" height="34" rx="3" fill={c} />)}</svg>);
    case 'air':
      return (<svg {...s} viewBox="0 0 120 120"><circle cx="60" cy="54" r="30" fill="#ffd166" /><g stroke="#ffd166" strokeWidth="5" strokeLinecap="round"><path d="M60 8v10M60 90v10M14 54h10M96 54h10M28 22l7 7M85 79l7 7M28 86l7-7M85 29l7-7" /></g><circle cx="50" cy="50" r="4" fill="#7a4a00" /><circle cx="70" cy="50" r="4" fill="#7a4a00" /><path d="M48 66 q12 8 24 0" stroke="#7a4a00" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>);
    case 'pit':
      return (<svg {...s} viewBox="0 0 120 120"><ellipse cx="60" cy="70" rx="50" ry="24" fill="#b4643f" stroke="#7a3d22" strokeWidth="3" /><ellipse cx="60" cy="72" rx="26" ry="12" fill="#1b0d07" /><text x="60" y="40" textAnchor="middle" fontSize="34" fontWeight="700" fill="#fff" stroke="#556" strokeWidth="1.5">?</text></svg>);
    default:
      return (<svg {...s} viewBox="0 0 120 120"><circle cx="60" cy="60" r="40" fill="#4fd1c5" /></svg>);
  }
}
