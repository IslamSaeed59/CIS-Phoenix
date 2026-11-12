import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Noise2D } from '../../core/noise';

// Coarse continent outlines (lon, lat) hand-simplified for a stylised globe. Not cartographically precise.
const CONTINENTS: [number, number][][] = [
  [[-168,66],[-162,70],[-140,70],[-120,74],[-95,72],[-80,73],[-62,66],[-56,52],[-66,45],[-70,41],[-76,35],[-81,31],[-80,25],[-82,26],[-84,30],[-90,29],[-97,26],[-97,21],[-90,21],[-87,15],[-83,9],[-79,8],[-82,8],[-86,12],[-92,15],[-98,16],[-105,20],[-110,24],[-112,31],[-117,32],[-122,37],[-124,42],[-124,48],[-130,54],[-140,59],[-152,58],[-160,56],[-166,60]],
  [[-50,60],[-42,60],[-20,70],[-18,80],[-35,83],[-60,82],[-70,77],[-55,70]],
  [[-79,8],[-72,12],[-62,10],[-50,0],[-35,-6],[-38,-13],[-41,-22],[-48,-26],[-53,-34],[-58,-38],[-65,-42],[-68,-50],[-70,-55],[-74,-50],[-74,-40],[-71,-30],[-71,-18],[-76,-13],[-81,-5],[-80,0],[-77,4]],
  [[-10,36],[-9,43],[-2,44],[-4,48],[2,51],[6,54],[9,57],[5,62],[14,68],[24,71],[30,70],[40,67],[44,68],[60,69],[60,55],[50,45],[40,45],[36,41],[28,41],[26,38],[22,37],[20,40],[15,38],[12,44],[8,44],[3,43],[-2,36]],
  [[-17,21],[-16,28],[-10,30],[-6,36],[10,37],[11,33],[20,31],[25,32],[32,31],[35,28],[43,12],[51,12],[48,4],[40,-3],[40,-15],[35,-24],[32,-29],[27,-34],[19,-35],[16,-29],[12,-17],[13,-6],[9,-1],[9,4],[4,6],[-4,5],[-8,4],[-13,8],[-17,14]],
  [[36,41],[40,45],[50,45],[60,55],[60,69],[70,73],[80,73],[100,78],[115,74],[130,72],[142,72],[160,70],[175,67],[180,65],[170,60],[160,58],[156,51],[142,47],[140,40],[135,35],[128,35],[127,40],[122,40],[121,32],[122,25],[117,23],[109,21],[108,16],[109,12],[105,9],[103,1],[101,3],[100,13],[98,16],[94,16],[92,22],[87,22],[80,15],[77,8],[73,17],[72,21],[67,25],[61,25],[57,26],[56,23],[59,22],[55,17],[44,13],[43,17],[39,21],[35,28],[35,33],[36,36]],
  [[114,-22],[114,-34],[120,-34],[129,-31],[138,-35],[141,-38],[147,-38],[150,-37],[153,-28],[153,-25],[146,-19],[142,-11],[136,-12],[136,-15],[131,-12],[126,-14],[122,-18]],
  [[-5,50],[1,51],[-2,56],[-5,58],[-6,55]],
  [[130,31],[135,34],[140,36],[142,40],[141,45],[139,42],[136,37],[131,34]],
  [[44,-25],[47,-25],[50,-15],[49,-12],[44,-17]],
  [[109,1],[117,7],[119,1],[116,-4],[110,-3]],
  [[95,5],[106,-6],[102,-5],[96,2]],
  [[172,-34],[178,-38],[174,-41],[167,-46],[170,-44]],
  [[-24,64],[-14,64],[-14,66],[-22,66.5]],
  [[131,-1],[141,-3],[150,-10],[141,-9],[133,-4]],
];

export function latLonToVec(lat: number, lon: number, r = 1) {
  const phi = ((lon + 180) * Math.PI) / 180;
  const la = (lat * Math.PI) / 180;
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(la) * r, Math.sin(la) * r, Math.sin(phi) * Math.cos(la) * r);
}

function earthTextures() {
  const W = 1024, H = 512;
  const mask = document.createElement('canvas');
  mask.width = W; mask.height = H;
  const mctx = mask.getContext('2d')!;
  mctx.fillStyle = '#000'; mctx.fillRect(0, 0, W, H);
  mctx.fillStyle = '#fff';
  CONTINENTS.forEach((poly) => {
    mctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * W, y = ((90 - lat) / 180) * H;
      i ? mctx.lineTo(x, y) : mctx.moveTo(x, y);
    });
    mctx.closePath();
    mctx.fill();
  });
  mctx.fillRect(0, ((90 + 68) / 180) * H, W, H); // Antarctica
  const md = mctx.getImageData(0, 0, W, H).data;
  const n = new Noise2D(42);
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const cloud = document.createElement('canvas');
  cloud.width = W; cloud.height = H;
  const cctx = cloud.getContext('2d')!;
  const cimg = cctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y / H) * 180;
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * 360 - 180;
      const o = (y * W + x) * 4;
      // coastline wobble
      const wob = n.fbm(x * 0.03, y * 0.03, 3) * 6;
      const sx = Math.min(W - 1, Math.max(0, Math.round(x + wob))), sy = Math.min(H - 1, Math.max(0, Math.round(y + wob * 0.7)));
      const land = md[(sy * W + sx) * 4] > 128;
      const tex = n.fbm(x * 0.02, y * 0.02, 5) * 0.5 + 0.5;
      let r, g, b;
      if (land) {
        const alat = Math.abs(lat);
        // Soft, noise-edged arid regions (ellipses) instead of hard boxes
        const blob = (clat: number, clon: number, rlat: number, rlon: number) => {
          const d = Math.hypot((lat - clat) / rlat, (lon - clon) / rlon);
          return 1 - Math.min(1, Math.max(0, (d - 0.55 + n.fbm(x * 0.05, y * 0.05, 3) * 0.45) / 0.45));
        };
        const arid = Math.max(
          blob(23, 12, 10, 32), blob(24, 46, 8, 14), // Sahara, Arabia
          blob(39, 92, 6, 22), blob(43, 105, 4, 12), // Tibet/Tarim/Qaidam, Gobi
          blob(-25, 132, 8, 14), blob(33, -112, 7, 8), blob(-23, -69, 6, 3), blob(-24, 18, 5, 6),
        );
        const veg: [number, number, number] = [62 + tex * 40, 98 + tex * 40, 52 + tex * 15];
        const dry: [number, number, number] = [192 + tex * 30, 158 + tex * 25, 112 + tex * 20];
        const boreal: [number, number, number] = [96 + tex * 30, 106 + tex * 25, 80];
        const base = alat > 52 ? boreal : veg;
        r = base[0] + (dry[0] - base[0]) * arid; g = base[1] + (dry[1] - base[1]) * arid; b = base[2] + (dry[2] - base[2]) * arid;
        const ice = Math.min(1, Math.max(0, (alat - 64 + n.fbm(x * 0.04, y * 0.04, 2) * 6) / 4));
        if (lat < -62) { r = 235; g = 240; b = 245; }
        else { r += (235 - r) * ice; g += (240 - g) * ice; b += (245 - b) * ice; }
        const mtn = blob(31, 86, 3, 12) + blob(36, 85, 2, 10); // Himalaya / Kunlun relief
        r *= 1 - mtn * 0.25; g *= 1 - mtn * 0.25; b *= 1 - mtn * 0.2;
      } else {
        const deep = n.fbm(x * 0.01, y * 0.01, 3) * 0.5 + 0.5;
        r = 8 + deep * 10; g = 34 + deep * 25; b = 72 + deep * 40;
      }
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
      const cl = n.fbm(x * 0.012 + 50, y * 0.024, 6) * 0.5 + 0.5;
      const band = 0.75 + 0.25 * Math.cos((lat * Math.PI) / 30);
      const a = Math.max(0, (cl * band - 0.48) * 3.2);
      cimg.data[o] = 255; cimg.data[o + 1] = 255; cimg.data[o + 2] = 255; cimg.data[o + 3] = Math.min(230, a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  cctx.putImageData(cimg, 0, 0);
  const map = new THREE.CanvasTexture(out);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const clouds = new THREE.CanvasTexture(cloud);
  return { map, clouds };
}

function marsTexture() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const n = new Noise2D(4);
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y / H) * 180;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const t = n.fbm(x * 0.008, y * 0.016, 6) * 0.5 + 0.5;
      const d = n.fbm(x * 0.03 + 9, y * 0.06, 4) * 0.5 + 0.5;
      let r = 170 + t * 60, g = 92 + t * 35, b = 58 + t * 20;
      // dark albedo regions (soft-edged)
      const dk = 1 - Math.min(1, Math.max(0, (t - 0.36) / 0.1));
      const m = 1 - dk * 0.3;
      r *= m; g *= m; b *= m;
      // canyon-like streak near equator (stylised)
      if (Math.abs(lat + 8 + Math.sin(x * 0.02) * 2) < 1.6 && x > W * 0.55 && x < W * 0.75) { r *= 0.6; g *= 0.55; b *= 0.55; }
      // craters
      const cr = n.noise(x * 0.09, y * 0.18);
      const cm = 1 - Math.min(1, Math.max(0, (cr - 0.55) / 0.12)) * 0.15;
      r *= cm; g *= cm; b *= cm;
      r *= 0.9 + d * 0.15; g *= 0.9 + d * 0.15;
      if (Math.abs(lat) > 78) { r = 235; g = 228; b = 222; }
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const atmoVert = `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix*mv; }`;
const atmoFrag = `uniform vec3 uColor; uniform float uPow; varying vec3 vN; varying vec3 vP; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), uPow); gl_FragColor = vec4(uColor*f*1.6, f); }`;

export function Atmosphere({ radius, color, power = 2.6 }: { radius: number; color: string; power?: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        uniforms: { uColor: { value: new THREE.Color(color) }, uPow: { value: power } },
        blending: THREE.AdditiveBlending,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [color, power],
  );
  return (
    <mesh material={mat} scale={radius * 1.06}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
}

let earthTexCache: ReturnType<typeof earthTextures> | null = null;
let marsTexCache: THREE.Texture | null = null;

export function EarthGlobe({ radius = 10, spin = 0.01, markerLatLon, children }: { radius?: number; spin?: number; markerLatLon?: [number, number]; children?: React.ReactNode }) {
  const tex = useMemo(() => (earthTexCache ??= earthTextures()), []);
  const g = useRef<THREE.Group>(null);
  const cl = useRef<THREE.Mesh>(null);
  const marker = useRef<THREE.Mesh>(null);
  useFrame((st, dt) => {
    if (g.current) g.current.rotation.y += dt * spin;
    if (cl.current) cl.current.rotation.y += dt * 0.006;
    if (marker.current) marker.current.scale.setScalar(1 + Math.sin(st.clock.elapsedTime * 4) * 0.3);
  });
  const mpos = markerLatLon ? latLonToVec(markerLatLon[0], markerLatLon[1], radius * 1.003) : null;
  return (
    <group ref={g}>
      <mesh scale={radius}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial map={tex.map} roughness={0.75} metalness={0} />
      </mesh>
      <mesh ref={cl} scale={radius * 1.012}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial map={tex.clouds} transparent depthWrite={false} roughness={1} />
      </mesh>
      <Atmosphere radius={radius} color="#5fa8ff" />
      {mpos && (
        <mesh ref={marker} position={mpos}>
          <sphereGeometry args={[radius * 0.0035, 12, 12]} />
          <meshBasicMaterial color="#4fd1c5" />
        </mesh>
      )}
      {children}
    </group>
  );
}

export function MarsGlobe({ radius = 6, spin = 0.01 }: { radius?: number; spin?: number }) {
  const tex = useMemo(() => (marsTexCache ??= marsTexture()), []);
  const g = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * spin; });
  return (
    <group>
      <mesh ref={g} scale={radius}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      <Atmosphere radius={radius} color="#e8a074" power={3.5} />
    </group>
  );
}

export function Starfield({ count = 4000, radius = 900 }: { count?: number; radius?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const c = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(radius * (0.8 + Math.random() * 0.2));
      p.set([v.x, v.y, v.z], i * 3);
      const t = Math.random();
      const col = new THREE.Color().setHSL(t < 0.2 ? 0.6 : t < 0.3 ? 0.08 : 0, t < 0.3 ? 0.4 : 0, 0.7 + Math.random() * 0.3);
      c.set([col.r, col.g, col.b], i * 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  }, [count, radius]);
  return (
    <points geometry={geo}>
      <pointsMaterial size={1.6} sizeAttenuation={false} vertexColors transparent opacity={0.9} />
    </points>
  );
}
