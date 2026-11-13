import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, comparisonProgress, interpFor, catStatus } from '../../game/core/store';
import { CATEGORIES, CAT_BY_ID, type CategoryId } from '../../data/scientific-checklist/categories';
import { COMPARISON_STATEMENTS, APPLICATIONS, type StatementClass } from '../../data/scientific-checklist/comparison';
import { TopoModel } from '../../ui/journal/Views';
import { getQaidamHF, QAIDAM_RES } from '../../game/environments/qaidam/qaidamTerrain';
import { getMarsHF, MARS_RES } from '../../game/environments/mars/marsTerrain';
import { audio } from '../../game/core/audio';
import { StatusChip } from '../../ui/common';

const Q_RES = QAIDAM_RES;

export function AnalysisApp() {
  const [tab, setTab] = useState<'datasets' | 'viz' | 'sims' | 'conclusions'>('conclusions');
  const g = useGame();
  const cp = comparisonProgress(g);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="between" style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)' }}>
        <div>
          <div className="mono teal small" style={{ letterSpacing: '0.25em' }}>EARTH–MARS RESEARCH ANALYSIS</div>
          <div className="tiny dim">Analogue = useful for selected processes &amp; operations, not because Earth and Mars are identical.</div>
        </div>
        <div className="mono tiny" style={{ textAlign: 'right', lineHeight: 1.6 }}>
          ANSWERED {cp.classified}/{cp.total}<br />
          {cp.ready ? <span className="green">READY FOR FINAL REPORT</span> : <span className="amber">ANALYSIS IN PROGRESS</span>}
        </div>
      </div>
      <div className="tabs">
        {(['conclusions', 'sims', 'viz', 'datasets'] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => { setTab(t); audio.ui('click'); }}>
            {t === 'datasets' ? 'Your data (extra)' : t === 'viz' ? '3D compare (extra)' : t === 'sims' ? 'Play with simulations' : '⚖️ Same or different?'}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'datasets' && <Datasets />}
        {tab === 'viz' && <Visualisations />}
        {tab === 'sims' && <Simulations />}
        {tab === 'conclusions' && <Conclusions />}
      </div>
    </div>
  );
}

function Datasets() {
  const [cat, setCat] = useState<CategoryId>('geology');
  const g = useGame();
  const side = (w: 'earth' | 'mars') => {
    const interp = (w === 'earth' ? g.earthInterp : g.marsInterp)[cat];
    const set = interpFor(w)[cat];
    const opt = interp && set.options.find((o) => o.id === interp.optionId);
    const lim = interp && set.limitations.find((l) => l.id === interp.limitationId);
    const ev = Object.values(w === 'earth' ? g.earthEvidence : g.marsEvidence).filter((e) => e.key && (interpFor(w)[cat] ? true : false));
    const photos = g.photos.filter((p) => p.world === w && p.category === cat).slice(-4);
    const readings = g.thermal.filter((t) => t.world === w);
    const evList = (w === 'earth' ? g.earthEvidence : g.marsEvidence);
    const keys = Object.keys(evList).filter((k) => (w === 'earth' ? (CAT_TASKS.earth[cat] ?? []) : (CAT_TASKS.mars[cat] ?? [])).includes(k));
    return (
      <div className="card" style={{ height: '100%', overflowY: 'auto' }}>
        <div className="between">
          <span className="mono small teal">{w === 'earth' ? 'EARTH · QAIDAM BASIN' : 'MARS · RESEARCH ZONE 02'}</span>
          <StatusChip s={catStatus(w, cat, g)} />
        </div>
        <div className="label" style={{ marginTop: 10 }}>Observation</div>
        <div className="small" style={{ lineHeight: 1.5 }}>{set.observation}</div>
        <div className="label" style={{ marginTop: 10 }}>Evidence ({keys.length})</div>
        {keys.map((k) => <div key={k} className="tiny mono" style={{ padding: '2px 0' }}>✓ {evList[k].instrument} — {evList[k].summary}</div>)}
        {photos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 8 }}>
            {photos.map((p) => <img key={p.id} className="thumb" src={p.thumb} />)}
          </div>
        )}
        {cat === 'temperature' && readings.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="label">Instrument readings (simulated)</div>
            {readings.slice(-6).map((r, i) => <div key={i} className="tiny mono">{r.material}: {r.tempC} °C ({r.day ? 'day' : 'night'})</div>)}
          </div>
        )}
        <div className="label" style={{ marginTop: 10 }}>Interpretation</div>
        <div className="small" style={{ lineHeight: 1.5 }}>{opt ? opt.text : '—'}</div>
        <div className="tiny dim" style={{ marginTop: 4 }}>Confidence: {interp?.confidence ?? '—'} · Limitation: {lim?.text ?? '—'}</div>
      </div>
    );
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', height: '100%', minHeight: 0 }}>
      <div className="scroll" style={{ borderRight: '1px solid var(--line)', padding: 8 }}>
        {CATEGORIES.map((c) => (
          <div key={c.id} className={`card ${cat === c.id ? 'sel' : ''}`} style={{ marginBottom: 6, cursor: 'pointer', padding: '7px 10px' }} onClick={() => setCat(c.id)}>
            <span className="mono tiny teal">{c.num}</span> <span className="small">{c.short}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: 10, minHeight: 0 }}>{side('earth')}</div>
      <div style={{ padding: 10, minHeight: 0 }}>{side('mars')}</div>
    </div>
  );
}

import { EARTH_TASKS } from '../../data/earth/earthData';
import { MARS_TASKS } from '../../data/mars/marsData';
const CAT_TASKS = {
  earth: CATEGORIES.reduce((a, c) => ({ ...a, [c.id]: EARTH_TASKS.filter((t) => t.cat === c.id).map((t) => t.id) }), {} as Record<string, string[]>),
  mars: CATEGORIES.reduce((a, c) => ({ ...a, [c.id]: MARS_TASKS.filter((t) => t.cat === c.id).map((t) => t.id) }), {} as Record<string, string[]>),
};

// ------------------------------------------------------------ Visualisations
function Visualisations() {
  const q = useGame((s) => s.settings.quality);
  const ehf = useMemo(() => getQaidamHF(Q_RES[q]), [q]);
  const mhf = useMemo(() => getMarsHF(MARS_RES[q]), [q]);
  const g = useGame();
  const [pair, setPair] = useState<'aeolian' | 'layers'>('aeolian');
  const eCenter: [number, number] = pair === 'aeolian' ? [225, 0] : [20, -200];
  const mCenter: [number, number] = pair === 'aeolian' ? [190, -115] : [0, -185];
  const th = g.thermal;
  const probes = g.scans.filter((s) => s.kind === 'probe');
  return (
    <div className="scroll" style={{ padding: 12, height: '100%' }}>
      <div className="between">
        <div className="label">1–2 · Terrain &amp; landform comparison (3D, slope-coloured)</div>
        <div className="row">
          <button className={`btn sm ${pair === 'aeolian' ? 'active' : ''}`} onClick={() => setPair('aeolian')}>Wind-eroded ridges</button>
          <button className={`btn sm ${pair === 'layers' ? 'active' : ''}`} onClick={() => setPair('layers')}>Layered escarpments</button>
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 8 }}>
        <div>
          <div className="mono tiny teal">EARTH · {pair === 'aeolian' ? 'Qaidam yardang field' : 'Zone D escarpment'}</div>
          <div style={{ height: 240, border: '1px solid var(--line)' }}><TopoModel hf={ehf} center={eCenter} radius={110} /></div>
        </div>
        <div>
          <div className="mono tiny" style={{ color: 'var(--amber)' }}>MARS · {pair === 'aeolian' ? 'Wind-eroded ridges' : 'Light-toned layered outcrop'}</div>
          <div style={{ height: 240, border: '1px solid var(--line)' }}><TopoModel hf={mhf} center={mCenter} radius={110} /></div>
        </div>
      </div>
      <div className="tiny dim" style={{ marginTop: 6 }}>Similar morphology can arise from similar processes (wind abrasion of layered, weakly-cemented sediment) — but similar shape does not prove identical origin, age or rate. Both terrains are game reconstructions.</div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="label">3–4 · Thermal readings &amp; surface materials (your data, simulated)</div>
          <ThermalChart readings={th} />
        </div>
        <div className="card">
          <div className="label">7 · Rover mobility &amp; trafficability</div>
          <svg viewBox="0 0 300 150" style={{ width: '100%', maxHeight: 210, marginTop: 6 }}>
            {[
              { l: 'Earth crust', v: probes.find((p) => p.data.surf === 'salt')?.data.kPa ?? 0, c: '#4fd1c5' },
              { l: 'Earth gravel', v: probes.find((p) => p.data.surf === 'gravel')?.data.kPa ?? 0, c: '#4fd1c5' },
              { l: 'Earth sand', v: probes.find((p) => p.data.surf === 'sand')?.data.kPa ?? 0, c: '#4fd1c5' },
              { l: 'Mars sand*', v: g.marsEvidence['recover:fault'] ? 30 : 0, c: '#f0a830' },
            ].map((b, i) => (
              <g key={b.l}>
                <rect x={10 + i * 72} y={130 - (b.v / 600) * 110} width={50} height={(b.v / 600) * 110} fill={b.c} opacity={b.v ? 0.85 : 0.15} />
                <text x={35 + i * 72} y={145} fontSize={8} fill="#9ab" textAnchor="middle">{b.l}</text>
                <text x={35 + i * 72} y={125 - (b.v / 600) * 110} fontSize={8} fill="#fff" textAnchor="middle">{b.v ? `${b.v} kPa` : 'n/a'}</text>
              </g>
            ))}
          </svg>
          <div className="tiny dim">*Mars value is an illustrative estimate inferred from the embedding event, not a measurement. Mars 0.38 g lowers wheel load but also traction.</div>
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="label">5 · Erosion &amp; landform comparison</div>
          <div className="small" style={{ lineHeight: 1.6, marginTop: 6 }}>
            Yardang orientation in Qaidam records NW winds; Martian ridges align with the modelled SW–NE wind in this reconstruction.
            Run the <b>wind-erosion simulation</b> to compare rates under Earth vs Mars air density.
          </div>
        </div>
        <div className="card">
          <div className="label">6 · Habitability comparison</div>
          <table className="mono tiny" style={{ width: '100%', marginTop: 6, lineHeight: 1.7 }}>
            <tbody>
              <tr><td className="dim">Surface pressure</td><td>~70 kPa (at ~3 km)</td><td className="amber">~0.6–0.8 kPa</td></tr>
              <tr><td className="dim">Liquid water stable?</td><td>Yes (seasonal/ephemeral)</td><td className="amber">Not at surface (generally)</td></tr>
              <tr><td className="dim">UV / radiation</td><td>High UV, shielded</td><td className="amber">Much harsher</td></tr>
              <tr><td className="dim">Life detected?</td><td>Halophiles known in salts</td><td className="amber">None detected</td></tr>
            </tbody>
          </table>
          <div className="tiny dim">General literature values; game readings are simulated.</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="label">8 · Subsurface investigation comparison</div>
        <div className="small" style={{ lineHeight: 1.6, marginTop: 6 }}>
          Both GPR profiles show layered reflectors. The Qaidam overhang is a shallow erosional shelter; the Martian pit is a <i>candidate</i> sheltered environment
          whose connection to any cave is unverified. Origin differs — this is where the analogue weakens.
        </div>
      </div>
    </div>
  );
}

function ThermalChart({ readings }: { readings: { world: string; tempC: number; day: boolean; material: string }[] }) {
  const pts = readings.slice(-16);
  const y = (t: number) => 130 - ((t + 110) / 180) * 120;
  return (
    <svg viewBox="0 0 300 150" style={{ width: '100%', maxHeight: 210, marginTop: 6 }}>
      {[-100, -50, 0, 50].map((t) => (
        <g key={t}><line x1={30} x2={295} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.08)" /><text x={2} y={y(t) + 3} fontSize={8} fill="#789">{t}°C</text></g>
      ))}
      <text x={90} y={146} fontSize={8} fill="#4fd1c5" textAnchor="middle">EARTH</text>
      <text x={230} y={146} fontSize={8} fill="#f0a830" textAnchor="middle">MARS</text>
      {pts.map((r, i) => {
        const x = (r.world === 'earth' ? 50 : 190) + (i % 8) * 11;
        return <circle key={i} cx={x} cy={y(r.tempC)} r={3.5} fill={r.world === 'earth' ? '#4fd1c5' : '#f0a830'} stroke={r.day ? '#fff' : '#334'} strokeWidth={1}><title>{`${r.material}: ${r.tempC} °C (${r.day ? 'day' : 'night'})`}</title></circle>;
      })}
      {pts.length === 0 && <text x={150} y={75} fontSize={10} fill="#789" textAnchor="middle">No thermal readings yet</text>}
    </svg>
  );
}

// ------------------------------------------------------------ Simulations
function Simulations() {
  const [sim, setSim] = useState<'erosion' | 'mobility' | 'thermal'>('erosion');
  const simsRun = useGame((s) => s.simsRun);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: '100%', minHeight: 0 }}>
      <div style={{ borderRight: '1px solid var(--line)', padding: 8 }}>
        {[
          { id: 'erosion', t: 'Wind erosion of layered sediment' },
          { id: 'mobility', t: 'Rover mobility vs terrain & gravity' },
          { id: 'thermal', t: 'Diurnal thermal response' },
        ].map((s) => (
          <div key={s.id} className={`card ${sim === s.id ? 'sel' : ''}`} style={{ marginBottom: 6, cursor: 'pointer' }} onClick={() => setSim(s.id as any)}>
            <div className="small">{s.t}</div>
            <div className="tiny mono" style={{ color: simsRun.includes(s.id) ? 'var(--green)' : 'var(--dim)' }}>{simsRun.includes(s.id) ? 'RUN ✓' : 'NOT RUN'}</div>
          </div>
        ))}
        <div className="tiny dim" style={{ marginTop: 8, lineHeight: 1.5 }}>All simulations are <b>illustrative models</b> using your collected game data — not real scientific results.</div>
      </div>
      <div className="scroll" style={{ padding: 14 }}>
        {sim === 'erosion' && <ErosionSim />}
        {sim === 'mobility' && <MobilitySim />}
        {sim === 'thermal' && <ThermalSim />}
      </div>
    </div>
  );
}

function ErosionSim() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [planet, setPlanet] = useState<'earth' | 'mars'>('earth');
  const [wind, setWind] = useState(12);
  const [running, setRunning] = useState(false);
  const [years, setYears] = useState(0);
  const runSim = useGame((s) => s.runSim);
  const grid = useRef<Float32Array | null>(null);
  const W = 160, H = 80;
  const reset = () => {
    const a = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const inBlock = y > 20 && x > 30 && x < 140;
      a[y * W + x] = inBlock ? (Math.floor((y - 20) / 6) % 2 ? 0.45 : 1) : 0; // alternating soft/hard layers (resistance)
    }
    grid.current = a;
    setYears(0);
  };
  useEffect(() => { reset(); }, [planet]);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const density = planet === 'earth' ? 1 : 0.015;
    const step = () => {
      const a = grid.current!;
      // particles hit exposed cells from the left (windward) and from above with lower probability
      for (let n = 0; n < 900; n++) {
        let y = H - 1 - Math.floor(Math.pow(Math.random(), 1.6) * (H - 21));
        let x = 0;
        while (x < W && a[y * W + x] === 0) x++;
        if (x >= W) continue;
        const res = a[y * W + x];
        const rate = ((wind / 12) ** 2 * density * 0.006) / (res * res);
        if (Math.random() < rate) {
          a[y * W + x] = 0;
          // deflect: abrasion is stronger near the base (sand saltation height)
          if (y > H - 30 && Math.random() < 0.5 && x + 1 < W) a[y * W + x + 1] *= 0.97;
        }
      }
      setYears((t) => t + (planet === 'earth' ? 1 : 1) );
      draw();
      raf = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, [running, wind, planet]);
  const draw = () => {
    const c = ref.current; if (!c || !grid.current) return;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const v = grid.current[i];
      const o = i * 4;
      if (v === 0) { img.data[o] = planet === 'earth' ? 150 : 190; img.data[o + 1] = planet === 'earth' ? 180 : 140; img.data[o + 2] = planet === 'earth' ? 205 : 110; }
      else if (v > 0.6) { img.data[o] = 150; img.data[o + 1] = 105; img.data[o + 2] = 78; }
      else { img.data[o] = 200; img.data[o + 1] = 168; img.data[o + 2] = 128; }
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  useEffect(() => { draw(); });
  return (
    <div>
      <div className="label">Wind erosion of alternating hard/soft layers · 2D cross-section (illustrative)</div>
      <canvas ref={ref} width={W} height={H} style={{ width: '100%', maxWidth: 760, imageRendering: 'pixelated', border: '1px solid var(--line)', marginTop: 8, display: 'block' }} />
      <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <button className={`btn sm ${planet === 'earth' ? 'active' : ''}`} onClick={() => setPlanet('earth')}>Earth air density</button>
        <button className={`btn sm ${planet === 'mars' ? 'active' : ''}`} onClick={() => setPlanet('mars')}>Mars air density (~1–2%)</button>
        <span className="small">Wind {wind} m/s</span>
        <input type="range" min={4} max={30} value={wind} onChange={(e) => setWind(+e.target.value)} style={{ accentColor: '#4fd1c5' }} />
        <button className="btn sm primary" onClick={() => { setRunning(!running); runSim('erosion'); }}>{running ? 'Pause' : 'Run'}</button>
        <button className="btn sm" onClick={() => { setRunning(false); reset(); }}>Reset</button>
        <span className="mono tiny dim">STEPS {years}</span>
      </div>
      <div className="small dim" style={{ marginTop: 8, lineHeight: 1.6 }}>
        Wind-driven abrasion removes weak layers faster than resistant ones, producing ledges and a streamlined, blunt-windward profile.
        At the same wind speed, Martian air carries far less momentum, so this toy model erodes far more slowly on Mars. Real Martian rates also depend on
        rare strong winds, sand supply and time spans of millions of years — this model is qualitative only.
      </div>
    </div>
  );
}

function MobilitySim() {
  const [terrain, setTerrain] = useState<'crust' | 'gravel' | 'sand'>('sand');
  const [gravity, setGravity] = useState<'earth' | 'mars'>('mars');
  const runSim = useGame((s) => s.runSim);
  const probes = useGame((s) => s.scans).filter((s) => s.kind === 'probe');
  const kPa = (probes.find((p) => p.data.surf === (terrain === 'crust' ? 'salt' : terrain))?.data.kPa as number) ?? (terrain === 'crust' ? 450 : terrain === 'gravel' ? 300 : 45);
  useEffect(() => { runSim('mobility'); }, []);
  const g = gravity === 'earth' ? 9.81 : 3.71;
  const load = (900 * g) / 6; // N per wheel for a ~900 kg rover
  const pts = Array.from({ length: 21 }, (_, i) => {
    const throttle = i / 20;
    const strength = kPa / 450;
    const traction = Math.min(1, strength * (gravity === 'mars' ? 0.85 : 1));
    const slip = Math.min(1, Math.max(0, throttle * (1.15 - traction) * (load < 1000 ? 1.1 : 1) + (terrain === 'sand' ? throttle * throttle * 0.6 : 0)));
    return slip;
  });
  const d = pts.map((s, i) => `${i ? 'L' : 'M'}${20 + i * 13},${130 - s * 110}`).join(' ');
  return (
    <div>
      <div className="label">Rover mobility · slip vs commanded throttle (illustrative model)</div>
      <div className="row" style={{ margin: '8px 0', flexWrap: 'wrap' }}>
        {(['crust', 'gravel', 'sand'] as const).map((t) => <button key={t} className={`btn sm ${terrain === t ? 'active' : ''}`} onClick={() => setTerrain(t)}>{t}</button>)}
        <span style={{ width: 16 }} />
        {(['earth', 'mars'] as const).map((t) => <button key={t} className={`btn sm ${gravity === t ? 'active' : ''}`} onClick={() => setGravity(t)}>{t} gravity</button>)}
      </div>
      <svg viewBox="0 0 300 150" style={{ width: '100%', maxWidth: 640, border: '1px solid var(--line)' }}>
        <line x1={20} x2={280} y1={130} y2={130} stroke="#567" />
        <line x1={20} x2={20} y1={20} y2={130} stroke="#567" />
        <line x1={20} x2={280} y1={130 - 0.6 * 110} y2={130 - 0.6 * 110} stroke="#f0a830" strokeDasharray="4 3" />
        <text x={282} y={130 - 0.6 * 110 + 3} fontSize={7} fill="#f0a830">embed risk</text>
        <path d={d} stroke="#4fd1c5" fill="none" strokeWidth={2} />
        <text x={150} y={146} fontSize={8} fill="#9ab" textAnchor="middle">commanded throttle →</text>
        <text x={6} y={70} fontSize={8} fill="#9ab" transform="rotate(-90 6 70)">slip</text>
      </svg>
      <div className="mono small" style={{ marginTop: 8, lineHeight: 1.7 }}>
        BEARING STRENGTH {kPa} kPa {probes.length ? '(from your penetrometer data)' : '(default — no field data)'} · WHEEL LOAD {load.toFixed(0)} N
      </div>
      <div className="small dim" style={{ lineHeight: 1.6, marginTop: 6 }}>
        Lower gravity reduces sinkage pressure but also the normal force that gives traction, so loose sand remains hazardous on Mars.
        Your Earth tests calibrate the shape of the curve; they cannot reproduce Martian gravity — a key analogue limitation.
      </div>
    </div>
  );
}

function ThermalSim() {
  const runSim = useGame((s) => s.runSim);
  const readings = useGame((s) => s.thermal);
  const [inertia, setInertia] = useState(0.15);
  useEffect(() => { runSim('thermal'); }, []);
  const curve = (planet: 'earth' | 'mars', I: number) =>
    Array.from({ length: 49 }, (_, i) => {
      const h = i / 2; // hour
      const sun = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
      const mean = planet === 'earth' ? 8 : -60;
      const amp = (planet === 'earth' ? 28 : 55) * (1.1 - I);
      const lag = I * 2;
      const s2 = Math.max(0, Math.sin(((h - 6 - lag) / 12) * Math.PI));
      return mean + amp * (s2 * 1.2 - 0.45) + (sun > 0 ? 0 : -amp * 0.15);
    });
  const y = (t: number) => 140 - ((t + 110) / 180) * 125;
  const path = (arr: number[]) => arr.map((t, i) => `${i ? 'L' : 'M'}${30 + i * 5.5},${y(t)}`).join(' ');
  return (
    <div>
      <div className="label">Diurnal surface temperature · illustrative model with your readings overlaid</div>
      <div className="row" style={{ margin: '8px 0' }}>
        <span className="small">Thermal inertia</span>
        <input type="range" min={0.05} max={0.95} step={0.05} value={inertia} onChange={(e) => setInertia(+e.target.value)} style={{ accentColor: '#4fd1c5' }} />
        <span className="mono small">{inertia < 0.3 ? 'loose sand' : inertia < 0.6 ? 'crust / gravel' : 'bedrock'}</span>
      </div>
      <svg viewBox="0 0 310 150" style={{ width: '100%', maxWidth: 700, border: '1px solid var(--line)' }}>
        {[-100, -50, 0, 50].map((t) => <g key={t}><line x1={30} x2={300} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.07)" /><text x={2} y={y(t) + 3} fontSize={7} fill="#789">{t}°C</text></g>)}
        <path d={path(curve('earth', inertia))} stroke="#4fd1c5" fill="none" strokeWidth={1.8} />
        <path d={path(curve('mars', inertia))} stroke="#f0a830" fill="none" strokeWidth={1.8} />
        {readings.map((r, i) => (
          <circle key={i} cx={30 + (r.day ? 14 : 23) * 2 * 5.5 * 0.5 + (i % 5) * 3} cy={y(r.tempC)} r={3} fill={r.world === 'earth' ? '#4fd1c5' : '#f0a830'} stroke="#fff" strokeWidth={0.6} />
        ))}
        <text x={30} y={148} fontSize={7} fill="#789">00h</text><text x={162} y={148} fontSize={7} fill="#789">12h</text><text x={285} y={148} fontSize={7} fill="#789">24h</text>
      </svg>
      <div className="small dim" style={{ lineHeight: 1.6, marginTop: 6 }}>
        Low-inertia materials (loose sand) heat and cool fastest; bedrock lags and stays warmer at night — the pattern you measured on both worlds.
        Mars’ thin atmosphere holds little heat, so swings are larger and the whole curve sits far colder. Equipment must survive these cycles (heaters, insulation, battery management).
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Conclusions
function Conclusions() {
  const g = useGame();
  return (
    <div className="scroll" style={{ padding: 14, height: '100%' }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>Is it the same on Earth and Mars?</div>
      <div className="small dim" style={{ margin: '4px 0 12px' }}>For each sentence pick: <b className="teal">similarity</b> (same), <b className="amber">difference</b>, or <b style={{ color: 'var(--violet)' }}>limitation</b> (where the comparison stops working).</div>
      {COMPARISON_STATEMENTS.map((s) => {
        const v = g.classified[s.id];
        const correct = v === s.answer;
        return (
          <div key={s.id} className="card" style={{ marginBottom: 8 }}>
            <div className="between" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <span className="tag" style={{ marginRight: 6 }}>{CAT_BY_ID[s.cat].num} {CAT_BY_ID[s.cat].short}</span>
                <span className="small">{s.text}</span>
              </div>
              <div className="row" style={{ flex: 'none' }}>
                {(['similarity', 'difference', 'limitation'] as StatementClass[]).map((c) => (
                  <button key={c} className={`btn sm ${v === c ? (correct ? 'active' : 'amber') : ''}`} onClick={() => { g.classify(s.id, c); audio.ui(c === s.answer ? 'confirm' : 'click'); }}>{c}</button>
                ))}
              </div>
            </div>
            {v && <div className="tiny" style={{ marginTop: 6, color: correct ? 'var(--green)' : 'var(--amber)' }}>{correct ? '✓ ' : '↻ Reconsider — '}{correct ? s.why : 'think about whether this describes shared features, contrasting conditions, or where the comparison stops being useful.'}</div>}
          </div>
        );
      })}
      <div className="hr" />
      <div className="label">Exploration applications — select those your evidence supports (★ = also relevant to permanent lunar-base planning)</div>
      <div className="col" style={{ marginTop: 8 }}>
        {APPLICATIONS.map((a) => {
          const on = g.apps.includes(a.id);
          return (
            <div key={a.id} className={`card ${on ? 'sel' : ''}`} style={{ cursor: 'pointer' }} onClick={() => { g.toggleApp(a.id); audio.ui('click'); }}>
              <span className={`chk ${on ? 'on' : ''}`} style={{ marginRight: 8 }}>{on ? '✓' : ''}</span>
              <span className="small">{a.text}</span> {a.lunar && <span className="amber">★</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
