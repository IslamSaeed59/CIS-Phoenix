import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { rover, useRover, instruments, telemetryLine, isDay } from '../../game/rover/roverSim';
import { RoverModel } from '../../game/rover/Rover';
import { useGame, worldProgress } from '../../game/core/store';
import { renderReliefMap } from '../../game/core/terrain';
import { getMarsHF, MARS_RES, MARS_SIZE, softSand } from '../../game/environments/mars/marsTerrain';
import { MARS_POIS } from '../../data/mars/marsData';
import { ScansView } from '../../ui/journal/Views';
import { useUI } from '../../game/core/ui';
import { audio } from '../../game/core/audio';
import { fmtTime, Bar } from '../../ui/common';
import { CATEGORIES } from '../../data/scientific-checklist/categories';

const hfNow = () => getMarsHF(MARS_RES[useGame.getState().settings.quality]);
let marsRelief: HTMLCanvasElement | null = null;
export function marsReliefMap() {
  if (!marsRelief) {
    marsRelief = renderReliefMap(hfNow(), 420, (x, z, h, slope) => {
      const sand = softSand(x, z);
      let c: [number, number, number] = [170, 104, 70];
      if (h > 10) c = [196, 150, 116];
      if (sand > 0.3) c = [110, 72, 56];
      if (slope > 25) c = [230, 90, 70];
      return c;
    }, MARS_SIZE);
  }
  return marsRelief;
}

// ---------------------------------------------------------------- Navigation
export function NavigationApp() {
  useRover((s) => s.snap);
  const [tab, setTab] = useState<'map' | 'models'>('map');
  const [route, setRoute] = useState<[number, number][]>([]);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 0]);
  const [follow, setFollow] = useState(true);
  const ref = useRef<HTMLCanvasElement>(null);
  const extent = MARS_SIZE / zoom;
  const cx = follow ? rover.x : center[0], cz = follow ? rover.z : center[1];
  const hf = useMemo(() => hfNow(), []);

  useEffect(() => {
    if (tab !== 'map') return;
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const W = c.width;
    const toPx = (x: number, z: number) => [((x - cx) / extent + 0.5) * W, ((z - cz) / extent + 0.5) * W];
    const img = marsReliefMap();
    // draw subregion
    const sx = ((cx - extent / 2) / MARS_SIZE + 0.5) * img.width, sy = ((cz - extent / 2) / MARS_SIZE + 0.5) * img.height;
    const sw = (extent / MARS_SIZE) * img.width;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, W);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, sx, sy, sw, sw, 0, 0, W, W);
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(0, 0, W, W);
    // grid every 50 m
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    for (let g = -450; g <= 450; g += 50) {
      const [gx] = toPx(g, 0); const [, gy] = toPx(0, g);
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    // hazards: soft sand ring & pit
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(240,168,48,.9)';
    let [hx, hy] = toPx(150, 50); ctx.beginPath(); ctx.arc(hx, hy, (38 / extent) * W, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,90,78,.9)';
    [hx, hy] = toPx(-178, -120); ctx.beginPath(); ctx.arc(hx, hy, (16 / extent) * W, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // POIs
    MARS_POIS.forEach((p) => {
      const [px, py] = toPx(p.pos[0], p.pos[1]);
      ctx.strokeStyle = '#4fd1c5'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, Math.max(4, (p.radius / extent) * W), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e8ffff'; ctx.font = '11px Inter'; ctx.textAlign = 'center';
      ctx.fillText(p.name, px, py - Math.max(6, (p.radius / extent) * W) - 4);
    });
    // trail
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.beginPath();
    rover.trail.forEach(([x, z], i) => { const [px, py] = toPx(x, z); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke();
    // routes
    const drawRoute = (pts: [number, number][], col: string) => {
      if (!pts.length) return;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
      const [rx, ry] = toPx(rover.x, rover.z); ctx.moveTo(rx, ry);
      pts.forEach(([x, z]) => { const [px, py] = toPx(x, z); ctx.lineTo(px, py); });
      ctx.stroke(); ctx.setLineDash([]);
      pts.forEach(([x, z], i) => {
        const [px, py] = toPx(x, z);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = 'bold 9px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), px, py + 3);
      });
    };
    drawRoute(rover.waypoints.slice(rover.wpIndex), '#f0a830');
    drawRoute(route, '#a78bfa');
    // rover
    const [rx, ry] = toPx(rover.x, rover.z);
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(-rover.heading);
    ctx.fillStyle = '#4fd1c5'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    // scale bar
    ctx.fillStyle = '#fff'; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'left';
    const px50 = (50 / extent) * W;
    ctx.fillRect(14, W - 18, px50, 2); ctx.fillText('50 m', 14, W - 24);
  });

  const toWorld = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [cx + ((e.clientX - r.left) / r.width - 0.5) * extent, cz + ((e.clientY - r.top) / r.height - 0.5) * extent];
  };
  const routeLen = useMemo(() => {
    let L = 0, px = rover.x, pz = rover.z;
    route.forEach(([x, z]) => { L += Math.hypot(x - px, z - pz); px = x; pz = z; });
    return L;
  }, [route]);
  const routeRisk = useMemo(() => {
    let sand = 0, steep = 0;
    let px = rover.x, pz = rover.z;
    route.forEach(([x, z]) => {
      for (let t = 0; t <= 1; t += 0.05) {
        const sx = px + (x - px) * t, sz = pz + (z - pz) * t;
        if (softSand(sx, sz) > 0.3) sand++;
        if (hf.slope(sx, sz) > 25) steep++;
      }
      px = x; pz = z;
    });
    return { sand, steep };
  }, [route]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="tabs">
        <button className={`tab ${tab === 'map' ? 'on' : ''}`} onClick={() => setTab('map')}>Traverse map</button>
        <button className={`tab ${tab === 'models' ? 'on' : ''}`} onClick={() => setTab('models')}>Terrain models</button>
      </div>
      {tab === 'map' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, minHeight: 0 }}>
            <canvas
              ref={ref}
              width={720}
              height={720}
              style={{ height: '100%', maxHeight: '100%', aspectRatio: '1/1', border: '1px solid var(--line)', cursor: 'crosshair' }}
              onClick={(e) => { if (route.length < 8) { setRoute([...route, toWorld(e)]); audio.ui('click'); } }}
              onContextMenu={(e) => { e.preventDefault(); setRoute(route.slice(0, -1)); }}
              onWheel={(e) => setZoom((z) => Math.max(1, Math.min(8, z * (e.deltaY < 0 ? 1.2 : 0.83))))}
              onMouseDown={(e) => { if (e.button === 1) { setFollow(false); setCenter([cx, cz]); } }}
            />
          </div>
          <div className="scroll" style={{ borderLeft: '1px solid var(--line)', padding: 12 }}>
            <div className="label">Waypoint planner</div>
            <div className="tiny dim" style={{ margin: '4px 0 8px', lineHeight: 1.5 }}>Click: add waypoint · Right-click: remove last · Scroll: zoom. Orbital reconnaissance targets in teal; amber dashed = soft sand; red dashed = pit hazard.</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={() => setZoom(1)}>Full map</button>
              <button className="btn sm" onClick={() => setZoom(3)}>Local</button>
              <button className={`btn sm ${follow ? 'active' : ''}`} onClick={() => setFollow(!follow)}>Follow rover</button>
            </div>
            <div className="hr" />
            <div className="mono small" style={{ lineHeight: 1.7 }}>
              <div>PLANNED WAYPOINTS {route.length}</div>
              <div>ROUTE LENGTH {routeLen.toFixed(0)} m</div>
              <div>EST. ENERGY {(routeLen * 0.022).toFixed(1)} %</div>
              <div style={{ color: routeRisk.sand ? 'var(--amber)' : undefined }}>SOFT-SAND SEGMENTS {routeRisk.sand}</div>
              <div style={{ color: routeRisk.steep ? 'var(--red)' : undefined }}>STEEP SEGMENTS {routeRisk.steep}</div>
            </div>
            <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn sm primary" disabled={!route.length} onClick={() => { instruments.setRoute(route); instruments.executeRoute(); setRoute([]); }}>Uplink &amp; execute</button>
              <button className="btn sm" disabled={!route.length} onClick={() => setRoute([])}>Clear</button>
              {rover.mode === 'AUTONAV' && <button className="btn sm danger" onClick={() => instruments.abortRoute()}>Abort autonav</button>}
            </div>
            {(routeRisk.sand > 0 || routeRisk.steep > 0) && <div className="small amber" style={{ marginTop: 8 }}>Route crosses hazards. Onboard autonomy will halt before them — consider replanning.</div>}
            <div className="hr" />
            <div className="label">Rover</div>
            <div className="mono tiny" style={{ lineHeight: 1.7 }}>
              {telemetryLine()}<br />POS {rover.x.toFixed(1)}, {(-rover.z).toFixed(1)} (est.)<br />ODO {rover.odometry.toFixed(0)} m · MODE {rover.mode}
            </div>
            <div className="hr" />
            <div className="label">Targets</div>
            {MARS_POIS.map((p) => (
              <div key={p.id} className="between tiny" style={{ padding: '3px 0' }}>
                <span>{p.name}{p.conceptual ? ' *' : ''}</span>
                <span className="mono dim">{Math.hypot(p.pos[0] - rover.x, p.pos[1] - rover.z).toFixed(0)} m</span>
              </div>
            ))}
            <div className="tiny dim" style={{ marginTop: 4 }}>* conceptual feature</div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ScansView world="mars" hf={hf} hazardKey="hazard:mars" onHazardEvidence={(slope) => {
            const g = useGame.getState();
            if (g.addEvidence('mars', { key: 'hazard:mars', instrument: 'Stereo terrain model', location: 'Navigation', summary: `Slope ${slope.toFixed(0)}° flagged` })) {
              g.addJournal({ world: 'mars', kind: 'observation', title: 'Martian navigation hazard flagged', text: `Slope of ${slope.toFixed(0)}° on stereo model — exceeds rover limits.`, cat: 'terrain' });
              import('../../game/core/ui').then((m) => m.toast('EVIDENCE COLLECTED', '02 · Mark a hazard on the Martian terrain model', 'evidence'));
            }
          }} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Telemetry & diagnostics
const history: { bat: number[]; solar: number[]; motor: number[]; cur: number[] } = { bat: [], solar: [], motor: [], cur: [] };
export function sampleHistory() {
  const push = (a: number[], v: number) => { a.push(v); if (a.length > 180) a.shift(); };
  push(history.bat, rover.battery);
  push(history.solar, rover.solar * 100);
  push(history.motor, rover.motorTemp);
  push(history.cur, rover.wheels.reduce((s, w) => s + w.current, 0));
}

function Spark({ data, min, max, color, label, unit }: { data: number[]; min: number; max: number; color: string; label: string; unit: string }) {
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${(i / 179) * 300},${60 - ((v - min) / (max - min)) * 56}`).join(' ');
  return (
    <div className="card" style={{ padding: 8 }}>
      <div className="between mono tiny"><span className="dim">{label}</span><span style={{ color }}>{(data[data.length - 1] ?? 0).toFixed(1)} {unit}</span></div>
      <svg viewBox="0 0 300 62" style={{ width: '100%', height: 62 }}>
        <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
      </svg>
    </div>
  );
}

export function TelemetryApp() {
  useRover((s) => s.snap);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', minHeight: 0 }}>
      <div className="scroll" style={{ padding: 12, borderRight: '1px solid var(--line)' }}>
        <div className="label">Rover diagnostics · ARES-6</div>
        <div style={{ height: 260, border: '1px solid var(--line)', marginTop: 8, background: 'radial-gradient(circle, #1a2228, #07090b)' }}>
          <Canvas camera={{ position: [3.2, 2.2, 3.6], fov: 40 }}>
            <ambientLight intensity={1.4} />
            <hemisphereLight args={['#dff', '#433', 1.2]} />
            <directionalLight position={[3, 5, 2]} intensity={3.2} />
            <directionalLight position={[-3, 2, -2]} intensity={1.2} color="#9cf" />
            <DiagRover />
            <OrbitControls enablePan={false} />
          </Canvas>
        </div>
        <div className="grid2" style={{ marginTop: 10 }}>
          {rover.wheels.map((w) => (
            <div key={w.id} className="card" style={{ borderColor: w.fault ? 'var(--red)' : undefined, padding: 8 }}>
              <div className="between"><span className="mono small">WHEEL {w.id}</span><span className={`tiny mono ${w.fault ? 'red' : 'green'}`}>{w.fault ? 'FAULT' : 'NOMINAL'}</span></div>
              <div className="mono tiny dim">HEALTH {(w.health * 100).toFixed(0)}% · {w.current.toFixed(2)} A · {w.temp.toFixed(0)} °C</div>
            </div>
          ))}
        </div>
        {rover.faultMsg && <div className="small red" style={{ marginTop: 8 }}>{rover.faultMsg}</div>}
        <div className="label" style={{ margin: '12px 0 6px' }}>Recovery & diagnostic procedures</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={() => instruments.powerCheck()}>Power-system check</button>
          <button className="btn sm amber" disabled={!rover.wheels.some((w) => w.fault)} onClick={() => instruments.resetMotor()}>Reset motor controller</button>
          <button className="btn sm amber" disabled={!rover.stuck} onClick={() => instruments.recovery()}>Embedding recovery sequence</button>
          <button className="btn sm danger" disabled={rover.mode !== 'SAFE' && rover.battery > 20} onClick={() => instruments.recharge()}>Recharge / exit safe mode</button>
        </div>
        <div className="tiny dim" style={{ marginTop: 6, lineHeight: 1.5 }}>Failures are always recoverable. Mission Control guidance arrives on the Comms channel.</div>
      </div>
      <div className="scroll" style={{ padding: 12 }}>
        <div className="label" style={{ marginBottom: 8 }}>Telemetry (last 3 min)</div>
        <div className="col">
          <Spark data={history.bat} min={0} max={100} color="#4fd1c5" label="BATTERY" unit="%" />
          <Spark data={history.solar} min={0} max={100} color="#f0a830" label="SOLAR INPUT" unit="%" />
          <Spark data={history.motor} min={-90} max={60} color="#ff5a4e" label="MOTOR TEMP" unit="°C" />
          <Spark data={history.cur} min={0} max={12} color="#a78bfa" label="TOTAL WHEEL CURRENT" unit="A" />
        </div>
        <div className="mono small" style={{ marginTop: 10, lineHeight: 1.8 }}>
          <div>{telemetryLine()} · {isDay() ? 'DAY' : 'NIGHT'}</div>
          <div>INTERNAL {rover.internalTemp.toFixed(1)} °C · PANEL DUST {(rover.dust * 100).toFixed(0)}%</div>
          <div>COMMS LINK {(rover.commQuality * 100).toFixed(0)}% · STORM {rover.stormPhase.toUpperCase()}</div>
          <div>STORAGE {useGame.getState().photos.filter((p) => p.world === 'mars' && p.onboard).length}/{rover.storageCap} images</div>
        </div>
      </div>
    </div>
  );
}

function DiagRover() {
  // Show the rover at origin by temporarily rendering a copy with neutral transforms
  return <RoverModel local />;
}

// ---------------------------------------------------------------- Instruments
export function InstrumentsApp() {
  useRover((s) => s.snap);
  const g = useGame();
  const I = [
    { name: 'Multispectral calibration', desc: 'Image onboard calibration target (needed before multispectral).', power: 0.6, act: () => instruments.calibrate(), state: rover.calibrated ? 'CALIBRATED' : 'UNCALIBRATED' },
    { name: 'Multispectral imaging (Mastcam)', desc: 'Aim Mastcam at a target. Preliminary mineral indicators.', power: 1.0, act: () => instruments.multispec() },
    { name: 'Thermal-infrared radiometer', desc: 'Surface temperature of the aimed target.', power: 0.3, act: () => instruments.thermal() },
    { name: 'Contact spectrometer (arm)', desc: 'Stop within ~6 m of a target. Deploys arm.', power: 3.0, act: () => instruments.spectro() },
    { name: 'Ground-penetrating radar', desc: 'Toggle; profile acquired while driving ≥ 30 m.', power: 0.03, act: () => instruments.toggleGPR(), state: rover.gprOn ? `ON · ${rover.gprDist.toFixed(0)} m` : 'OFF', unit: '%/s' },
    { name: 'Navcam stereo terrain model', desc: 'Stereo mesh of surroundings; opens in Navigation.', power: 0.8, act: () => instruments.navScan() },
    { name: 'Wind & dust sensors', desc: 'Wind speed, dust opacity, pressure.', power: 0.4, act: () => instruments.windDust() },
    { name: 'Habitability environment suite', desc: 'UV, humidity, pressure, radiation estimate.', power: 0.5, act: () => instruments.habitability() },
    { name: 'Onboard sample analysis (organics)', desc: 'Screens outcrop spectrometer data — simulated.', power: 2.0, act: () => instruments.organics() },
  ];
  return (
    <div className="scroll" style={{ padding: 14, height: '100%' }}>
      <div className="between" style={{ marginBottom: 10 }}>
        <div className="label">Scientific instruments · all outputs are clearly-labelled simulations</div>
        <div className="mono small">BATTERY <span className={rover.battery < 25 ? 'amber' : 'teal'}>{rover.battery.toFixed(0)}%</span> · {rover.busy ? <span className="amber">{rover.busy}</span> : 'IDLE'}</div>
      </div>
      {rover.busy && <div style={{ marginBottom: 10 }}><Bar v={rover.busyT / Math.max(0.1, rover.busyDur)} color="var(--amber)" /></div>}
      <div className="grid2">
        {I.map((x) => (
          <div key={x.name} className="card">
            <div className="between"><span style={{ fontWeight: 500, fontSize: 13 }}>{x.name}</span>{x.state && <span className="tag">{x.state}</span>}</div>
            <div className="tiny dim" style={{ margin: '4px 0 8px' }}>{x.desc}</div>
            <div className="between">
              <span className="mono tiny dim">POWER {x.power}{x.unit ?? '%'}</span>
              <button className="btn sm" onClick={x.act} disabled={!!rover.busy && x.name !== 'Ground-penetrating radar'}>Send command</button>
            </div>
          </div>
        ))}
      </div>
      <div className="label" style={{ margin: '14px 0 8px' }}>Operations planning</div>
      <div className="grid2">
        <div className="card">
          <div style={{ fontWeight: 500, fontSize: 13 }}>Sol timeline · {telemetryLine()}</div>
          <div className="tiny dim" style={{ margin: '4px 0 8px' }}>Night requires heater power; driving is suspended at night. Thermal readings at night reveal thermal inertia.</div>
          <div className="row">
            <button className="btn sm" disabled={!isDay()} onClick={() => instruments.hibernate()}>Hibernate until night (−9%)</button>
            <button className="btn sm" disabled={isDay()} onClick={() => instruments.wake()}>Wake at dawn</button>
          </div>
        </div>
        <div className="card">
          <div style={{ fontWeight: 500, fontSize: 13 }}>Weather · {rover.stormPhase === 'none' ? 'CLEAR' : rover.stormPhase.toUpperCase()}</div>
          <div className="tiny dim" style={{ margin: '4px 0 8px' }}>Dust storms reduce visibility, solar power and link quality.</div>
          <button className="btn sm" disabled={rover.stormPhase !== 'active' && rover.stormPhase !== 'incoming'} onClick={() => instruments.hunker()}>Stow &amp; wait out storm</button>
        </div>
      </div>
      <div className="tiny dim" style={{ marginTop: 10 }}>Mars checklist {worldProgress('mars', g).completed}/8 categories complete.</div>
    </div>
  );
}

// ---------------------------------------------------------------- Comms
export function CommsApp() {
  const log = useUI((s) => s.radioLog);
  useRover((s) => s.snap);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', height: '100%', minHeight: 0 }}>
      <div className="scroll" style={{ padding: 12, borderRight: '1px solid var(--line)' }}>
        <div className="label" style={{ marginBottom: 8 }}>Voice loop transcripts</div>
        {log.length === 0 && <div className="dim small">No transmissions yet.</div>}
        {log.map((m) => (
          <div key={m.id} style={{ padding: '7px 0', borderBottom: '1px dashed var(--line)' }}>
            <div className="between mono tiny"><span style={{ color: m.level === 'alert' ? 'var(--red)' : m.level === 'warn' ? 'var(--amber)' : 'var(--teal)' }}>{m.from}</span><span className="dim">{fmtTime(m.t)}</span></div>
            <div className="small" style={{ marginTop: 3, lineHeight: 1.45 }}>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="scroll" style={{ padding: 12 }}>
        <div className="label" style={{ marginBottom: 8 }}>Uplink / downlink command log</div>
        <div className="mono tiny dim" style={{ marginBottom: 8 }}>OWLT (compressed) {rover.latency.toFixed(1)} s · LINK {(rover.commQuality * 100).toFixed(0)}%</div>
        {rover.cmdLog.map((c, i) => (
          <div key={i} className="mono tiny" style={{ padding: '3px 0', color: c.state === 'FAIL' ? 'var(--red)' : c.state === 'DONE' ? 'var(--green)' : c.state === 'TX' ? 'var(--amber)' : 'var(--text)' }}>
            {fmtTime(c.t)} [{c.state}] {c.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Overview
export function OverviewApp({ onBegin, begun, onOpen }: { onBegin: () => void; begun: boolean; onOpen: (a: string) => void }) {
  const g = useGame();
  useRover((s) => s.snap);
  const ep = worldProgress('earth', g), mp = worldProgress('mars', g);
  return (
    <div className="scroll" style={{ padding: 20, height: '100%' }}>
      <div className="mono teal small" style={{ letterSpacing: '0.3em' }}>MISSION OVERVIEW</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>PD-2077 · Mars Robotic Expedition</div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card mono small" style={{ lineHeight: 1.9 }}>
          <div><span className="dim">ROVER</span> ARES-6 · six-wheel rocker-bogie · solar powered</div>
          <div><span className="dim">LOCATION</span> Mars Research Zone 02 (representative crater-floor reconstruction)</div>
          <div><span className="dim">MISSION TIME</span> {telemetryLine()}</div>
          <div><span className="dim">STATUS</span> <span className={rover.mode === 'SAFE' || rover.mode === 'FAULT' ? 'red' : 'green'}>{begun ? rover.mode : 'AWAITING INITIALISATION'}</span></div>
          <div><span className="dim">BATTERY</span> {rover.battery.toFixed(0)}% · <span className="dim">ODO</span> {rover.odometry.toFixed(0)} m</div>
        </div>
        <div className="card">
          <div className="label">Objectives</div>
          <div className="small" style={{ marginTop: 6 }}>Earth dataset — {ep.completed}/8 categories</div><Bar v={ep.completed / 8} />
          <div className="small" style={{ marginTop: 6 }}>Mars dataset — {mp.completed}/8 categories ({mp.tasksDone}/{mp.tasksTotal} tasks)</div><Bar v={mp.completed / 8} color="var(--amber)" />
          <div className="small" style={{ marginTop: 6 }}>Comparison — {g.reportSubmitted ? 'submitted' : mp.done ? 'unlocked' : 'locked'}</div>
        </div>
      </div>
      {!begun ? (
        <div className="card" style={{ marginTop: 16, borderColor: 'var(--teal)' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Initialise Mars rover operations</div>
          <div className="small dim" style={{ margin: '6px 0 10px', lineHeight: 1.6 }}>
            Your Earth dataset has been loaded into the analysis system. ARES-6 is awake on the crater floor and awaiting its first command.
            You will operate the rover remotely through this workstation. Commands travel with a (compressed) signal delay.
          </div>
          <button className="btn primary" onClick={onBegin}>Establish link &amp; begin expedition ▸</button>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="label" style={{ marginBottom: 6 }}>Remaining Mars objectives</div>
          <div className="small" style={{ lineHeight: 1.7 }}>
            {mp.done ? 'All Mars categories complete — open Analysis to compare datasets.' : 'Open the Checklist app for the full task list, or start in Rover Control.'}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm primary" onClick={() => onOpen('rover')}>Rover Control</button>
            <button className="btn sm" onClick={() => onOpen('checklist')}>Checklist</button>
            {mp.done && <button className="btn sm amber" onClick={() => onOpen('analysis')}>Analysis</button>}
          </div>
        </div>
      )}
      <div className="tiny dim" style={{ marginTop: 14, lineHeight: 1.5 }}>
        Earth readings come from your Qaidam field work. Mars readings are generated by this simulation and labelled as such. Neither are real measurements.
      </div>
    </div>
  );
}
