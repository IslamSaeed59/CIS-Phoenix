// The eight investigation themes, derived from the NASA Space Apps Challenge
// "Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars".
// This game is a fan/educational project and is not endorsed by NASA.

export type CategoryId =
  | 'geology'
  | 'terrain'
  | 'temperature'
  | 'water'
  | 'dust'
  | 'biology'
  | 'subsurface'
  | 'operations';

export interface Category {
  id: CategoryId;
  num: string;
  title: string;
  short: string;
  glyph: string;
  objective: string;
  investigates: string[];
  earthMethod: string;
  marsMethod: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'geology',
    num: '01',
    title: 'Geology & Surface Materials',
    short: 'GEOLOGY',
    glyph: '◆',
    objective: 'Characterise surface composition, rock formations, sedimentary layers and evaporite deposits.',
    investigates: ['Surface composition', 'Mineralogy (preliminary → lab)', 'Rock formations & structures', 'Sedimentary layers', 'Evaporite deposits'],
    earthMethod: 'Field inspection, handheld spectral scanner (preliminary), sample collection, field-lab analysis',
    marsMethod: 'Mast camera imaging, multispectral imaging, contact spectrometer',
  },
  {
    id: 'terrain',
    num: '02',
    title: 'Terrain & Topography',
    short: 'TERRAIN',
    glyph: '▲',
    objective: 'Map elevation, slope and roughness; identify landforms and navigation hazards.',
    investigates: ['Elevation', 'Slope', 'Surface roughness', 'Landform morphology', 'Navigation difficulty'],
    earthMethod: 'Terrain LiDAR scan → 3D topographic model, hazard mapping, photography',
    marsMethod: 'Navigation-camera stereo terrain model, hazard mapping, mast camera imaging',
  },
  {
    id: 'temperature',
    num: '03',
    title: 'Temperature & Environmental Extremes',
    short: 'THERMAL',
    glyph: '◐',
    objective: 'Record surface temperatures, day/night variation and thermal contrasts between materials.',
    investigates: ['Surface temperature', 'Day–night variation', 'Solar exposure', 'Thermal contrast between materials'],
    earthMethod: 'Thermal camera readings by day and night on contrasting surfaces',
    marsMethod: 'Rover thermal-infrared radiometer, day and night readings',
  },
  {
    id: 'water',
    num: '04',
    title: 'Water, Ice & Resources',
    short: 'WATER',
    glyph: '◇',
    objective: 'Look for geological evidence of past water activity and potential resources.',
    investigates: ['Evidence of past water activity', 'Evaporite deposits', 'Water-related sedimentary structures', 'Potential resources'],
    earthMethod: 'Inspection of evaporites and channel deposits, sampling, lab analysis',
    marsMethod: 'Multispectral imaging for hydration-related indicators, contact spectrometer on vein material',
  },
  {
    id: 'dust',
    num: '05',
    title: 'Dust, Wind & Erosion',
    short: 'AEOLIAN',
    glyph: '≋',
    objective: 'Investigate wind erosion, dust movement, aeolian landforms and dust-related hazards.',
    investigates: ['Wind erosion', 'Dust movement', 'Aeolian landforms (yardangs, ripples)', 'Dust-related operational hazards'],
    earthMethod: 'Environmental sensor suite (wind), yardang inspection, ripple photography',
    marsMethod: 'Rover wind/dust sensors, ripple imaging, solar-panel dust diagnostics',
  },
  {
    id: 'biology',
    num: '06',
    title: 'Biology, Extremophiles & Habitability',
    short: 'HABITABILITY',
    glyph: '✻',
    objective: 'Assess environmental conditions relevant to life and record evidence honestly as confirmed, inconclusive or absent.',
    investigates: ['Extremophile habitats', 'Environmental limits (UV, humidity, salinity)', 'Potential biosignatures', 'Earth vs Mars habitability differences'],
    earthMethod: 'Environmental sensors, evaporite sampling, simulated biological assay dataset',
    marsMethod: 'Environmental sensors (UV, humidity, pressure), simulated onboard organic screening',
  },
  {
    id: 'subsurface',
    num: '07',
    title: 'Caves & Subsurface Environments',
    short: 'SUBSURFACE',
    glyph: '▼',
    objective: 'Investigate subsurface layering and potential sheltered environments.',
    investigates: ['Subsurface layering', 'Sheltered environments (overhangs, pits)', 'Subsurface resource potential'],
    earthMethod: 'Ground-penetrating radar (GPR) profile, inspection of erosional overhang',
    marsMethod: 'Rover GPR traverse, imaging of a candidate collapse pit (conceptual)',
  },
  {
    id: 'operations',
    num: '08',
    title: 'Exploration & Human/Robotic Operations',
    short: 'OPERATIONS',
    glyph: '⬡',
    objective: 'Evaluate mobility, terrain accessibility, communications and operational risks.',
    investigates: ['Surface bearing strength / trafficability', 'Landing & site suitability', 'Communications', 'Mobility faults & recovery'],
    earthMethod: 'Penetrometer trafficability tests, comms link test, flat-site evaluation',
    marsMethod: 'Rover odometry, autonomous navigation route, fault recovery',
  },
];

export const CAT_BY_ID: Record<CategoryId, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as any;

export type TaskKind = 'field' | 'analysis';
export interface Task {
  id: string; // evidence key that completes the task
  cat: CategoryId;
  label: string;
  hint: string;
  kind: TaskKind;
}

export type Status = 'NOT STARTED' | 'IN PROGRESS' | 'EVIDENCE COLLECTED' | 'ANALYSIS REQUIRED' | 'COMPLETED';

export interface InterpOption {
  id: string;
  text: string;
  quality: 'supported' | 'overclaim' | 'inconclusive';
  suggestedConfidence: 'Low' | 'Moderate' | 'High';
}

export interface InterpSet {
  observation: string; // what was directly observed (summary)
  options: InterpOption[];
  limitations: { id: string; text: string; good: boolean }[];
}
