import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useUI } from '../core/ui';
import { fpAnim, fpProgress } from './fpAnim';
import { runtime } from './PlayerController';

const SCREEN: Record<string, string> = {
  camera: '#1b2630', spectral: '#a78bfa', thermal: '#ff7a45', lidar: '#4fd1c5', gpr: '#67d8ef', env: '#6ee7a0', probe: '#f0a830',
};

/** Hand-drawn style materials that always render on top (no clipping into terrain). */
function mat(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...extra });
  m.depthTest = false;
  m.depthWrite = false;
  return m;
}

const ease = (t: number) => t * t * (3 - 2 * t);
const seg = (k: number, a: number, b: number) => ease(Math.min(1, Math.max(0, (k - a) / (b - a))));

function Glove({ left = false }: { left?: boolean }) {
  const m = useMemo(() => mat('#e07a2e'), []);
  const cuff = useMemo(() => mat('#3b4046'), []);
  return (
    <group scale={[left ? -1 : 1, 1, 1]}>
      <mesh material={m} renderOrder={10}><boxGeometry args={[0.085, 0.05, 0.11]} /></mesh>
      {[-0.03, -0.01, 0.01, 0.03].map((x, i) => (
        <mesh key={i} material={m} position={[x, -0.004, -0.075]} renderOrder={10}><capsuleGeometry args={[0.009, 0.035, 3, 6]} /></mesh>
      ))}
      <mesh material={m} position={[-0.05, 0, -0.02]} rotation={[0, 0, 0.9]} renderOrder={10}><capsuleGeometry args={[0.01, 0.03, 3, 6]} /></mesh>
      <mesh material={cuff} position={[0, 0, 0.08]} renderOrder={10}><cylinderGeometry args={[0.045, 0.05, 0.06, 12]} /></mesh>
      <mesh material={m} position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]} renderOrder={10}><cylinderGeometry args={[0.042, 0.05, 0.22, 10]} /></mesh>
    </group>
  );
}

function Device({ tool }: { tool: string }) {
  const body = useMemo(() => mat('#2b3036', { metalness: 0.4, roughness: 0.4 }), []);
  const screen = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: SCREEN[tool] ?? '#4fd1c5' });
    m.depthTest = false;
    m.depthWrite = false;
    m.toneMapped = false;
    return m;
  }, [tool]);
  const lens = useMemo(() => mat('#0b0d10', { metalness: 0.8, roughness: 0.2 }), []);
  if (tool === 'camera') {
    return (
      <group>
        <mesh material={body} renderOrder={11}><boxGeometry args={[0.15, 0.09, 0.06]} /></mesh>
        <mesh material={lens} position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]} renderOrder={12}><cylinderGeometry args={[0.032, 0.036, 0.07, 16]} /></mesh>
        <mesh material={screen} position={[0, 0, 0.031]} renderOrder={12}><planeGeometry args={[0.1, 0.06]} /></mesh>
      </group>
    );
  }
  if (tool === 'probe') {
    return (
      <group>
        <mesh material={body} renderOrder={11}><boxGeometry args={[0.05, 0.12, 0.05]} /></mesh>
        <mesh material={lens} position={[0, -0.22, 0]} renderOrder={11}><cylinderGeometry args={[0.008, 0.008, 0.34, 8]} /></mesh>
        <mesh material={screen} position={[0, 0.03, 0.026]} renderOrder={12}><planeGeometry args={[0.035, 0.03]} /></mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh material={body} renderOrder={11}><boxGeometry args={[0.13, 0.08, 0.17]} /></mesh>
      <mesh material={body} position={[0, -0.07, 0.03]} rotation={[0.3, 0, 0]} renderOrder={11}><boxGeometry args={[0.04, 0.1, 0.04]} /></mesh>
      <mesh material={screen} position={[0, 0.041, 0.01]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={12}><planeGeometry args={[0.1, 0.12]} /></mesh>
      <mesh material={lens} position={[0, 0, -0.09]} rotation={[Math.PI / 2, 0, 0]} renderOrder={12}><cylinderGeometry args={[0.025, 0.025, 0.02, 12]} /></mesh>
    </group>
  );
}

function Jar() {
  const glass = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.35, roughness: 0.1 });
    m.depthTest = false;
    m.depthWrite = false;
    return m;
  }, []);
  const lid = useMemo(() => mat('#4fd1c5'), []);
  const salt = useMemo(() => mat('#f4f1ea', { roughness: 0.4 }), []);
  return (
    <group>
      <mesh material={salt} position={[0, -0.02, 0]} renderOrder={13}><cylinderGeometry args={[0.03, 0.03, 0.05, 12]} /></mesh>
      <mesh material={glass} renderOrder={14}><cylinderGeometry args={[0.036, 0.036, 0.1, 16, 1, true]} /></mesh>
      <mesh material={lid} position={[0, 0.056, 0]} renderOrder={14}><cylinderGeometry args={[0.04, 0.04, 0.018, 16]} /></mesh>
    </group>
  );
}

export function FirstPersonRig() {
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const jar = useRef<THREE.Group>(null);
  const tool = useUI((s) => s.tool);
  const raised = useUI((s) => s.toolRaised);
  const third = useUI((s) => s.thirdPerson);
  const raiseK = useRef(0);

  useFrame(({ clock }, dt) => {
    if (!root.current) return;
    root.current.position.copy(camera.position);
    root.current.quaternion.copy(camera.quaternion);
    root.current.visible = !third;
    const k = fpProgress();
    const type = fpAnim.type;
    const t = clock.elapsedTime;
    const walk = Math.min(1, runtime.speed / 6);
    const bob = Math.sin(t * 9) * 0.012 * walk;

    // Right hand with device: raise/lower smoothly
    const wantRaise = raised || type === 'probe' ? 1 : 0;
    raiseK.current += (wantRaise - raiseK.current) * Math.min(1, dt * 8);
    if (right.current) {
      const r = raiseK.current;
      let y = -0.42 + r * 0.17 + bob, z = -0.5, x = 0.24, rx = -0.1;
      if (type === 'probe' && k >= 0) {
        const push = Math.sin(seg(k, 0.15, 0.55) * Math.PI);
        y -= push * 0.18;
        z -= push * 0.12;
        rx = -0.1 - push * 0.6;
      }
      right.current.position.set(x + Math.cos(t * 4.5) * 0.004 * walk, y, z);
      right.current.rotation.set(rx, -0.15, 0.05);
      right.current.visible = r > 0.02;
    }
    // Left hand: pickup sequence (reach down → scoop → lift jar to show → put away)
    if (left.current && jar.current) {
      const active = type === 'pickup' && k >= 0;
      left.current.visible = active;
      jar.current.visible = active && k > 0.45;
      if (active) {
        const reach = seg(k, 0.1, 0.42);
        const lift = seg(k, 0.5, 0.75);
        const away = seg(k, 0.88, 1);
        const x = -0.2 + reach * 0.12 - lift * 0.02;
        const y = -0.45 - reach * 0.12 + lift * 0.32 - away * 0.5;
        const z = -0.45 - reach * 0.12 + lift * 0.1;
        left.current.position.set(x, y, z);
        left.current.rotation.set(-0.6 + reach * 0.4 + lift * 0.6, 0.3, -0.2 + Math.sin(k * 30) * 0.03 * reach * (1 - lift));
        jar.current.position.set(x + 0.01, y + 0.07, z - 0.05);
        jar.current.rotation.set(0, t * 0.8 * lift, 0);
      }
    }
  });

  return (
    <group ref={root}>
      <ambientLight intensity={0} />
      <group ref={right}>
        <Glove />
        <group position={[0, 0.06, -0.08]}><Device tool={tool} /></group>
      </group>
      <group ref={left} visible={false}>
        <Glove left />
      </group>
      <group ref={jar} visible={false}>
        <Jar />
      </group>
    </group>
  );
}
