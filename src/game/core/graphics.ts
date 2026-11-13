// Graphics configuration. Every field here is read by the real rendering code:
//  resScale     → canvas device-pixel-ratio (render resolution)
//  shadows      → shadow casting on/off + shadow-map resolution
//  textures     → procedural planet texture resolution + anisotropic filtering
//  aa           → WebGL antialiasing (canvas is recreated when this changes)
//  viewDistance → camera far plane + atmospheric fog density
//  density      → rocks, pebbles, crystals and cobbles instance counts
//  particles    → wind-blown dust particle counts
//  terrain      → terrain mesh resolution (heightfield vertices)
//  fpsLimit     → frame-rate cap (0 = follow the display refresh / browser VSync)
//  targetFps    → what the performance monitor tries to maintain

export type Preset = 'low' | 'medium' | 'high' | 'ultra';
export type ShadowQ = 'off' | 'low' | 'medium' | 'high';
export type TexQ = 'low' | 'medium' | 'high';

export interface Gfx {
  preset: Preset | 'custom';
  resScale: number;
  shadows: ShadowQ;
  textures: TexQ;
  aa: boolean;
  viewDistance: number;
  density: number;
  particles: number;
  terrain: Preset;
  fpsLimit: 0 | 30 | 60 | 90;
  targetFps: 30 | 60 | 90;
}

export const PRESETS: Record<Preset, Gfx> = {
  low: { preset: 'low', resScale: 0.7, shadows: 'off', textures: 'low', aa: false, viewDistance: 0.7, density: 0.5, particles: 0.35, terrain: 'low', fpsLimit: 0, targetFps: 30 },
  medium: { preset: 'medium', resScale: 0.9, shadows: 'low', textures: 'medium', aa: true, viewDistance: 0.9, density: 0.8, particles: 0.7, terrain: 'medium', fpsLimit: 0, targetFps: 60 },
  high: { preset: 'high', resScale: 1, shadows: 'medium', textures: 'medium', aa: true, viewDistance: 1, density: 1, particles: 1, terrain: 'high', fpsLimit: 0, targetFps: 60 },
  ultra: { preset: 'ultra', resScale: 1.25, shadows: 'high', textures: 'high', aa: true, viewDistance: 1.3, density: 1.35, particles: 1, terrain: 'ultra', fpsLimit: 0, targetFps: 60 },
};

export const PRESET_INFO: Record<Preset, { title: string; sub: string }> = {
  low: { title: 'LOW', sub: 'Performance priority' },
  medium: { title: 'MEDIUM', sub: 'Balanced' },
  high: { title: 'HIGH', sub: 'Visual quality' },
  ultra: { title: 'ULTRA', sub: 'Maximum quality' },
};

export const SHADOW_MAP: Record<ShadowQ, number> = { off: 0, low: 1024, medium: 2048, high: 4096 };
export const TEX_SIZE: Record<TexQ, number> = { low: 512, medium: 1024, high: 2048 };
export const ANISO: Record<TexQ, number> = { low: 1, medium: 4, high: 8 };

/** Final device pixel ratio for the canvas. */
export function gfxDpr(g: Gfx) {
  const native = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.max(0.5, Math.min(2, native * g.resScale));
}

/** Rough relative GPU cost of a config (1 = HIGH preset) — used to explain changes in the menu. */
export function gfxCost(g: Gfx) {
  const px = (gfxDpr(g) / gfxDpr(PRESETS.high)) ** 2;
  const sh = { off: 0.55, low: 0.75, medium: 1, high: 1.35 }[g.shadows];
  const den = 0.7 + 0.3 * g.density;
  const ter = { low: 0.8, medium: 0.9, high: 1, ultra: 1.15 }[g.terrain];
  return px * sh * den * ter * (g.aa ? 1.08 : 1);
}

export function sameGfx(a: Gfx, b: Gfx) {
  const k: (keyof Gfx)[] = ['resScale', 'shadows', 'textures', 'aa', 'viewDistance', 'density', 'particles', 'terrain', 'fpsLimit', 'targetFps'];
  return k.every((x) => a[x] === b[x]);
}

/** Identify which preset a config matches exactly (or 'custom'). */
export function matchPreset(g: Gfx): Preset | 'custom' {
  const p = (Object.keys(PRESETS) as Preset[]).find((k) => sameGfx({ ...g, targetFps: PRESETS[k].targetFps, fpsLimit: PRESETS[k].fpsLimit }, PRESETS[k]));
  return p ?? 'custom';
}

const SHADOW_ORDER: ShadowQ[] = ['off', 'low', 'medium', 'high'];
const TERRAIN_ORDER: Preset[] = ['low', 'medium', 'high', 'ultra'];

/** One gentle step down in cost: shadows first, then resolution, then density/particles, then terrain. */
export function stepDown(g: Gfx): { next: Gfx; what: string } | null {
  const si = SHADOW_ORDER.indexOf(g.shadows);
  if (si > 1) return { next: { ...g, shadows: SHADOW_ORDER[si - 1], preset: 'custom' }, what: `Shadows → ${SHADOW_ORDER[si - 1]}` };
  if (g.resScale > 0.65) { const r = Math.max(0.6, +(g.resScale - 0.15).toFixed(2)); return { next: { ...g, resScale: r, preset: 'custom' }, what: `Resolution → ${Math.round(r * 100)}%` }; }
  if (g.density > 0.55 || g.particles > 0.4) return { next: { ...g, density: Math.max(0.5, +(g.density - 0.25).toFixed(2)), particles: Math.max(0.35, +(g.particles - 0.25).toFixed(2)), preset: 'custom' }, what: 'Rock & dust density reduced' };
  if (si === 1) return { next: { ...g, shadows: 'off', preset: 'custom' }, what: 'Shadows → off' };
  const ti = TERRAIN_ORDER.indexOf(g.terrain);
  if (ti > 0) return { next: { ...g, terrain: TERRAIN_ORDER[ti - 1], preset: 'custom' }, what: `Terrain detail → ${TERRAIN_ORDER[ti - 1]}` };
  return null;
}
