import type { CategoryId, InterpSet, Task } from '../scientific-checklist/categories';

export interface MarsPOI {
  id: string;
  name: string;
  pos: [number, number];
  radius: number;
  description: string;
  thermal: { absorb: number; inertia: number; material: string };
  multispec?: string;
  spectro?: string;
  conceptual?: boolean;
}

// Representative terrain reconstruction of a sedimentary crater-floor setting.
// Positions are game-world metres, NOT real Martian coordinates.
export const MARS_POIS: MarsPOI[] = [
  {
    id: 'm-layers',
    name: 'Light-toned Layered Outcrop',
    pos: [0, -188],
    radius: 22,
    description: 'An escarpment exposing many thin, light-toned layers of sedimentary rock.',
    thermal: { absorb: 0.72, inertia: 0.8, material: 'Layered bedrock' },
    multispec: 'Spectral parameters show a weak absorption that MAY indicate hydrated minerals (e.g., sulfates or clays). PRELIMINARY — requires contact analysis.',
    spectro: 'Contact spectrometer (SIMULATED): elevated sulfur and calcium relative to nearby soil; consistent with a sulfate-bearing sedimentary rock. Illustrative values.',
  },
  {
    id: 'm-veins',
    name: 'Light-toned Vein Network',
    pos: [-42, -160],
    radius: 10,
    description: 'Thin, bright veins cutting across the bedrock in a criss-cross network.',
    thermal: { absorb: 0.45, inertia: 0.75, material: 'Vein-filled bedrock' },
    multispec: 'Bright, spectrally flat in visible bands; hydration signal uncertain.',
    spectro: 'Contact spectrometer (SIMULATED): Ca and S enriched — consistent with calcium sulfate veins, which on Earth form from water moving through fractures. Illustrative.',
  },
  {
    id: 'm-boulder',
    name: 'Dark Boulder Field',
    pos: [-140, 15],
    radius: 22,
    description: 'Dark, angular-to-subrounded boulders, some with pitted surfaces.',
    thermal: { absorb: 0.88, inertia: 0.85, material: 'Dark rock' },
    multispec: 'Spectral shape consistent with mafic (basalt-like) rock. PRELIMINARY.',
    spectro: 'Contact spectrometer (SIMULATED): Fe- and Mg-rich composition consistent with basaltic rock. Illustrative.',
  },
  {
    id: 'm-dunes',
    name: 'Ripple & Soft-Sand Field',
    pos: [150, 50],
    radius: 38,
    description: 'Fields of wind ripples in fine, loose sand. HAZARD: high wheel sinkage risk.',
    thermal: { absorb: 0.75, inertia: 0.12, material: 'Loose sand' },
    multispec: 'Mafic sand with dust coating. PRELIMINARY.',
    spectro: 'Contact spectrometer (SIMULATED): basaltic sand composition. Illustrative.',
  },
  {
    id: 'm-ridges',
    name: 'Wind-eroded Ridges',
    pos: [195, -115],
    radius: 35,
    description: 'Streamlined ridges carved by wind into a friable deposit — morphologically similar to terrestrial yardangs.',
    thermal: { absorb: 0.7, inertia: 0.45, material: 'Friable deposit' },
    multispec: 'Dust-coated fine-grained deposit. PRELIMINARY.',
  },
  {
    id: 'm-pit',
    name: 'Collapse Pit (candidate)',
    pos: [-178, -120],
    radius: 16,
    description: 'A steep-walled, rimless depression. CONCEPTUAL: in this reconstruction it is a candidate sheltered environment; its connection to any cave is unverified.',
    thermal: { absorb: 0.6, inertia: 0.95, material: 'Shadowed pit floor' },
    conceptual: true,
  },
  {
    id: 'm-crater',
    name: 'Small Impact Crater',
    pos: [85, 175],
    radius: 26,
    description: 'A small, fresh-looking bowl crater with a raised rim and scattered ejecta blocks.',
    thermal: { absorb: 0.78, inertia: 0.55, material: 'Ejecta & regolith' },
    multispec: 'Ejecta blocks expose less-dusty rock. PRELIMINARY.',
  },
];
export const MARS_POI_BY_ID = Object.fromEntries(MARS_POIS.map((p) => [p.id, p])) as Record<string, MarsPOI>;

export const MARS_TASKS: Task[] = [
  { id: 'photo:m-crater', cat: 'terrain', kind: 'field', label: 'Photograph the crater', hint: 'Station 1 · Crater' },
  { id: 'photo:m-dunes', cat: 'dust', kind: 'field', label: 'Photograph the sand ripples', hint: 'Station 2 · Sand ripples' },
  { id: 'thermal:m-dunes:day', cat: 'temperature', kind: 'field', label: 'Measure the sand temperature', hint: 'Station 2 · Sand ripples' },
  { id: 'recover:fault', cat: 'operations', kind: 'field', label: 'Test the soft sand and get unstuck', hint: 'Station 2 · Sand ripples' },
  { id: 'spectro:m-layers', cat: 'geology', kind: 'field', label: 'Touch the layered rock with the arm', hint: 'Station 3 · Layered rock' },
  { id: 'multispec:m-layers', cat: 'water', kind: 'field', label: 'Colour-scan the layered rock', hint: 'Station 3 · Layered rock' },
  { id: 'scan:env', cat: 'biology', kind: 'field', label: 'Measure air, UV and humidity', hint: 'Station 3 · Layered rock' },
  { id: 'photo:m-pit', cat: 'subsurface', kind: 'field', label: 'Photograph the mysterious pit', hint: 'Station 4 · Pit' },
];

export const MARS_INTERP: Record<CategoryId, InterpSet> = {
  geology: {
    observation: 'Light-toned layered sedimentary rock with S/Ca enrichment; dark boulders consistent with basaltic composition.',
    options: [
      { id: 'g1', text: 'The outcrop is a layered sedimentary rock with a sulfate component; dark boulders are likely basaltic. Mineralogy remains preliminary.', quality: 'supported', suggestedConfidence: 'Moderate' },
      { id: 'g2', text: 'The outcrop is identical in composition to the Qaidam playa crust.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'g3', text: 'No compositional inference possible.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'Remote and contact data are simulated and lack a returned sample for lab confirmation.', good: true },
      { id: 'l2', text: 'Spectra uniquely identify every mineral.', good: false },
    ],
  },
  terrain: {
    observation: 'Stereo model shows a crater, an escarpment, ridges and ripple fields; steep slopes exceed rover limits.',
    options: [
      { id: 't1', text: 'Safe routes exist across flat plains; the escarpment, crater walls and ripple fields need avoidance or careful planning.', quality: 'supported', suggestedConfidence: 'High' },
      { id: 't2', text: 'The entire area is safe to drive.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 't3', text: 'Not enough terrain data.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'Stereo range is limited; sub-surface weak layers are invisible to cameras.', good: true },
      { id: 'l2', text: 'Cameras can see all hazards.', good: false },
    ],
  },
  temperature: {
    observation: 'Sand much warmer than rock by day and colder at night (low inertia); overall far colder than Qaidam.',
    options: [
      { id: 'h1', text: 'Thermal inertia controls the sand-vs-rock contrast; Martian surface temperatures are far colder and swing more widely than in Qaidam.', quality: 'supported', suggestedConfidence: 'Moderate' },
      { id: 'h2', text: 'Mars surface temperatures are similar to a cold desert night on Earth all year.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'h3', text: 'No thermal pattern found.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'Simulated readings from a few points and one sol only.', good: true },
      { id: 'l2', text: 'One sol represents all seasons.', good: false },
    ],
  },
  water: {
    observation: 'Possible hydration signal in layers; Ca–S-rich veins in fractures.',
    options: [
      { id: 'w1', text: 'Sulfate-bearing layers and Ca-sulfate-like veins are consistent with past water activity; no liquid water was observed.', quality: 'supported', suggestedConfidence: 'Moderate' },
      { id: 'w2', text: 'Liquid water flows here today.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'w3', text: 'Nothing relates to water.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'Timing, duration and chemistry of past water remain unknown.', good: true },
      { id: 'l2', text: 'The veins prove a long-lived ocean.', good: false },
    ],
  },
  dust: {
    observation: 'Measured winds and lofted dust; ripple fields; dust accumulation reduced solar power.',
    options: [
      { id: 'd1', text: 'Wind shapes ripples and ridges; dust deposition is a major operational hazard for solar power and optics.', quality: 'supported', suggestedConfidence: 'High' },
      { id: 'd2', text: 'Martian winds are as forceful as Earth winds of the same speed.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'd3', text: 'Dust has no operational impact.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'The thin atmosphere means wind exerts much less force at equal speed; erosion rates differ greatly.', good: true },
      { id: 'l2', text: 'Earth and Mars erosion rates are identical.', good: false },
    ],
  },
  biology: {
    observation: 'High UV, very low pressure and humidity; simulated organic screening returned no biosignature detection.',
    options: [
      { id: 'b1', text: 'No biosignature detected (inconclusive for life). Past water-related environments may have been habitable, but present surface conditions are harsh.', quality: 'supported', suggestedConfidence: 'Moderate' },
      { id: 'b2', text: 'Because Qaidam salts host microbes, this outcrop hosts microbes.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'b3', text: 'Absence of detection proves Mars was never habitable.', quality: 'overclaim', suggestedConfidence: 'High' },
    ],
    limitations: [
      { id: 'l1', text: 'Instrument sensitivity and sampling are limited; non-detection is not evidence of absence.', good: true },
      { id: 'l2', text: 'The screening rules out all life everywhere on Mars.', good: false },
    ],
  },
  subsurface: {
    observation: 'GPR shows layered reflectors; a steep-walled pit was imaged from a safe distance.',
    options: [
      { id: 's1', text: 'Layering continues below the surface; the pit is a candidate sheltered environment whose cave connection is unverified.', quality: 'supported', suggestedConfidence: 'Low' },
      { id: 's2', text: 'The pit is confirmed as a lava-tube entrance suitable for a habitat.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 's3', text: 'Nothing can be said about the subsurface.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'Conceptual pit; GPR is simulated, depth-limited and non-unique.', good: true },
      { id: 'l2', text: 'Orbital and rover data confirm a cave.', good: false },
    ],
  },
  operations: {
    observation: 'Signal delay required planning; soft sand caused slip/sinkage; autonav succeeded on benign terrain; dust reduced power.',
    options: [
      { id: 'o1', text: 'Delay forces autonomy and careful planning; soft sand and dust are the main mobility and power risks; recoveries are slow but possible.', quality: 'supported', suggestedConfidence: 'High' },
      { id: 'o2', text: 'Direct real-time joystick driving is practical on Mars.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'o3', text: 'No operational lessons learned.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'The game compresses real signal delay (several to ~20+ minutes one-way) into seconds.', good: true },
      { id: 'l2', text: 'The simulation reproduces real rover dynamics exactly.', good: false },
    ],
  },
};
