import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { buildTerrainGeometry, type Heightfield } from '../../core/terrain';
import { makeRockGeometry, patchMaterial, sharedUniforms } from '../../core/shaders';
import { getMarsHF, MARS_RES, marsColor, marsSurf, MARS_WIND, escarpEdge } from './marsTerrain';
import { BOULDERS } from './marsProps';
import { useGame } from '../../core/store';
import { rover, isDay } from '../../rover/roverSim';
import { Noise2D, smoothstep } from '../../core/noise';

export function useMarsHF() {
  const q = useGame((s) => s.settings.quality);
  return useMemo(() => getMarsHF(MARS_RES[q]), [q]);
}

function Terrain({ hf }: { hf: Heightfield }) {
  const geo = useMemo(() => buildTerrainGeometry(hf, marsColor, marsSurf), [hf]);
  const mat = useMemo(
    () =>
      patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }), {
        terrain: true,
        detailAmount: 0.3,
        strataColorA: new THREE.Color('#c79c78'),
        strataColorB: new THREE.Color('#8d5c40'),
      }),
    [],
  );
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

function FarRim() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(6000, 6000, 160, 160);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const n = new Noise2D(9);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      let h = -10;
      if (r > 440) h = 30 + smoothstep(600, 1500, r) * (120 + n.ridged(x * 0.002, z * 0.002, 4) * 260) * (0.55 + 0.45 * Math.sin(Math.atan2(z, x) * 2 + 0.7));
      p.setY(i, h);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ color: '#7a4630', roughness: 1 }), { absorb: 0.75, inertia: 0.6, detailScale: 0.1, detailAmount: 0.35 }), []);
  return <mesh geometry={geo} material={mat} />;
}

function Boulders({ hf }: { hf: Heightfield }) {
  const geos = useMemo(() => [0, 1, 2, 3].map((s) => makeRockGeometry(s + 11, 2)), []);
  const darkMat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ color: '#3f2e27', roughness: 0.85 }), { absorb: 0.88, inertia: 0.85, detailScale: 2, detailAmount: 0.4 }), []);
  const lightMat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ color: '#8c634b', roughness: 0.95 }), { absorb: 0.72, inertia: 0.75, detailScale: 2, detailAmount: 0.4 }), []);
  return (
    <group>
      {BOULDERS.map((b, i) => (
        <mesh
          key={i}
          geometry={geos[b.seed % 4]}
          material={b.dark ? darkMat : lightMat}
          position={[b.x, hf.height(b.x, b.z) + b.r * 0.25, b.z]}
          scale={[b.r * (0.9 + (b.seed % 3) * 0.15), b.r * 0.8, b.r]}
          rotation={[0, b.seed * 1.7, (b.seed % 5) * 0.1]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

function Pebbles({ hf }: { hf: Heightfield }) {
  const q = useGame((s) => s.settings.quality);
  const count = q === 'high' ? 5000 : q === 'medium' ? 3000 : 1400;
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => makeRockGeometry(5, 0), []);
  const mat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ color: '#6a4535', roughness: 0.9 }), { absorb: 0.8, inertia: 0.7 }), []);
  useEffect(() => {
    const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      // cluster around the traverse area
      const x = (rnd() - 0.5) * 640, z = (rnd() - 0.5) * 640;
      const size = 0.04 + Math.pow(rnd(), 3) * 0.35;
      p.set(x, hf.height(x, z) + size * 0.2, z);
      e.set(rnd(), rnd() * 6, rnd());
      qn.setFromEuler(e);
      s.set(size * 1.2, size * 0.7, size);
      ref.current!.setMatrixAt(i, m.compose(p, qn, s));
    }
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [hf, count]);
  return <instancedMesh ref={ref} args={[geo, mat, count]} castShadow receiveShadow />;
}

function Ripples({ hf }: { hf: Heightfield }) {
  const geo = useMemo(() => {
    const size = 90, cx = 150, cz = 50;
    const g = new THREE.PlaneGeometry(size, size, 220, 220);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const n = new Noise2D(77);
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i), lz = p.getZ(i);
      const x = cx + lx, z = cz + lz;
      const d = Math.hypot(lx, lz) / 42;
      const fade = 1 - smoothstep(0.65, 1.0, d);
      const ph = (x * MARS_WIND.x + z * MARS_WIND.y) * 1.3 + n.noise(x * 0.05, z * 0.05) * 3;
      const rip = (Math.pow(Math.sin(ph) * 0.5 + 0.5, 2) - 0.35) * 0.35;
      p.setY(i, hf.height(x, z) + 0.05 + rip * fade - (1 - fade) * 0.3);
    }
    g.computeVertexNormals();
    return { g, cx, cz };
  }, [hf]);
  const mat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ color: '#6e4636', roughness: 1 }), { absorb: 0.75, inertia: 0.12, detailScale: 3, detailAmount: 0.2 }), []);
  return <mesh geometry={geo.g} material={mat} position={[geo.cx, 0, geo.cz]} receiveShadow />;
}

function Veins({ hf }: { hf: Heightfield }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(245,238,225,0.95)';
    ctx.lineCap = 'round';
    let s = 9;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      ctx.lineWidth = 1 + rnd() * 4;
      ctx.beginPath();
      let x = rnd() * 512, y = rnd() * 512;
      ctx.moveTo(x, y);
      const a = rnd() * Math.PI;
      for (let k = 0; k < 8; k++) {
        x += Math.cos(a + (rnd() - 0.5) * 0.6) * 18;
        y += Math.sin(a + (rnd() - 0.5) * 0.6) * 18;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    return t;
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(22, 22, 40, 40);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, hf.height(-42 + p.getX(i), -160 + p.getZ(i)) + 0.04);
    return g;
  }, [hf]);
  return (
    <mesh geometry={geo} position={[-42, 0, -160]}>
      <meshStandardMaterial map={tex} transparent depthWrite={false} roughness={0.6} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

function MarsSky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uSun: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() }, uDay: { value: 1 }, uStorm: { value: 0 } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uSun; uniform float uDay; uniform float uStorm; varying vec3 vDir;
          void main(){
            float h = clamp(vDir.y, -0.1, 1.0);
            vec3 horizon = vec3(0.80,0.58,0.40);
            vec3 zenith = vec3(0.42,0.27,0.19);
            vec3 c = mix(horizon, zenith, pow(max(h,0.0), 0.6));
            float s = max(dot(normalize(vDir), uSun), 0.0);
            c += vec3(0.55,0.62,0.75) * pow(s, 60.0) * 0.6;   // bluish glow around the sun (forward scattering)
            c += vec3(1.0,0.95,0.85) * pow(s, 1200.0) * 2.0;
            c = mix(c, vec3(0.62,0.42,0.28), uStorm*0.8);
            vec3 night = vec3(0.02,0.015,0.02);
            c = mix(night, c, uDay);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  useFrame(() => {
    mat.uniforms.uDay.value += ((isDay() ? 1 : 0) - mat.uniforms.uDay.value) * 0.05;
    mat.uniforms.uStorm.value = rover.storm;
  });
  return (
    <mesh material={mat} scale={4000}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  );
}

function DustParticles() {
  const N = 1800;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) p.set([(Math.random() - 0.5) * 60, Math.random() * 8, (Math.random() - 0.5) * 60], i * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const mat = useRef<THREE.PointsMaterial>(null);
  useFrame((_, dt) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const sp = 2 + rover.storm * 16;
    for (let i = 0; i < N; i++) {
      let x = p.getX(i) + MARS_WIND.x * dt * sp * (0.6 + (i % 7) * 0.1);
      let z = p.getZ(i) + MARS_WIND.y * dt * sp * (0.6 + (i % 5) * 0.1);
      let y = p.getY(i);
      if (x - rover.x > 30) x -= 60; if (x - rover.x < -30) x += 60;
      if (z - rover.z > 30) z -= 60; if (z - rover.z < -30) z += 60;
      if (y - rover.y > 8) y -= 8; if (y < rover.y) y += 8;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
    if (mat.current) mat.current.opacity = 0.15 + rover.storm * 0.6;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial ref={mat} size={0.06} color="#c99b74" transparent opacity={0.2} depthWrite={false} />
    </points>
  );
}

function Tracks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const MAX = 600;
  const hf = useMarsHF();
  const last = useRef(0);
  useFrame(() => {
    if (!ref.current || rover.trail.length === last.current) return;
    last.current = rover.trail.length;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    rover.trail.forEach(([x, z], i) => {
      const prev = rover.trail[i - 1] ?? [x, z + 1];
      const ang = Math.atan2(x - prev[0], z - prev[1]);
      q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, ang));
      p.set(x, hf.height(x, z) + 0.03, z);
      ref.current!.setMatrixAt(i, m.compose(p, q, s));
    });
    ref.current.count = rover.trail.length;
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, MAX]} frustumCulled={false}>
      <planeGeometry args={[2.6, 2.2]} />
      <meshBasicMaterial color="#3d2419" transparent opacity={0.28} depthWrite={false} />
    </instancedMesh>
  );
}

export function MarsWorld({ shadows = true }: { shadows?: boolean }) {
  const hf = useMarsHF();
  const { scene, camera } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const quality = useGame((s) => s.settings.quality);
  const sunDir = useMemo(() => new THREE.Vector3(0.45, 0.55, 0.35).normalize(), []);
  useEffect(() => {
    scene.fog = new THREE.FogExp2('#b78560', 0.0022);
    scene.background = new THREE.Color('#b78560');
  }, [scene]);
  useFrame(({ clock }) => {
    const d = isDay();
    sharedUniforms.uDay.value += ((d ? 1 : 0) - sharedUniforms.uDay.value) * 0.05;
    sharedUniforms.uTime.value = clock.elapsedTime;
    sharedUniforms.uSunView.value.copy(sunDir).transformDirection(camera.matrixWorldInverse);
    const fog = scene.fog as THREE.FogExp2;
    fog.density = 0.0022 + rover.storm * 0.02;
    const day = sharedUniforms.uDay.value;
    fog.color.setRGB(0.6 * day + 0.02, 0.4 * day + 0.015, 0.28 * day + 0.02);
    if (rover.storm > 0) fog.color.lerp(new THREE.Color('#a77450'), rover.storm * day);
    (scene.background as THREE.Color).copy(fog.color);
    if (sun.current) {
      sun.current.intensity = (2.2 * (1 - rover.storm * 0.75)) * day + 0.02;
      sun.current.position.set(rover.x + sunDir.x * 150, rover.y + sunDir.y * 150, rover.z + sunDir.z * 150);
      sun.current.target.position.set(rover.x, rover.y, rover.z);
      sun.current.target.updateMatrixWorld();
    }
    if (hemi.current) hemi.current.intensity = 0.55 * day + 0.06;
  });
  return (
    <group>
      <MarsSky />
      <hemisphereLight ref={hemi} args={['#e2b48e', '#5a3424', 0.55]} />
      <directionalLight
        ref={sun}
        intensity={2.2}
        color="#ffe2c4"
        castShadow={shadows && quality !== 'low'}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={5}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <Terrain hf={hf} />
      <FarRim />
      <Boulders hf={hf} />
      <Pebbles hf={hf} />
      <Ripples hf={hf} />
      <Veins hf={hf} />
      <Tracks />
      <DustParticles />
    </group>
  );
}

export { escarpEdge };
