import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Heightfield } from '../../core/terrain';
import { PlayerController, runtime } from '../../player/PlayerController';
import { useGame, worldProgress, catStatus, comparisonProgress } from '../../core/store';
import { useUI, radio, fadeTo, wait } from '../../core/ui';
import { audio } from '../../core/audio';
import { matches, isTyping, keyLabel } from '../../core/input';
import { Laptop } from '../../../laptop/desktop/Laptop';
import { GameCanvas } from '../../core/GameCanvas';
import { RadioFeed, Toasts } from '../../../ui/common';
import { PauseMenu } from '../../../ui/pause/PauseMenu';
import { CATEGORIES } from '../../../data/scientific-checklist/categories';
import { rover } from '../../rover/roverSim';

const flat = new Heightfield(60, 4, () => 0);
const DESK = new THREE.Vector3(0, 0, 1.2);
const LAPTOP_POS = new THREE.Vector3(0, 0.79, 0.95);
const hqState = { mode: 'walk' as 'walk' | 'sitting' | 'laptop' | 'standing' | 'finale', t: 0, from: new THREE.Vector3(), fromQ: new THREE.Quaternion(), finaleT: 0 };

function makeScreenTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 1024, h = 512) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const redraw = () => { ctx.clearRect(0, 0, w, h); draw(ctx, w, h); tex.needsUpdate = true; };
  redraw();
  return { tex, redraw };
}

function frame(ctx: CanvasRenderingContext2D, w: number, h: number, title: string) {
  ctx.fillStyle = '#071014'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(79,209,197,.35)'; ctx.lineWidth = 2; ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = '#4fd1c5'; ctx.font = '600 30px JetBrains Mono, monospace'; ctx.fillText(title, 26, 50);
  ctx.fillStyle = 'rgba(79,209,197,.15)'; ctx.fillRect(26, 62, w - 52, 2);
}

function VideoWall() {
  const g = useGame();
  const screens = useMemo(() => {
    const left = makeScreenTexture((ctx, w, h) => {
      const s = useGame.getState();
      frame(ctx, w, h, 'EARTH DATASET · QAIDAM BASIN');
      CATEGORIES.forEach((c, i) => {
        const st = catStatus('earth', c.id, s);
        ctx.fillStyle = '#b8c8cb'; ctx.font = '24px Inter, sans-serif';
        ctx.fillText(`${c.num}  ${c.title}`, 30, 104 + i * 48);
        ctx.fillStyle = st === 'COMPLETED' ? '#4fd1c5' : '#f0a830'; ctx.font = '20px JetBrains Mono, monospace';
        ctx.fillText(st, w - 260, 104 + i * 48);
      });
    });
    const center = makeScreenTexture((ctx, w, h) => {
      const s = useGame.getState();
      const done = s.reportSubmitted || hqState.mode === 'finale';
      ctx.fillStyle = '#05090c'; ctx.fillRect(0, 0, w, h);
      // stylised Mars
      const grd = ctx.createRadialGradient(w * 0.3, h * 0.55, 10, w * 0.3, h * 0.55, 180);
      grd.addColorStop(0, '#d98a5a'); grd.addColorStop(0.7, '#9b4e2e'); grd.addColorStop(1, '#2a1209');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(w * 0.3, h * 0.55, 170, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4fd1c5'; ctx.font = '600 32px JetBrains Mono, monospace';
      ctx.fillText(done ? 'MISSION 2077 · RESULTS' : 'MARS MISSION STATUS', 30, 54);
      const ep = worldProgress('earth', s), mp = worldProgress('mars', s), cp = comparisonProgress(s);
      const lines = done
        ? [['EARTH INVESTIGATION', 'COMPLETE'], ['MARS INVESTIGATION', 'COMPLETE'], ['SCIENTIFIC COMPARISON', 'COMPLETE'], ['MISSION STATUS', 'SUCCESS']]
        : [['ROVER', 'ARES-6'], ['LINK', s.marsStarted ? 'ACTIVE' : 'STANDBY'], ['EARTH DATASET', `${ep.completed}/8`], ['MARS DATASET', `${mp.completed}/8`], ['COMPARISON', `${cp.classified}/${cp.total}`]];
      lines.forEach(([a, b], i) => {
        ctx.fillStyle = '#9fb3b6'; ctx.font = '26px JetBrains Mono, monospace'; ctx.fillText(a, w * 0.55, 140 + i * 64);
        ctx.fillStyle = b === 'SUCCESS' || b === 'COMPLETE' ? '#6ee7a0' : '#ffffff'; ctx.font = '700 30px JetBrains Mono, monospace';
        ctx.fillText(b, w * 0.55, 172 + i * 64);
      });
    });
    const right = makeScreenTexture((ctx, w, h) => {
      frame(ctx, w, h, 'ARES-6 · ROVER TELEMETRY');
      ctx.strokeStyle = '#4fd1c5'; ctx.lineWidth = 3;
      ctx.strokeRect(w * 0.15, h * 0.35, w * 0.4, h * 0.22);
      [0.18, 0.35, 0.52].forEach((x) => { ctx.beginPath(); ctx.arc(w * x, h * 0.68, 26, 0, Math.PI * 2); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(w * 0.48, h * 0.35); ctx.lineTo(w * 0.48, h * 0.16); ctx.stroke();
      ctx.strokeRect(w * 0.44, h * 0.12, w * 0.1, h * 0.05);
      ctx.fillStyle = '#b8c8cb'; ctx.font = '24px JetBrains Mono, monospace';
      const s = useGame.getState();
      [[`BATTERY`, `${rover.battery.toFixed(0)}%`], ['MODE', s.marsStarted ? rover.mode : 'STANDBY'], ['ODOMETRY', `${rover.odometry.toFixed(0)} m`], ['SOL', `${rover.sol}`]].forEach(([a, b], i) => {
        ctx.fillStyle = '#7e9196'; ctx.fillText(a, w * 0.65, 140 + i * 60);
        ctx.fillStyle = '#fff'; ctx.fillText(b, w * 0.65, 168 + i * 60);
      });
    });
    return { left, center, right };
  }, []);
  useEffect(() => {
    const id = setInterval(() => { screens.left.redraw(); screens.center.redraw(); screens.right.redraw(); }, 1500);
    return () => clearInterval(id);
  }, [screens]);
  useEffect(() => { screens.center.redraw(); }, [g.reportSubmitted]);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (glow.current) glow.current.color.setScalar(hqState.mode === 'finale' ? 1.0 + Math.sin(clock.elapsedTime * 3) * 0.1 : 0.9);
  });
  return (
    <group position={[0, 0, -9.4]}>
      <mesh position={[-7.4, 3.3, 0]}>
        <planeGeometry args={[6.6, 3.3]} />
        <meshBasicMaterial map={screens.left.tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.6, 0]}>
        <planeGeometry args={[7.6, 3.8]} />
        <meshBasicMaterial ref={glow} map={screens.center.tex} toneMapped={false} />
      </mesh>
      <mesh position={[7.4, 3.3, 0]}>
        <planeGeometry args={[6.6, 3.3]} />
        <meshBasicMaterial map={screens.right.tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.4, -0.05]}>
        <planeGeometry args={[23, 5]} />
        <meshStandardMaterial color="#0b0f12" metalness={0.5} roughness={0.4} />
      </mesh>
      <pointLight args={['#6fd6e0', 6, 14]} position={[0, 3.4, 1.5]} />
    </group>
  );
}

function Person({ position, rot = 0, seated = true, color = '#3b5560', seed = 0 }: { position: [number, number, number]; rot?: number; seated?: boolean; color?: string; seed?: number }) {
  const head = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 3.1;
    if (head.current) { head.current.rotation.y = Math.sin(t * 0.4) * 0.35; head.current.rotation.x = Math.sin(t * 0.7) * 0.08; }
    if (body.current) {
      const stand = hqState.mode === 'finale' && hqState.finaleT > 2 + (seed % 4) * 0.4;
      const target = stand ? 0.45 : 0;
      body.current.position.y += (target - body.current.position.y) * 0.05;
    }
  });
  const y0 = seated ? 0 : 0.4;
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <group ref={body}>
        <mesh position={[0, 0.95 + y0, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.5, 4, 10]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh ref={head} position={[0, 1.45 + y0, 0]} castShadow>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshStandardMaterial color={['#c99d7c', '#8d5f43', '#e0bfa0', '#6b4630'][seed % 4]} roughness={0.6} />
        </mesh>
        {seated && (
          <mesh position={[0, 0.5, 0.05]}>
            <boxGeometry args={[0.45, 0.12, 0.5]} />
            <meshStandardMaterial color="#20262c" />
          </mesh>
        )}
      </group>
    </group>
  );
}

function Workstation({ position, rot = 0, seed = 0, person = true }: { position: [number, number, number]; rot?: number; seed?: number; person?: boolean }) {
  const scr = useMemo(() => makeScreenTexture((ctx, w, h) => {
    ctx.fillStyle = '#081116'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ['#4fd1c5', '#f0a830', '#67d8ef'][seed % 3]; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = 0; x < w; x += 8) ctx.lineTo(x, h * 0.5 + Math.sin(x * 0.03 + seed) * 50 + Math.sin(x * 0.11) * 15);
    ctx.stroke();
    ctx.fillStyle = '#9fb3b6'; ctx.font = '22px JetBrains Mono';
    for (let i = 0; i < 4; i++) ctx.fillText(`CH${seed}${i}  ${(Math.sin(seed + i) * 50 + 50).toFixed(1)}`, 20, 40 + i * 30);
  }, 512, 300), [seed]);
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.05, 0.8]} />
        <meshStandardMaterial color="#2a3037" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.38, -0.3]}>
        <boxGeometry args={[1.7, 0.74, 0.05]} />
        <meshStandardMaterial color="#1c2126" />
      </mesh>
      {[-0.45, 0.45].map((x, i) => (
        <group key={i} position={[x, 1.08, -0.22]} rotation={[0, -x * 0.4, 0]}>
          <mesh>
            <boxGeometry args={[0.8, 0.5, 0.03]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[0.76, 0.45]} />
            <meshBasicMaterial map={scr.tex} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {person && <Person position={[0, 0, 0.65]} rot={Math.PI} seed={seed} color={['#2f4a56', '#4a3f56', '#3b4a3a', '#56463a'][seed % 4]} />}
    </group>
  );
}

function PlayerLaptop() {
  const scr = useMemo(() => makeScreenTexture((ctx, w, h) => {
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#0a1a1f'); grd.addColorStop(1, '#03070a');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4fd1c5'; ctx.font = '600 44px Inter'; ctx.textAlign = 'center';
    ctx.fillText('ORBITAL OS', w / 2, h / 2 - 10);
    ctx.font = '22px JetBrains Mono'; ctx.fillStyle = '#7e9196';
    ctx.fillText('PRESS E TO LOG IN', w / 2, h / 2 + 34);
  }, 640, 400), []);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (mat.current) mat.current.color.setScalar(0.85 + Math.sin(clock.elapsedTime * 2) * 0.1); });
  return (
    <group position={LAPTOP_POS.toArray()}>
      <mesh castShadow>
        <boxGeometry args={[0.42, 0.018, 0.29]} />
        <meshStandardMaterial color="#3a3f45" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.011, 0.03]}>
        <planeGeometry args={[0.36, 0.13]} />
        <meshStandardMaterial color="#15181b" />
      </mesh>
      <group position={[0, 0.01, -0.145]} rotation={[-0.32, 0, 0]}>
        <mesh position={[0, 0.14, 0]} castShadow>
          <boxGeometry args={[0.42, 0.28, 0.012]} />
          <meshStandardMaterial color="#3a3f45" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.14, 0.0065]}>
          <planeGeometry args={[0.39, 0.25]} />
          <meshBasicMaterial ref={mat} map={scr.tex} toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0, 0.25, 0.1]} intensity={0.4} distance={1.5} color="#4fd1c5" />
    </group>
  );
}

function Room() {
  const floor = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2a3036'; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#353c43'; ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 6);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 22]} />
        <meshStandardMaterial map={floor} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6, 0]}>
        <planeGeometry args={[30, 22]} />
        <meshStandardMaterial color="#0e1114" />
      </mesh>
      {[[0, 3, -10, 0], [0, 3, 11, Math.PI], [-15, 3, 0, Math.PI / 2], [15, 3, 0, -Math.PI / 2]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, r, 0]} receiveShadow>
          <planeGeometry args={[i < 2 ? 30 : 22, 6]} />
          <meshStandardMaterial color="#262d33" roughness={0.75} />
        </mesh>
      ))}
      {/* ceiling light strips */}
      {[-6, 0, 6].map((x) => (
        <mesh key={x} position={[x, 5.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, 18]} />
          <meshBasicMaterial color="#7fa9ad" />
        </mesh>
      ))}
      {/* wall emblem */}
      <mesh position={[-14.9, 3.2, 3]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[1.2, 48]} />
        <meshBasicMaterial color="#123033" />
      </mesh>
    </group>
  );
}

function CameraDirector({ onSeated }: { onSeated: () => void }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    if (hqState.mode === 'sitting') {
      hqState.t = Math.min(1, hqState.t + dt / 1.6);
      const k = hqState.t * hqState.t * (3 - 2 * hqState.t);
      const target = LAPTOP_POS.clone().add(new THREE.Vector3(0, 0.3, 0.42));
      cam.position.lerpVectors(hqState.from, target, k);
      const look = new THREE.Matrix4().lookAt(target, LAPTOP_POS.clone().add(new THREE.Vector3(0, 0.13, -0.1)), new THREE.Vector3(0, 1, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(look);
      cam.quaternion.slerpQuaternions(hqState.fromQ, q, k);
      if (hqState.t >= 1) { hqState.mode = 'laptop'; onSeated(); }
    } else if (hqState.mode === 'finale') {
      hqState.finaleT += dt;
      const k = Math.min(1, hqState.finaleT / 6);
      const e = k * k * (3 - 2 * k);
      const from = LAPTOP_POS.clone().add(new THREE.Vector3(0, 0.3, 0.42));
      const to = new THREE.Vector3(0, 2.4, 4.5);
      cam.position.lerpVectors(from, to, e);
      cam.lookAt(new THREE.Vector3(0, 0.9, 0.5).lerp(new THREE.Vector3(0, 3.4, -9.4), e));
    }
  });
  return null;
}

export function HQScene() {
  const g = useGame();
  const panel = useUI((s) => s.panel);
  const prompt = useUI((s) => s.prompt);
  const [mode, setMode] = useState<typeof hqState.mode>('walk');
  const shadowQ = useGame((s) => s.settings.gfx.shadows);
  const keys = useGame((s) => s.settings.keys);

  useEffect(() => {
    hqState.mode = 'walk';
    runtime.pos.set(0, 0, 8.5);
    runtime.yaw = 0;
    runtime.pitch = -0.08;
    audio.startLoop('hq');
    fadeTo(0, 1400);
    if (!g.hqVisited) {
      useGame.setState({ hqVisited: true });
      setTimeout(() => radio('MISSION DIRECTOR', 'Welcome back to Mission Operations. Your Qaidam dataset is on the wall. Take your workstation — the rover team is ready for you.'), 1500);
      g.addJournal({ world: 'hq', kind: 'event', title: 'Arrived at Mission Operations Centre', text: 'Earth dataset uploaded to the analysis system.' });
    }
    return () => { audio.stopLoop('hq'); };
  }, []);

  // interaction prompt for the laptop
  useEffect(() => {
    const id = setInterval(() => {
      if (hqState.mode !== 'walk') { useUI.getState().setPrompt(null); return; }
      const d = Math.hypot(runtime.pos.x - DESK.x, runtime.pos.z - (DESK.z + 0.4));
      useUI.getState().setPrompt(d < 1.8 ? 'Use workstation laptop' : null);
    }, 120);
    return () => clearInterval(id);
  }, []);

  const sit = () => {
    const cam = (window as any).__hqCam as THREE.Camera | undefined;
    if (!cam) return;
    hqState.from.copy(cam.position);
    hqState.fromQ.copy(cam.quaternion);
    hqState.t = 0;
    hqState.mode = 'sitting';
    setMode('sitting');
    audio.ui('key');
  };
  const exitLaptop = () => {
    audio.ui('close');
    hqState.mode = 'walk';
    setMode('walk');
    runtime.pos.set(DESK.x, 0, DESK.z + 1.1);
    runtime.yaw = 0;
    runtime.pitch = -0.35;
  };
  const submit = async () => {
    hqState.mode = 'finale';
    hqState.finaleT = 0;
    setMode('finale');
    audio.ui('confirm');
    radio('MISSION CONTROL', 'Final report received. Distributing to the science teams now.');
    await wait(4500);
    radio('MISSION DIRECTOR', 'Everyone — the research objectives have been achieved. Earth analogue work, Mars operations, and an honest comparison. This is how we get to Mars. Well done.');
    await wait(8000);
    await fadeTo(1, 1800);
    g.setPhase('ending');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (hqState.mode === 'walk' && matches(e, 'interact') && useUI.getState().prompt && !useUI.getState().panel) sit();
      if (e.code === 'Escape' && useUI.getState().panel === 'pause') return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ep = worldProgress('earth', g);
  return (
    <>
      <GameCanvas camera={{ fov: 70, position: [0, 1.7, 8.5], near: 0.03, far: 100 }} onCreated={({ camera, scene }) => { (window as any).__hqCam = camera; scene.background = new THREE.Color('#07090b'); scene.fog = new THREE.Fog('#07090b', 18, 40); }}>
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#bfe', '#223', 0.6]} />
        <pointLight position={[0, 5, 0]} intensity={70} distance={26} decay={1.6} color="#d6f3f5" castShadow={shadowQ === 'high' || shadowQ === 'medium'} />
        <pointLight position={[-8, 5, 4]} intensity={40} distance={20} decay={1.6} color="#d6f3f5" />
        <pointLight position={[8, 5, 4]} intensity={40} distance={20} decay={1.6} color="#d6f3f5" />
        <Room />
        <VideoWall />
        {[-8, -4, 4, 8].map((x, i) => <Workstation key={x} position={[x, 0, -3]} seed={i + 1} />)}
        {[-8, -4, 4, 8].map((x, i) => <Workstation key={'b' + x} position={[x, 0, 4.5]} seed={i + 5} person={i % 2 === 0} />)}
        <Workstation position={[0, 0, 0.6]} seed={0} person={false} />
        <PlayerLaptop />
        <Person position={[-11, 0, -6]} rot={0.6} seated={false} seed={9} color="#41505a" />
        <Person position={[10.5, 0, 1]} rot={-1.2} seated={false} seed={10} color="#5a4a41" />
        {mode === 'walk' && <PlayerController hf={flat} obstacles={[
          ...[-8, -4, 4, 8].flatMap((x) => [{ x, z: -3, r: 1.0 }, { x: x - 0.6, z: -3, r: 0.8 }, { x: x + 0.6, z: -3, r: 0.8 }, { x, z: 4.5, r: 1.0 }, { x: x - 0.6, z: 4.5, r: 0.8 }, { x: x + 0.6, z: 4.5, r: 0.8 }]),
          { x: 0, z: 0.6, r: 0.75 }, { x: -0.6, z: 0.6, r: 0.7 }, { x: 0.6, z: 0.6, r: 0.7 },
        ]} bounds={{ radius: 0, rect: [-14, -9, 14, 10] }} walk={2.6} sprint={4.5} showBody={false} />}
        <CameraDirector onSeated={() => setMode('laptop')} />
      </GameCanvas>
      {mode === 'walk' && (
        <div className="layer" style={{ zIndex: 10 }}>
          <div className="hud-top">
            <div className="hud-block">
              <div className="big">IPARC MISSION OPERATIONS CENTRE</div>
              <div className="dim" style={{ marginTop: 4 }}>CHAPTER 03 · RETURN TO MISSION CONTROL · EARTH {ep.completed}/8</div>
            </div>
          </div>
          <div className="objective panel">
            <div className="label">Objective</div>
            <div className="small" style={{ marginTop: 6 }}>{g.reportSubmitted ? 'Mission complete. Revisit your workstation any time.' : g.marsStarted ? 'Continue Mars operations at your workstation.' : 'Go to your workstation (front row, centre) and use the laptop.'}</div>
          </div>
          {!panel && <div className="crosshair"><div className="dot" /></div>}
          {!panel && prompt && <div className="prompt panel"><span className="kbd">{keyLabel(keys.interact)}</span> {prompt}</div>}
          {!panel && !useUI.getState().locked && !runtime.lockFailed && (
            <div className="panel mono small" style={{ position: 'fixed', left: '50%', top: '64%', transform: 'translateX(-50%)', padding: '10px 16px', pointerEvents: 'none' }}>CLICK TO CAPTURE MOUSE (or drag to look) · WASD to walk</div>
          )}
          <RadioFeed />
          <Toasts />
          {panel === 'pause' && <PauseMenu />}
        </div>
      )}
      {mode === 'laptop' && <Laptop onExit={exitLaptop} onSubmit={submit} />}
      {mode === 'finale' && (
        <div className="layer letterbox" style={{ zIndex: 10 }}>
          <RadioFeed style={{ bottom: '14vh' }} />
        </div>
      )}
    </>
  );
}
