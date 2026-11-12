import * as THREE from 'three';
import { useGame } from '../core/store';
import { useUI, toast, radio, type ToolId } from '../core/ui';
import { audio } from '../core/audio';
import { runtime } from '../player/PlayerController';
import { EARTH_POIS, EARTH_POI_BY_ID, EARTH_ZONES, EARTH_TASKS, type EarthPOI } from '../../data/earth/earthData';
import { zoneAt, surfaceAt, getQaidamHF } from '../environments/qaidam/qaidamTerrain';
import { sharedUniforms, thermalIndex } from '../core/shaders';
import { CAT_BY_ID } from '../../data/scientific-checklist/categories';
import type { Heightfield } from '../core/terrain';

export const TOOLS: { id: ToolId; key: string; name: string; short: string; range: number; desc: string }[] = [
  { id: 'camera', key: '1', name: 'Field Camera', short: 'CAM', range: 180, desc: 'Capture evidence photographs. Subjects in frame are auto-tagged.' },
  { id: 'spectral', key: '2', name: 'Spectral Scanner (VNIR)', short: 'SPEC', range: 30, desc: 'Preliminary reflectance spectrum of a target. Not definitive.' },
  { id: 'thermal', key: '3', name: 'Thermal Camera', short: 'TIR', range: 70, desc: 'False-colour thermal view; click to log target temperature.' },
  { id: 'lidar', key: '4', name: 'Terrain LiDAR', short: 'LIDAR', range: 0, desc: 'Scan 160 m radius → 3D topographic model, slope statistics.' },
  { id: 'gpr', key: '5', name: 'Ground-Penetrating Radar', short: 'GPR', range: 0, desc: 'Acquire a subsurface reflection profile (simulated).' },
  { id: 'env', key: '6', name: 'Environmental Suite', short: 'ENV', range: 0, desc: 'Wind, air temperature, humidity, UV index (simulated).' },
  { id: 'probe', key: '7', name: 'Penetrometer', short: 'PROBE', range: 0, desc: 'Surface bearing-strength test at your feet.' },
];

export const POI_RADIUS: Record<string, number> = {
  'yardang-major': 48, 'strata-cliff': 20, 'playa-polygons': 16, 'ripples': 22, 'halite-mounds': 14, 'dry-channel': 12, overhang: 12, 'dark-gravel': 16,
};
export const poiRadius = (id: string) => POI_RADIUS[id] ?? 8;

const ZONE_LABEL = (x: number, z: number) => {
  const zid = zoneAt(x, z);
  return zid ? EARTH_ZONES[zid].name : 'Qaidam Basin (open terrain)';
};

export function earthLocation() {
  return ZONE_LABEL(runtime.pos.x, runtime.pos.z);
}

/** Records evidence and toasts; returns true if new. */
export function logEvidence(key: string, instrument: string, summary: string) {
  const g = useGame.getState();
  const isNew = g.addEvidence('earth', { key, instrument, location: earthLocation(), summary });
  if (isNew && EARTH_TASKS.some((t) => t.id === key)) {
    const task = EARTH_TASKS.find((t) => t.id === key)!;
    toast('EVIDENCE COLLECTED', `${CAT_BY_ID[task.cat].num} · ${task.label}`, 'evidence');
    afterEvidence();
  }
  return isNew;
}

let lastPraise = 0;
function afterEvidence() {
  const g = useGame.getState();
  const ev = g.earthEvidence;
  const count = Object.keys(ev).length;
  if (count === 1) radio('MISSION CONTROL', 'First evidence logged. Good work — keep observations separate from interpretations.');
  if (count === 8 && Date.now() - lastPraise > 10000) { lastPraise = Date.now(); radio('DR. LIN — GEOLOGY', 'Your dataset is building nicely. Remember to run lab analyses on collected samples from the tablet.'); }
  if (count === 18) radio('MISSION CONTROL', 'Over two-thirds of field evidence is in. Record interpretations in the checklist once each category has its evidence.');
}

/** Angle-based target acquisition from the camera. */
export function aimedPOI(camera: THREE.Camera, range: number, extraDeg = 4): EarthPOI | null {
  const hf = getQaidamHF(useGame.getState().settings.quality === 'high' ? 400 : useGame.getState().settings.quality === 'medium' ? 300 : 220);
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  let best: EarthPOI | null = null, bestScore = Infinity;
  for (const p of EARTH_POIS) {
    if (p.specimen === 'none') continue;
    const target = new THREE.Vector3(p.pos[0], hf.height(p.pos[0], p.pos[1]) + 1, p.pos[1]);
    const to = target.clone().sub(camera.position);
    const dist = to.length();
    if (dist > range + poiRadius(p.id)) continue;
    const ang = (fwd.angleTo(to.normalize()) * 180) / Math.PI;
    const allowed = (Math.atan2(poiRadius(p.id), Math.max(1, dist)) * 180) / Math.PI + extraDeg;
    if (ang < allowed && ang < bestScore) { bestScore = ang; best = p; }
  }
  return best;
}

function poisInFrame(camera: THREE.PerspectiveCamera, hf: Heightfield) {
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  const half = (camera.fov * 0.5 * 0.85);
  return EARTH_POIS.filter((p) => {
    if (p.specimen === 'none') return false;
    const target = new THREE.Vector3(p.pos[0], hf.height(p.pos[0], p.pos[1]) + 1, p.pos[1]);
    const to = target.sub(camera.position);
    const d = to.length();
    if (d > 180 + poiRadius(p.id)) return false;
    const ang = (fwd.angleTo(to.normalize()) * 180) / Math.PI;
    const allowed = half + (Math.atan2(poiRadius(p.id), Math.max(1, d)) * 180) / Math.PI * 0.6;
    return ang < allowed;
  }).map((p) => p.id);
}

export function captureThumb(canvas: HTMLCanvasElement, w = 320, h = 180) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const sw = canvas.width, sh = canvas.height;
  const ar = w / h;
  let cw = sw, ch = sw / ar;
  if (ch > sh) { ch = sh; cw = sh * ar; }
  ctx.drawImage(canvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.72);
}

export function tempC(p: { absorb: number; inertia: number }, day: boolean, incidence = 0.7, world: 'earth' | 'mars' = 'earth') {
  const idx = thermalIndex(p.absorb, p.inertia, incidence, day ? 1 : 0);
  return world === 'earth' ? -22 + idx * 85 : -105 + idx * 125;
}

/** Use the current Earth tool. */
export function useTool(camera: THREE.PerspectiveCamera, gl: THREE.WebGLRenderer, hf: Heightfield) {
  const ui = useUI.getState();
  const g = useGame.getState();
  const tool = ui.tool;
  const loc = earthLocation();
  const zid = zoneAt(runtime.pos.x, runtime.pos.z);
  const day = g.earthTime === 'day';

  if (tool === 'camera') {
    audio.shutter();
    const thumb = captureThumb(gl.domElement);
    const pois = poisInFrame(camera, hf);
    const firstCat = pois.length ? EARTH_POI_BY_ID[pois[0]].categories[0] : null;
    const photo = g.addPhoto({
      world: 'earth', thumb, pos: [runtime.pos.x, runtime.pos.z], location: loc, pois, category: firstCat,
      caption: pois.length ? EARTH_POI_BY_ID[pois[0]].name : 'Field photograph', important: false, instrument: 'Field Camera', status: 'Awaiting analysis',
    });
    pois.forEach((id) => logEvidence(`photo:${id}`, 'Field Camera', `IMAGE ${String(photo.id).padStart(4, '0')}`));
    g.addJournal({ world: 'earth', kind: 'photo', title: `IMAGE ${String(photo.id).padStart(4, '0')}`, text: `${loc}${pois.length ? ' — subjects: ' + pois.map((p) => EARTH_POI_BY_ID[p].name).join(', ') : ''}` });
    ui.setLastPhoto(photo.id);
    ui.setReadout({ title: `IMAGE ${String(photo.id).padStart(4, '0')} SAVED`, lines: [pois.length ? `Subjects: ${pois.map((p) => EARTH_POI_BY_ID[p].name).join(', ')}` : 'No catalogued subject in frame', 'Tablet → Gallery to caption/categorise'], t: Date.now() });
    return;
  }

  if (tool === 'spectral' || tool === 'thermal') {
    const range = tool === 'spectral' ? 30 : 70;
    const target = aimedPOI(camera, range);
    if (!target) {
      audio.ui('error');
      ui.setReadout({ title: 'NO TARGET', lines: [`Aim at a catalogued surface within ${range} m.`], t: Date.now() });
      return;
    }
    if (tool === 'spectral') {
      if (!target.spectral) {
        ui.setReadout({ title: 'SPECTRUM INCONCLUSIVE', lines: ['Signal too weak / shadowed target.'], t: Date.now() });
        return;
      }
      ui.setScanBusy(true);
      audio.scanner();
      setTimeout(() => {
        useUI.getState().setScanBusy(false);
        audio.scanDone();
        logEvidence(`spectral:${target.id}`, 'Spectral Scanner', target.spectral!);
        g.addScan({ world: 'earth', kind: 'spectral', zone: loc, pos: [runtime.pos.x, runtime.pos.z], data: { poi: target.id, text: target.spectral } });
        g.addJournal({ world: 'earth', kind: 'scan', title: `Spectral scan — ${target.name}`, text: target.spectral!, cat: 'geology' });
        useUI.getState().setReadout({ title: `VNIR SPECTRUM — ${target.name.toUpperCase()}`, lines: [target.spectral!, 'Status: PRELIMINARY'], t: Date.now() });
      }, 1600);
      return;
    }
    // thermal
    const hfN = hf.normal(target.pos[0], target.pos[1]);
    const sunDir = day ? new THREE.Vector3(-0.45, 0.62, 0.55).normalize() : new THREE.Vector3(0, 1, 0);
    const T = tempC(target.thermal, day, hfN.dot(sunDir));
    audio.tone(1800, 0.06, 'sine', 0.06);
    g.addThermal({ world: 'earth', poi: target.id, material: target.thermal.material, tempC: Math.round(T * 10) / 10, day });
    const key = day ? `thermal:${target.id}:day` : `thermal:night`;
    if (day) logEvidence(key, 'Thermal Camera', `${T.toFixed(1)} °C`);
    else { logEvidence('thermal:night', 'Thermal Camera', `${target.name}: ${T.toFixed(1)} °C at night`); logEvidence(`thermal:${target.id}:night`, 'Thermal Camera', `${T.toFixed(1)} °C`); }
    g.addJournal({ world: 'earth', kind: 'scan', title: `Thermal reading — ${target.name}`, text: `${T.toFixed(1)} °C (${day ? 'day' : 'night'}), ${target.thermal.material}. SIMULATED value.`, cat: 'temperature' });
    ui.setReadout({ title: `TIR — ${target.name.toUpperCase()}`, lines: [`Surface: ${T.toFixed(1)} °C  (${day ? 'DAY' : 'NIGHT'})`, `Material: ${target.thermal.material}`, 'SIMULATED reading'], t: Date.now() });
    return;
  }

  if (tool === 'lidar') {
    if (ui.scanBusy) return;
    ui.setScanBusy(true);
    audio.scanner();
    sharedUniforms.uScanOrigin.value.copy(runtime.pos);
    const t0 = performance.now();
    const anim = () => {
      const k = (performance.now() - t0) / 2600;
      sharedUniforms.uScan.value = Math.min(1, k);
      if (k < 1.25) requestAnimationFrame(anim);
      else sharedUniforms.uScan.value = 0;
    };
    anim();
    setTimeout(() => {
      // slope statistics over scan disc
      const cx = runtime.pos.x, cz = runtime.pos.z;
      let sum = 0, max = 0, n = 0, steep = 0, minH = Infinity, maxH = -Infinity;
      for (let i = 0; i < 400; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 150;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        const s = hf.slope(x, z);
        const h = hf.height(x, z);
        sum += s; n++; if (s > max) max = s; if (s > 20) steep++;
        minH = Math.min(minH, h); maxH = Math.max(maxH, h);
      }
      const local: number[] = [];
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 25;
        local.push(hf.slope(cx + Math.cos(a) * r, cz + Math.sin(a) * r));
      }
      const localMean = local.reduce((a, b) => a + b, 0) / local.length;
      const rec = g.addScan({
        world: 'earth', kind: 'terrain', zone: loc, pos: [cx, cz],
        data: { meanSlope: sum / n, maxSlope: max, steepPct: (steep / n) * 100, relief: maxH - minH, localMean, zid },
      });
      useUI.getState().setScanBusy(false);
      audio.scanDone();
      if (zid) logEvidence(`scan:terrain:${zid}`, 'Terrain LiDAR', `${rec.id}`);
      if (zid === 'playa' && localMean < 3) logEvidence('site:flat', 'Terrain LiDAR', `Local mean slope ${localMean.toFixed(1)}° — suitable flat site`);
      g.addJournal({ world: 'earth', kind: 'scan', title: `LiDAR terrain model ${rec.id}`, text: `${loc}. Mean slope ${(sum / n).toFixed(1)}°, max ${max.toFixed(0)}°, relief ${(maxH - minH).toFixed(1)} m.`, cat: 'terrain' });
      useUI.getState().setReadout({
        title: `TERRAIN MODEL ${rec.id}`,
        lines: [`Mean slope ${(sum / n).toFixed(1)}° · max ${max.toFixed(0)}°`, `Relief ${(maxH - minH).toFixed(1)} m · local slope ${localMean.toFixed(1)}°`, 'Open Tablet → SCANS for 3D model'],
        t: Date.now(),
      });
      if (zid === 'playa' && localMean >= 3) toast('Site evaluation', 'Local slope above 3° — try a flatter spot on the playa.', 'info');
    }, 2700);
    return;
  }

  if (tool === 'gpr') {
    if (ui.scanBusy) return;
    ui.setScanBusy(true);
    audio.scanner();
    setTimeout(() => {
      const layers = zid === 'sediment' ? 7 : zid === 'playa' || zid === 'saline' ? 4 : zid === 'yardang' ? 5 : 3;
      const rec = g.addScan({ world: 'earth', kind: 'gpr', zone: loc, pos: [runtime.pos.x, runtime.pos.z], data: { layers, seed: Math.floor(Math.random() * 1000), zid } });
      useUI.getState().setScanBusy(false);
      audio.scanDone();
      if (zid) logEvidence(`scan:gpr:${zid}`, 'GPR', rec.id);
      g.addJournal({ world: 'earth', kind: 'scan', title: `GPR profile ${rec.id}`, text: `${loc}. ${layers} continuous reflectors in the upper ~8 m (SIMULATED). Interpretation non-unique.`, cat: 'subsurface' });
      useUI.getState().setReadout({ title: `GPR PROFILE ${rec.id}`, lines: [`${layers} reflectors detected (simulated)`, 'Tablet → SCANS for cross-section'], t: Date.now() });
    }, 2200);
    return;
  }

  if (tool === 'env') {
    audio.scanner();
    const wind = zid === 'yardang' ? 9 + Math.random() * 6 : 4 + Math.random() * 5;
    const air = day ? 16 + Math.random() * 6 : -8 + Math.random() * 4;
    const rh = 8 + Math.random() * 10;
    const uv = day ? 9 + Math.random() * 3 : 0;
    const data = { wind: +wind.toFixed(1), gust: +(wind * 1.5).toFixed(1), dir: 'NW → SE', air: +air.toFixed(1), rh: +rh.toFixed(0), uv: +uv.toFixed(1), zid };
    g.addScan({ world: 'earth', kind: 'env', zone: loc, pos: [runtime.pos.x, runtime.pos.z], data });
    if (zid) { logEvidence(`scan:wind:${zid}`, 'Environmental Suite', `${data.wind} m/s`); logEvidence(`scan:env:${zid}`, 'Environmental Suite', `UV ${data.uv}, RH ${data.rh}%`); }
    g.addJournal({ world: 'earth', kind: 'scan', title: 'Environmental log', text: `${loc}. Wind ${data.wind} m/s (gust ${data.gust}) from NW; air ${data.air} °C; RH ${data.rh}%; UV index ${data.uv}. SIMULATED.`, cat: 'dust' });
    ui.setReadout({ title: 'ENVIRONMENTAL SUITE', lines: [`Wind ${data.wind} m/s (gust ${data.gust}) · ${data.dir}`, `Air ${data.air} °C · RH ${data.rh}% · UV ${data.uv}`, 'SIMULATED readings'], t: Date.now() });
    return;
  }

  if (tool === 'probe') {
    audio.thud();
    const surf = surfaceAt(runtime.pos.x, runtime.pos.z);
    const kPa = surf === 'salt' ? 420 + Math.random() * 120 : surf === 'sand' ? 35 + Math.random() * 20 : surf === 'gravel' ? 260 + Math.random() * 80 : 330 + Math.random() * 90;
    const sink = surf === 'sand' ? 4 + Math.random() * 3 : surf === 'salt' ? 0.3 : 0.8;
    g.addScan({ world: 'earth', kind: 'probe', zone: loc, pos: [runtime.pos.x, runtime.pos.z], data: { surf, kPa: Math.round(kPa), sink: +sink.toFixed(1) } });
    const key = surf === 'salt' ? 'probe:crust' : surf === 'sand' ? 'probe:sand' : `probe:${surf}`;
    logEvidence(key, 'Penetrometer', `${Math.round(kPa)} kPa`);
    g.addJournal({ world: 'earth', kind: 'scan', title: `Penetrometer — ${surf}`, text: `${loc}. Bearing ~${Math.round(kPa)} kPa, sinkage ${sink.toFixed(1)} cm. SIMULATED.`, cat: 'operations' });
    ui.setReadout({ title: `PENETROMETER — ${surf.toUpperCase()}`, lines: [`Bearing strength ~${Math.round(kPa)} kPa`, `Sinkage ${sink.toFixed(1)} cm · ${kPa < 80 ? 'HIGH rover sinkage risk' : 'Good trafficability'}`, 'SIMULATED'], t: Date.now() });
  }
}
