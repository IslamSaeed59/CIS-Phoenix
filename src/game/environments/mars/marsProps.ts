import { mulberry32 } from '../../core/noise';
import { softSand } from './marsTerrain';

export interface Boulder { x: number; z: number; r: number; seed: number; dark: boolean }

/** Deterministic boulder placement shared by the renderer and rover collision. */
export const BOULDERS: Boulder[] = (() => {
  const rnd = mulberry32(2026);
  const out: Boulder[] = [];
  // Dark boulder field
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 30;
    const x = -140 + Math.cos(a) * rr, z = 15 + Math.sin(a) * rr;
    const r = 0.5 + Math.pow(rnd(), 2) * 2.2;
    if (out.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + r + 1.5)) continue;
    out.push({ x, z, r, seed: i, dark: true });
  }
  // Ejecta blocks around the crater
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, rr = 28 + rnd() * 20;
    const x = 85 + Math.cos(a) * rr, z = 175 + Math.sin(a) * rr;
    out.push({ x, z, r: 0.4 + rnd() * 1.2, seed: 100 + i, dark: false });
  }
  // Talus at the escarpment base
  for (let i = 0; i < 50; i++) {
    const x = (rnd() - 0.5) * 420, z = -170 + rnd() * 16;
    out.push({ x, z, r: 0.3 + rnd() * 1.1, seed: 200 + i, dark: false });
  }
  // Scattered rocks
  for (let i = 0; i < 70; i++) {
    const x = (rnd() - 0.5) * 680, z = (rnd() - 0.5) * 680;
    if (Math.hypot(x, z) > 330 || Math.hypot(x, z - 60) < 18 || softSand(x, z) > 0.1) continue;
    out.push({ x, z, r: 0.3 + Math.pow(rnd(), 3) * 1.3, seed: 300 + i, dark: rnd() > 0.5 });
  }
  return out;
})();
