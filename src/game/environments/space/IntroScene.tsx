import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { EarthGlobe, Starfield, latLonToVec } from './planets';
import { useGame } from '../../core/store';
import { fadeTo } from '../../core/ui';
import { audio } from '../../core/audio';
import { smoothstep, lerp } from '../../core/noise';

const QAIDAM: [number, number] = [37.3, 94.5]; // approximate basin centre (degrees)
const DURATION = 27;

function CameraRig({ t }: { t: React.MutableRefObject<number> }) {
  useFrame(({ camera }, dt) => {
    t.current += dt;
    const k = t.current;
    let lat: number, lon: number, dist: number;
    if (k < 8) {
      const a = smoothstep(0, 8, k);
      lat = lerp(8, 18, a); lon = lerp(10, 55, a); dist = lerp(46, 36, a);
    } else if (k < 16) {
      const a = smoothstep(8, 16, k);
      lat = lerp(18, QAIDAM[0], a); lon = lerp(55, QAIDAM[1], a); dist = lerp(36, 19, a);
    } else {
      const a = smoothstep(16, 24, k);
      lat = QAIDAM[0] - a * 3; lon = QAIDAM[1]; dist = lerp(19, 13.4, a);
    }
    const p = latLonToVec(lat, lon, dist);
    camera.position.copy(p);
    const target = latLonToVec(QAIDAM[0], QAIDAM[1], 10);
    const look = new THREE.Vector3(0, 0, 0).lerp(target, smoothstep(10, 22, k));
    camera.lookAt(look);
  });
  return null;
}

/** Keeps the sun on the camera's side (slightly off-axis) so the target region stays lit with a visible terminator. */
function SunFollow() {
  const ref = useRef<THREE.DirectionalLight>(null);
  useFrame(({ camera }) => {
    if (!ref.current) return;
    const p = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.9);
    p.y += 15;
    ref.current.position.copy(p);
  });
  return <directionalLight ref={ref} intensity={2.8} color="#fff6ea" />;
}

export function IntroScene() {
  const setPhase = useGame((s) => s.setPhase);
  const t = useRef(0);
  const [time, setTime] = useState(0);
  const done = useRef(false);

  const finish = async () => {
    if (done.current) return;
    done.current = true;
    await fadeTo(1, 900);
    audio.stopLoop('space');
    setPhase('briefing');
    fadeTo(0, 700);
  };

  useEffect(() => {
    audio.startLoop('space');
    fadeTo(0, 2000);
    const id = setInterval(() => {
      setTime(t.current);
      if (t.current > DURATION) finish();
    }, 100);
    const key = (e: KeyboardEvent) => { if (['Space', 'Enter', 'Escape'].includes(e.code)) finish(); };
    window.addEventListener('keydown', key);
    return () => { clearInterval(id); window.removeEventListener('keydown', key); audio.stopLoop('space'); };
  }, []);

  const show = (a: number, b: number) => ({ opacity: smoothstep(a, a + 1.2, time) * (1 - smoothstep(b - 1.2, b, time)), transition: 'opacity .2s' });
  return (
    <div className="letterbox" style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas camera={{ fov: 40, near: 0.1, far: 3000, position: [0, 0, 46] }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={['#000']} />
        <Starfield />
        <ambientLight intensity={0.08} />
        <SunFollow />
        <EarthGlobe radius={10} spin={0} markerLatLon={QAIDAM} />
        <CameraRig t={t} />
      </Canvas>
      <div className="cine-title" style={show(0.5, 7)}>
        <div className="mono" style={{ letterSpacing: '0.6em', color: 'var(--teal)', fontSize: 14 }}>EARTH · YEAR 2077</div>
      </div>
      <div className="subtitle" style={show(3, 9)}>
        2077. Humanity is getting ready to send people to Mars.
      </div>
      <div className="cine-title" style={{ ...show(9.5, 15.5), zIndex: 32 }}>
        <div className="mono teal" style={{ letterSpacing: '0.3em', marginBottom: 20, fontSize: 18, textShadow: '0 2px 6px #000' }}>YOUR JOB</div>
        <div style={{ display: 'flex', gap: 18 }}>
          {[['1', 'Study a Mars-like desert on Earth'], ['2', 'Drive a rover on Mars'], ['3', 'Compare the two']].map(([n, t]) => (
            <div key={n} className="panel" style={{ padding: '18px 22px', width: 250, textAlign: 'left', borderTop: '3px solid var(--teal)', background: 'rgba(5,10,14,.88)' }}>
              <div className="mono teal" style={{ fontSize: 30 }}>{n}</div>
              <div style={{ fontSize: 20, marginTop: 6, fontWeight: 500, lineHeight: 1.3 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'fixed', left: '56%', top: '38%', zIndex: 32, ...show(15.5, 23) }}>
        <div className="panel" style={{ padding: '16px 20px', borderLeft: '3px solid var(--teal)', background: 'rgba(5,10,14,.88)' }}>
          <div className="mono tiny teal" style={{ letterSpacing: '0.2em' }}>TARGET · EARTH ANALOGUE SITE</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>Qaidam Basin</div>
          <div style={{ marginTop: 4, fontSize: 16, color: '#cfdcdf' }}>China · a cold, dry, salty desert that looks a bit like Mars</div>
          <div className="teal" style={{ marginTop: 8, fontSize: 16, fontWeight: 600 }}>Stage 1 starts here</div>
        </div>
      </div>
      <div className="cine-title" style={{ ...show(21.5, 28), background: 'radial-gradient(ellipse at center, rgba(0,0,0,.65), rgba(0,0,0,.2) 60%)', zIndex: 32 }}>
        <div style={{ fontSize: 58, fontWeight: 700, letterSpacing: '0.08em' }}>PLANETDETECTIVE</div>
        <div className="mono" style={{ letterSpacing: '0.7em', color: 'var(--teal)', marginTop: 10 }}>MISSION 2077</div>
        
      </div>
      <button className="btn sm" style={{ position: 'fixed', right: 24, bottom: 'calc(9vh + 14px)', zIndex: 40 }} onClick={finish}>Skip ▸</button>
    </div>
  );
}
