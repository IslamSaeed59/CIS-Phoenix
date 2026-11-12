import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { EarthGlobe, MarsGlobe, Starfield } from './planets';
import { useGame, scienceScore } from '../../core/store';
import { fadeTo } from '../../core/ui';
import { audio } from '../../core/audio';
import { smoothstep, lerp } from '../../core/noise';

const MARS_POS = new THREE.Vector3(0, 0, -700);

function Ship({ t }: { t: React.MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const k = t.current;
    if (!g.current) return;
    // Position: parked in orbit, then burns toward Mars, arrives in Mars orbit
    const start = new THREE.Vector3(14, 2, 6);
    let p = start.clone();
    if (k > 15 && k < 30) {
      const a = smoothstep(15, 30, k);
      p = start.clone().lerp(MARS_POS.clone().add(new THREE.Vector3(-13, 5, 8)), a * a);
    } else if (k >= 30) {
      const a = (k - 30) * 0.05;
      p = MARS_POS.clone().add(new THREE.Vector3(-13 - a * 2, 5 + a * 0.5, 8 - a * 2));
    }
    g.current.position.copy(p);
    g.current.rotation.set(0, 0, 0);
    g.current.lookAt(MARS_POS);
    if (ring.current) ring.current.rotation.z += dt * 0.4;
    if (flame.current) {
      const on = k > 13.5 && k < 29 ? 1 : 0;
      flame.current.scale.set(0.7, on * (1.0 + Math.random() * 0.25), 0.7);
      (flame.current.material as THREE.MeshBasicMaterial).opacity = on * 0.45;
    }
  });
  const hull = '#d7d9dc';
  return (
    <group ref={g}>
      <group rotation={[0, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 3.2, 20]} />
          <meshStandardMaterial color={hull} metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 1.9]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.35, 0.6, 20]} />
          <meshStandardMaterial color={hull} metalness={0.6} roughness={0.35} />
        </mesh>
        <group ref={ring} position={[0, 0, 0.3]}>
          <mesh>
            <torusGeometry args={[1.1, 0.12, 12, 48]} />
            <meshStandardMaterial color="#bfc3c8" metalness={0.7} roughness={0.3} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} position={[0, 0, 0]}>
              <boxGeometry args={[2.2, 0.05, 0.05]} />
              <meshStandardMaterial color="#9aa" />
            </mesh>
          ))}
        </group>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.9, 0, -0.6]}>
            <boxGeometry args={[2.4, 0.02, 0.8]} />
            <meshStandardMaterial color="#1b2a4a" metalness={0.7} roughness={0.2} emissive="#0a1020" />
          </mesh>
        ))}
        <mesh position={[0, 0, -1.8]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.32, 0.5, 20, 1, true]} />
          <meshStandardMaterial color="#444" metalness={0.8} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={flame} position={[0, 0, -2.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.28, 1.6, 16, 1, true]} />
          <meshBasicMaterial color="#5fb4ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function Director({ t }: { t: React.MutableRefObject<number> }) {
  useFrame(({ camera }, dt) => {
    t.current += dt;
    const k = t.current;
    const cam = camera as THREE.PerspectiveCamera;
    if (k < 8) {
      const a = smoothstep(0, 8, k);
      cam.position.set(lerp(-30, -6, a), lerp(10, 4, a), lerp(38, 26, a));
      cam.lookAt(0, 0, 0);
    } else if (k < 15) {
      const a = smoothstep(8, 15, k);
      cam.position.set(lerp(9, 17, a), lerp(3.5, 2.6, a), lerp(12, 9, a));
      cam.lookAt(lerp(5, 14, a), 2, lerp(2, 6, a));
    } else if (k < 22) {
      const a = smoothstep(15, 22, k);
      const ship = new THREE.Vector3(14, 2, 6).lerp(MARS_POS.clone().add(new THREE.Vector3(-13, 5, 8)), Math.pow(smoothstep(15, 30, k), 2));
      cam.position.copy(ship.clone().add(new THREE.Vector3(lerp(3, -4, a), lerp(1.5, 2.5, a), lerp(6, 9, a))));
      cam.lookAt(ship);
    } else if (k < 30) {
      const ship = new THREE.Vector3(14, 2, 6).lerp(MARS_POS.clone().add(new THREE.Vector3(-13, 5, 8)), Math.pow(smoothstep(15, 30, k), 2));
      cam.position.copy(ship.clone().add(new THREE.Vector3(-3, 2, 8)));
      cam.lookAt(ship.clone().add(new THREE.Vector3(0, 0, -20)));
    } else {
      const a = smoothstep(30, 40, k);
      cam.position.copy(MARS_POS.clone().add(new THREE.Vector3(lerp(18, 6, a), lerp(4, 6, a), lerp(26, 22, a))));
      cam.lookAt(MARS_POS.clone().add(new THREE.Vector3(lerp(6, -3, a), 0, 0)));
    }
    cam.fov = 45;
    cam.updateProjectionMatrix();
  });
  return null;
}

export function EndingScene() {
  const t = useRef(0);
  const [time, setTime] = useState(0);
  const g = useGame();
  const sc = scienceScore(g);
  useEffect(() => {
    audio.stopAll();
    audio.startLoop('space');
    fadeTo(0, 2000);
    const id = setInterval(() => setTime(t.current), 100);
    return () => { clearInterval(id); audio.stopLoop('space'); };
  }, []);
  const show = (a: number, b = 999) => ({ opacity: smoothstep(a, a + 1.5, time) * (1 - smoothstep(b - 1.5, b, time)), transition: 'opacity .3s' });
  const toMenu = async () => { await fadeTo(1, 900); g.setPhase('menu'); };
  return (
    <div className="letterbox" style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas camera={{ fov: 45, near: 0.1, far: 5000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={['#000']} />
        <Starfield count={6000} radius={2000} />
        <ambientLight intensity={0.06} />
        <directionalLight position={[100, 35, 35]} intensity={3.0} color="#fff4e6" />
        <pointLight position={[20, 6, 14]} intensity={60} distance={30} color="#cfe8ff" />
        <EarthGlobe radius={10} spin={0.015} />
        <group position={MARS_POS.toArray()}>
          <MarsGlobe radius={9} spin={0.01} />
        </group>
        <Ship t={t} />
        <Director t={t} />
      </Canvas>
      <div className="subtitle" style={show(1, 7.5)}>Mission Control has received your report. Earth investigation, Mars investigation and scientific comparison: complete.</div>
      <div className="subtitle" style={show(8, 14.5)}>Your findings feed directly into instrument design, rover mobility planning and dust mitigation for the next expedition.</div>
      <div className="subtitle" style={show(15, 22)}>Years later, a crewed vehicle departs Earth orbit.</div>
      <div className="subtitle" style={show(22.5, 29.5)}>Seven months of transit. Every route, every sample protocol, rehearsed first on Earth.</div>
      <div className="cine-title" style={{ ...show(32), zIndex: 35 }}>
        <div style={{ fontSize: 50, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center' }}>MISSION 2077</div>
        <div className="mono" style={{ color: 'var(--teal)', letterSpacing: '0.6em', marginTop: 8 }}>THE PATH TO MARS</div>
        <div style={{ marginTop: 30, fontSize: 18, fontStyle: 'italic', color: '#d8e2e4', maxWidth: 720, textAlign: 'center', ...show(35) }}>
          “Before humanity explored another world, it learned how to read its own.”
        </div>
        <div className="mono small" style={{ marginTop: 26, color: 'var(--dim)', ...show(38) }}>
          SCIENCE REVIEW SCORE {sc.total} · {sc.grade} · EVIDENCE ITEMS {sc.evidence}
        </div>
        <div style={{ marginTop: 22, pointerEvents: 'auto', ...show(39) }}>
          <button className="btn primary" onClick={toMenu}>Return to main menu</button>
        </div>
      </div>
      {time < 39 && <button className="btn sm" style={{ position: 'fixed', right: 24, bottom: 'calc(9vh + 14px)', zIndex: 40 }} onClick={() => { t.current = Math.max(t.current, 32); }}>Skip ▸</button>}
    </div>
  );
}
