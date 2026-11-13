import { create } from 'zustand';
import { rover, instruments, logMars, resetRover } from '../rover/roverSim';
import { useGame } from '../core/store';
import { radio, toast } from '../core/ui';
import { audio } from '../core/audio';
import { MARS_POI_BY_ID } from '../../data/mars/marsData';
import type { IconName } from '../../ui/icons';

export type ActionId = 'photo' | 'thermal' | 'sandtest' | 'arm' | 'colour' | 'air';

export interface Station {
  id: string;
  num: number;
  name: string;
  poi: string;
  approach: [number, number];
  actions: { id: ActionId; label: string; icon: IconName; task: string }[];
}

export const STATIONS: Station[] = [
  {
    id: 'crater', num: 1, name: 'Crater', poi: 'm-crater', approach: [85, 138],
    actions: [{ id: 'photo', label: 'Take a photo', icon: 'camera', task: 'photo:m-crater' }],
  },
  {
    id: 'dunes', num: 2, name: 'Sand ripples', poi: 'm-dunes', approach: [104, 50],
    actions: [
      { id: 'photo', label: 'Take a photo', icon: 'camera', task: 'photo:m-dunes' },
      { id: 'thermal', label: 'Measure temperature', icon: 'thermo', task: 'thermal:m-dunes:day' },
      { id: 'sandtest', label: 'Test drive into the sand', icon: 'wheel', task: 'recover:fault' },
    ],
  },
  {
    id: 'layers', num: 3, name: 'Layered rock', poi: 'm-layers', approach: [0, -157],
    actions: [
      { id: 'arm', label: 'Touch rock with arm', icon: 'arm', task: 'spectro:m-layers' },
      { id: 'colour', label: 'Colour scan', icon: 'spectrum', task: 'multispec:m-layers' },
      { id: 'air', label: 'Measure the air', icon: 'air', task: 'scan:env' },
    ],
  },
  {
    id: 'pit', num: 4, name: 'Mysterious pit', poi: 'm-pit', approach: [-152, -100],
    actions: [{ id: 'photo', label: 'Take a photo', icon: 'camera', task: 'photo:m-pit' }],
  },
];

interface StationState {
  at: string | null; // station the rover is parked at
  driving: string | null; // station the rover is driving to
  busy: ActionId | null;
  sand: 'none' | 'driving' | 'stuck' | 'reversing';
}
export const useStations = create<StationState>()(() => ({ at: null, driving: null, busy: null, sand: 'none' }));

/** Simple mode: no scripted faults, no storm, frozen daylight, low latency. */
export function setupSimpleMars() {
  rover.training = true;
  rover.faultHappened = true;
  rover.stormPhase = 'done';
  rover.lmst = 11;
  rover.calibrated = true;
  rover.autoSpeed = 2.6; // time-lapse driving
  rover.autoTurn = 1.4;
}

export function stationDone(st: Station) {
  const ev = useGame.getState().marsEvidence;
  return st.actions.every((a) => ev[a.task]);
}

export function nextStation(): Station | undefined {
  return STATIONS.find((s) => !stationDone(s));
}

export function goTo(id: string) {
  const st = STATIONS.find((s) => s.id === id)!;
  if (rover.stuck) { toast('Rover is stuck', 'Back out of the sand first.', 'warn'); return; }
  rover.wheels.forEach((w) => { w.fault = false; });
  if (rover.mode === 'SAFE') rover.battery = Math.max(rover.battery, 60);
  rover.mode = 'IDLE';
  instruments.setRoute([st.approach]);
  rover.mode = 'AUTONAV';
  useStations.setState({ driving: id, at: null });
  audio.ui('confirm');
  rover.cam = 'NAVCAM';
  rover.camYaw = 0;
  rover.camPitch = -0.1;
}

/** Called every frame-ish from the UI to detect arrival and keep the camera aimed. */
export function tickStations() {
  const s = useStations.getState();
  // keep things simple and day-lit
  rover.lmst = 11;
  if (s.driving) {
    const st = STATIONS.find((x) => x.id === s.driving)!;
    const d = Math.hypot(st.approach[0] - rover.x, st.approach[1] - rover.z);
    if (rover.mode !== 'AUTONAV') {
      if (d < 8) {
        useStations.setState({ driving: null, at: st.id });
        audio.ui('confirm');
        aimAt(st.poi);
      } else if (rover.hazard || d >= 8) {
        // Onboard autonomy stopped for a hazard — nudge around it and continue
        const ang = Math.atan2(st.approach[1] - rover.z, st.approach[0] - rover.x) + Math.PI / 2;
        instruments.setRoute([[rover.x + Math.cos(ang) * 12, rover.z + Math.sin(ang) * 12], st.approach]);
        rover.mode = 'AUTONAV';
      }
    }
  }
  if (s.at && s.sand === 'none' && !s.busy) aimAt(STATIONS.find((x) => x.id === s.at)!.poi, true);
  // Sand test flow
  if (s.sand === 'driving' && rover.stuck) {
    rover.cmd = { throttle: 0, steer: 0, brake: false };
    useStations.setState({ sand: 'stuck' });
    radio('ROVI', 'Uh-oh, we are stuck! Press “Back out slowly”.', 'warn');
  }
  if (s.sand === 'driving' && !rover.stuck && Math.hypot(rover.x - 150, rover.z - 50) < 12) {
    // safety: force the embed if we somehow reached the centre
    rover.stuck = true;
  }
  if (s.sand === 'reversing' && !rover.stuck) {
    rover.cmd = { throttle: 0, steer: 0, brake: false };
    useStations.setState({ sand: 'none' });
    rover.cam = 'NAVCAM';
    goTo('dunes');
  }
}

function aimAt(poiId: string, smooth = false) {
  const p = MARS_POI_BY_ID[poiId];
  const dx = p.pos[0] - rover.x, dz = p.pos[1] - rover.z;
  let rel = Math.atan2(-dx, -dz) - rover.heading;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  const target = Math.max(-2.6, Math.min(2.6, rel));
  rover.camYaw = smooth ? rover.camYaw + (target - rover.camYaw) * 0.08 : target;
  const pitch = poiId === 'm-pit' ? -0.25 : poiId === 'm-layers' ? 0.05 : -0.1;
  rover.camPitch = smooth ? rover.camPitch + (pitch - rover.camPitch) * 0.08 : pitch;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function doAction(st: Station, a: Station['actions'][number]) {
  const g = useGame.getState();
  if (g.marsEvidence[a.task] || useStations.getState().busy) return;
  useStations.setState({ busy: a.id });
  try {
    if (a.id === 'photo') {
      rover.cam = 'NAVCAM';
      aimAt(st.poi);
      await wait(700);
      instruments.capture();
    } else if (a.id === 'thermal') {
      rover.thermalView = true;
      aimAt(st.poi);
      await wait(900);
      instruments.thermal();
      await wait(2200);
      rover.thermalView = false;
    } else if (a.id === 'colour') {
      rover.cam = 'MASTCAM';
      rover.zoom = 2;
      rover.calibrated = true;
      aimAt(st.poi);
      await wait(800);
      instruments.multispec();
      await wait(3600);
      rover.cam = 'NAVCAM';
      rover.zoom = 1;
    } else if (a.id === 'air') {
      instruments.habitability();
      await wait(3000);
    } else if (a.id === 'arm') {
      rover.mode = 'ARM';
      rover.cam = 'ARMCAM';
      audio.servo(1.2);
      await wait(4200);
      audio.scanDone();
      const p = MARS_POI_BY_ID[st.poi];
      logMars(a.task, 'Contact spectrometer', 'Integration complete');
      g.addScan({ world: 'mars', kind: 'spectro', zone: p.name, pos: [rover.x, rover.z], data: { target: p.name, result: p.spectro } });
      g.addJournal({ world: 'mars', kind: 'scan', title: `Contact spectrometer — ${p.name}`, text: p.spectro!, cat: 'geology' });
      rover.mode = 'IDLE';
      await wait(600);
      rover.cam = 'NAVCAM';
    } else if (a.id === 'sandtest') {
      // Point the rover at the ripple field and push in
      rover.heading = Math.atan2(-(150 - rover.x), -(50 - rover.z));
      rover.cam = 'HAZ-F';
      rover.mode = 'DIRECT';
      rover.cmd = { throttle: 0.9, steer: 0, brake: false };
      useStations.setState({ sand: 'driving' });
    }
  } finally {
    useStations.setState({ busy: null });
  }
}

export function backOut() {
  rover.cmd = { throttle: -0.4, steer: 0, brake: false };
  rover.cam = 'HAZ-R';
  useStations.setState({ sand: 'reversing' });
  audio.servo(0.6);
}

export function startMarsSimple() {
  resetRover();
  setupSimpleMars();
}
