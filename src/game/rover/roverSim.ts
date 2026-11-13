import * as THREE from 'three';
import { create } from 'zustand';
import { getMarsHF, MARS_RES, softSand, marsZoneName, MARS_RADIUS } from '../environments/mars/marsTerrain';
import { BOULDERS } from '../environments/mars/marsProps';
import { MARS_POIS, MARS_POI_BY_ID, MARS_TASKS, type MarsPOI } from '../../data/mars/marsData';
import { CAT_BY_ID } from '../../data/scientific-checklist/categories';
import { useGame, worldProgress } from '../core/store';
import { radio, toast } from '../core/ui';
import { audio } from '../core/audio';
import { isDown } from '../core/input';
import { tempC, captureThumb } from '../instruments/earthInstruments';
import { queueDiscovery } from '../core/discovery';
import { photoWithFX } from '../core/fx';

export type CamId = 'NAVCAM' | 'MASTCAM' | 'HAZ-F' | 'HAZ-R' | 'ARMCAM';
export const CAMS: { id: CamId; name: string; fov: number; desc: string }[] = [
  { id: 'NAVCAM', name: 'Navigation Camera', fov: 60, desc: 'Mast-mounted, wide-angle, pan/tilt' },
  { id: 'MASTCAM', name: 'Mast Camera (zoom)', fov: 34, desc: 'Science colour camera, optical zoom' },
  { id: 'HAZ-F', name: 'Front Hazard Camera', fov: 100, desc: 'Fixed, wide-angle, low' },
  { id: 'HAZ-R', name: 'Rear Hazard Camera', fov: 100, desc: 'Fixed, rear-facing' },
  { id: 'ARMCAM', name: 'Arm Inspection Camera', fov: 40, desc: 'Close-up imager on robotic arm' },
];
export type Mode = 'IDLE' | 'DIRECT' | 'AUTONAV' | 'SAFE' | 'HIBERNATE' | 'RECOVERY' | 'ARM' | 'FAULT';

export interface Wheel { id: string; health: number; current: number; temp: number; fault: boolean }

/** Mutable simulation state (read by renderers every frame). */
export const rover = {
  x: 0, z: 60, y: 0, heading: 0, // 0 = facing north (-z)
  v: 0, steer: 0, pitch: 0, roll: 0, wheelRot: 0, wheelOffsets: [0, 0, 0, 0, 0, 0],
  battery: 86, solar: 0, dust: 0.08, motorTemp: -20, internalTemp: 12,
  wheels: ['LF', 'LM', 'LR', 'RF', 'RM', 'RR'].map((id) => ({ id, health: 1, current: 0, temp: -30, fault: false })) as Wheel[],
  mode: 'IDLE' as Mode,
  stuck: false, slip: 0, stuckTimer: 0, recoverTimer: 0, odometry: 0, gprOn: false, gprDist: 0, calibrated: false,
  sol: 412, lmst: 10.5,
  storm: 0, stormPhase: 'none' as 'none' | 'incoming' | 'active' | 'clearing' | 'done', stormT: 0,
  latency: 1.4, commQuality: 1, training: false,
  autoSpeed: 0.6, autoTurn: 0.4,
  storageCap: 16,
  cam: 'NAVCAM' as CamId, camYaw: 0, camPitch: -0.12, zoom: 1,
  thermalView: false,
  waypoints: [] as [number, number][], wpIndex: 0, routeLen: 0,
  trail: [] as [number, number][],
  faultHappened: false, faultMsg: '' as string,
  busy: null as string | null, busyT: 0, busyDur: 0,
  hazard: null as string | null,
  armOut: 0,
  camPos: new THREE.Vector3(), camDir: new THREE.Vector3(0, 0, -1), camFov: 60,
  inputEnabled: false,
  started: false,
  cmd: { throttle: 0, steer: 0, brake: false },
  queue: [] as { at: number; throttle: number; steer: number; brake: boolean }[],
  lastSent: { throttle: 0, steer: 0, brake: false, t: 0 },
  startTime: 0,
  cmdLog: [] as { t: number; text: string; state: 'TX' | 'ACK' | 'EXEC' | 'DONE' | 'FAIL' }[],
  canvas: null as HTMLCanvasElement | null,
};

/** Low-rate snapshot for React UI (10 Hz). */
export const useRover = create<{ snap: number }>()(() => ({ snap: 0 }));

const V_MAX = 2.4; // m/s (time-accelerated for gameplay; real rovers drive ~0.04 m/s)
const day = () => rover.lmst >= 6.2 && rover.lmst <= 17.8;
export const isDay = day;
const hf = () => getMarsHF(MARS_RES[useGame.getState().settings.quality]);

function logCmd(text: string, state: 'TX' | 'ACK' | 'EXEC' | 'DONE' | 'FAIL') {
  rover.cmdLog = [{ t: Date.now(), text, state }, ...rover.cmdLog].slice(0, 30);
}

export function logMars(key: string, instrument: string, summary: string) {
  const g = useGame.getState();
  const isNew = g.addEvidence('mars', { key, instrument, location: marsZoneName(rover.x, rover.z), summary });
  if (isNew && MARS_TASKS.some((t) => t.id === key)) {
    const t = MARS_TASKS.find((x) => x.id === key)!;
    queueDiscovery('mars', t.cat);
    const n = Object.keys(useGame.getState().marsEvidence).length;
    if (n === 1) radio('ROVER OPS — CAPCOM', 'First Martian evidence downlinked. Beautiful data. Keep an eye on battery and slip.');
    if (worldProgress('mars').tasksDone === worldProgress('mars').tasksTotal) radio('MISSION CONTROL', 'All Mars field evidence collected. Record interpretations in the Checklist app to complete each category.');
  }
  return isNew;
}

// ---------------------------------------------------------------- Comms-delayed commands
let execId = 0;
export function command(label: string, execMs: number, power: number, fn: () => void, opts: { needStopped?: boolean; needDay?: boolean; allowNight?: boolean; noBusy?: boolean } = {}) {
  if (!opts.noBusy && rover.busy) { toast('Instrument busy', `${rover.busy} in progress.`, 'warn'); return false; }
  if (rover.mode === 'SAFE' && !label.startsWith('RECHARGE')) { toast('SAFE MODE', 'Only recovery commands accepted. Recharge first (Diagnostics).', 'warn'); return false; }
  if (opts.needStopped && Math.abs(rover.v) > 0.05) { toast('Command rejected', 'Rover must be stationary. Press Space to brake.', 'warn'); return false; }
  if (opts.needDay && !day()) { toast('Command rejected', 'Requires daylight.', 'warn'); return false; }
  if (rover.battery - power < 4 && power > 0) { toast('Insufficient power', `Needs ${power.toFixed(1)}% battery.`, 'warn'); audio.warning(); return false; }
  const id = ++execId;
  const lat = rover.training ? 0.2 : rover.latency + (rover.stormPhase === 'active' ? 1.2 : 0);
  if (!opts.noBusy) { rover.busy = label; rover.busyT = 0; rover.busyDur = lat + execMs / 1000; }
  logCmd(label, 'TX');
  audio.tone(1300, 0.05, 'square', 0.03);
  setTimeout(() => {
    logCmd(label, 'ACK');
    audio.tone(1700, 0.05, 'sine', 0.04);
    setTimeout(() => {
      if (id !== execId && !opts.noBusy) { /* superseded */ }
      rover.battery = Math.max(2, rover.battery - power);
      try { fn(); logCmd(label, 'DONE'); } catch (e) { logCmd(label, 'FAIL'); console.error(e); }
      if (!opts.noBusy) rover.busy = null;
    }, execMs);
  }, lat * 1000);
  return true;
}

// ---------------------------------------------------------------- Targeting
export function aimedMarsPOI(range: number, extraDeg = 3): MarsPOI | null {
  const h = hf();
  let best: MarsPOI | null = null, bestA = Infinity;
  for (const p of MARS_POIS) {
    const target = new THREE.Vector3(p.pos[0], h.height(p.pos[0], p.pos[1]) + 1.5, p.pos[1]);
    const to = target.sub(rover.camPos);
    const d = to.length();
    if (d > range + p.radius) continue;
    const a = (rover.camDir.angleTo(to.normalize()) * 180) / Math.PI;
    const allow = (Math.atan2(p.radius, Math.max(1, d)) * 180) / Math.PI + extraDeg;
    if (a < allow && a < bestA) { bestA = a; best = p; }
  }
  return best;
}
function poisInView() {
  const h = hf();
  return MARS_POIS.filter((p) => {
    const target = new THREE.Vector3(p.pos[0], h.height(p.pos[0], p.pos[1]) + 1.5, p.pos[1]);
    const to = target.sub(rover.camPos);
    const d = to.length();
    const range = rover.cam === 'MASTCAM' ? 260 : rover.cam === 'NAVCAM' ? 110 : 40;
    if (d > range + p.radius) return false;
    const a = (rover.camDir.angleTo(to.normalize()) * 180) / Math.PI;
    return a < rover.camFov * 0.5 * 0.9 + (Math.atan2(p.radius, Math.max(1, d)) * 180) / Math.PI * 0.5;
  });
}
const distTo = (p: MarsPOI) => Math.hypot(p.pos[0] - rover.x, p.pos[1] - rover.z);

// ---------------------------------------------------------------- Instruments
export const instruments = {
  capture() {
    const g = useGame.getState();
    const onboard = g.photos.filter((p) => p.world === 'mars' && p.onboard).length;
    if (onboard >= rover.storageCap) { toast('STORAGE FULL', 'Onboard image storage full. Downlink images in the Archive app.', 'warn'); audio.warning(); return; }
    if (!rover.canvas) return;
    photoWithFX(() => {
    audio.shutter();
    const thumb = captureThumb(rover.canvas);
    const pois = poisInView();
    const camName = CAMS.find((c) => c.id === rover.cam)!.name;
    const first = pois[0];
    const photo = g.addPhoto({
      world: 'mars', thumb, pos: [rover.x, rover.z], location: marsZoneName(rover.x, rover.z), pois: pois.map((p) => p.id),
      category: first ? (first.id === 'm-pit' ? 'subsurface' : first.id === 'm-dunes' ? 'dust' : first.id === 'm-crater' ? 'terrain' : first.id === 'm-veins' ? 'water' : 'geology') : null,
      caption: first ? `${first.name} — ${rover.cam}` : `${rover.cam} frame`, important: false, instrument: camName, status: 'Awaiting analysis', onboard: true,
    });
    rover.battery -= 0.15;
    pois.forEach((p) => {
      if (p.id === 'm-pit' && distTo(p) < 13) return;
      logMars(`photo:${p.id}`, camName, `IMAGE ${String(photo.id).padStart(4, '0')}`);
    });
    g.addJournal({ world: 'mars', kind: 'photo', title: `IMAGE ${String(photo.id).padStart(4, '0')} (${rover.cam})`, text: `${marsZoneName(rover.x, rover.z)}${pois.length ? ' — subjects: ' + pois.map((p) => p.name).join(', ') : ''}. Stored onboard; awaiting downlink.` });
    return { thumb, label: first ? first.name : 'Photo saved' };
    });
  },
  calibrate() {
    return command('MULTISPECTRAL CALIBRATION', 3500, 0.6, () => {
      rover.calibrated = true;
      audio.scanDone();
      toast('Calibration complete', 'Calibration target imaged — multispectral radiometry valid.', 'info');
      useGame.getState().addJournal({ world: 'mars', kind: 'event', title: 'Multispectral calibration', text: 'Imaged onboard calibration target; reflectance calibration applied.' });
    }, { needDay: true });
  },
  multispec() {
    if (rover.cam !== 'MASTCAM') { toast('Switch to MASTCAM', 'Multispectral imaging uses the mast camera.', 'warn'); return; }
    const p = aimedMarsPOI(180);
    if (!p || !p.multispec) { toast('No multispectral target', 'Aim the Mastcam at a catalogued surface within ~180 m.', 'warn'); return; }
    const pname = p.name;
    command(`MULTISPECTRAL ${p.id.toUpperCase()}`, 3000, 1.0, () => {
      audio.scanDone();
      const g = useGame.getState();
      if (!rover.calibrated) {
        toast('UNCALIBRATED DATA', 'Result flagged unreliable. Run calibration first (Instruments).', 'warn');
        g.addJournal({ world: 'mars', kind: 'scan', title: `Multispectral (UNCALIBRATED) — ${pname}`, text: 'Data unreliable without calibration; not accepted as evidence.' });
        return;
      }
      logMars(`multispec:${p.id}`, 'Mastcam multispectral', 'Calibrated');
      g.addScan({ world: 'mars', kind: 'multispec', zone: pname, pos: [rover.x, rover.z], data: { target: pname, result: p.multispec } });
      g.addJournal({ world: 'mars', kind: 'scan', title: `Multispectral — ${pname}`, text: `${p.multispec} (SIMULATED)`, cat: p.id === 'm-layers' ? 'water' : 'geology' });
      toast(`MULTISPECTRAL — ${pname}`, p.multispec, 'info');
    }, { needDay: true });
  },
  thermal() {
    const p = aimedMarsPOI(90);
    if (!p) { toast('No TIR target', 'Aim at a catalogued surface within ~90 m.', 'warn'); return; }
    command(`TIR RADIOMETER ${p.id.toUpperCase()}`, 1500, 0.3, () => {
      const d = day();
      const T = tempC(p.thermal, d, d ? 0.75 : 0, 'mars');
      const g = useGame.getState();
      g.addThermal({ world: 'mars', poi: p.id, material: p.thermal.material, tempC: Math.round(T * 10) / 10, day: d });
      if (d) logMars(`thermal:${p.id}:day`, 'TIR radiometer', `${T.toFixed(1)} °C`);
      else { logMars('thermal:night', 'TIR radiometer', `${p.name}: ${T.toFixed(1)} °C`); logMars(`thermal:${p.id}:night`, 'TIR radiometer', `${T.toFixed(1)} °C`); }
      g.addJournal({ world: 'mars', kind: 'scan', title: `TIR — ${p.name}`, text: `${T.toFixed(1)} °C (${d ? 'day' : 'night'}), ${p.thermal.material}. SIMULATED.`, cat: 'temperature' });
      toast(`TIR — ${p.name}`, `${T.toFixed(1)} °C · ${d ? 'DAY' : 'NIGHT'} · simulated`, 'info');
    }, { allowNight: true });
  },
  spectro() {
    const near = MARS_POIS.filter((p) => p.spectro).map((p) => ({ p, d: distTo(p) - p.radius * 0.6 })).sort((a, b) => a.d - b.d)[0];
    if (!near || near.d > 7) { toast('Out of arm reach', 'Drive within ~6 m of a target (outcrop base, veins, boulder or sand) and stop.', 'warn'); return; }
    const p = near.p;
    rover.mode = 'ARM';
    rover.cam = 'ARMCAM';
    audio.servo(1.2);
    command(`ARM DEPLOY + SPECTROMETER ${p.id.toUpperCase()}`, 6000, 3.0, () => {
      rover.mode = 'IDLE';
      audio.scanDone();
      const g = useGame.getState();
      logMars(`spectro:${p.id}`, 'Contact spectrometer', 'Integration complete');
      g.addScan({ world: 'mars', kind: 'spectro', zone: p.name, pos: [rover.x, rover.z], data: { target: p.name, result: p.spectro } });
      g.addJournal({ world: 'mars', kind: 'scan', title: `Contact spectrometer — ${p.name}`, text: p.spectro!, cat: p.id === 'm-veins' ? 'water' : 'geology' });
      toast(`SPECTROMETER — ${p.name}`, p.spectro, 'info');
    }, { needStopped: true });
  },
  toggleGPR() {
    command(rover.gprOn ? 'GPR OFF' : 'GPR ON', 600, 0.1, () => {
      rover.gprOn = !rover.gprOn;
      rover.gprDist = 0;
      toast(rover.gprOn ? 'GPR ACTIVE' : 'GPR OFF', rover.gprOn ? 'Drive ≥ 30 m to acquire a subsurface profile.' : '', 'info');
    }, { noBusy: true });
  },
  windDust() {
    command('ENV · WIND & DUST', 2000, 0.4, () => {
      const storm = rover.storm;
      const wind = 4 + Math.random() * 6 + storm * 18;
      const tau = 0.5 + storm * 3.5;
      const g = useGame.getState();
      const data = { wind: +wind.toFixed(1), dir: 'SW → NE', opacity: +tau.toFixed(2), pressure: Math.round(700 + Math.random() * 80), dust: rover.dust.toFixed(2) };
      g.addScan({ world: 'mars', kind: 'wind', zone: marsZoneName(rover.x, rover.z), pos: [rover.x, rover.z], data });
      logMars('scan:wind', 'Wind & dust sensors', `${data.wind} m/s, τ≈${data.opacity}`);
      g.addJournal({ world: 'mars', kind: 'scan', title: 'Wind & dust reading', text: `Wind ${data.wind} m/s from SW, atmospheric dust opacity τ≈${data.opacity}${storm > 0.3 ? ' (regional dust event)' : ''}. Pressure ${data.pressure} Pa. SIMULATED.`, cat: 'dust' });
      toast('WIND & DUST', `Wind ${data.wind} m/s · τ ${data.opacity} · ${data.pressure} Pa`, 'info');
    });
  },
  habitability() {
    command('ENV · HABITABILITY SUITE', 2500, 0.5, () => {
      const d = day();
      const g = useGame.getState();
      const data = { uv: d ? +(18 + Math.random() * 6).toFixed(1) : 0, rh: +(Math.random() * 3 + (d ? 0.5 : 8)).toFixed(1), pressure: Math.round(700 + Math.random() * 80), radiation: '≈ 0.6–0.7 mSv/sol (order of magnitude, illustrative)', airT: +(d ? -20 - Math.random() * 10 : -75 - Math.random() * 10).toFixed(1) };
      g.addScan({ world: 'mars', kind: 'env', zone: marsZoneName(rover.x, rover.z), pos: [rover.x, rover.z], data });
      logMars('scan:env', 'Habitability suite', `UV ${data.uv}, RH ${data.rh}%, ${data.pressure} Pa`);
      g.addJournal({ world: 'mars', kind: 'scan', title: 'Habitability environment', text: `UV index-equivalent ${data.uv}; RH ${data.rh}%; pressure ${data.pressure} Pa; air ${data.airT} °C; dose ${data.radiation}. SIMULATED. Liquid water not stable at these conditions.`, cat: 'biology' });
      toast('HABITABILITY SUITE', `UV ${data.uv} · RH ${data.rh}% · ${data.pressure} Pa · ${data.airT} °C`, 'info');
    });
  },
  navScan() {
    command('NAVCAM STEREO TERRAIN MODEL', 3500, 0.8, () => {
      const h = hf();
      let sum = 0, max = 0, n = 0, steep = 0, minH = Infinity, maxH = -Infinity;
      for (let i = 0; i < 400; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 140;
        const x = rover.x + Math.cos(a) * r, z = rover.z + Math.sin(a) * r;
        const s = h.slope(x, z); const hh = h.height(x, z);
        sum += s; n++; if (s > max) max = s; if (s > 20) steep++;
        minH = Math.min(minH, hh); maxH = Math.max(maxH, hh);
      }
      const g = useGame.getState();
      const rec = g.addScan({ world: 'mars', kind: 'terrain', zone: marsZoneName(rover.x, rover.z), pos: [rover.x, rover.z], data: { meanSlope: sum / n, maxSlope: max, steepPct: (steep / n) * 100, relief: maxH - minH } });
      logMars('scan:terrain', 'Navcam stereo', rec.id);
      g.addJournal({ world: 'mars', kind: 'scan', title: `Stereo terrain model ${rec.id}`, text: `Mean slope ${(sum / n).toFixed(1)}°, max ${max.toFixed(0)}°, relief ${(maxH - minH).toFixed(1)} m.`, cat: 'terrain' });
      toast('TERRAIN MODEL READY', `${rec.id} — open Navigation → Terrain models to inspect & mark hazards.`, 'info');
    }, { needStopped: true, needDay: true });
  },
  organics() {
    const g = useGame.getState();
    if (!g.marsEvidence['spectro:m-layers']) { toast('No input data', 'Requires contact-spectrometer data from the layered outcrop.', 'warn'); return; }
    command('ONBOARD ORGANIC SCREENING (SIM)', 7000, 2.0, () => {
      logMars('analyze:organics', 'Onboard analysis (simulated)', 'No biosignature detected');
      g.addJournal({ world: 'mars', kind: 'lab', title: 'Organic screening — layered outcrop (SIMULATED)', text: 'No biosignature detected above instrument background. Interpreted as INCONCLUSIVE for life: non-detection does not demonstrate absence. Surface radiation and oxidants (e.g., perchlorates) can degrade organics.', cat: 'biology' });
      toast('ORGANIC SCREENING', 'No biosignature detected — inconclusive (simulated).', 'info');
    });
  },
  powerCheck() {
    command('DIAGNOSTIC · POWER SYSTEM', 2500, 0.2, () => {
      const loss = Math.round(rover.dust * 100);
      logMars('diag:dust', 'Power diagnostics', `Panel output reduced ~${loss}% by dust`);
      useGame.getState().addJournal({ world: 'mars', kind: 'scan', title: 'Power system diagnostic', text: `Solar array output reduced by ~${loss}% due to dust deposition. Battery ${rover.battery.toFixed(0)}%. SIMULATED.`, cat: 'dust' });
      toast('POWER DIAGNOSTIC', `Solar array dust loss ≈ ${loss}%`, 'info');
    }, { noBusy: true });
  },
  resetMotor() {
    const w = rover.wheels.find((x) => x.fault);
    if (!w) { toast('No motor fault', 'All wheel motor controllers nominal.', 'info'); return; }
    command(`RESET MOTOR CONTROLLER ${w.id}`, 5000, 0.3, () => {
      w.fault = false; w.health = 0.82; w.current = 0; w.temp = Math.min(w.temp, 0);
      rover.mode = 'IDLE'; rover.faultMsg = '';
      logMars('recover:fault', 'Diagnostics', `Wheel ${w.id} controller reset`);
      useGame.getState().addJournal({ world: 'mars', kind: 'event', title: `Wheel ${w.id} fault recovered`, text: 'Motor controller reset after overcurrent. Health reduced to 82%. Lesson: avoid rock strikes and high-load slopes.', cat: 'operations' });
      radio('ROVER OPS — CAPCOM', `Wheel ${w.id} controller reset confirmed. Drive is re-enabled. Avoid sharp rocks on that side.`);
    }, { needStopped: true });
  },
  recovery() {
    if (!rover.stuck) { toast('Not embedded', 'No embedding detected.', 'info'); return; }
    command('RECOVERY · LOW-SPEED REVERSE SEQUENCE', 6000, 2.5, () => {
      unstick('Automated recovery sequence');
    }, { noBusy: false });
  },
  hibernate() {
    if (!day()) { toast('Already night', '', 'info'); return; }
    command('HIBERNATE UNTIL NIGHT (HEATERS ON)', 2500, 0, () => {
      rover.lmst = 22.3;
      rover.battery = Math.max(6, rover.battery - 9);
      rover.mode = 'HIBERNATE';
      setTimeout(() => { if (rover.mode === 'HIBERNATE') rover.mode = 'IDLE'; }, 1500);
      radio('ROVER OPS — CAPCOM', 'Rover is in night operations. Heaters are drawing power; driving is suspended until dawn. Thermal readings are a go.');
    }, { needStopped: true });
  },
  wake() {
    if (day()) { toast('Already daytime', '', 'info'); return; }
    command('WAKE AT DAWN', 2500, 0, () => {
      rover.lmst = 8.5;
      rover.battery = Math.min(100, Math.max(rover.battery - 4, 45));
      rover.sol += 1;
      rover.mode = 'IDLE';
      radio('ROVER OPS — CAPCOM', `Good morning, Sol ${rover.sol}. Battery recovering on solar. Resume traverse when ready.`);
    }, { noBusy: true });
  },
  recharge() {
    command('RECHARGE · WAIT FOR SOLAR', 3500, 0, () => {
      if (!day()) { rover.lmst = 9; rover.sol += 1; }
      rover.battery = Math.max(rover.battery, 62);
      rover.mode = 'IDLE';
      radio('ROVER OPS — CAPCOM', 'Batteries back to sixty-plus percent. Safe mode exited. Plan power-aware activities.');
    }, { noBusy: true });
  },
  hunker() {
    if (rover.stormPhase !== 'active' && rover.stormPhase !== 'incoming') { toast('No storm', '', 'info'); return; }
    command('STOW & WAIT OUT DUST STORM', 4000, 0, () => {
      rover.stormPhase = 'clearing';
      rover.stormT = 0;
      rover.battery = Math.max(10, rover.battery - 6);
      rover.lmst = Math.min(15, rover.lmst + 2);
      radio('ROVER OPS — CAPCOM', 'Storm is clearing. Dust deposition is heavier on the panels now — check the power diagnostic.');
    }, { needStopped: false, noBusy: true });
  },
  downlink(id: number) {
    command(`DOWNLINK IMAGE ${String(id).padStart(4, '0')}`, 1800 / Math.max(0.3, rover.commQuality), 0.1, () => {
      useGame.getState().updatePhoto(id, { onboard: false, status: 'Downlinked' });
    }, { noBusy: true });
  },
  setRoute(points: [number, number][]) {
    rover.waypoints = points;
    rover.wpIndex = 0;
    let L = 0, px = rover.x, pz = rover.z;
    points.forEach(([x, z]) => { L += Math.hypot(x - px, z - pz); px = x; pz = z; });
    rover.routeLen = L;
  },
  executeRoute() {
    if (!rover.waypoints.length) { toast('No route', 'Place waypoints on the map first.', 'warn'); return; }
    if (rover.wheels.some((w) => w.fault) || rover.stuck) { toast('Drive inhibited', 'Resolve faults first (Diagnostics).', 'warn'); return; }
    if (!day()) { toast('Night', 'Traverse is suspended at night. Wake at dawn.', 'warn'); return; }
    command('UPLINK AUTONAV ROUTE', 800, 0.2, () => {
      rover.mode = 'AUTONAV';
      radio('ROVER OPS — CAPCOM', `Route uplinked: ${rover.waypoints.length} waypoints, ${rover.routeLen.toFixed(0)} m. The rover will navigate autonomously.`);
    }, { noBusy: true });
  },
  abortRoute() {
    command('ABORT AUTONAV', 200, 0, () => { rover.mode = 'IDLE'; rover.waypoints = []; }, { noBusy: true });
  },
};

function unstick(how: string) {
  rover.stuck = false;
  rover.slip = 0;
  rover.stuckTimer = 0;
  rover.recoverTimer = 0;
  rover.mode = 'IDLE';
  rover.x -= Math.sin(rover.heading) * -1.2;
  rover.z -= Math.cos(rover.heading) * -1.2;
  logMars('recover:fault', 'Mobility recovery', how);
  useGame.getState().addJournal({ world: 'mars', kind: 'event', title: 'Mobility recovery — wheels freed', text: `${how}. Soft sand caused excessive slip and sinkage. Lesson: approach ripple fields slowly, or route around them.`, cat: 'operations' });
  radio('ROVER OPS — CAPCOM', 'We have positive motion. Rover is free. Nice patience — that is exactly how it is done.');
}

function startStorm() {
  if (rover.stormPhase !== 'none') return;
  rover.stormPhase = 'incoming';
  rover.stormT = 0;
  radio('MISSION CONTROL', 'Weather alert: orbital imagery shows a regional dust storm approaching your area. Expect reduced visibility, solar power, and comms.', 'warn');
}

// ---------------------------------------------------------------- Simulation step
const tmp = new THREE.Vector3();
let snapAcc = 0, inputAcc = 0, trailAcc = 0, warnAcc = 0;

export function resetRover() {
  const h = hf();
  rover.y = h.height(rover.x, rover.z);
}

function sampleInput(now: number) {
  if (!rover.inputEnabled) return;
  let throttle = 0, steer = 0;
  if (isDown('forward')) throttle += 1;
  if (isDown('back')) throttle -= 1;
  if (isDown('left')) steer += 1;
  if (isDown('right')) steer -= 1;
  const brake = isDown('brake');
  if (isDown('sprint')) throttle *= 0.4; // precision (low-gear) mode with Shift
  const ls = rover.lastSent;
  const changed = throttle !== ls.throttle || steer !== ls.steer || brake !== ls.brake;
  if (changed || (now - ls.t > 0.5 && (throttle || steer))) {
    const lat = rover.training ? 0.2 : rover.latency + (rover.stormPhase === 'active' ? 1.2 : 0);
    rover.queue.push({ at: now + lat, throttle, steer, brake });
    rover.lastSent = { throttle, steer, brake, t: now };
    if (changed && (throttle || steer || brake)) {
      if (rover.mode === 'IDLE') rover.mode = 'DIRECT';
      if (rover.mode === 'AUTONAV' && (throttle || steer)) { rover.mode = 'DIRECT'; rover.waypoints = []; toast('Autonav overridden', 'Direct drive commands took priority.', 'info'); }
    }
  }
}

export function stepRover(dtRaw: number) {
  const dt = Math.min(dtRaw, 0.05);
  const now = performance.now() / 1000;
  const h = hf();
  const g = useGame.getState();

  inputAcc += dt;
  if (inputAcc > 0.1) { inputAcc = 0; sampleInput(now); }
  while (rover.queue.length && rover.queue[0].at <= now) {
    const c = rover.queue.shift()!;
    rover.cmd = { throttle: c.throttle, steer: c.steer, brake: c.brake };
  }

  // Time of sol
  rover.lmst += dt / 150; // 1 Mars hour per 150 s
  if (rover.lmst >= 24) { rover.lmst -= 24; rover.sol += 1; }
  const d = day();

  // Storm
  if (rover.stormPhase !== 'none' && rover.stormPhase !== 'done') {
    rover.stormT += dt;
    if (rover.stormPhase === 'incoming') { rover.storm = Math.min(0.35, rover.stormT / 60); if (rover.stormT > 22) { rover.stormPhase = 'active'; rover.stormT = 0; radio('MISSION CONTROL', 'Dust storm on top of you. Consider stowing and waiting it out, or proceed carefully with reduced power.', 'alert'); } }
    else if (rover.stormPhase === 'active') { rover.storm = Math.min(1, 0.35 + rover.stormT / 15); if (rover.stormT > 110) { rover.stormPhase = 'clearing'; rover.stormT = 0; } }
    else if (rover.stormPhase === 'clearing') { rover.storm = Math.max(0, rover.storm - dt / 20); if (rover.storm <= 0) { rover.stormPhase = 'done'; radio('MISSION CONTROL', 'Storm has passed. Skies clearing.'); } }
  }
  if (rover.stormPhase === 'none' && rover.started && now - rover.startTime > 420) startStorm();
  rover.commQuality = 1 - rover.storm * 0.6;

  // Mobility
  const faulted = rover.wheels.some((w) => w.fault);
  let targetV = 0, steerCmd = 0;
  const canDrive = d && !faulted && rover.mode !== 'SAFE' && rover.mode !== 'HIBERNATE' && rover.mode !== 'ARM' && rover.mode !== 'RECOVERY';
  if (rover.mode === 'AUTONAV' && canDrive) {
    const wp = rover.waypoints[rover.wpIndex];
    if (wp) {
      const dx = wp[0] - rover.x, dz = wp[1] - rover.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(-dx, -dz);
      let err = want - rover.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      steerCmd = Math.max(-1, Math.min(1, err * 2));
      targetV = Math.abs(err) > 0.6 ? 0 : V_MAX * rover.autoSpeed * Math.min(1, dist / 6);
      if (dist < 2.5) {
        rover.wpIndex++;
        audio.tone(1500, 0.08, 'sine', 0.05);
        if (rover.wpIndex >= rover.waypoints.length) {
          rover.mode = 'IDLE';
          rover.waypoints = [];
          if (rover.routeLen >= 20) logMars('autonav:route', 'Autonav', `${rover.routeLen.toFixed(0)} m route completed`);
          g.addJournal({ world: 'mars', kind: 'event', title: 'Autonomous route complete', text: `Route of ${rover.routeLen.toFixed(0)} m completed with onboard hazard avoidance.`, cat: 'operations' });
          radio('ROVER OPS — CAPCOM', 'Autonav route complete. The rover reached the final waypoint.');
        }
      }
    }
  } else if (canDrive) {
    targetV = rover.cmd.throttle * V_MAX;
    steerCmd = rover.cmd.steer;
  }
  if (rover.cmd.brake && rover.mode !== 'AUTONAV') targetV = 0;

  // terrain under/ahead
  const fx = -Math.sin(rover.heading), fz = -Math.cos(rover.heading);
  const hF = h.height(rover.x + fx * 1.4, rover.z + fz * 1.4), hB = h.height(rover.x - fx * 1.4, rover.z - fz * 1.4);
  const rx = -fz, rz = fx;
  const hL = h.height(rover.x - rx * 1.1, rover.z - rz * 1.1), hR = h.height(rover.x + rx * 1.1, rover.z + rz * 1.1);
  const pitch = Math.atan2(hF - hB, 2.8);
  const roll = Math.atan2(hR - hL, 2.2);
  rover.pitch += (pitch - rover.pitch) * Math.min(1, dt * 6);
  rover.roll += (roll - rover.roll) * Math.min(1, dt * 6);
  const pitchDeg = (rover.pitch * 180) / Math.PI;
  const dirSign = Math.sign(targetV || rover.v);
  const climb = pitchDeg * dirSign;

  // Onboard hazard detection (autonomy) — looks 4 m ahead in the direction of travel
  rover.hazard = null;
  if (Math.abs(targetV) > 0.01) {
    const ax = rover.x + fx * 4 * dirSign, az = rover.z + fz * 4 * dirSign;
    const sAhead = h.slope(ax, az);
    const pit = Math.hypot(ax + 178, az + 120) < 15.5;
    const edge = Math.hypot(ax, az) > MARS_RADIUS - 8;
    const sand = softSand(ax, az) > 0.2 && softSand(rover.x, rover.z) < 0.2;
    if (pit) rover.hazard = 'PIT EDGE';
    else if (edge) rover.hazard = 'TERRAIN LIMIT';
    else if (sAhead > 32) rover.hazard = `SLOPE ${sAhead.toFixed(0)}°`;
    else if (sand && rover.mode === 'AUTONAV') rover.hazard = 'SOFT SAND';
    if (rover.hazard && (rover.hazard !== 'SOFT SAND' || rover.mode === 'AUTONAV')) {
      targetV = 0;
      if (rover.mode === 'AUTONAV') { rover.mode = 'IDLE'; radio('ROVER OPS — CAPCOM', `Autonav halted: ${rover.hazard.toLowerCase()} detected on path. Replan your route.`, 'warn'); }
      warnAcc += dt;
      if (warnAcc > 2.5) { warnAcc = 0; audio.warning(); toast('AUTO-STOP', `Onboard hazard avoidance: ${rover.hazard}`, 'warn'); }
    }
  }

  // Slope & sand effects
  const sand = softSand(rover.x, rover.z);
  let slip = sand * (0.25 + 0.95 * Math.min(1, Math.abs(rover.v) / V_MAX));
  if (climb > 12) slip += (climb - 12) / 18;
  slip = Math.min(1, slip);
  rover.slip += (slip - rover.slip) * Math.min(1, dt * 3);
  if (!rover.stuck && sand > 0.35 && rover.slip > 0.72 && Math.abs(targetV) > 0.2) {
    rover.stuckTimer += dt;
    if (rover.stuckTimer > 1.4) {
      rover.stuck = true;
      rover.mode = 'DIRECT';
      audio.warning();
      toast('MOBILITY FAULT — WHEELS EMBEDDED', 'Excessive slip in soft sand. Reverse slowly (hold Shift + S) or run Recovery in Diagnostics.', 'warn');
      radio('ROVER OPS — CAPCOM', 'We are seeing one hundred percent slip — wheels are embedded. Do not keep pushing forward. Back out slowly in low gear.', 'alert');
    }
  } else if (!rover.stuck) rover.stuckTimer = Math.max(0, rover.stuckTimer - dt);

  if (rover.stuck) {
    if (targetV < 0 && Math.abs(rover.cmd.throttle) <= 0.5) {
      rover.recoverTimer += dt;
      if (rover.recoverTimer > 4) unstick('Low-gear reverse');
    }
    targetV = targetV < 0 ? targetV * 0.15 : 0;
  }

  // speed integrate
  const climbFactor = climb > 0 ? 1 - Math.min(0.85, Math.max(0, (climb - 8) / 22)) : 1;
  const vt = targetV * climbFactor;
  rover.v += (vt - rover.v) * Math.min(1, dt * (Math.abs(vt) < Math.abs(rover.v) ? 3 : 1.4));
  if (climb > 30 && rover.v * dirSign > 0) rover.v *= 0.5;
  const move = rover.v * (1 - rover.slip * 0.95) * dt;
  // heading: ackermann + point turn
  if (canDrive && !rover.stuck) {
    if (Math.abs(rover.v) > 0.05) rover.heading += steerCmd * rover.v * dt * 0.28;
    else if (Math.abs(steerCmd) > 0 && targetV === 0 && rover.mode !== 'AUTONAV' && !rover.cmd.brake) rover.heading += steerCmd * 0.35 * dt;
    else if (rover.mode === 'AUTONAV') rover.heading += steerCmd * rover.autoTurn * dt;
  }
  rover.steer += (steerCmd - rover.steer) * Math.min(1, dt * 4);
  let nx = rover.x + fx * move, nz = rover.z + fz * move;
  // boulder collisions
  for (const b of BOULDERS) {
    const dd = Math.hypot(nx - b.x, nz - b.z);
    const rr = b.r * 0.8 + 1.4;
    if (dd < rr && b.r > 0.7) {
      nx = b.x + ((nx - b.x) / dd) * rr;
      nz = b.z + ((nz - b.z) / dd) * rr;
      if (Math.abs(rover.v) > 0.8) { audio.thud(); toast('CONTACT', 'Wheel contact with a large rock. Slow down near boulders.', 'warn'); }
      rover.v *= 0.2;
      if (!rover.faultHappened) triggerWheelFault('rock strike on right-middle wheel');
    }
  }
  if (Math.hypot(nx, nz) > MARS_RADIUS) { nx = rover.x; nz = rover.z; rover.v = 0; }
  const moved = Math.hypot(nx - rover.x, nz - rover.z);
  rover.x = nx; rover.z = nz;
  rover.odometry += moved;
  if (rover.gprOn) {
    rover.gprDist += moved;
    if (rover.gprDist >= 30 && !g.marsEvidence['gpr:traverse']) {
      const rec = g.addScan({ world: 'mars', kind: 'gpr', zone: marsZoneName(rover.x, rover.z), pos: [rover.x, rover.z], data: { layers: 5, seed: 77, void: false } });
      logMars('gpr:traverse', 'GPR', rec.id);
      g.addJournal({ world: 'mars', kind: 'scan', title: `GPR traverse ${rec.id}`, text: 'Layered reflectors to ~8 m depth along a 30 m traverse (SIMULATED). No void signature resolved.', cat: 'subsurface' });
    }
  }
  if (rover.odometry >= 150 && !g.marsEvidence['drive:150']) logMars('drive:150', 'Odometry', `${rover.odometry.toFixed(0)} m`);
  // Scripted, understandable fault after a meaningful traverse
  if (!rover.faultHappened && rover.odometry > 95 && Math.abs(rover.v) > 0.3) triggerWheelFault('current spike after crossing a rocky patch');

  const groundY = h.height(rover.x, rover.z);
  rover.y += (groundY - rover.y) * Math.min(1, dt * 10);
  rover.wheelRot += (rover.v * (1 - rover.slip * 0.4) * dt) / 0.26 + (rover.stuck && Math.abs(rover.cmd.throttle) > 0 ? dt * 6 * Math.sign(rover.cmd.throttle) : 0);
  // per-wheel visual suspension
  const wheelLocal: [number, number][] = [[-1.05, -1.25], [-1.1, 0], [-1.05, 1.15], [1.05, -1.25], [1.1, 0], [1.05, 1.15]];
  const sinH = Math.sin(rover.heading), cosH = Math.cos(rover.heading);
  wheelLocal.forEach(([lx, lz], i) => {
    const wx = rover.x + lx * cosH + lz * sinH, wz = rover.z - lx * sinH + lz * cosH;
    const gh = h.height(wx, wz);
    const planeH = rover.y + Math.tan(rover.pitch) * -lz + Math.tan(rover.roll) * lx;
    rover.wheelOffsets[i] = Math.max(-0.25, Math.min(0.25, gh - planeH));
  });

  // Power
  const sunElev = d ? Math.sin(((rover.lmst - 6) / 12) * Math.PI) : 0;
  rover.solar = Math.max(0, sunElev) * (1 - rover.dust) * (1 - rover.storm * 0.8);
  let drain = 0.012 + Math.abs(rover.v) * 0.05 + (rover.gprOn ? 0.03 : 0) + (d ? 0 : 0.05) + (rover.stuck ? 0.04 : 0);
  rover.battery += (rover.solar * 0.085 - drain) * dt;
  rover.battery = Math.max(2, Math.min(100, rover.battery));
  rover.dust = Math.min(0.65, rover.dust + dt * 0.00025 * (1 + rover.storm * 12));
  if (rover.battery < 6 && rover.mode !== 'SAFE') {
    rover.mode = 'SAFE';
    rover.v = 0;
    audio.warning();
    radio('ROVER OPS — CAPCOM', 'Rover has entered SAFE MODE on low battery. Only recovery commands accepted. Open Diagnostics and recharge.', 'alert');
  }

  // Thermal/motor state
  const load = Math.abs(rover.v) / V_MAX + Math.max(0, climb) / 25 + sand * 0.5;
  const ambient = d ? -25 : -75;
  rover.motorTemp += ((ambient + load * 70) - rover.motorTemp) * dt * 0.08;
  rover.internalTemp += ((d ? 15 : 2) - rover.internalTemp) * dt * 0.02;
  rover.wheels.forEach((w, i) => {
    if (w.fault) { w.current = 0; return; }
    const extra = rover.stuck ? 1.5 : 0;
    w.current = (Math.abs(rover.v) / V_MAX) * (1.1 + Math.max(0, climb) / 20 + sand * 0.8) + extra + (i % 3 === 1 ? 0.05 : 0);
    w.temp += ((ambient + w.current * 25) - w.temp) * dt * 0.1;
  });

  // Trail
  trailAcc += moved;
  if (trailAcc > 2) { trailAcc = 0; rover.trail.push([rover.x, rover.z]); if (rover.trail.length > 600) rover.trail.shift(); }
  if (rover.busy) rover.busyT += dt;
  if (rover.mode === 'DIRECT' && Math.abs(rover.v) < 0.02 && !rover.cmd.throttle && !rover.cmd.steer && !rover.stuck && rover.queue.length === 0 && !rover.lastSent.throttle && !rover.lastSent.steer) rover.mode = 'IDLE';

  audio.setLoop('rover', { speed: rover.v / V_MAX, rough: 1 + sand });
  snapAcc += dt;
  if (snapAcc > 0.1) { snapAcc = 0; useRover.setState({ snap: performance.now() }); }
}

function triggerWheelFault(why: string) {
  rover.faultHappened = true;
  const w = rover.wheels[4];
  w.fault = true;
  w.current = 4.8;
  w.temp = 35;
  w.health = 0.7;
  rover.mode = 'FAULT';
  rover.v = 0;
  rover.faultMsg = `WHEEL RM OVERCURRENT — ${why}`;
  audio.warning();
  toast('FAULT — WHEEL RM MOTOR', 'Drive inhibited. Press R (Diagnostics) and reset the motor controller.', 'warn');
  radio('ROVER OPS — CAPCOM', `Fault protection tripped: right-middle wheel overcurrent, ${why}. Drive is inhibited. Run diagnostics and reset the controller.`, 'alert');
}

export function telemetryLine() {
  return `SOL ${rover.sol} · LMST ${String(Math.floor(rover.lmst)).padStart(2, '0')}:${String(Math.floor((rover.lmst % 1) * 60)).padStart(2, '0')}`;
}
export function headingDeg() {
  return ((((-rover.heading * 180) / Math.PI) % 360) + 360) % 360;
}
export { MARS_POI_BY_ID };

if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev')) (window as any).__rover = rover;
