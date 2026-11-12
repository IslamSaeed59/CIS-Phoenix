import { useEffect, useMemo, useRef, useState } from 'react';
import { useUI, type TabletTab, toast } from '../../game/core/ui';
import { useGame, worldProgress, type World } from '../../game/core/store';
import { ChecklistView } from '../checklist/ChecklistView';
import { GalleryView, JournalView, ScansView } from './Views';
import { audio } from '../../game/core/audio';
import { renderReliefMap } from '../../game/core/terrain';
import { getQaidamHF, PLAY_SIZE, CHANNEL, sandWeight } from '../../game/environments/qaidam/qaidamTerrain';
import { EARTH_POIS, EARTH_POI_BY_ID, EARTH_ZONES } from '../../data/earth/earthData';
import { runtime } from '../../game/player/PlayerController';
import { logEvidence } from '../../game/instruments/earthInstruments';
import { Bar } from '../common';
import { travelTo } from '../../game/missions/travel';
import { nextEarthStep } from '../../game/missions/earthGuide';

const RES = { low: 220, medium: 300, high: 400 } as const;

let reliefCache: HTMLCanvasElement | null = null;
export function earthRelief() {
  if (!reliefCache) {
    const hf = getQaidamHF(RES[useGame.getState().settings.quality]);
    reliefCache = renderReliefMap(hf, 360, (x, z, h, slope) => {
      if (Math.hypot(x + 215, z - 55) < 110) return [214, 208, 194];
      if (Math.hypot(x + 200, z + 150) < 80) return [228, 226, 218];
      if (sandWeight(x, z) > 0.5) return h > 2 ? [190, 160, 122] : [196, 172, 134];
      if (h > 12) return [160, 124, 96];
      return [166, 154, 134];
    }, PLAY_SIZE);
  }
  return reliefCache;
}

export function EarthMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const photos = useGame((s) => s.photos).filter((p) => p.world === 'earth');
  const ev = useGame((s) => s.earthEvidence);
  const [showPhotos, setShowPhotos] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current;
      if (!c) return;
      const ctx = c.getContext('2d')!;
      const W = c.width;
      const toPx = (x: number, z: number) => [(x / PLAY_SIZE + 0.5) * W, (z / PLAY_SIZE + 0.5) * W];
      ctx.drawImage(earthRelief(), 0, 0, W, W);
      ctx.fillStyle = 'rgba(5,10,14,.25)';
      ctx.fillRect(0, 0, W, W);
      // grid
      ctx.strokeStyle = 'rgba(120,200,200,.08)';
      for (let i = 0; i <= 10; i++) { ctx.beginPath(); ctx.moveTo((i / 10) * W, 0); ctx.lineTo((i / 10) * W, W); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, (i / 10) * W); ctx.lineTo(W, (i / 10) * W); ctx.stroke(); }
      // channel
      ctx.strokeStyle = 'rgba(103,216,239,.5)'; ctx.setLineDash([4, 4]); ctx.beginPath();
      CHANNEL.forEach(([x, z], i) => { const [px, py] = toPx(x, z); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke(); ctx.setLineDash([]);
      // zones
      Object.values(EARTH_ZONES).forEach((zn) => {
        const [px, py] = toPx(zn.center[0], zn.center[1]);
        ctx.strokeStyle = 'rgba(79,209,197,.5)';
        ctx.beginPath(); ctx.arc(px, py, (zn.radius / PLAY_SIZE) * W, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#4fd1c5'; ctx.font = '600 11px JetBrains Mono'; ctx.textAlign = 'center';
        ctx.fillText(zn.label, px, py - (zn.radius / PLAY_SIZE) * W - 4);
      });
      // POIs
      EARTH_POIS.forEach((p) => {
        const [px, py] = toPx(p.pos[0], p.pos[1]);
        const visited = Object.keys(ev).some((k) => k.endsWith(p.id));
        ctx.fillStyle = p.specimen === 'none' ? '#f0a830' : visited ? '#6ee7a0' : '#fff';
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
        if (hover === p.id) { ctx.fillStyle = '#fff'; ctx.font = '11px Inter'; ctx.textAlign = 'left'; ctx.fillText(p.name, px + 8, py + 4); }
      });
      if (showPhotos) photos.forEach((ph) => {
        const [px, py] = toPx(ph.pos[0], ph.pos[1]);
        ctx.fillStyle = '#a78bfa'; ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
      });
      // player
      const [px, py] = toPx(runtime.pos.x, runtime.pos.z);
      ctx.save(); ctx.translate(px, py); ctx.rotate(-runtime.yaw);
      ctx.fillStyle = '#4fd1c5'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [photos.length, showPhotos, hover, ev]);
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * PLAY_SIZE, z = ((e.clientY - r.top) / r.height - 0.5) * PLAY_SIZE;
    const near = EARTH_POIS.find((p) => Math.hypot(p.pos[0] - x, p.pos[1] - z) < 14);
    setHover(near?.id ?? null);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, minHeight: 0 }}>
        <canvas ref={ref} width={720} height={720} onMouseMove={onMove} onClick={() => { if (hover) { const p = EARTH_POIS.find((x) => x.id === hover)!; travelTo(p.pos, p.name); } }} style={{ height: '100%', maxHeight: '100%', aspectRatio: '1/1', border: '1px solid var(--line)', cursor: hover ? 'pointer' : 'default' }} />
      </div>
      <div className="scroll" style={{ borderLeft: '1px solid var(--line)', padding: 12 }}>
        <div className="label">Survey map · representative reconstruction</div>
        <p className="tiny dim" style={{ lineHeight: 1.5 }}>Zone layout is a gameplay reconstruction inspired by NW Qaidam Basin landscapes. Distances and positions are not survey data.</p>
        <button className="btn primary" style={{ width: '100%', margin: '6px 0' }} onClick={() => { const st = nextEarthStep(); if (st.target) travelTo(st.target, st.place ?? 'goal'); }}>Travel to next goal ▸</button>
        <div className="tiny dim" style={{ marginBottom: 6 }}>Tip: click any site on the map to travel there.</div>
        <label className="row small" style={{ margin: '8px 0' }}><input type="checkbox" checked={showPhotos} onChange={(e) => setShowPhotos(e.target.checked)} /> Show photo locations</label>
        {Object.entries(EARTH_ZONES).map(([k, z]) => (
          <div key={k} className="card" style={{ marginBottom: 6 }}>
            <div className="between">
              <span className="mono small teal">{z.label}</span>
              <button className="btn sm" onClick={() => travelTo(z.center, z.name)}>Travel ▸</button>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{z.name}</div>
            <div className="tiny dim" style={{ marginTop: 3, lineHeight: 1.45 }}>{z.blurb}</div>
          </div>
        ))}
        <div className="tiny mono dim" style={{ marginTop: 6 }}>● white: unvisited site · ● green: evidence logged · ● amber: equipment · ■ violet: photo</div>
      </div>
    </div>
  );
}

function LabView() {
  const samples = useGame((s) => s.samples);
  const update = useGame((s) => s.updateSample);
  const addJournal = useGame((s) => s.addJournal);
  const [, tick] = useState(0);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const run = (id: string, kind: 'lab' | 'bio') => {
    const sample = samples.find((x) => x.id === id)!;
    const poi = EARTH_POI_BY_ID[sample.poi];
    update(id, { [kind]: 'running' } as any);
    audio.scanner();
    const t0 = performance.now();
    const dur = kind === 'lab' ? 5000 : 6500;
    const step = () => {
      const k = (performance.now() - t0) / dur;
      setProgress((p) => ({ ...p, [id + kind]: Math.min(1, k) }));
      if (k < 1) requestAnimationFrame(step);
      else {
        update(id, { [kind]: 'done' } as any);
        audio.scanDone();
        const r = kind === 'lab' ? poi.labResult! : poi.bioResult!;
        logEvidence(`${kind === 'lab' ? 'lab' : 'labbio'}:${poi.id}`, kind === 'lab' ? 'Field lab (geochem)' : 'Field lab (bio assay)', `${r.confidence} confidence`);
        addJournal({ world: 'earth', kind: 'lab', title: `${r.title} — ${poi.name}`, text: `${r.result} Confidence: ${r.confidence}. ${r.note}`, cat: kind === 'lab' ? 'geology' : 'biology' });
        tick((x) => x + 1);
      }
    };
    step();
  };
  if (!samples.length) return <div className="dim small" style={{ padding: 16 }}>No samples collected. Inspect a sampleable site and use “Collect sample”.</div>;
  return (
    <div className="scroll" style={{ padding: 14 }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="label">Field laboratory · sample capacity {samples.length}/6</span>
        <span className="tag sim">simulated analyses</span>
      </div>
      {samples.map((s) => {
        const poi = EARTH_POI_BY_ID[s.poi];
        return (
          <div key={s.id} className="card" style={{ marginBottom: 10 }}>
            <div className="between">
              <div>
                <div className="mono small teal">SAMPLE {s.id}</div>
                <div style={{ fontWeight: 500 }}>{s.name}</div>
                <div className="tiny dim">{s.location}</div>
              </div>
              <div className="row">
                {poi.labResult && <button className="btn sm" disabled={s.lab !== 'none'} onClick={() => run(s.id, 'lab')}>{s.lab === 'done' ? 'Geochem ✓' : s.lab === 'running' ? 'Running…' : 'Run geochemistry'}</button>}
                {poi.bioResult && <button className="btn sm" disabled={s.bio !== 'none'} onClick={() => run(s.id, 'bio')}>{s.bio === 'done' ? 'Bio assay ✓' : s.bio === 'running' ? 'Running…' : 'Run biological assay'}</button>}
              </div>
            </div>
            {s.lab === 'running' && <div style={{ marginTop: 8 }}><Bar v={progress[s.id + 'lab'] ?? 0} /></div>}
            {s.bio === 'running' && <div style={{ marginTop: 8 }}><Bar v={progress[s.id + 'bio'] ?? 0} color="var(--violet)" /></div>}
            {s.lab === 'done' && poi.labResult && <LabResult r={poi.labResult} />}
            {s.bio === 'done' && poi.bioResult && <LabResult r={poi.bioResult} />}
            {s.lab === 'none' && <div className="tiny amber" style={{ marginTop: 6 }}>Field reading was PRELIMINARY: {poi.spectral}</div>}
          </div>
        );
      })}
    </div>
  );
}

function LabResult({ r }: { r: { title: string; result: string; confidence: string; note: string } }) {
  return (
    <div style={{ marginTop: 8, borderLeft: '2px solid var(--violet)', paddingLeft: 10 }}>
      <div className="mono tiny" style={{ color: 'var(--violet)' }}>{r.title}</div>
      <div className="small" style={{ lineHeight: 1.5, marginTop: 3 }}>{r.result}</div>
      <div className="tiny dim" style={{ marginTop: 3 }}>Confidence: <b>{r.confidence}</b> · Limitation: {r.note}</div>
    </div>
  );
}

const TABS: { id: TabletTab; label: string }[] = [
  { id: 'checklist', label: 'Checklist' },
  { id: 'map', label: 'Map' },
  { id: 'lab', label: 'Lab' },
  { id: 'scans', label: 'Scans' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'journal', label: 'Journal' },
];

export function Tablet({ world }: { world: World }) {
  const tab = useUI((s) => s.tabletTab);
  const setTab = useUI((s) => s.setTabletTab);
  const setPanel = useUI((s) => s.setPanel);
  const prog = worldProgress('earth', useGame());
  const hf = useMemo(() => getQaidamHF(RES[useGame.getState().settings.quality]), []);
  return (
    <div className="overlay" onMouseDown={(e) => e.stopPropagation()}>
      <div className="window" style={{ width: 'min(1240px, 94vw)', height: 'min(800px, 90vh)', borderRadius: 10, border: '10px solid #1c2228', boxShadow: '0 0 0 1px #333, 0 40px 100px rgba(0,0,0,.8)' }}>
        <div className="win-head">
          <span className="win-title">Field Tablet · PD-2077 · Qaidam Survey</span>
          <div className="row">
            <span className="mono tiny dim">EARTH {prog.completed}/8 · TASKS {prog.tasksDone}/{prog.tasksTotal}</span>
            <button className="btn sm" onClick={() => { setPanel(null); audio.ui('close'); }}>Close [Esc]</button>
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => { setTab(t.id); audio.ui('click'); }}>{t.label}</button>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {tab === 'checklist' && <ChecklistView world={world} />}
          {tab === 'journal' && <JournalView world="earth" />}
          {tab === 'map' && <EarthMap />}
          {tab === 'lab' && <LabView />}
          {tab === 'gallery' && <GalleryView world="earth" mapImage={earthRelief()} mapExtent={PLAY_SIZE} />}
          {tab === 'scans' && (
            <ScansView
              world="earth"
              hf={hf}
              hazardKey="hazard:earth"
              onHazardEvidence={(slope) => {
                if (logEvidence('hazard:earth', 'Topographic model', `Steep slope ${slope.toFixed(0)}° flagged`)) {
                  useGame.getState().addJournal({ world: 'earth', kind: 'observation', title: 'Navigation hazard flagged', text: `Slope of ${slope.toFixed(0)}° identified on LiDAR model — exceeds typical rover limits.`, cat: 'terrain' });
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export { toast };
