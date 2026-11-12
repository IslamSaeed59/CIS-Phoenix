import * as THREE from 'three';

/** A sampled heightfield with bilinear lookup. Used for walking, rover suspension and maps. */
export class Heightfield {
  size: number; // world size (m), centred on origin
  res: number; // vertices per side
  data: Float32Array;
  minH = Infinity;
  maxH = -Infinity;
  constructor(size: number, res: number, fn: (x: number, z: number) => number) {
    this.size = size;
    this.res = res;
    this.data = new Float32Array(res * res);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const x = (i / (res - 1) - 0.5) * size;
        const z = (j / (res - 1) - 0.5) * size;
        const h = fn(x, z);
        this.data[j * res + i] = h;
        if (h < this.minH) this.minH = h;
        if (h > this.maxH) this.maxH = h;
      }
    }
  }
  height(x: number, z: number) {
    const r = this.res - 1;
    let u = (x / this.size + 0.5) * r;
    let v = (z / this.size + 0.5) * r;
    u = Math.max(0, Math.min(r - 0.0001, u));
    v = Math.max(0, Math.min(r - 0.0001, v));
    const i = Math.floor(u), j = Math.floor(v);
    const fu = u - i, fv = v - j;
    const d = this.data, w = this.res;
    const h00 = d[j * w + i], h10 = d[j * w + i + 1];
    const h01 = d[(j + 1) * w + i], h11 = d[(j + 1) * w + i + 1];
    return (h00 * (1 - fu) + h10 * fu) * (1 - fv) + (h01 * (1 - fu) + h11 * fu) * fv;
  }
  normal(x: number, z: number, e = 1.5) {
    const hL = this.height(x - e, z), hR = this.height(x + e, z);
    const hD = this.height(x, z - e), hU = this.height(x, z + e);
    return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize();
  }
  /** slope in degrees */
  slope(x: number, z: number) {
    const n = this.normal(x, z, 2);
    return (Math.acos(n.y) * 180) / Math.PI;
  }
}

export type ColorFn = (x: number, z: number, h: number, slope: number, out: THREE.Color) => void;

/** Builds a terrain mesh geometry from a heightfield, with vertex colours + a zone attribute. */
/** surfFn returns [playaPatternWeight, strataWeight, thermalInertia(0..1)] */
export function buildTerrainGeometry(
  hf: Heightfield,
  colorFn: ColorFn,
  surfFn?: (x: number, z: number, h: number) => [number, number, number],
) {
  const res = hf.res;
  const geo = new THREE.PlaneGeometry(hf.size, hf.size, res - 1, res - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const zones = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    const i = Math.round((x / hf.size + 0.5) * (res - 1));
    const j = Math.round((z / hf.size + 0.5) * (res - 1));
    const h = hf.data[j * res + i];
    pos.setY(k, h);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k), h = pos.getY(k);
    const slope = (Math.acos(Math.min(1, nrm.getY(k))) * 180) / Math.PI;
    colorFn(x, z, h, slope, c);
    colors[k * 3] = c.r;
    colors[k * 3 + 1] = c.g;
    colors[k * 3 + 2] = c.b;
    const s = surfFn ? surfFn(x, z, h) : [0, 0, 0.5];
    zones[k * 3] = s[0];
    zones[k * 3 + 1] = s[1];
    zones[k * 3 + 2] = s[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSurf', new THREE.BufferAttribute(zones, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** Renders a heightfield to a 2D canvas image (shaded relief) for maps. */
export function renderReliefMap(
  hf: Heightfield,
  px: number,
  colorFn: (x: number, z: number, h: number, slope: number) => [number, number, number],
  extent = hf.size,
) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(px, px);
  const light = new THREE.Vector3(-0.6, 0.7, -0.4).normalize();
  for (let j = 0; j < px; j++) {
    for (let i = 0; i < px; i++) {
      const x = (i / (px - 1) - 0.5) * extent;
      const z = (j / (px - 1) - 0.5) * extent;
      const h = hf.height(x, z);
      const n = hf.normal(x, z, extent / px);
      const slope = (Math.acos(n.y) * 180) / Math.PI;
      const shade = 0.55 + 0.6 * Math.max(0, n.dot(light));
      const [r, g, b] = colorFn(x, z, h, slope);
      const o = (j * px + i) * 4;
      img.data[o] = Math.min(255, r * shade);
      img.data[o + 1] = Math.min(255, g * shade);
      img.data[o + 2] = Math.min(255, b * shade);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
