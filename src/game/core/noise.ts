// Deterministic procedural noise used for terrain generation (Earth + Mars).
// Simplex-style gradient noise implemented locally (no external assets).

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Noise2D {
  private perm = new Uint8Array(512);
  private grad: [number, number][] = [];
  constructor(seed = 1) {
    const rnd = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    for (let i = 0; i < 256; i++) {
      const a = rnd() * Math.PI * 2;
      this.grad.push([Math.cos(a), Math.sin(a)]);
    }
  }
  private dot(ix: number, iy: number, x: number, y: number) {
    const g = this.grad[this.perm[(ix & 255) + this.perm[iy & 255]] & 255];
    return g[0] * (x - ix) + g[1] * (y - iy);
  }
  /** Perlin gradient noise in approx [-1, 1] */
  noise(x: number, y: number) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const sx = x - x0, sy = y - y0;
    const fx = sx * sx * sx * (sx * (sx * 6 - 15) + 10);
    const fy = sy * sy * sy * (sy * (sy * 6 - 15) + 10);
    const n00 = this.dot(x0, y0, x, y), n10 = this.dot(x0 + 1, y0, x, y);
    const n01 = this.dot(x0, y0 + 1, x, y), n11 = this.dot(x0 + 1, y0 + 1, x, y);
    const a = n00 + fx * (n10 - n00);
    const b = n01 + fx * (n11 - n01);
    return (a + fy * (b - a)) * 1.414;
  }
  fbm(x: number, y: number, oct = 5, lac = 2.0, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * this.noise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lac;
    }
    return sum / norm;
  }
  ridged(x: number, y: number, oct = 5) {
    let amp = 0.5, freq = 1, sum = 0;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(this.noise(x * freq, y * freq));
      sum += n * n * amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum;
  }
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
