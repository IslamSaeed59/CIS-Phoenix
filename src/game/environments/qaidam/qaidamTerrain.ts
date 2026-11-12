import * as THREE from 'three';
import { Noise2D, smoothstep, clamp } from '../../core/noise';
import { Heightfield } from '../../core/terrain';
import { EARTH_ZONES, type ZoneId } from '../../../data/earth/earthData';

// Representative reconstruction of Qaidam Basin landscapes (NOT survey-accurate topography).
// World axes: +x = east, -z = north. Prevailing wind: from NW toward SE.

const n = new Noise2D(2077);
const n2 = new Noise2D(31);

export const WIND_DIR = new THREE.Vector2(1, 1).normalize(); // blowing toward SE
export const PLAY_SIZE = 960;
export const PLAY_RADIUS = 430;

export interface Yardang { x: number; z: number; L: number; W: number; H: number; ang: number }
export const YARDANGS: Yardang[] = (() => {
  const out: Yardang[] = [];
  const ang = Math.atan2(WIND_DIR.y, WIND_DIR.x);
  // The flagship yardang (POI)
  out.push({ x: 222, z: -18, L: 105, W: 26, H: 17, ang });
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70 && out.length < 26; i++) {
    const x = 140 + rnd() * 230;
    const z = -120 + rnd() * 230;
    if (Math.hypot(x - 262, z - 62) < 34) continue; // keep ripple corridor clear
    if (Math.hypot(x - 175, z - 30) < 22) continue; // entry corridor
    const L = 40 + rnd() * 70, W = 10 + rnd() * 14, H = 5 + rnd() * 11;
    if (out.some((y) => Math.hypot(y.x - x, y.z - z) < (y.W + W) * 1.25 + 8)) continue;
    out.push({ x, z, L, W, H, ang: ang + (rnd() - 0.5) * 0.12 });
  }
  return out;
})();

function yardangHeight(x: number, z: number) {
  let h = 0;
  for (const y of YARDANGS) {
    const dx = x - y.x, dz = z - y.z;
    if (Math.abs(dx) > y.L && Math.abs(dz) > y.L) continue;
    const c = Math.cos(y.ang), s = Math.sin(y.ang);
    const u = (dx * c + dz * s) / (y.L * 0.5); // -1 windward(NW) .. +1 leeward(SE)
    const v = (-dx * s + dz * c) / (y.W * 0.5);
    if (u < -1.15 || u > 1.15) continue;
    // width profile: blunt upwind, tapering downwind
    const wProf = u < -0.75 ? Math.sqrt(Math.max(0, 1 - ((u + 0.75) / 0.4) ** 2)) : Math.pow(Math.max(0, 1 - (u + 0.75) / 1.9), 0.55);
    if (wProf <= 0.001) continue;
    const vv = Math.abs(v) / wProf;
    if (vv > 1.25) continue;
    const cross = Math.pow(clamp(1 - Math.pow(vv, 3.2), 0, 1), 0.45);
    const along = smoothstep(-1.08, -0.82, u) * (1 - 0.75 * smoothstep(-0.1, 1.05, u));
    let hy = y.H * cross * along;
    // layered terracing + flank grooves
    hy += Math.sin(hy * 1.6) * 0.35 * cross;
    hy += Math.sin(v * 9 + u * 2) * 0.25 * cross * along;
    h = Math.max(h, hy);
  }
  return h;
}

// Dry channel polyline (north→southwest)
export const CHANNEL: [number, number][] = [
  [-50, -186], [-62, -160], [-90, -135], [-112, -100], [-125, -70], [-150, -40], [-175, -10], [-200, 20],
];
function distToChannel(x: number, z: number) {
  let best = 1e9;
  for (let i = 0; i < CHANNEL.length - 1; i++) {
    const [ax, az] = CHANNEL[i], [bx, bz] = CHANNEL[i + 1];
    const vx = bx - ax, vz = bz - az;
    const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
    const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
    if (d < best) best = d;
  }
  return best;
}

export const cliffEdge = (x: number) => -192 + n.noise(x * 0.012, 3.3) * 6 + n.noise(x * 0.05, 9.1) * 1.5;

function zoneWeight(x: number, z: number, id: ZoneId, pad = 1) {
  const zn = EARTH_ZONES[id];
  const d = Math.hypot(x - zn.center[0], z - zn.center[1]);
  return 1 - smoothstep(zn.radius * 0.6 * pad, zn.radius * pad, d);
}

export function qaidamHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  let h = n.fbm(x * 0.004, z * 0.004, 4) * 3.0 + n.fbm(x * 0.03, z * 0.03, 3) * 0.6;

  // Playa: extremely flat, slightly lower
  const wp = zoneWeight(x, z, 'playa', 1.15);
  h = h * (1 - wp) + (-1.6 + n.fbm(x * 0.05, z * 0.05, 2) * 0.08) * wp;

  // Saline pan: hummocky mounds
  const ws = zoneWeight(x, z, 'saline', 1.1);
  const mounds = Math.max(0, n2.fbm(x * 0.09, z * 0.09, 3)) * 2.6;
  h = h * (1 - ws) + (-1.2 + mounds) * ws;

  // Camp flat
  const wc = 1 - smoothstep(25, 45, Math.hypot(x - 0, z - 140));
  h = h * (1 - wc) + 0.4 * wc;

  // Relay knoll
  h += 7 * Math.exp(-((x - 128) ** 2 + (z - 168) ** 2) / (2 * 16 * 16));

  // Yardangs (only in eastern field)
  if (x > 80 && x < 420 && z > -200 && z < 200) h += yardangHeight(x, z);

  // Escarpment & plateau to the north
  const ce = cliffEdge(x);
  const span = 1 - smoothstep(170, 260, Math.abs(x));
  const plateau = 23 + n.fbm(x * 0.01, z * 0.01, 3) * 3;
  const cliffT = smoothstep(ce + 1.5, ce - 7.5, z); // 0 south of edge, 1 on plateau
  // terraced profile for ledges
  const terr = cliffT + Math.sin(cliffT * Math.PI * 6) * 0.03;
  h += plateau * clamp(terr, 0, 1) * span + (1 - span) * smoothstep(-150, -260, z) * 14;

  // Dry channel carved in
  const dc = distToChannel(x, z);
  if (dc < 16) {
    const depth = 3.2 * (1 - smoothstep(2, 9, dc));
    h -= depth;
  }

  // Outer basin margin rises (hides edges)
  h += smoothstep(PLAY_RADIUS - 10, PLAY_SIZE * 0.5, r) * (30 + n.ridged(x * 0.01, z * 0.01, 3) * 40);
  return h;
}

/** Soft, noise-edged weight of the sandy yardang-field floor. */
export function sandWeight(x: number, z: number) {
  const d = Math.hypot((x - 240) / 150, (z - 5) / 175) + n.fbm(x * 0.02, z * 0.02, 3) * 0.25;
  return 1 - smoothstep(0.75, 1.0, d);
}

export function qaidamSurf(x: number, z: number, h: number): [number, number, number] {
  const wp = zoneWeight(x, z, 'playa', 1.05);
  const ws = zoneWeight(x, z, 'saline', 1.0);
  const ce = cliffEdge(x);
  const nearCliff = 1 - smoothstep(0, 14, Math.abs(z - (ce - 3)));
  const yard = x > 100 ? clamp(yardangHeight(x, z) / 3, 0, 1) : 0;
  const strata = clamp(Math.max(nearCliff * (1 - smoothstep(170, 230, Math.abs(x))), yard), 0, 1);
  const sand = sandWeight(x, z) * (1 - yard);
  const gravel = 1 - smoothstep(18, 34, Math.hypot(x + 75, z - 70));
  let inertia = 0.4;
  inertia = inertia * (1 - wp) + 0.5 * wp;
  inertia = inertia * (1 - sand * 0.8) + 0.15 * sand * 0.8;
  inertia = inertia * (1 - gravel) + 0.45 * gravel;
  inertia = Math.max(inertia, strata * 0.85);
  return [Math.max(wp, ws * 0.7), strata, inertia];
}

const C = (h: string) => new THREE.Color(h);
const COL = {
  floor: C('#a69a86'), floor2: C('#8e8473'), playa: C('#cdc6b6'), playa2: C('#b4a68c'), salt: C('#e4e0d6'),
  sand: C('#c2a77f'), yard: C('#b99f7a'), gravel: C('#55504a'), plateau: C('#9c7c5f'), channel: C('#8d8578'),
  mount: C('#6f645a'), snow: C('#eef0f2'),
};

export function qaidamColor(x: number, z: number, h: number, slope: number, out: THREE.Color) {
  const t = n.fbm(x * 0.02, z * 0.02, 3) * 0.5 + 0.5;
  out.copy(COL.floor).lerp(COL.floor2, t * 0.6);
  const wp = zoneWeight(x, z, 'playa', 1.1);
  if (wp > 0) out.lerp(new THREE.Color().copy(COL.playa).lerp(COL.playa2, n2.fbm(x * 0.03, z * 0.03, 3) * 0.5 + 0.4), wp);
  const ws = zoneWeight(x, z, 'saline', 1.05);
  if (ws > 0) out.lerp(COL.salt, ws * 0.9);
  const sw = sandWeight(x, z); if (sw > 0) out.lerp(COL.sand, 0.65 * sw);
  const yh = x > 100 ? yardangHeight(x, z) : 0;
  if (yh > 0.6) out.lerp(COL.yard, clamp(yh / 4, 0, 1));
  const gravel = 1 - smoothstep(16, 32, Math.hypot(x + 75, z - 70));
  if (gravel > 0) out.lerp(COL.gravel, gravel * 0.92);
  if (z < cliffEdge(x) - 2) out.lerp(COL.plateau, 0.7);
  const dc = distToChannel(x, z);
  if (dc < 10) out.lerp(COL.channel, (1 - dc / 10) * 0.7);
  if (dc < 3) out.lerp(COL.salt, 0.35);
  const r = Math.hypot(x, z);
  if (r > PLAY_RADIUS) out.lerp(COL.mount, smoothstep(PLAY_RADIUS, PLAY_RADIUS + 60, r));
  if (slope > 35) out.multiplyScalar(0.9);
}

export function zoneAt(x: number, z: number): ZoneId | null {
  let best: ZoneId | null = null, bd = 1e9;
  (Object.keys(EARTH_ZONES) as ZoneId[]).forEach((k) => {
    const zn = EARTH_ZONES[k];
    const d = Math.hypot(x - zn.center[0], z - zn.center[1]);
    if (d < zn.radius && d < bd) { bd = d; best = k; }
  });
  return best;
}

export function surfaceAt(x: number, z: number): 'salt' | 'sand' | 'gravel' | 'hard' {
  if (1 - smoothstep(16, 32, Math.hypot(x + 75, z - 70)) > 0.5) return 'gravel';
  if (zoneWeight(x, z, 'playa', 1.05) > 0.5 || zoneWeight(x, z, 'saline', 1) > 0.5) return 'salt';
  if (sandWeight(x, z) > 0.5 && yardangHeight(x, z) < 0.8) return 'sand';
  return 'hard';
}

let _hf: Heightfield | null = null;
let _hfRes = 0;
export function getQaidamHF(res: number) {
  if (!_hf || _hfRes !== res) {
    _hf = new Heightfield(PLAY_SIZE, res, qaidamHeight);
    _hfRes = res;
  }
  return _hf;
}

/** Distant mountains ring (Kunlun / Qilian / Altun ranges surround the basin) */
export function mountainHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  const ring = smoothstep(1100, 2000, r);
  const ang = Math.atan2(z, x);
  const range = 0.6 + 0.4 * Math.sin(ang * 3 + 1.3);
  return -2 + ring * (40 + n.ridged(x * 0.0016, z * 0.0016, 5) * 560 * range) + smoothstep(PLAY_RADIUS, 900, r) * 22 + n.fbm(x * 0.004, z * 0.004, 3) * 6 * smoothstep(PLAY_RADIUS, 700, r);
}
