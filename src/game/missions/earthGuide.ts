import { useGame, catStatus, worldProgress } from '../core/store';
import { EARTH_POI_BY_ID, EARTH_ZONES, EARTH_TASKS } from '../../data/earth/earthData';
import { CATEGORIES } from '../../data/scientific-checklist/categories';

export interface GuideStep {
  text: string; // what to do (short)
  how: string; // which key / action
  target?: [number, number]; // world x,z for the beacon
  place?: string; // name of the place
}

// A route through the basin that keeps walking short: camp → playa → salt pan → channel → cliffs → yardangs → relay → night.
const ORDER = [
  'inspect:playa-polygons', 'scan:env:playa', 'probe:crust', 'sample:playa-crust', 'thermal:playa-crust:day', 'site:flat',
  'thermal:dark-gravel:day',
  'inspect:halite-mounds', 'sample:halite-mounds',
  'inspect:dry-channel',
  'inspect:overhang', 'photo:strata-cliff', 'spectral:strata-cliff', 'scan:gpr:sediment',
  'inspect:yardang-major', 'photo:yardang-major', 'scan:terrain:yardang', 'scan:wind:yardang', 'photo:ripples', 'probe:sand',
  'comms:relay',
  'lab:playa-crust', 'lab:halite-mounds', 'labbio:halite-mounds', 'hazard:earth',
  'thermal:night',
];

const poiPos = (id: string): [number, number] => EARTH_POI_BY_ID[id].pos;
const zonePos = (id: string): [number, number] => EARTH_ZONES[id as keyof typeof EARTH_ZONES].center;

function stepFor(key: string, isDay: boolean): GuideStep {
  const [kind, a, b] = key.split(':');
  const poi = a && EARTH_POI_BY_ID[a];
  switch (kind) {
    case 'inspect':
      return { text: `Inspect the ${poi.name}`, how: 'Walk to the beacon · press E', target: poiPos(a), place: poi.name };
    case 'sample':
      return { text: `Take a sample of the ${poi.name}`, how: 'Press E · click “Collect sample”', target: poiPos(a), place: poi.name };
    case 'photo':
      return { text: `Photograph the ${poi.name}`, how: 'Press 1 · aim at it · click', target: poiPos(a), place: poi.name };
    case 'spectral':
      return { text: `Scan the ${poi.name}`, how: 'Press 2 · aim at it · click', target: poiPos(a), place: poi.name };
    case 'thermal':
      if (a === 'night') {
        return isDay
          ? { text: 'Wait for night', how: 'Go to the camp tent · press E to rest', target: poiPos('tent'), place: 'Camp tent' }
          : { text: 'Measure a temperature at night', how: 'Press 3 · aim at any marked site · click', target: poiPos('dark-gravel'), place: 'Dark gravel' };
      }
      if (!isDay) return { text: 'It is night — go back to daytime', how: 'Go to the camp tent · press E to rest', target: poiPos('tent'), place: 'Camp tent' };
      return { text: `Measure the temperature of the ${poi.name}`, how: 'Press 3 · aim at it · click', target: poiPos(a), place: poi.name };
    case 'scan':
      if (a === 'terrain') return { text: 'Scan the terrain', how: 'Stand in the zone · press 4 · click', target: zonePos(b), place: EARTH_ZONES[b as 'yardang'].name };
      if (a === 'gpr') return { text: 'Scan underground', how: 'Stand in the zone · press 5 · click', target: zonePos(b), place: EARTH_ZONES[b as 'yardang'].name };
      return { text: a === 'wind' ? 'Measure the wind' : 'Measure the environment (UV, humidity)', how: 'Stand in the zone · press 6 · click', target: zonePos(b), place: EARTH_ZONES[b as 'yardang'].name };
    case 'probe':
      return a === 'sand'
        ? { text: 'Test how soft the sand is', how: 'Stand on the sand · press 7 · click', target: poiPos('ripples'), place: 'Sand ripples' }
        : { text: 'Test how hard the salt crust is', how: 'Stand on the salt · press 7 · click', target: zonePos('playa'), place: 'Salt flat' };
    case 'site':
      return { text: 'Check a flat landing spot', how: 'On the salt flat · press 4 · click', target: [-215, 75], place: 'Salt flat' };
    case 'comms':
      return { text: 'Test the radio link', how: 'Go to the antenna · press E', target: poiPos('relay'), place: 'Radio antenna' };
    case 'lab':
    case 'labbio':
      return { text: 'Analyse your samples', how: 'Press Tab · LAB tab · run analysis' };
    case 'hazard':
      return { text: 'Mark a dangerous slope', how: 'Press Tab · SCANS · click a red area' };
  }
  return { text: 'Continue the survey', how: 'Press Tab for the checklist' };
}

export function nextEarthStep(): GuideStep {
  const s = useGame.getState();
  const ev = s.earthEvidence;
  const isDay = s.earthTime === 'day';
  // Field/analysis tasks in route order (only tasks that exist in the checklist)
  const valid = new Set(EARTH_TASKS.map((t) => t.id));
  const next = ORDER.find((k) => valid.has(k) && !ev[k]);
  // Sampling needs a lab run before the lab step can be done, so lab steps naturally follow samples.
  if (next) return stepFor(next, isDay);
  // Interpretations
  const pending = CATEGORIES.find((c) => catStatus('earth', c.id, s) === 'EVIDENCE COLLECTED');
  if (pending) return { text: `Write your conclusion for “${pending.short}”`, how: 'Press Tab · pick a category · Record interpretation' };
  if (worldProgress('earth', s).done) return { text: 'Earth done! Head back to base', how: 'Go to the white vehicle · press E', target: poiPos('vehicle'), place: 'Vehicle' };
  return { text: 'Open your checklist', how: 'Press Tab' };
}
