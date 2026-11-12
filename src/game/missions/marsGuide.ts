import { useGame, catStatus, worldProgress } from '../core/store';
import { MARS_POI_BY_ID, MARS_TASKS } from '../../data/mars/marsData';
import { CATEGORIES } from '../../data/scientific-checklist/categories';
import { rover, isDay } from '../rover/roverSim';

export interface MarsStep { text: string; how: string; target?: [number, number] }

const ORDER = [
  'scan:terrain', 'scan:env', 'scan:wind', 'gpr:traverse', 'photo:m-crater',
  'thermal:m-boulder:day', 'multispec:m-boulder',
  'photo:m-dunes', 'thermal:m-dunes:day',
  'photo:m-layers', 'multispec:m-layers', 'spectro:m-layers', 'analyze:organics',
  'photo:m-veins', 'spectro:m-veins',
  'photo:m-pit', 'drive:150', 'autonav:route', 'diag:dust', 'hazard:mars', 'recover:fault', 'thermal:night',
];

const P = (id: string) => MARS_POI_BY_ID[id];

function stepFor(key: string): MarsStep {
  const [kind, a] = key.split(':');
  const poi = a && P(a);
  switch (kind) {
    case 'scan':
      if (a === 'terrain') return { text: 'Make a 3D map of the area', how: 'Stop · Instruments → Navcam stereo terrain model' };
      if (a === 'env') return { text: 'Measure UV, humidity and pressure', how: 'Instruments → Habitability suite' };
      return { text: 'Measure the wind and dust', how: 'Instruments → Wind & dust sensors' };
    case 'gpr':
      return { text: 'Scan underground while driving', how: 'Turn GPR on · drive 30 m' };
    case 'photo':
      return { text: `Photograph the ${poi.name}`, how: 'Drive closer · aim the camera · press P', target: poi.pos };
    case 'thermal':
      if (a === 'night') return isDay() ? { text: 'Take a reading at night', how: 'Instruments → Hibernate until night' } : { text: 'Take a temperature reading at night', how: 'Aim at a target · TIR reading' };
      return { text: `Measure the temperature of the ${poi.name}`, how: 'Aim at it · TIR reading', target: poi.pos };
    case 'multispec':
      return rover.calibrated
        ? { text: `Colour-scan the ${poi.name}`, how: 'Switch to MASTCAM · aim · Multispectral', target: poi.pos }
        : { text: 'Calibrate the colour camera first', how: 'Instruments → Multispectral calibration' };
    case 'spectro':
      return { text: `Touch the ${poi.name} with the arm`, how: 'Drive right up to it · stop · Arm spectrometer', target: poi.pos };
    case 'analyze':
      return { text: 'Check the rock data for organics', how: 'Instruments → Onboard sample analysis' };
    case 'drive':
      return { text: 'Drive 150 m in total', how: 'W/S drive · A/D steer' };
    case 'autonav':
      return { text: 'Let the rover drive itself', how: 'Navigation → click waypoints → Uplink & execute' };
    case 'diag':
      return { text: 'Check dust on the solar panels', how: 'Press R → Power-system check' };
    case 'hazard':
      return { text: 'Mark a dangerous slope', how: 'Navigation → Terrain models → click a red area' };
    case 'recover':
      return { text: 'Handle a rover problem', how: 'Drive into soft sand or over rocks, then fix it (R)', target: P('m-dunes').pos };
  }
  return { text: 'Continue the mission', how: 'Open the Checklist app' };
}

export function nextMarsStep(): MarsStep {
  const s = useGame.getState();
  const ev = s.marsEvidence;
  if (rover.stuck) return { text: 'The rover is stuck in sand', how: 'Hold Shift + S to reverse slowly' };
  if (rover.wheels.some((w) => w.fault)) return { text: 'A wheel motor has a fault', how: 'Press R → Reset motor controller' };
  if (rover.mode === 'SAFE') return { text: 'Battery is too low', how: 'Press R → Recharge / exit safe mode' };
  const valid = new Set(MARS_TASKS.map((t) => t.id));
  const next = ORDER.find((k) => valid.has(k) && !ev[k]);
  if (next) return stepFor(next);
  const pending = CATEGORIES.find((c) => catStatus('mars', c.id, s) === 'EVIDENCE COLLECTED');
  if (pending) return { text: `Write your conclusion for “${pending.short}”`, how: 'Checklist app → pick a category → Record' };
  if (worldProgress('mars', s).done) return { text: 'Compare Earth and Mars', how: 'Open the Analysis app' };
  return { text: 'Open the Checklist app', how: '' };
}
