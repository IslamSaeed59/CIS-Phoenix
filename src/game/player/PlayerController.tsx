import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { isDown } from '../core/input';
import { useGame } from '../core/store';
import { useUI, toast } from '../core/ui';
import { audio } from '../core/audio';
import type { Heightfield } from '../core/terrain';

export const runtime = {
  pos: new THREE.Vector3(0, 0, 130),
  yaw: Math.PI, // facing north (-z)
  pitch: -0.05,
  speed: 0,
  forward: new THREE.Vector3(),
  dragging: false,
  dragDist: 0,
  lockWorked: false,
  lockFailed: false,
};

if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev')) (window as any).__pdRuntime = runtime;

export interface Obstacle { x: number; z: number; r: number }

export function PlayerController({
  hf,
  obstacles,
  bounds,
  surfaceAt,
  eye = 1.7,
  maxSlope = 38,
  walk = 4.2,
  sprint = 8.5,
  showBody = true,
}: {
  hf: Heightfield;
  obstacles: Obstacle[];
  bounds?: { radius: number; center?: [number, number]; rect?: [number, number, number, number] };
  surfaceAt?: (x: number, z: number) => 'salt' | 'sand' | 'gravel' | 'hard';
  eye?: number;
  maxSlope?: number;
  walk?: number;
  sprint?: number;
  showBody?: boolean;
}) {
  const { camera, gl } = useThree();
  const settings = useGame((s) => s.settings);
  const third = useUI((s) => s.thirdPerson);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const bob = useRef(0);
  const stepAcc = useRef(0);
  const vel = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3());
  const boundWarned = useRef(0);

  // Pointer lock + mouse look
  useEffect(() => {
    const el = gl.domElement;
    const onClick = () => {
      const ui = useUI.getState();
      if (ui.panel) return;
      if (document.pointerLockElement !== el && runtime.dragDist < 6) {
        try {
          const p: any = el.requestPointerLock?.();
          if (p && typeof p.catch === 'function') p.catch(() => { runtime.lockFailed = true; });
        } catch { runtime.lockFailed = true; }
      }
    };
    const onDown = (e: MouseEvent) => {
      if (document.pointerLockElement === el) return;
      runtime.dragging = true;
      runtime.dragDist = 0;
    };
    const onUp = () => { runtime.dragging = false; };
    const onMove = (e: MouseEvent) => {
      const locked = document.pointerLockElement === el;
      // Fallback: drag-to-look when pointer lock is unavailable
      if (!locked && !runtime.dragging) return;
      if (!locked && useUI.getState().panel) return;
      if (!locked) runtime.dragDist += Math.abs(e.movementX) + Math.abs(e.movementY);
      const s = useGame.getState().settings;
      const k = (locked ? 0.0022 : 0.004) * s.sensitivity;
      runtime.yaw -= e.movementX * k;
      runtime.pitch -= e.movementY * k * (s.invertY ? -1 : 1);
      runtime.pitch = Math.max(-1.45, Math.min(1.4, runtime.pitch));
    };
    const onLock = () => {
      const locked = document.pointerLockElement === el;
      if (locked) runtime.lockWorked = true;
      useUI.getState().setLocked(locked);
      if (!locked && !useUI.getState().panel) useUI.getState().setPanel('pause');
    };
    const onLockErr = () => { runtime.lockFailed = true; };
    el.addEventListener('click', onClick);
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onLock);
    document.addEventListener('pointerlockerror', onLockErr);
    return () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onLock);
      document.removeEventListener('pointerlockerror', onLockErr);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [gl]);

  // Release pointer lock when a panel opens
  const panel = useUI((s) => s.panel);
  useEffect(() => {
    if (panel && document.pointerLockElement) document.exitPointerLock();
  }, [panel]);

  useEffect(() => {
    (camera as THREE.PerspectiveCamera).fov = settings.fov;
    camera.updateProjectionMatrix();
  }, [settings.fov, camera]);

  const tmp = useMemo(() => ({ f: new THREE.Vector3(), r: new THREE.Vector3(), d: new THREE.Vector3() }), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const ui = useUI.getState();
    const active = !ui.panel || ui.panel === 'photoTag';
    const p = runtime.pos;

    // Movement input
    tmp.f.set(-Math.sin(runtime.yaw), 0, -Math.cos(runtime.yaw));
    tmp.r.set(-tmp.f.z, 0, tmp.f.x);
    tmp.d.set(0, 0, 0);
    if (active) {
      if (isDown('forward')) tmp.d.add(tmp.f);
      if (isDown('back')) tmp.d.sub(tmp.f);
      if (isDown('right')) tmp.d.add(tmp.r);
      if (isDown('left')) tmp.d.sub(tmp.r);
    }
    const moving = tmp.d.lengthSq() > 0;
    const target = moving ? (isDown('sprint') ? sprint : walk) : 0;
    if (moving) tmp.d.normalize().multiplyScalar(target);
    vel.current.lerp(tmp.d, 1 - Math.exp(-dt * 10));

    // Proposed position + slope check
    const nx = p.x + vel.current.x * dt, nz = p.z + vel.current.z * dt;
    const hNow = hf.height(p.x, p.z), hNext = hf.height(nx, nz);
    const step = Math.hypot(nx - p.x, nz - p.z);
    const grade = step > 1e-4 ? ((hNext - hNow) / step) : 0;
    const slopeDeg = (Math.atan(grade) * 180) / Math.PI;
    let ok = slopeDeg < maxSlope;
    // obstacle collisions
    for (const o of obstacles) {
      const d = Math.hypot(nx - o.x, nz - o.z);
      if (d < o.r) {
        ok = false;
        // slide along
        const ax = (nx - o.x) / (d || 1), az = (nz - o.z) / (d || 1);
        p.x = o.x + ax * o.r;
        p.z = o.z + az * o.r;
        break;
      }
    }
    if (ok) {
      p.x = nx;
      p.z = nz;
    } else {
      vel.current.multiplyScalar(0.3);
    }
    // bounds
    if (bounds) {
      if (bounds.rect) {
        const [x0, z0, x1, z1] = bounds.rect;
        p.x = Math.max(x0, Math.min(x1, p.x));
        p.z = Math.max(z0, Math.min(z1, p.z));
      } else {
        const [cx, cz] = bounds.center ?? [0, 0];
        const d = Math.hypot(p.x - cx, p.z - cz);
        if (d > bounds.radius) {
          p.x = cx + ((p.x - cx) / d) * bounds.radius;
          p.z = cz + ((p.z - cz) / d) * bounds.radius;
          if (performance.now() - boundWarned.current > 6000) {
            boundWarned.current = performance.now();
            toast('Survey boundary', 'You are at the edge of the mission survey area.', 'warn');
          }
        }
      }
    }
    const ground = hf.height(p.x, p.z);
    p.y = THREE.MathUtils.lerp(p.y || ground, ground, 1 - Math.exp(-dt * 18));
    runtime.speed = Math.hypot(vel.current.x, vel.current.z);
    runtime.forward.copy(tmp.f);

    // Head bob + footsteps
    if (runtime.speed > 0.3) {
      bob.current += dt * runtime.speed * 1.9;
      stepAcc.current += runtime.speed * dt;
      const stride = runtime.speed > 6 ? 1.6 : 1.25;
      if (stepAcc.current > stride) {
        stepAcc.current = 0;
        audio.footstep(surfaceAt ? surfaceAt(p.x, p.z) : 'hard');
      }
    } else {
      bob.current += dt * 1.2;
    }
    const bobY = runtime.speed > 0.3 ? Math.abs(Math.sin(bob.current)) * 0.06 * (runtime.speed / walk) : Math.sin(bob.current) * 0.008;
    const bobX = runtime.speed > 0.3 ? Math.sin(bob.current) * 0.03 : 0;

    // Camera
    const cam = camera as THREE.PerspectiveCamera;
    const eyePos = new THREE.Vector3(p.x, p.y + eye + bobY, p.z);
    if (useUI.getState().thirdPerson) {
      const back = new THREE.Vector3(Math.sin(runtime.yaw) * Math.cos(runtime.pitch), -Math.sin(runtime.pitch), Math.cos(runtime.yaw) * Math.cos(runtime.pitch));
      const desired = eyePos.clone().addScaledVector(back, 4.2).add(new THREE.Vector3(tmp.r.x * 0.6, 0.35, tmp.r.z * 0.6));
      const gh = hf.height(desired.x, desired.z) + 0.4;
      if (desired.y < gh) desired.y = gh;
      camPos.current.lerp(desired, 1 - Math.exp(-dt * 14));
      cam.position.copy(camPos.current);
      cam.lookAt(eyePos.x + tmp.r.x * 0.6, eyePos.y + 0.1, eyePos.z + tmp.r.z * 0.6);
    } else {
      camPos.current.copy(eyePos);
      cam.position.copy(eyePos).addScaledVector(tmp.r, bobX);
      cam.rotation.set(0, 0, 0);
      cam.rotation.order = 'YXZ';
      cam.rotation.y = runtime.yaw;
      cam.rotation.x = runtime.pitch;
      cam.rotation.z = -bobX * 0.15;
    }

    // Body animation
    if (body.current) {
      body.current.visible = useUI.getState().thirdPerson && showBody;
      body.current.position.set(p.x, p.y, p.z);
      body.current.rotation.y = runtime.yaw;
      const sw = runtime.speed > 0.3 ? Math.sin(bob.current) * Math.min(0.7, runtime.speed * 0.12) : 0;
      if (legL.current) legL.current.rotation.x = sw;
      if (legR.current) legR.current.rotation.x = -sw;
      if (armL.current) armL.current.rotation.x = -sw * 0.8;
      if (armR.current) armR.current.rotation.x = sw * 0.8 - (useUI.getState().toolRaised ? 1.1 : 0);
    }
  });

  return (
    <group ref={body} visible={third}>
      {/* Field scientist (procedural) */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <capsuleGeometry args={[0.24, 0.55, 6, 12]} />
        <meshStandardMaterial color="#c8682a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.27, 0.24]} castShadow>
        <boxGeometry args={[0.42, 0.55, 0.2]} />
        <meshStandardMaterial color="#3b4046" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.78, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 12]} />
        <meshStandardMaterial color="#d6b08c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.86, 0]} castShadow>
        <sphereGeometry args={[0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e9e4d8" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.8, -0.13]}>
        <boxGeometry args={[0.24, 0.06, 0.04]} />
        <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
      </mesh>
      <group ref={legL as any} position={[-0.12, 0.92, 0]}>
        <mesh position={[0, -0.45, 0]} castShadow>
          <boxGeometry args={[0.16, 0.9, 0.18]} />
          <meshStandardMaterial color="#4b4f45" />
        </mesh>
      </group>
      <group ref={legR as any} position={[0.12, 0.92, 0]}>
        <mesh position={[0, -0.45, 0]} castShadow>
          <boxGeometry args={[0.16, 0.9, 0.18]} />
          <meshStandardMaterial color="#4b4f45" />
        </mesh>
      </group>
      <group ref={armL as any} position={[-0.33, 1.58, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.12, 0.62, 0.12]} />
          <meshStandardMaterial color="#c8682a" />
        </mesh>
      </group>
      <group ref={armR as any} position={[0.33, 1.58, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.12, 0.62, 0.12]} />
          <meshStandardMaterial color="#c8682a" />
        </mesh>
        <mesh position={[0, -0.62, -0.08]} castShadow>
          <boxGeometry args={[0.18, 0.12, 0.26]} />
          <meshStandardMaterial color="#2a2f35" />
        </mesh>
      </group>
    </group>
  );
}
