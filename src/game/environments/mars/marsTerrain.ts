import * as THREE from 'three';
import { Noise2D, smoothstep, clamp } from '../../core/noise';
import { Heightfield } from '../../core/terrain';
import { MARS_POI_BY_ID } from '../../../data/mars/marsData';

// Representative reconstruction of a sedimentary crater-floor setting on Mars.
// Positions are game-world metres, not real Martian coordinates.

const n = new Noise2D(1965);
const n2 = new Noise2D(404);
export const MARS_SIZE = 900;
export const MARS_RADIUS = 360;
export const MARS_WIND = new THREE.Vector2(0.8, 0.6).normalize();

interface Crater { x: number; z: number; r: number; d: number }
export const CRATERS: Crater[] = (() => {
  const out: Crater[] = [{ x: 85, z: 175, r: 26, d: 7 }];
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const x = (rnd() - 0.5) * 760, z = (rnd() - 0.5) * 760;
    if (Math.hypot(x, z - 60) < 40) continue;
    if (z < -150) continue;
    if (Math.hypot(x - 150, z - 50) < 50) continue;
    const r = 3 + Math.pow(rnd(), 2.2) * 14;
    out.push({ x, z, r, d: r * 0.22 });
  }
  return out;
})();

function craterH(x: number, z: number) {
  let h = 0;
  for (const c of CRATERS) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d > 2.2) continue;
    if (d < 1) h += -c.d * (1 - d * d) + c.d * 0.25 * d ** 6;
    else h += c.d * 0.25 * Math.exp(-((d - 1) ** 2) * 6);
  }
  return h;
}

const RIDGES = (() => {
  const out: { x: number; z: number; L: number; W: number; H: number }[] = [];
  let s = 5;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 30 && out.length < 9; i++) {
    const x = 170 + (rnd() - 0.5) * 90, z = -115 + (rnd() - 0.5) * 80;
    const L = 30 + rnd() * 40, W = 7 + rnd() * 8, H = 4 + rnd() * 6;
    if (out.some((r) => Math.hypot(r.x - x, r.z - z) < (r.W + W) * 1.3 + 4)) continue;
    out.push({ x, z, L, W, H });
  }
  return out;
})();

function ridgeH(x: number, z: number) {
  let h = 0;
  const ang = Math.atan2(MARS_WIND.y, MARS_WIND.x);
  const c = Math.cos(ang), s = Math.sin(ang);
  for (const r of RIDGES) {
    const dx = x - r.x, dz = z - r.z;
    const u = (dx * c + dz * s) / (r.L * 0.5);
    const v = (-dx * s + dz * c) / (r.W * 0.5);
    if (u < -1.1 || u > 1.1) continue;
    const w = u < -0.7 ? Math.sqrt(Math.max(0, 1 - ((u + 0.7) / 0.4) ** 2)) : Math.pow(Math.max(0, 1 - (u + 0.7) / 1.8), 0.6);
    if (w < 0.01) continue;
    const vv = Math.abs(v) / w;
    if (vv > 1.2) continue;
    const hh = r.H * Math.pow(clamp(1 - vv ** 3, 0, 1), 0.5) * smoothstep(-1.05, -0.8, u) * (1 - 0.7 * smoothstep(0, 1.05, u));
    h = Math.max(h, hh);
  }
  return h;
}

export const escarpEdge = (x: number) => -176 + n.noise(x * 0.015, 1.7) * 7;

export function marsHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  let h = n.fbm(x * 0.005, z * 0.005, 4) * 4 + n.fbm(x * 0.04, z * 0.04, 3) * 0.5 + n2.ridged(x * 0.02, z * 0.02, 2) * 0.4;
  h += craterH(x, z);
  if (x > 110) h += ridgeH(x, z);
  // Escarpment with layered outcrop
  const e = escarpEdge(x);
  const t = smoothstep(e + 2, e - 9, z);
  const terr = t + Math.sin(t * Math.PI * 8) * 0.025;
  h += clamp(terr, 0, 1) * (19 + n.fbm(x * 0.01, z * 0.01, 2) * 3) * (1 - smoothstep(230, 320, Math.abs(x)));
  // Collapse pit (conceptual) — steep, rimless
  const pd = Math.hypot(x + 178, z + 120);
  if (pd < 16) h -= 14 * (1 - smoothstep(9, 13.5, pd));
  // Ripple field: slight depression
  const sd = Math.hypot(x - 150, z - 50);
  h -= 0.8 * (1 - smoothstep(20, 42, sd));
  // Rover start: smooth
  const sp = Math.hypot(x, z - 60);
  h = h * smoothstep(6, 22, sp) + (h * 0.3) * (1 - smoothstep(6, 22, sp));
  // Crater-rim walls at the edge of the play area
  h += smoothstep(MARS_RADIUS - 5, MARS_SIZE * 0.5, r) * (25 + n.ridged(x * 0.01, z * 0.01, 3) * 30);
  return h;
}

export function softSand(x: number, z: number) {
  return 1 - smoothstep(26, 40, Math.hypot(x - 150, z - 50));
}

export function marsSurf(x: number, z: number, h: number): [number, number, number] {
  const e = escarpEdge(x);
  const cliff = 1 - smoothstep(0, 12, Math.abs(z - (e - 4)));
  const ridge = x > 110 ? clamp(ridgeH(x, z) / 2, 0, 1) : 0;
  const strata = clamp(Math.max(cliff * (1 - smoothstep(220, 300, Math.abs(x))), ridge * 0.8), 0, 1);
  const sand = softSand(x, z);
  let inertia = 0.35 * (1 - sand) + 0.12 * sand;
  inertia = Math.max(inertia, strata * 0.8);
  const boulder = 1 - smoothstep(20, 34, Math.hypot(x + 140, z - 15));
  inertia = Math.max(inertia, boulder * 0.7);
  return [0, strata, inertia];
}

const C = (h: string) => new THREE.Color(h);
const COL = {
  base: C('#9a5a3a'), base2: C('#7f4630'), dust: C('#b9774f'), dark: C('#5a3a2c'), sand: C('#6b4535'), rock: C('#8a6550'), light: C('#c69a76'),
};
export function marsColor(x: number, z: number, h: number, slope: number, out: THREE.Color) {
  const t = n.fbm(x * 0.012, z * 0.012, 4) * 0.5 + 0.5;
  out.copy(COL.base).lerp(COL.base2, t * 0.8);
  const d = n2.fbm(x * 0.05, z * 0.05, 3) * 0.5 + 0.5;
  out.lerp(COL.dust, d * 0.35);
  const sand = softSand(x, z);
  if (sand > 0) out.lerp(COL.sand, sand * 0.8);
  if (z < escarpEdge(x) - 3) out.lerp(COL.light, 0.55);
  const boulder = 1 - smoothstep(18, 34, Math.hypot(x + 140, z - 15));
  if (boulder > 0) out.lerp(COL.dark, boulder * 0.45);
  if (slope > 28) out.lerp(COL.rock, 0.5);
  // Dust-devil tracks (dark streaks)
  const trk = Math.abs(Math.sin((x * 0.6 - z * 0.8) * 0.05 + n.noise(x * 0.01, z * 0.01) * 4));
  if (trk < 0.04) out.multiplyScalar(0.9);
  const pd = Math.hypot(x + 178, z + 120);
  if (pd < 13) out.multiplyScalar(0.55 + 0.45 * smoothstep(5, 13, pd));
}

let _hf: Heightfield | null = null;
let _res = 0;
export function getMarsHF(res = 300) {
  if (!_hf || _res !== res) {
    _hf = new Heightfield(MARS_SIZE, res, marsHeight);
    _res = res;
  }
  return _hf;
}
export const MARS_RES = { low: 220, medium: 300, high: 380, ultra: 440 } as const;

export function marsZoneName(x: number, z: number) {
  const near = Object.values(MARS_POI_BY_ID)
    .map((p) => ({ p, d: Math.hypot(p.pos[0] - x, p.pos[1] - z) - p.radius }))
    .sort((a, b) => a.d - b.d)[0];
  if (near && near.d < 30) return `Near ${near.p.name}`;
  if (Math.hypot(x, z - 60) < 40) return 'Landing ellipse (traverse start)';
  return 'Crater floor plains';
}
