import { useEffect, useState } from 'react';
import { useUI } from '../../game/core/ui';
import { useGame, catStatus, worldProgress } from '../../game/core/store';
import { runtime } from '../../game/player/PlayerController';
import { TOOLS } from '../../game/instruments/earthInstruments';
import { zoneAt } from '../../game/environments/qaidam/qaidamTerrain';
import { EARTH_ZONES } from '../../data/earth/earthData';
import { CATEGORIES } from '../../data/scientific-checklist/categories';
import { RadioFeed, Toasts, StatusChip, useMissionClock, Bar, Rovi } from '../common';
import { totalStars } from '../../game/core/discovery';
import { Icon } from '../icons';
import { keyLabel } from '../../game/core/input';
import { Tablet } from '../journal/Tablet';
import { InspectView } from '../checklist/InspectView';
import { PauseMenu } from '../pause/PauseMenu';
import { nextEarthStep } from '../../game/missions/earthGuide';

function useTick(ms = 200) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function Compass() {
  useTick(80);
  const deg = ((-runtime.yaw * 180) / Math.PI + 360 * 4) % 360; // 0 = north
  const marks = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return (
    <div style={{ width: 360, height: 26, overflow: 'hidden', position: 'relative', borderBottom: '1px solid rgba(255,255,255,.25)' }}>
      {Array.from({ length: 72 }).map((_, i) => {
        const a = i * 15 - 360;
        let d = a - deg;
        while (d < -180) d += 360;
        while (d > 180) d -= 360;
        if (Math.abs(d) > 90) return null;
        const x = 180 + d * 2;
        const isMain = (a + 720) % 45 === 0;
        return (
          <div key={i} style={{ position: 'absolute', left: x, bottom: 0, transform: 'translateX(-50%)', textAlign: 'center' }}>
            {isMain && <div className="mono" style={{ fontSize: 10, color: ((a + 720) % 360) === 0 ? 'var(--amber)' : '#fff' }}>{marks[(((a + 720) % 360) / 45) | 0]}</div>}
            <div style={{ width: 1, height: isMain ? 6 : 3, background: 'rgba(255,255,255,.6)', margin: '0 auto' }} />
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 180, top: 0, width: 2, height: 26, background: 'var(--teal)' }} />
      <div className="mono" style={{ position: 'absolute', right: 0, top: 0, fontSize: 10, color: 'var(--dim)' }}>{Math.round(deg).toString().padStart(3, '0')}°</div>
    </div>
  );
}

function TopBar() {
  useTick(500);
  const clock = useMissionClock();
  const time = useGame((s) => s.earthTime);
  const zid = zoneAt(runtime.pos.x, runtime.pos.z);
  const zone = zid ? EARTH_ZONES[zid] : null;
  return (
    <div className="hud-top">
      <div className="hud-block">
        <div className="big">STAGE 1 · EARTH</div>
        <div className="dim" style={{ marginTop: 4 }}>{time === 'day' ? '☀ Day' : '☾ Night'}</div>
        <div style={{ marginTop: 4 }}>
          <span className="teal">{zone ? zone.label : 'OPEN TERRAIN'}</span> {zone ? `· ${zone.name}` : ''}
        </div>
      </div>
      <Compass />
      <div style={{ width: 260 }} />
    </div>
  );
}

function Objectives() {
  const s = useGame();
  const prog = worldProgress('earth', s);
  return (
    <div className="objective panel" style={{ width: 200 }}>
      <div className="between" style={{ marginBottom: 6 }}>
        <span className="label">Earth {prog.completed}/8</span>
        <span style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="star" size={16} color="#ffd166" />{totalStars(s.stars)}</span>
      </div>
      <Bar v={prog.tasksDone / prog.tasksTotal} />
      <div className="tiny dim" style={{ marginTop: 6 }}><span className="kbd">{keyLabel(s.settings.keys.checklist)}</span> full checklist</div>
    </div>
  );
}

function NextStep() {
  useTick(250);
  useGame((g) => g.earthEvidence);
  const step = nextEarthStep();
  let dist: number | null = null, rel = 0;
  if (step.target) {
    const dx = step.target[0] - runtime.pos.x, dz = step.target[1] - runtime.pos.z;
    dist = Math.hypot(dx, dz);
    const want = Math.atan2(-dx, -dz);
    rel = want - runtime.yaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
  }
  const near = dist !== null && dist < 12;
  return (
    <div className="panel" style={{ position: 'fixed', top: 58, left: '50%', transform: 'translateX(-50%)', padding: '9px 16px', minWidth: 380, maxWidth: 600, display: 'flex', gap: 14, alignItems: 'center', borderTop: '2px solid var(--teal)', borderRadius: 10, pointerEvents: 'none' }}>
      <Rovi />
      {step.target && (
        <div style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          {near ? <span className="teal" style={{ fontSize: 22 }}>◎</span> : (
            <svg width="30" height="30" viewBox="0 0 30 30" style={{ transform: `rotate(${(-rel * 180) / Math.PI}deg)` }}>
              <path d="M15 3 L24 25 L15 19 L6 25 Z" fill="#4fd1c5" />
            </svg>
          )}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div className="mono tiny teal" style={{ letterSpacing: '0.2em' }}>ROVI · NEXT{dist !== null ? ` · ${near ? 'YOU ARE HERE' : Math.round(dist) + ' m'}` : ''}</div>
        <div className="kid" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{step.text}</div>
        <div className="small dim" style={{ marginTop: 1 }}>{step.how}</div>
      </div>
      {dist !== null && dist > 40 && (
        <div className="small" style={{ flex: 'none', textAlign: 'center', borderLeft: '1px solid var(--line)', paddingLeft: 12 }}>
          <span className="kbd" style={{ fontSize: 12 }}>T</span>
          <div className="tiny dim" style={{ marginTop: 3 }}>quick travel</div>
        </div>
      )}
    </div>
  );
}

function Hotbar() {
  useTick(400);
  const want = nextEarthStep().tool;
  const tool = useUI((s) => s.tool);
  const raised = useUI((s) => s.toolRaised);
  return (
    <div className="hotbar">
      {TOOLS.map((t) => (
        <div key={t.id} className={`slot ${tool === t.id ? 'sel' : ''} ${want === t.key && tool !== t.id ? 'pulse-key' : ''}`} style={tool === t.id && raised ? { boxShadow: '0 0 0 1px var(--teal) inset' } : undefined}>
          <span className="k">{t.key}</span>
          <span>{t.short}</span>
        </div>
      ))}
    </div>
  );
}

function ToolOverlay() {
  const tool = useUI((s) => s.tool);
  const raised = useUI((s) => s.toolRaised);
  const busy = useUI((s) => s.scanBusy);
  const time = useGame((s) => s.earthTime);
  const t = TOOLS.find((x) => x.id === tool)!;
  if (!raised) return null;
  return (
    <>
      {tool === 'camera' && <div className="viewfinder"><div className="mono tiny" style={{ position: 'absolute', left: 10, top: 8, color: '#fff' }}>● REC · f/8 · 1/500 · ISO 100</div></div>}
      {tool === 'thermal' && (
        <div className="thermal-bar">
          <span style={{ top: -6 }}>{time === 'day' ? '+63 °C' : '+63 °C'}</span>
          <span style={{ bottom: -6 }}>-22 °C</span>
          <span style={{ top: 120, color: 'var(--violet)' }}>IRONBOW · SIM</span>
        </div>
      )}
      {(tool === 'spectral' || tool === 'thermal') && (
        <div style={{ position: 'fixed', left: '50%', top: '50%', width: 80, height: 80, transform: 'translate(-50%,-50%)', border: '1px solid rgba(255,255,255,.6)', borderRadius: tool === 'spectral' ? '50%' : 0, pointerEvents: 'none' }} />
      )}
      <div className="panel mono small" style={{ position: 'fixed', left: '50%', bottom: 84, transform: 'translateX(-50%)', padding: '5px 12px', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <span className="teal">{t.name.toUpperCase()}</span> · {busy ? <span className="amber blink">ACQUIRING…</span> : <span className="dim">{t.desc}</span>} · <span className="kbd">LMB</span>
      </div>
    </>
  );
}

function Readout() {
  const r = useUI((s) => s.readout);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!r || Date.now() - r.t > 9000) return null;
  return (
    <div className="readout panel">
      <div className="teal" style={{ letterSpacing: '0.12em', marginBottom: 4 }}>{r.title}</div>
      {r.lines.map((l, i) => (
        <div key={i} style={{ color: l.includes('SIMULATED') || l.includes('PRELIMINARY') ? 'var(--violet)' : undefined }}>{l}</div>
      ))}
    </div>
  );
}

export function EarthHUD() {
  const panel = useUI((s) => s.panel);
  const prompt = useUI((s) => s.prompt);
  const locked = useUI((s) => s.locked);
  const keys = useGame((s) => s.settings.keys);
  return (
    <div className="layer" style={{ zIndex: 10 }}>
      <TopBar />
      {!panel && <Objectives />}
      {!panel && <NextStep />}
      {!panel && <div className="crosshair"><div className="dot" /></div>}
      {!panel && prompt && (
        <div className="prompt panel">
          <span className="kbd">{keyLabel(keys.interact)}</span> {prompt}
        </div>
      )}
      {!panel && <ToolOverlay />}
      <Hotbar />
      <Readout />
      <RadioFeed />
      <Toasts />
      {!panel && !locked && !runtime.lockFailed && (
        <div className="panel mono small" style={{ position: 'fixed', left: '50%', top: '64%', transform: 'translateX(-50%)', padding: '10px 16px', pointerEvents: 'none' }}>
          CLICK TO CAPTURE MOUSE (or drag to look) · <span className="kbd">Esc</span> releases the mouse
        </div>
      )}
      {panel === 'tablet' && <Tablet world="earth" />}
      {panel === 'inspect' && <InspectView />}
      {panel === 'pause' && <PauseMenu />}
    </div>
  );
}
