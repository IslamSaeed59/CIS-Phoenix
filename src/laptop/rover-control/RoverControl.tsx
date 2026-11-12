import { useEffect, useRef, useState } from 'react';
import { RoverFeedCanvas, feedState } from '../../game/camera/RoverFeed';
import { rover, useRover, CAMS, instruments, telemetryLine, headingDeg, isDay, type CamId } from '../../game/rover/roverSim';
import { useGame, worldProgress } from '../../game/core/store';
import { marsZoneName } from '../../game/environments/mars/marsTerrain';
import { MARS_POIS } from '../../data/mars/marsData';
import { audio } from '../../game/core/audio';
import { keyLabel } from '../../game/core/input';
import { nextMarsStep } from '../../game/missions/marsGuide';

function Noise() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0, f = 0;
    const draw = () => {
      f++;
      if (f % 2 === 0) {
        const img = ctx.createImageData(c.width, c.height);
        const amt = 18 + rover.storm * 40 + (1 - rover.commQuality) * 30;
        for (let i = 0; i < img.data.length; i += 4) {
          const v = 128 + (Math.random() - 0.5) * amt * 2;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 22 + rover.storm * 30;
        }
        ctx.putImageData(img, 0, 0);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={320} height={180} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'overlay', pointerEvents: 'none', imageRendering: 'pixelated' }} />;
}

function MarsNext() {
  const step = nextMarsStep();
  let dist: number | null = null, rel = 0;
  if (step.target) {
    const dx = step.target[0] - rover.x, dz = step.target[1] - rover.z;
    dist = Math.hypot(dx, dz);
    const facing = rover.heading + (rover.cam === 'NAVCAM' || rover.cam === 'MASTCAM' ? rover.camYaw : rover.cam === 'HAZ-R' ? Math.PI : 0);
    rel = Math.atan2(-dx, -dz) - facing;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
  }
  return (
    <div className="panel" style={{ position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', padding: '7px 14px', display: 'flex', gap: 12, alignItems: 'center', borderTop: '2px solid var(--teal)', pointerEvents: 'none', maxWidth: '80%' }}>
      {step.target && (
        <svg width="24" height="24" viewBox="0 0 30 30" style={{ transform: `rotate(${(-rel * 180) / Math.PI}deg)`, flex: 'none' }}>
          <path d="M15 3 L24 25 L15 19 L6 25 Z" fill="#4fd1c5" />
        </svg>
      )}
      <div>
        <div className="mono tiny teal" style={{ letterSpacing: '0.2em' }}>NEXT{dist !== null ? ` · ${Math.round(dist)} m` : ''}</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{step.text}</div>
        {step.how && <div className="tiny dim">{step.how}</div>}
      </div>
    </div>
  );
}

function Gauge({ label, v, unit, warn, crit, max = 100 }: { label: string; v: number; unit: string; warn?: number; crit?: number; max?: number }) {
  const col = crit !== undefined && v <= crit ? 'var(--red)' : warn !== undefined && v <= warn ? 'var(--amber)' : 'var(--teal)';
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="between mono tiny"><span className="dim">{label}</span><span style={{ color: col }}>{v.toFixed(0)}{unit}</span></div>
      <div className="progress"><div style={{ width: `${Math.max(0, Math.min(1, v / max)) * 100}%`, background: col }} /></div>
    </div>
  );
}

export function RoverControl({ active, onOpen }: { active: boolean; onOpen: (app: string) => void }) {
  useRover((s) => s.snap);
  const g = useGame();
  const [dragging, setDragging] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const [exposure, setExposure] = useState(0);
  const [blur, setBlur] = useState(0);
  const [tx, setTx] = useState(0);
  const mp = worldProgress('mars', g);

  useEffect(() => { rover.inputEnabled = active; return () => { rover.inputEnabled = false; }; }, [active]);
  useEffect(() => { feedState.exposure = exposure; }, [exposure]);

  // keyboard: camera switch, capture, diagnostics
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const keys = useGame.getState().settings.keys;
      if (e.code === keys.camera) { cycleCam(); }
      if (e.code === 'KeyP') instruments.capture();
      if (e.code === keys.diagnostics) onOpen('telemetry');
      if (e.code === 'KeyT') { rover.thermalView = !rover.thermalView; audio.ui('click'); }
      if (e.code === keys.interact) instruments.capture();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const cycleCam = () => {
    const i = CAMS.findIndex((c) => c.id === rover.cam);
    setCam(CAMS[(i + 1) % CAMS.length].id);
  };
  const setCam = (id: CamId) => {
    rover.cam = id;
    audio.servo(0.2);
    refocus();
    useRover.setState({ snap: performance.now() });
  };
  const refocus = () => {
    let k = 1;
    const id = setInterval(() => { k -= 0.12; setBlur(Math.max(0, k * 3)); if (k <= 0) clearInterval(id); }, 40);
  };
  const onMouseDown = (e: React.MouseEvent) => { if (e.button === 0) setDragging(true); };
  useEffect(() => {
    const up = () => setDragging(false);
    const move = (e: MouseEvent) => {
      if (!dragging) return;
      if (rover.cam !== 'NAVCAM' && rover.cam !== 'MASTCAM') return;
      const k = rover.cam === 'MASTCAM' ? 0.003 / rover.zoom : 0.004;
      rover.camYaw = Math.max(-2.6, Math.min(2.6, rover.camYaw - e.movementX * k));
      rover.camPitch = Math.max(-1.1, Math.min(0.6, rover.camPitch - e.movementY * k));
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) audio.setLoop('rover', { speed: 0.05 });
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', move);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('mousemove', move); };
  }, [dragging]);
  const onWheel = (e: React.WheelEvent) => {
    if (rover.cam !== 'MASTCAM') return;
    rover.zoom = Math.max(1, Math.min(8, rover.zoom * (e.deltaY < 0 ? 1.15 : 0.87)));
    refocus();
  };
  useEffect(() => {
    const id = setInterval(() => setTx(rover.queue.length), 120);
    return () => clearInterval(id);
  }, []);

  const camInfo = CAMS.find((c) => c.id === rover.cam)!;
  // nearest target distance
  const nearest = MARS_POIS.map((p) => ({ p, d: Math.hypot(p.pos[0] - rover.x, p.pos[1] - rover.z) })).sort((a, b) => a.d - b.d)[0];
  const wp = rover.waypoints[rover.wpIndex];
  const distTarget = wp ? Math.hypot(wp[0] - rover.x, wp[1] - rover.z) : nearest.d;
  const faults = rover.wheels.filter((w) => w.fault);
  const onboard = g.photos.filter((p) => p.world === 'mars' && p.onboard).length;
  const cmdState = rover.cmdLog[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '190px minmax(0, 1fr) 210px', gridTemplateRows: 'minmax(0, 1fr) 96px', height: '100%', gap: 0, background: '#06080a' }}>
      {/* LEFT: rover status */}
      <div className="scroll" style={{ gridColumn: 1, gridRow: '1 / 3', borderRight: '1px solid var(--line)', padding: 10 }}>
        <div className="label" style={{ marginBottom: 8 }}>Rover status</div>
        <div className="mono small" style={{ marginBottom: 8 }}>
          MODE <span style={{ color: rover.mode === 'SAFE' || rover.mode === 'FAULT' ? 'var(--red)' : rover.mode === 'AUTONAV' ? 'var(--amber)' : 'var(--teal)' }}>{rover.mode}</span>
        </div>
        <Gauge label="BATTERY" v={rover.battery} unit="%" warn={25} crit={12} />
        <Gauge label="SOLAR INPUT" v={rover.solar * 100} unit="%" />
        <Gauge label="PANEL DUST LOSS" v={rover.dust * 100} unit="%" max={70} />
        <div className="between mono tiny" style={{ margin: '4px 0' }}><span className="dim">MOTOR TEMP</span><span>{rover.motorTemp.toFixed(0)} °C</span></div>
        <div className="between mono tiny" style={{ margin: '4px 0' }}><span className="dim">INTERNAL</span><span>{rover.internalTemp.toFixed(0)} °C</span></div>
        <div className="between mono tiny" style={{ margin: '4px 0' }}><span className="dim">SLIP</span><span style={{ color: rover.slip > 0.5 ? 'var(--amber)' : undefined }}>{(rover.slip * 100).toFixed(0)}%</span></div>
        <div className="label" style={{ margin: '10px 0 6px' }}>Wheels</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {[0, 3, 1, 4, 2, 5].map((i) => {
            const w = rover.wheels[i];
            return (
              <div key={w.id} className="mono tiny" style={{ border: `1px solid ${w.fault ? 'var(--red)' : w.health < 0.9 ? 'var(--amber)' : 'var(--line2)'}`, padding: '4px 5px', color: w.fault ? 'var(--red)' : 'var(--text)' }}>
                {w.id} {w.fault ? 'FAULT' : `${(w.health * 100).toFixed(0)}%`}
                <div className="dim">{w.current.toFixed(1)}A</div>
              </div>
            );
          })}
        </div>
        {rover.stuck && <div className="small red" style={{ marginTop: 8 }}>WHEELS EMBEDDED — reverse slowly (Shift+S) or run Recovery.</div>}
        {faults.length > 0 && <div className="small red" style={{ marginTop: 8 }}>{rover.faultMsg}</div>}
        <button className="btn sm" style={{ width: '100%', marginTop: 10 }} onClick={() => onOpen('telemetry')}>Diagnostics [{keyLabel(g.settings.keys.diagnostics)}]</button>
      </div>

      {/* CENTER: camera feed */}
      <div
        ref={feedRef}
        style={{ gridColumn: 2, gridRow: 1, position: 'relative', overflow: 'hidden', cursor: dragging ? 'grabbing' : rover.cam === 'NAVCAM' || rover.cam === 'MASTCAM' ? 'grab' : 'default', background: '#000' }}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
      >
        <div style={{ position: 'absolute', inset: 0, filter: `blur(${blur + rover.storm * 0.8}px) contrast(${1.05 - rover.storm * 0.2}) saturate(${rover.thermalView ? 1 : 0.92})` }}>
          <RoverFeedCanvas />
        </div>
        <Noise />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55))' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, height: 60, background: 'linear-gradient(transparent, rgba(255,255,255,.04), transparent)', animation: 'scanline 5s linear infinite', pointerEvents: 'none' }} />
        {feedState.cine > 0 && (
          <div className="mono small" style={{ position: 'absolute', left: 16, bottom: 16, color: '#fff', textShadow: '0 1px 3px #000' }}>
            RECONSTRUCTED VISUALISATION FROM TELEMETRY · ESTABLISHING VIEW
          </div>
        )}
        {/* HUD top */}
        <div className="mono tiny" style={{ position: 'absolute', top: 8, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', color: '#e8f4f4', textShadow: '0 1px 2px #000', pointerEvents: 'none' }}>
          <span>{telemetryLine()} · PD-2077 · ARES-6</span>
          <span>POS {rover.x.toFixed(1)}E {(-rover.z).toFixed(1)}N (EST.) · HDG {headingDeg().toFixed(0).padStart(3, '0')}°</span>
          <span style={{ color: rover.commQuality < 0.7 ? 'var(--amber)' : 'var(--green)' }}>LINK {(rover.commQuality * 100).toFixed(0)}% · OWLT {(rover.training ? 0.2 : rover.latency + (rover.stormPhase === 'active' ? 1.2 : 0)).toFixed(1)}s*</span>
        </div>
        {/* Center reticle */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <path d="M40 28 V36 M40 44 V52 M28 40 H36 M44 40 H52" stroke="rgba(255,255,255,.8)" strokeWidth="1.2" />
            <rect x="20" y="20" width="40" height="40" fill="none" stroke="rgba(79,209,197,.35)" />
          </svg>
        </div>
        {feedState.cine <= 0 && <MarsNext />}
        {rover.hazard && <div className="mono small" style={{ position: 'absolute', top: 96, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,90,78,.2)', border: '1px solid var(--red)', padding: '3px 10px', color: '#ffd3cf' }} >⚠ HAZARD AHEAD · {rover.hazard}</div>}
        {!isDay() && <div className="mono small" style={{ position: 'absolute', top: 36, right: 12, color: 'var(--amber)' }}>NIGHT OPS · DRIVE SUSPENDED</div>}
        {rover.thermalView && (
          <div className="thermal-bar" style={{ position: 'absolute', right: 18, height: 200 }}>
            <span style={{ top: -6 }}>+20 °C</span>
            <span style={{ bottom: -6 }}>-105 °C</span>
          </div>
        )}
        {/* HUD bottom-left camera info */}
        <div className="mono tiny" style={{ position: 'absolute', left: 10, bottom: 8, color: '#e8f4f4', textShadow: '0 1px 2px #000', pointerEvents: 'none', lineHeight: 1.6 }}>
          <div>{camInfo.id} · {camInfo.name.toUpperCase()}</div>
          <div className="dim">FOV {rover.camFov.toFixed(0)}° {rover.cam === 'MASTCAM' ? `· ZOOM ${rover.zoom.toFixed(1)}×` : ''} · PAN {((rover.camYaw * 180) / Math.PI).toFixed(0)}° TILT {((rover.camPitch * 180) / Math.PI).toFixed(0)}°</div>
        </div>
        <div className="mono tiny" style={{ position: 'absolute', right: 10, bottom: 8, color: '#e8f4f4', textShadow: '0 1px 2px #000', pointerEvents: 'none' }}>
          {rover.busy ? <span className="amber blink">{rover.busy}</span> : 'INSTRUMENTS IDLE'}
        </div>
      </div>

      {/* RIGHT: camera & instruments */}
      <div className="scroll" style={{ gridColumn: 3, gridRow: '1 / 3', borderLeft: '1px solid var(--line)', padding: 10 }}>
        <div className="label" style={{ marginBottom: 6 }}>Cameras [{keyLabel(g.settings.keys.camera)}]</div>
        <div className="col" style={{ gap: 4 }}>
          {CAMS.map((c) => (
            <button key={c.id} className={`btn sm ${rover.cam === c.id ? 'active' : ''}`} style={{ textAlign: 'left' }} onClick={() => setCam(c.id)} title={c.desc}>{c.id}</button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn sm primary" style={{ flex: 1 }} onClick={() => instruments.capture()}>Capture [P]</button>
        </div>
        <div className="tiny mono dim" style={{ marginTop: 4 }}>STORAGE {onboard}/{rover.storageCap} onboard</div>
        <div className="label" style={{ margin: '10px 0 4px' }}>Exposure</div>
        <input type="range" min={-1} max={1} step={0.05} value={exposure} onChange={(e) => setExposure(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#4fd1c5' }} />
        {rover.cam === 'MASTCAM' && <button className="btn sm" style={{ width: '100%', marginTop: 4 }} onClick={refocus}>Autofocus</button>}
        <div className="label" style={{ margin: '10px 0 6px' }}>Quick instruments</div>
        <div className="col" style={{ gap: 4 }}>
          <button className={`btn sm ${rover.thermalView ? 'active' : ''}`} onClick={() => { rover.thermalView = !rover.thermalView; }}>Thermal view [T]</button>
          <button className="btn sm" onClick={() => instruments.thermal()}>TIR reading (aimed)</button>
          <button className="btn sm" onClick={() => instruments.multispec()}>Multispectral (Mastcam)</button>
          <button className="btn sm" onClick={() => instruments.spectro()}>Arm spectrometer</button>
          <button className={`btn sm ${rover.gprOn ? 'active' : ''}`} onClick={() => instruments.toggleGPR()}>GPR {rover.gprOn ? `ON · ${rover.gprDist.toFixed(0)} m` : 'OFF'}</button>
          <button className="btn sm" onClick={() => onOpen('instruments')}>All instruments ▸</button>
        </div>
        <div className="label" style={{ margin: '10px 0 4px' }}>Observation status</div>
        <div className="mono tiny" style={{ lineHeight: 1.6 }}>
          MARS CHECKLIST {mp.completed}/8<br />TASKS {mp.tasksDone}/{mp.tasksTotal}
        </div>
        <label className="row tiny" style={{ marginTop: 8 }}><input type="checkbox" checked={rover.training} onChange={(e) => { rover.training = e.target.checked; }} /> Reduced-latency training mode</label>
        <div className="tiny dim" style={{ marginTop: 4, lineHeight: 1.4 }}>*Signal delay is compressed for gameplay. Real one-way light time to Mars: ~3–22 min.</div>
      </div>

      {/* BOTTOM: command bar */}
      <div style={{ gridColumn: 2, gridRow: 2, borderTop: '1px solid var(--line)', padding: '8px 12px', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.3fr', gap: 12, alignItems: 'center' }}>
        <div className="mono tiny" style={{ lineHeight: 1.6 }}>
          <div className="dim">COMMAND STATUS</div>
          <div>{tx > 0 ? <span className="amber">▲ TX {tx} drive cmd{tx > 1 ? 's' : ''} in flight</span> : <span className="green">● LINK IDLE</span>}</div>
          {cmdState && <div className="dim">{cmdState.state} · {cmdState.text}</div>}
        </div>
        <div className="mono tiny" style={{ lineHeight: 1.6 }}>
          <div className="dim">MOVEMENT</div>
          <div>{rover.mode} · {Math.abs(rover.v).toFixed(2)} m/s{rover.cmd.throttle < 0 ? ' (REV)' : ''}</div>
          <div className="dim">ODO {rover.odometry.toFixed(0)} m</div>
        </div>
        <div className="mono tiny" style={{ lineHeight: 1.6 }}>
          <div className="dim">{wp ? 'NEXT WAYPOINT' : 'NEAREST TARGET'}</div>
          <div>{distTarget.toFixed(0)} m {wp ? `(${rover.wpIndex + 1}/${rover.waypoints.length})` : `· ${nearest.p.name}`}</div>
          <div className="dim">{marsZoneName(rover.x, rover.z)}</div>
        </div>
        <div className="tiny dim" style={{ lineHeight: 1.6 }}>
          <span className="kbd">W/S</span> drive · <span className="kbd">A/D</span> steer · <span className="kbd">Shift</span> low gear · <span className="kbd">Space</span> brake<br />
          Drag feed: pan mast · Scroll: zoom · <span className="kbd">P</span> capture · <span className="kbd">T</span> thermal · <span className="kbd">Esc</span> exit laptop
        </div>
      </div>
    </div>
  );
}
