import * as THREE from 'three';
import { gfxDpr } from '../game/core/graphics';
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGame, worldProgress, resumePhase, scienceScore } from '../game/core/store';
import { fadeTo } from '../game/core/ui';
import { audio } from '../game/core/audio';
import { MarsGlobe, Starfield } from '../game/environments/space/planets';
import { SettingsPanel, ControlsPanel } from './pause/PauseMenu';
import { GraphicsPanel } from './settings/GraphicsPanel';

const DEV = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev');

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const L = [
      'IPARC SECURE TERMINAL · BUILD 2077.11',
      'Loading planetary terrain synthesiser ........ OK',
      'Loading spectral library (illustrative) ...... OK',
      'Initialising rover telemetry bridge .......... OK',
      'Calibrating thermal palette (ironbow) ........ OK',
      'Mounting mission archive (local storage) ..... OK',
      'All systems nominal.',
    ];
    let i = 0;
    const id = setInterval(() => {
      const line = L[i];
      setLines((x) => [...x, line]);
      i++;
      if (i >= L.length) { clearInterval(id); setReady(true); }
    }, 230);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const go = () => { audio.ensure(); audio.ui('boot'); onDone(); };
    window.addEventListener('keydown', go, { once: true });
    window.addEventListener('mousedown', go, { once: true });
    return () => { window.removeEventListener('keydown', go); window.removeEventListener('mousedown', go); };
  }, [ready]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#040607', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 640 }}>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.08em' }}>PLANETDETECTIVE</div>
        <div className="mono teal" style={{ letterSpacing: '0.6em', marginBottom: 26, fontSize: 12 }}>MISSION 2077</div>
        <div className="mono small" style={{ lineHeight: 1.9, color: '#9fb3b6', minHeight: 200 }}>
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div className="progress" style={{ marginTop: 12 }}><div style={{ width: `${(lines.length / 7) * 100}%` }} /></div>
        <div className="mono small" style={{ marginTop: 22, height: 18, color: '#fff', letterSpacing: '0.2em' }}>
          {ready && <span className="blink">CLICK OR PRESS ANY KEY TO ENABLE AUDIO &amp; CONTINUE</span>}
        </div>
        <div className="tiny dim" style={{ marginTop: 30 }}>Best experienced on desktop with a mouse and headphones.</div>
      </div>
    </div>
  );
}

export function MainMenu() {
  const s = useGame();
  const [sub, setSub] = useState<null | 'settings' | 'graphics' | 'controls' | 'chapters' | 'about' | 'confirm'>(null);
  const ep = worldProgress('earth', s);
  const mp = worldProgress('mars', s);
  const go = async (fn: () => void) => {
    audio.ui('confirm');
    await fadeTo(1, 700);
    fn();
  };
  const newGame = () => go(() => { s.newGame(); });
  const cont = () => go(() => s.setPhase(resumePhase()));
  const chapters = [
    { n: '01', t: 'Mission Initiation', ok: true, run: () => go(() => { s.setPhase('intro'); }) },
    { n: '02', t: 'Earth Research Expedition', ok: s.started || DEV, run: () => go(() => { if (!s.started) useGame.setState({ started: true }); s.setPhase('earth'); }) },
    { n: '03', t: 'Return to Mission Control', ok: ep.done || DEV, run: () => go(() => { if (!ep.done) s.devFill('earth'); s.setPhase('hq'); }) },
    { n: '04', t: 'Mars Rover Expedition', ok: ep.done || DEV, run: () => go(() => { if (!ep.done) s.devFill('earth'); s.setPhase('hq'); }) },
    { n: '05', t: 'Earth vs Mars Comparison', ok: mp.done || DEV, run: () => go(() => { if (!ep.done) s.devFill('earth'); if (!mp.done) s.devFill('mars'); s.setPhase('hq'); }) },
    { n: '—', t: 'Final Cinematic', ok: s.reportSubmitted || DEV, run: () => go(() => s.setPhase('ending')) },
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <div className="menu-bg">
        <Canvas dpr={gfxDpr(useGame.getState().settings.gfx)} gl={{ antialias: useGame.getState().settings.gfx.aa, toneMapping: THREE.ACESFilmicToneMapping }} camera={{ position: [0, 0, 22], fov: 40 }}>
          <Starfield count={5000} />
          <ambientLight intensity={0.05} />
          <directionalLight position={[-20, 6, 12]} intensity={2.6} color="#ffe8d6" />
          <group position={[7, -1.5, 0]} rotation={[0.2, 0, 0.1]}>
            <MarsGlobe radius={7.5} spin={0.02} />
          </group>
        </Canvas>
      </div>
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.6) 40%, transparent 70%)', pointerEvents: 'none' }} />
      <div className="menu">
        <div className="menu-title">PLANET<br />DETECTIVE</div>
        <div className="menu-sub">MISSION 2077</div>
        <div style={{ height: 36 }} />
        {s.started && <button className="menu-item" onMouseEnter={() => audio.ui('hover')} onClick={cont}>Continue mission</button>}
        <button className="menu-item" onMouseEnter={() => audio.ui('hover')} onClick={() => (s.started ? setSub('confirm') : newGame())}>New mission</button>
        <button className="menu-item" onMouseEnter={() => audio.ui('hover')} onClick={() => setSub('chapters')}>Chapter select</button>
        <button className="menu-item" onMouseEnter={() => audio.ui('hover')} onClick={() => setSub('settings')}>Settings</button>
        <button className="menu-item" onMouseEnter={() => audio.ui('hover')} onClick={() => setSub('graphics')}>Graphics</button>
        <button className="menu-item" onMouseEnter={() => audio.ui('hover')} onClick={() => setSub('controls')}>Controls</button>
        <button className="menu-item" onMouseEnter={() => audio.ui('hover')} onClick={() => setSub('about')}>Science &amp; credits</button>
        {s.started && (
          <div className="mono tiny dim" style={{ marginTop: 28, lineHeight: 1.8 }}>
            SAVE · EARTH {ep.completed}/8 · MARS {mp.completed}/8 · {s.reportSubmitted ? `REPORT SUBMITTED · SCORE ${scienceScore(s).total}` : 'IN PROGRESS'}
          </div>
        )}
        {DEV && <div className="mono tiny amber" style={{ marginTop: 8 }}>DEV MODE: all chapters unlocked</div>}
      </div>
      {sub && (
        <div className="overlay" onClick={() => setSub(null)}>
          <div className="window" style={{ width: sub === 'about' ? 760 : 560, maxHeight: '84vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="win-head">
              <span className="win-title">{sub === 'confirm' ? 'Start a new mission?' : sub === 'chapters' ? 'Chapter select' : sub === 'about' ? 'Science, sources & credits' : sub}</span>
              <button className="btn sm" onClick={() => setSub(null)}>Close</button>
            </div>
            <div className="scroll" style={{ padding: 18 }}>
              {sub === 'settings' && <SettingsPanel />}
              {sub === 'graphics' && <GraphicsPanel />}
              {sub === 'controls' && <ControlsPanel />}
              {sub === 'confirm' && (
                <div className="col">
                  <div className="small">This will erase your current mission progress, photographs, samples and journal.</div>
                  <div className="row"><button className="btn danger" onClick={newGame}>Erase &amp; start new</button><button className="btn" onClick={() => setSub(null)}>Cancel</button></div>
                </div>
              )}
              {sub === 'chapters' && (
                <div className="col">
                  {chapters.map((c) => (
                    <button key={c.t} className="card" disabled={!c.ok} onClick={c.run} style={{ textAlign: 'left', cursor: c.ok ? 'pointer' : 'not-allowed', opacity: c.ok ? 1 : 0.4, color: 'var(--text)' }}>
                      <span className="mono teal">{c.n}</span> &nbsp; {c.t} {!c.ok && <span className="tiny dim"> — locked</span>}
                    </button>
                  ))}
                  <div className="tiny dim">Chapters unlock as you complete them. Replaying keeps your existing evidence.</div>
                </div>
              )}
              {sub === 'about' && <About />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function About() {
  return (
    <div className="small" style={{ lineHeight: 1.65, color: '#c3d0d2' }}>
      <p style={{ marginTop: 0 }}>
        <b>PlanetDetective: Mission 2077</b> is an educational planetary-science simulation inspired by the NASA Space Apps Challenge theme
        <i> “Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars.”</i> It is a fictional, fan-made project and is
        <b> not affiliated with or endorsed by NASA</b>.
      </p>
      <div className="label">Scientific integrity</div>
      <ul>
        <li>All instrument readings (temperatures, lab results, GPR, wind, bearing strength) are <b>simulated game values</b>, labelled as such.</li>
        <li>Qaidam zones and the Mars research zone are <b>representative reconstructions</b>; positions are game-world metres, not survey coordinates.</li>
        <li>Mars features (layered sulfate-bearing rock, Ca-sulfate-like veins, ripples, wind-eroded ridges, a candidate pit) are modelled on feature <i>types</i> documented by Mars missions, not on a specific site.</li>
        <li>No discovery of life is implied. Habitability findings are recorded as confirmed / inconclusive / absent.</li>
        <li>Signal delay is compressed to seconds for playability; real one-way light time to Mars is roughly 3–22 minutes.</li>
      </ul>
      <div className="label">General background (public sources)</div>
      <ul>
        <li>NASA Mars Exploration Program — Mars facts (gravity ~0.38 g, thin CO₂ atmosphere ~0.6% of Earth sea-level pressure, mean surface ≈ −60 °C).</li>
        <li>NASA Planetary Data System (PDS) and NASA Earthdata — sources for real planetary and Earth-observation data.</li>
        <li>USGS EarthExplorer and Copernicus Data Space — Earth imagery &amp; elevation data.</li>
        <li>Peer-reviewed literature describes the Qaidam Basin (incl. Dalangtan playa and western Qaidam yardang fields) as a Mars analogue for evaporites and aeolian landforms.</li>
      </ul>
      <div className="label">Credits</div>
      <ul>
        <li>Engine: React, Three.js, React Three Fiber, Drei, Zustand, Vite.</li>
        <li>All terrain, models, textures and sounds are generated procedurally at runtime (original).</li>
        <li>Radio voice uses your browser’s speech synthesis when enabled.</li>
      </ul>
    </div>
  );
}
