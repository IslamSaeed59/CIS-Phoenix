import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import { buildTerrainGeometry, Heightfield } from '../../core/terrain';
import { makeRockGeometry, makeRockMaterial, patchMaterial, sharedUniforms } from '../../core/shaders';
import {
  getQaidamHF, mountainHeight, qaidamColor, qaidamSurf, PLAY_SIZE, WIND_DIR, CHANNEL, cliffEdge,
} from './qaidamTerrain';
import { useGame } from '../../core/store';
import { useUI } from '../../core/ui';
import { EARTH_POIS } from '../../../data/earth/earthData';
import { Noise2D, mulberry32, smoothstep } from '../../core/noise';

const QUALITY_RES = { low: 220, medium: 300, high: 400 } as const;

export function useQaidamHF() {
  const q = useGame((s) => s.settings.quality);
  return useMemo(() => getQaidamHF(QUALITY_RES[q]), [q]);
}

export function sunDirection(time: 'day' | 'night') {
  // Day: mid-afternoon sun from SW; Night: moon high in the E
  return time === 'day' ? new THREE.Vector3(-0.45, 0.62, 0.55).normalize() : new THREE.Vector3(0.5, 0.55, -0.3).normalize();
}

function Terrain({ hf }: { hf: Heightfield }) {
  const geo = useMemo(() => buildTerrainGeometry(hf, qaidamColor, qaidamSurf), [hf]);
  const mat = useMemo(
    () =>
      patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 }), {
        terrain: true,
        detailScale: 1,
        detailAmount: 0.22,
        strataColorA: new THREE.Color('#c4a984'),
        strataColorB: new THREE.Color('#946c52'),
      }),
    [],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={mat} receiveShadow castShadow={false} name="terrain" userData={{ ground: true }} />;
}

function Mountains() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(6000, 6000, 240, 240);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    const rock = new THREE.Color('#7a6c5e'), dark = new THREE.Color('#5d554e'), snow = new THREE.Color('#f2f3f5'), base = new THREE.Color('#9d917e');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      let h = mountainHeight(x, z);
      if (r < PLAY_SIZE * 0.5 - 20) h = -12;
      p.setY(i, h);
      c.copy(base).lerp(rock, smoothstep(10, 120, h)).lerp(dark, smoothstep(120, 260, h) * 0.6).lerp(snow, smoothstep(300, 400, h));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), { absorb: 0.7, inertia: 0.7, detailScale: 0.1, detailAmount: 0.3 }), []);
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

function Scatter({ hf }: { hf: Heightfield }) {
  const q = useGame((s) => s.settings.quality);
  const count = q === 'high' ? 2600 : q === 'medium' ? 1600 : 800;
  const { geo, mat, matrices } = useMemo(() => {
    const geo = makeRockGeometry(3, 1);
    const mat = makeRockMaterial('#7d7266', 0.8, 0.85);
    const rnd = mulberry32(99);
    const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    const list: THREE.Matrix4[] = [];
    let tries = 0;
    while (list.length < count && tries < count * 6) {
      tries++;
      const x = (rnd() - 0.5) * 900, z = (rnd() - 0.5) * 900;
      const r = Math.hypot(x, z);
      if (r > 440) continue;
      if (Math.hypot(x + 215, z - 55) < 110 && rnd() > 0.05) continue; // playa mostly clean
      if (Math.hypot(x, z - 140) < 30) continue; // camp
      const gravel = Math.hypot(x + 75, z - 70) < 32;
      const nearCliff = Math.abs(z - (cliffEdge(x) + 3)) < 10 && Math.abs(x) < 170;
      const size = gravel ? 0.08 + rnd() * 0.18 : nearCliff ? 0.3 + rnd() * 1.6 : 0.1 + Math.pow(rnd(), 3) * 1.0;
      if (!gravel && !nearCliff && rnd() > 0.55) continue;
      p.set(x, hf.height(x, z) + size * 0.2, z);
      e.set(rnd() * 0.5, rnd() * Math.PI * 2, rnd() * 0.5);
      qn.setFromEuler(e);
      s.set(size * (0.8 + rnd() * 0.6), size, size * (0.8 + rnd() * 0.6));
      list.push(m.clone().compose(p, qn, s));
    }
    // Dense gravel lag clasts
    for (let i = 0; i < (q === 'low' ? 500 : 1100); i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 28;
      const x = -75 + Math.cos(a) * rr, z = 70 + Math.sin(a) * rr;
      const size = 0.05 + rnd() * 0.12;
      p.set(x, hf.height(x, z) + 0.01, z);
      e.set(0, rnd() * 6, 0);
      qn.setFromEuler(e);
      s.set(size * 1.3, size * 0.6, size);
      list.push(m.clone().compose(p, qn, s));
    }
    return { geo, mat, matrices: list };
  }, [hf, count, q]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!ref.current) return;
    matrices.forEach((mm, i) => ref.current!.setMatrixAt(i, mm));
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geo, mat, matrices.length]} castShadow receiveShadow frustumCulled={false} />;
}

function HaliteCrystals({ hf }: { hf: Heightfield }) {
  const { matrices } = useMemo(() => {
    const rnd = mulberry32(5);
    const list: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < 900; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 70;
      const x = -205 + Math.cos(a) * rr, z = -148 + Math.sin(a) * rr;
      const size = 0.06 + Math.pow(rnd(), 2) * 0.5;
      p.set(x, hf.height(x, z) + size * 0.3, z);
      e.set(rnd() * 0.8, rnd() * 6, rnd() * 0.8);
      qn.setFromEuler(e);
      s.setScalar(size);
      list.push(m.clone().compose(p, qn, s));
    }
    return { matrices: list };
  }, [hf]);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.35, metalness: 0.0 }), { absorb: 0.28, inertia: 0.55, detailAmount: 0.08 }), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    matrices.forEach((mm, i) => ref.current!.setMatrixAt(i, mm));
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geo, mat, matrices.length]} castShadow receiveShadow />;
}

function ChannelCobbles({ hf }: { hf: Heightfield }) {
  const matrices = useMemo(() => {
    const rnd = mulberry32(17);
    const list: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < CHANNEL.length - 1; i++) {
      const [ax, az] = CHANNEL[i], [bx, bz] = CHANNEL[i + 1];
      for (let k = 0; k < 70; k++) {
        const t = rnd();
        const x = ax + (bx - ax) * t + (rnd() - 0.5) * 7, z = az + (bz - az) * t + (rnd() - 0.5) * 7;
        const size = 0.08 + rnd() * 0.22;
        p.set(x, hf.height(x, z) + size * 0.3, z);
        e.set(rnd(), rnd() * 6, rnd());
        qn.setFromEuler(e);
        s.set(size * 1.2, size * 0.8, size);
        list.push(m.clone().compose(p, qn, s));
      }
    }
    return list;
  }, [hf]);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const mat = useMemo(() => makeRockMaterial('#8a8174', 0.65, 0.6), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    matrices.forEach((mm, i) => ref.current!.setMatrixAt(i, mm));
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geo, mat, matrices.length]} castShadow receiveShadow />;
}

function RippleField({ hf, cx, cz, size, color = '#c9ad84' }: { hf: Heightfield; cx: number; cz: number; size: number; color?: string }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, 180, 180);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const n = new Noise2D(8);
    const along = new THREE.Vector2(WIND_DIR.x, WIND_DIR.y);
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i), lz = p.getZ(i);
      const x = cx + lx, z = cz + lz;
      const d = Math.hypot(lx, lz) / (size * 0.5);
      const fade = 1 - smoothstep(0.6, 1.0, d);
      const ph = (x * along.x + z * along.y) * 2.6 + n.noise(x * 0.08, z * 0.08) * 2.5;
      const rip = (Math.pow(Math.sin(ph) * 0.5 + 0.5, 1.8) - 0.4) * 0.12;
      p.setY(i, hf.height(x, z) + 0.06 + rip * fade - (1 - fade) * 0.1);
    }
    g.computeVertexNormals();
    return g;
  }, [hf, cx, cz, size]);
  const mat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: false }), { absorb: 0.7, inertia: 0.15, detailScale: 3, detailAmount: 0.15 }), [color]);
  return <mesh geometry={geo} material={mat} position={[cx, 0, cz]} receiveShadow />;
}

function Overhang({ hf }: { hf: Heightfield }) {
  const x = -32, z = -186;
  const base = hf.height(x, z);
  const capMat = useMemo(() => makeRockMaterial('#8e6a50', 0.7, 0.9), []);
  const recMat = useMemo(() => makeRockMaterial('#5d4636', 0.5, 0.95), []);
  const capGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(16, 2.2, 7, 16, 2, 8);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 0.8) * 0.15 + Math.cos(p.getZ(i) * 1.3) * 0.12);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group position={[x, base, z]}>
      <mesh geometry={capGeo} material={capMat} position={[0, 4.6, -1.2]} castShadow receiveShadow />
      <mesh material={recMat} position={[0, 1.7, -4.2]} castShadow receiveShadow>
        <boxGeometry args={[15, 3.6, 4]} />
      </mesh>
      <mesh material={capMat} position={[0, 8, -4.5]} castShadow receiveShadow>
        <boxGeometry args={[18, 5, 6]} />
      </mesh>
    </group>
  );
}

function Flag({ position, color = '#e2502c' }: { position: [number, number, number]; color?: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 3 + position[0]) * 0.25 + 0.6;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 1.5, 6]} />
        <meshStandardMaterial color="#d8d8d8" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={ref} position={[0, 1.35, 0]}>
        <planeGeometry args={[0.32, 0.2]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} emissive={color} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

function Camp({ hf }: { hf: Heightfield }) {
  const h = (x: number, z: number) => hf.height(x, z);
  const tentMat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ color: '#d27a2c', roughness: 0.85 }), { absorb: 0.6, inertia: 0.1 }), []);
  const metal = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ color: '#d9dcd8', roughness: 0.5, metalness: 0.4 }), { absorb: 0.4, inertia: 0.2 }), []);
  const dark = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.6, metalness: 0.3 }), { absorb: 0.9, inertia: 0.2 }), []);
  const crate = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ color: '#4f5d3f', roughness: 0.8 }), { absorb: 0.7, inertia: 0.3 }), []);
  return (
    <group>
      {/* Shelter */}
      <group position={[-14, h(-14, 150), 150]} rotation={[0, 0.3, 0]}>
        <mesh material={tentMat} position={[-0.75, 0.95, 0]} rotation={[0, 0, -0.75]} castShadow receiveShadow><boxGeometry args={[0.05, 2.6, 4.6]} /></mesh>
        <mesh material={tentMat} position={[0.75, 0.95, 0]} rotation={[0, 0, 0.75]} castShadow receiveShadow><boxGeometry args={[0.05, 2.6, 4.6]} /></mesh>
        <mesh material={dark} position={[0, 0.6, 2.3]}><circleGeometry args={[0.7, 3]} /></mesh>
      </group>
      {/* Second shelter */}
      <group position={[-24, h(-24, 138), 138]} rotation={[0, -0.4, 0]}>
        <mesh material={tentMat} position={[-0.6, 0.75, 0]} rotation={[0, 0, -0.75]} castShadow receiveShadow><boxGeometry args={[0.05, 2.1, 3.6]} /></mesh>
        <mesh material={tentMat} position={[0.6, 0.75, 0]} rotation={[0, 0, 0.75]} castShadow receiveShadow><boxGeometry args={[0.05, 2.1, 3.6]} /></mesh>
      </group>
      {/* Vehicle */}
      <group position={[14, h(14, 128), 128]} rotation={[0, 0.9, 0]}>
        <mesh material={metal} position={[0, 1.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 1.4, 5]} />
        </mesh>
        <mesh material={metal} position={[0, 2.3, -0.6]} castShadow>
          <boxGeometry args={[2.0, 0.8, 2.6]} />
        </mesh>
        <mesh material={dark} position={[0, 2.3, 0.75]}>
          <boxGeometry args={[1.9, 0.6, 0.05]} />
        </mesh>
        {[[-1.05, 1.6], [1.05, 1.6], [-1.05, -1.6], [1.05, -1.6]].map(([x, z], i) => (
          <mesh key={i} material={dark} position={[x, 0.5, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 0.4, 16]} />
          </mesh>
        ))}
        <mesh material={dark} position={[0, 2.85, -1.4]}>
          <boxGeometry args={[1.6, 0.08, 1.2]} />
        </mesh>
      </group>
      {/* Crates, solar panel, weather mast */}
      {[[6, 150], [7.4, 151], [6.6, 152.4]].map(([x, z], i) => (
        <mesh key={i} material={crate} position={[x, h(x, z) + 0.35, z]} rotation={[0, i * 0.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.7, 0.7]} />
        </mesh>
      ))}
      <group position={[0, h(0, 158), 158]}>
        <mesh material={metal} position={[0, 1.6, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 3.2, 8]} />
        </mesh>
        <mesh material={metal} position={[0, 3.2, 0]} castShadow>
          <boxGeometry args={[0.8, 0.05, 0.05]} />
        </mesh>
        <mesh material={dark} position={[0.4, 3.25, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
        </mesh>
      </group>
      <group position={[-4, h(-4, 162), 162]} rotation={[-0.6, 0.5, 0]}>
        <mesh material={dark} position={[0, 0.8, 0]} castShadow>
          <boxGeometry args={[2.4, 0.05, 1.3]} />
        </mesh>
      </group>
      <Flag position={[2, h(2, 145), 145]} color="#2aa198" />
    </group>
  );
}

function Relay({ hf }: { hf: Heightfield }) {
  const y = hf.height(128, 168);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(clock.elapsedTime * 4) > 0.6 ? 3 : 0.2;
  });
  return (
    <group position={[128, y, 168]}>
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.12, 8, 6]} />
        <meshStandardMaterial color="#cfd3d6" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.35, 6.5, 0]} rotation={[0, 0, -Math.PI / 2.4]} castShadow>
        <coneGeometry args={[0.6, 0.3, 16, 1, true]} />
        <meshStandardMaterial color="#e8e8e8" side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ref} position={[0, 8.1, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.8, 0.8, 0.6]} />
        <meshStandardMaterial color="#3a4148" />
      </mesh>
    </group>
  );
}

function POIMarkers({ hf }: { hf: Heightfield }) {
  return (
    <group>
      {EARTH_POIS.filter((p) => p.specimen !== 'none').map((p) => (
        <Flag key={p.id} position={[p.pos[0] + 1.6, hf.height(p.pos[0] + 1.6, p.pos[1] + 1.2), p.pos[1] + 1.2]} />
      ))}
    </group>
  );
}

function Dust({ center }: { center: React.MutableRefObject<THREE.Vector3> }) {
  const N = 1400;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) p.set([(Math.random() - 0.5) * 80, Math.random() * 6, (Math.random() - 0.5) * 80], i * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, dt) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const c = center.current;
    for (let i = 0; i < N; i++) {
      let x = p.getX(i) + WIND_DIR.x * dt * 6 * (0.6 + (i % 7) * 0.1);
      let z = p.getZ(i) + WIND_DIR.y * dt * 6 * (0.6 + (i % 5) * 0.1);
      let y = p.getY(i) + Math.sin(i + x * 0.1) * dt * 0.3;
      if (x - c.x > 40) x -= 80; if (x - c.x < -40) x += 80;
      if (z - c.z > 40) z -= 80; if (z - c.z < -40) z += 80;
      if (y < c.y - 2) y += 8; if (y > c.y + 6) y -= 8;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial size={0.05} color="#d8c8a8" transparent opacity={0.45} depthWrite={false} sizeAttenuation />
    </points>
  );
}

export function QaidamWorld({ playerRef }: { playerRef: React.MutableRefObject<THREE.Vector3> }) {
  const hf = useQaidamHF();
  const time = useGame((s) => s.earthTime);
  const quality = useGame((s) => s.settings.quality);
  const sun = useRef<THREE.DirectionalLight>(null);
  const { scene, camera } = useThree();
  const sunDir = useMemo(() => sunDirection(time), [time]);
  const isDay = time === 'day';
  const thermal = useUI((s) => s.tool === 'thermal' && s.toolRaised);

  useEffect(() => {
    scene.fog = new THREE.FogExp2(isDay ? '#c9c4bb' : '#0a0e18', isDay ? 0.0009 : 0.0022);
    scene.background = new THREE.Color(isDay ? '#a9bccf' : '#05070d');
    sharedUniforms.uDay.value = isDay ? 1 : 0;
  }, [isDay, scene]);

  useFrame(({ clock }) => {
    sharedUniforms.uTime.value = clock.elapsedTime;
    sharedUniforms.uSunView.value.copy(sunDir).transformDirection(camera.matrixWorldInverse);
    if (sun.current) {
      const c = playerRef.current;
      sun.current.position.set(c.x + sunDir.x * 200, c.y + sunDir.y * 200, c.z + sunDir.z * 200);
      sun.current.target.position.copy(c);
      sun.current.target.updateMatrixWorld();
    }
  });

  return (
    <group>
      {thermal ? null : isDay ? (
        <Sky distance={5500} sunPosition={sunDir.clone().multiplyScalar(100).toArray() as any} turbidity={5.5} rayleigh={0.9} mieCoefficient={0.006} mieDirectionalG={0.8} />
      ) : (
        <Stars radius={900} depth={60} count={5000} factor={5} saturation={0} fade speed={0.3} />
      )}
      <hemisphereLight args={[isDay ? '#cfd9e6' : '#24304a', isDay ? '#8a7a64' : '#0d0f14', isDay ? 0.75 : 0.5]} />
      <directionalLight
        ref={sun}
        intensity={isDay ? 2.6 : 0.8}
        color={isDay ? '#fff1dc' : '#9fb4e0'}
        castShadow={quality !== 'low'}
        shadow-mapSize={quality === 'high' ? [4096, 4096] : [2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={10}
        shadow-camera-far={500}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <Terrain hf={hf} />
      <Mountains />
      <Scatter hf={hf} />
      <HaliteCrystals hf={hf} />
      <ChannelCobbles hf={hf} />
      <RippleField hf={hf} cx={262} cz={62} size={70} />
      <Overhang hf={hf} />
      <Camp hf={hf} />
      <Relay hf={hf} />
      <POIMarkers hf={hf} />
      <Dust center={playerRef} />
    </group>
  );
}
