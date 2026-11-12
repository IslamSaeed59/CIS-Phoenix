import * as THREE from 'three';

/**
 * Shared shader uniforms. Thermal mode renders a false-colour "ironbow" image computed from
 * a simple illustrative surface-energy model (sun incidence, absorptivity, thermal inertia, time of day).
 * It is a game visualisation, NOT a physical radiometric model.
 */
export const sharedUniforms = {
  uThermal: { value: 0 },
  uSunView: { value: new THREE.Vector3(0, 1, 0) },
  uDay: { value: 1 }, // 0 = night, 1 = midday
  uTime: { value: 0 },
  uScan: { value: 0 }, // terrain-scan sweep 0..1 (0 = off)
  uScanOrigin: { value: new THREE.Vector3() },
};

export const NOISE_GLSL = /* glsl */ `
vec2 pd_hash2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float pd_hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float pd_vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(pd_hash(i),pd_hash(i+vec2(1,0)),u.x), mix(pd_hash(i+vec2(0,1)),pd_hash(i+vec2(1,1)),u.x),u.y);
}
float pd_fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*pd_vnoise(p); p*=2.03; a*=0.5;} return s; }
// returns (F1, F2-F1)
vec2 pd_voronoi(vec2 x){
  vec2 n=floor(x), f=fract(x); float f1=8.0, f2=8.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 g=vec2(float(i),float(j)); vec2 o=pd_hash2(n+g); vec2 r=g+o-f; float d=dot(r,r);
    if(d<f1){ f2=f1; f1=d; } else if(d<f2){ f2=d; }
  }
  return vec2(sqrt(f1), sqrt(f2)-sqrt(f1));
}
vec3 pd_ironbow(float t){
  t=clamp(t,0.0,1.0);
  vec3 c0=vec3(0.02,0.0,0.08), c1=vec3(0.32,0.0,0.55), c2=vec3(0.85,0.12,0.35), c3=vec3(0.98,0.55,0.05), c4=vec3(1.0,0.97,0.75);
  if(t<0.25) return mix(c0,c1,t/0.25);
  if(t<0.5) return mix(c1,c2,(t-0.25)/0.25);
  if(t<0.75) return mix(c2,c3,(t-0.5)/0.25);
  return mix(c3,c4,(t-0.75)/0.25);
}
`;

/** JS mirror of the shader thermal index (0..1) — used for HUD temperature readouts. */
export function thermalIndex(absorb: number, inertia: number, incidence: number, day: number) {
  const dayHeat = day * absorb * (0.35 + 0.65 * Math.max(0, incidence)) * (1 - 0.5 * inertia);
  const nightHold = (1 - day) * inertia * 0.45;
  return Math.min(1, Math.max(0, dayHeat + nightHold + 0.05));
}

interface PatchOpts {
  absorb?: number;
  inertia?: number;
  terrain?: boolean; // use aSurf attribute + procedural detail
  detailScale?: number;
  detailAmount?: number;
  strataColorA?: THREE.Color;
  strataColorB?: THREE.Color;
}

/** Patches a MeshStandardMaterial with procedural detail and thermal-camera false colour. */
export function patchMaterial<T extends THREE.MeshStandardMaterial>(mat: T, opts: PatchOpts = {}): T {
  const absorb = opts.absorb ?? 0.7;
  const inertia = opts.inertia ?? 0.5;
  const terrain = !!opts.terrain;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uThermal = sharedUniforms.uThermal;
    shader.uniforms.uSunView = sharedUniforms.uSunView;
    shader.uniforms.uDay = sharedUniforms.uDay;
    shader.uniforms.uScan = sharedUniforms.uScan;
    shader.uniforms.uScanOrigin = sharedUniforms.uScanOrigin;
    shader.uniforms.uAbsorb = { value: absorb };
    shader.uniforms.uInertia = { value: inertia };
    shader.uniforms.uDetailScale = { value: opts.detailScale ?? 1 };
    shader.uniforms.uDetailAmt = { value: opts.detailAmount ?? 0.25 };
    shader.uniforms.uStrataA = { value: opts.strataColorA ?? new THREE.Color('#b59a76') };
    shader.uniforms.uStrataB = { value: opts.strataColorB ?? new THREE.Color('#8a6d50') };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWPos; varying vec3 vWNrm;
         ${terrain ? 'attribute vec3 aSurf; varying vec3 vSurf;' : ''}`,
      )
      .replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
         vec4 pdW = vec4(transformed,1.0);
         #ifdef USE_INSTANCING
           pdW = instanceMatrix * pdW;
         #endif
         vWPos = (modelMatrix * pdW).xyz;
         vWNrm = normalize(mat3(modelMatrix) * objectNormal);
         ${terrain ? 'vSurf = aSurf;' : ''}`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uThermal; uniform vec3 uSunView; uniform float uDay; uniform float uAbsorb; uniform float uInertia;
         uniform float uDetailScale; uniform float uDetailAmt; uniform vec3 uStrataA; uniform vec3 uStrataB;
         uniform float uScan; uniform vec3 uScanOrigin;
         varying vec3 vWPos; varying vec3 vWNrm;
         ${terrain ? 'varying vec3 vSurf;' : ''}
         ${NOISE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         {
           vec2 wp = vWPos.xz * uDetailScale;
           float d1 = pd_fbm(wp*0.35);
           float d2 = pd_fbm(wp*2.7);
           float d3 = pd_vnoise(wp*11.0);
           float detail = (d1-0.5)*0.9 + (d2-0.5)*0.6 + (d3-0.5)*0.35;
           diffuseColor.rgb *= 1.0 + detail*uDetailAmt;
           ${
             terrain
               ? `
           // Polygonal salt-crust pattern (Dalangtan-style), raised whitish ridges on cell edges
           if(vSurf.x > 0.01){
             vec2 v = pd_voronoi(vWPos.xz/3.2 + vec2(pd_fbm(vWPos.xz*0.2))*0.6);
             float ridge = 1.0 - smoothstep(0.0, 0.09, v.y);
             vec2 v2 = pd_voronoi(vWPos.xz/0.9);
             float small = 1.0 - smoothstep(0.0, 0.06, v2.y);
             vec3 salt = vec3(0.93,0.91,0.86);
             diffuseColor.rgb = mix(diffuseColor.rgb, salt, vSurf.x*(ridge*0.75 + small*0.18));
             diffuseColor.rgb *= 1.0 - vSurf.x*0.10*smoothstep(0.2,0.0,v.x);
           }
           // Sedimentary banding
           if(vSurf.y > 0.01){
             float y = vWPos.y + (pd_fbm(vWPos.xz*0.05)-0.5)*3.0;
             float b = sin(y*1.7)*0.5+0.5;
             float b2 = sin(y*5.3 + 1.3)*0.5+0.5;
             vec3 sc = mix(uStrataA, uStrataB, smoothstep(0.3,0.7,b));
             sc *= 0.88 + 0.22*b2;
             diffuseColor.rgb = mix(diffuseColor.rgb, sc, vSurf.y);
           }`
               : ''
           }
         }`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         {
           float inertia = ${terrain ? 'vSurf.z' : 'uInertia'};
           float lum = dot(diffuseColor.rgb, vec3(0.299,0.587,0.114));
           float absorb = ${terrain ? 'clamp(1.05 - lum*0.95, 0.15, 0.95)' : 'uAbsorb'};
           // view-space normal is available as 'normal'
           float inc = dot(normalize(normal), normalize(uSunView));
           float dayHeat = uDay * absorb * (0.35 + 0.65*max(0.0, inc)) * (1.0 - 0.5*inertia);
           float nightHold = (1.0-uDay) * inertia * 0.45;
           float T = clamp(dayHeat + nightHold + 0.05 + (pd_vnoise(vWPos.xz*1.3)-0.5)*0.03, 0.0, 1.0);
           if(uThermal > 0.5){
             gl_FragColor = vec4(pd_ironbow(T), 1.0);
           }
           if(uScan > 0.001){
             float dist = length(vWPos - uScanOrigin);
             float front = uScan*160.0;
             float ring = smoothstep(4.0,0.0,abs(dist-front));
             float grid = (1.0 - smoothstep(0.0,0.06,abs(fract(vWPos.y*0.5)-0.5)*2.0 - 0.94)) ;
             float contour = 1.0 - smoothstep(0.0, 0.08, abs(fract(vWPos.y/2.0)-0.5));
             float inside = step(dist, front);
             vec3 sc = vec3(0.15,0.95,0.85);
             gl_FragColor.rgb = mix(gl_FragColor.rgb, sc, ring*0.8 + inside*contour*0.35*(1.0-uScan*0.5));
           }
         }`,
      );
  };
  mat.customProgramCacheKey = () => `pd-${terrain ? 't' : 'o'}-${absorb}-${inertia}-${opts.detailScale ?? 1}-${opts.detailAmount ?? 0.25}`;
  return mat;
}

export function makeRockMaterial(color: string, absorb = 0.75, inertia = 0.8, opts: Partial<PatchOpts> = {}) {
  return patchMaterial(
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0, flatShading: false }),
    { absorb, inertia, detailScale: 1.4, detailAmount: 0.35, ...opts },
  );
}

/** Low-poly irregular rock geometry */
export function makeRockGeometry(seed: number, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const s = seed * 13.37;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n =
      0.75 +
      0.25 * Math.sin(x * 3.1 + s) * Math.cos(z * 2.7 + s * 0.7) +
      0.12 * Math.sin(y * 7.0 + s * 1.3) +
      0.08 * Math.cos((x + z) * 9.0 + s);
    pos.setXYZ(i, x * n, y * n * 0.72, z * n);
  }
  g.computeVertexNormals();
  return g;
}
