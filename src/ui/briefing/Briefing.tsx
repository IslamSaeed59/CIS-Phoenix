import * as THREE from 'three';
import { gfxDpr } from '../../game/core/graphics';
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGame } from '../../game/core/store';
import { fadeTo } from '../../game/core/ui';
import { audio } from '../../game/core/audio';
import { CATEGORIES } from '../../data/scientific-checklist/categories';
import { EarthGlobe, Starfield } from '../../game/environments/space/planets';
import { TOOLS } from '../../game/instruments/earthInstruments';

const STEPS = [
  { n: '1', title: 'Explore Earth', text: 'Walk a Mars-like desert in China and collect evidence.', where: 'Qaidam Basin' },
  { n: '2', title: 'Drive on Mars', text: 'Control a rover from headquarters. Collect the same evidence.', where: 'Mission Control' },
  { n: '3', title: 'Compare', text: 'Find what is similar, what is different, and submit your report.', where: 'Your laptop' },
];

export function Briefing() {
  const setPhase = useGame((s) => s.setPhase);
  const [details, setDetails] = useState(false);
  const begin = async () => {
    audio.ui('confirm');
    await fadeTo(1, 900);
    setPhase('earth');
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 70% 40%, #0f1b20, #05080a 70%)' }}>
      <div style={{ position: 'absolute', right: '-10vw', top: '-4vh', width: '60vw', height: '108vh', opacity: 0.5 }}>
        <Canvas dpr={gfxDpr(useGame.getState().settings.gfx)} gl={{ antialias: useGame.getState().settings.gfx.aa, toneMapping: THREE.ACESFilmicToneMapping }} camera={{ position: [0, 4, 38], fov: 40 }}>
          <Starfield count={1500} />
          <directionalLight position={[10, 10, 30]} intensity={2.4} />
          <ambientLight intensity={0.08} />
          <group rotation={[0.3, -1.9, 0]}>
            <EarthGlobe radius={9} spin={0.03} markerLatLon={[37.3, 94.5]} />
          </group>
        </Canvas>
      </div>

      <div style={{ position: 'absolute', left: '7vw', top: '50%', transform: 'translateY(-50%)', width: 'min(560px, 86vw)' }}>
        <div className="mono teal small" style={{ letterSpacing: '0.3em' }}>YOUR MISSION</div>
        <div style={{ fontSize: 38, fontWeight: 700, margin: '8px 0 6px', lineHeight: 1.1 }}>Get humanity ready for Mars</div>
        <div className="dim" style={{ fontSize: 15, marginBottom: 26 }}>Three stages. Follow the cyan beacon — it always shows your next goal.</div>

        <div className="col" style={{ gap: 10 }}>
          {STEPS.map((s, i) => (
            <div key={s.n} className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '14px 16px', borderColor: i === 0 ? 'var(--teal)' : 'var(--line)', background: i === 0 ? 'rgba(79,209,197,.07)' : undefined }}>
              <div className="mono" style={{ fontSize: 26, color: i === 0 ? 'var(--teal)' : 'var(--dim)', width: 26 }}>{s.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{s.title}</div>
                <div className="small dim" style={{ marginTop: 2 }}>{s.text}</div>
              </div>
              <span className="tag">{s.where}</span>
            </div>
          ))}
        </div>

        <div className="row small dim" style={{ marginTop: 22, gap: 14, flexWrap: 'wrap' }}>
          <span><span className="kbd">WASD</span> move</span>
          <span><span className="kbd">E</span> interact</span>
          <span><span className="kbd">1–7</span> tools</span>
          <span><span className="kbd">Click</span> use tool</span>
          <span><span className="kbd">Tab</span> checklist</span>
          <span><span className="kbd">T</span> quick travel</span>
        </div>

        <div className="row" style={{ marginTop: 24 }}>
          <button className="btn primary" style={{ padding: '13px 30px', fontSize: 13 }} onClick={begin}>Start ▸</button>
          <button className="btn ghost" onClick={() => setDetails(true)}>Mission details</button>
          <button className="btn ghost" onClick={() => setPhase('menu')}>Menu</button>
        </div>
      </div>

      {details && (
        <div className="overlay" onClick={() => setDetails(false)}>
          <div className="window" style={{ width: 'min(760px, 92vw)', maxHeight: '84vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="win-head">
              <span className="win-title">Mission details</span>
              <button className="btn sm" onClick={() => setDetails(false)}>Close</button>
            </div>
            <div className="scroll" style={{ padding: 18 }}>
              <div className="small" style={{ lineHeight: 1.6 }}>
                <b>Qaidam Basin, China</b> — a dry, high desert with salt flats and wind-carved ridges, similar in some ways to Mars.
                The zones in the game are a representative reconstruction.
              </div>
              <div className="label" style={{ margin: '14px 0 6px' }}>8 evidence categories (NASA Space Apps analogue themes)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {CATEGORIES.map((c) => <div key={c.id} className="small"><span className="mono teal">{c.num}</span> {c.title}</div>)}
              </div>
              <div className="label" style={{ margin: '14px 0 6px' }}>Tools</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {TOOLS.map((t) => <div key={t.id} className="small"><span className="kbd">{t.key}</span> {t.name}</div>)}
              </div>
              <div className="tiny dim" style={{ marginTop: 14, lineHeight: 1.6 }}>
                All readings are simulated. You are scored on careful, honest interpretation — not speed. Fictional game, not affiliated with or endorsed by NASA.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
