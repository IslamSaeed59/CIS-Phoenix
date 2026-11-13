import type { CategoryId, InterpSet, Task } from '../scientific-checklist/categories';

export type ZoneId = 'camp' | 'playa' | 'saline' | 'yardang' | 'sediment';

export const EARTH_ZONES: Record<ZoneId, { name: string; label: string; center: [number, number]; radius: number; blurb: string }> = {
  camp: { name: 'Field Camp', label: 'BASE', center: [0, 140], radius: 55, blurb: 'Expedition field camp. Rest, radio, extraction vehicle.' },
  playa: {
    name: 'Dalangtan Playa (representative)',
    label: 'ZONE A',
    center: [-215, 55],
    radius: 120,
    blurb: 'Salt-rich playa with polygonal crust patterns and evaporite deposits. Representative reconstruction of a playa setting in the NW Qaidam Basin.',
  },
  saline: {
    name: 'Saline Pan',
    label: 'ZONE C',
    center: [-200, -150],
    radius: 85,
    blurb: 'Halite-rich mounds and salt crusts formed by evaporation. Representative reconstruction.',
  },
  yardang: {
    name: 'Qaidam Yardang Field (representative)',
    label: 'ZONE B',
    center: [235, 10],
    radius: 140,
    blurb: 'Wind-eroded, streamlined ridges carved from soft sediments, aligned with the prevailing wind. Representative reconstruction.',
  },
  sediment: {
    name: 'Basin Sedimentary & Drainage Zone',
    label: 'ZONE D',
    center: [0, -215],
    radius: 140,
    blurb: 'Layered sedimentary escarpment and a dry drainage channel. Representative reconstruction.',
  },
};

export interface InspectFeature {
  label: string;
  text: string; // direct observation wording
  pos: [number, number, number]; // hotspot position on specimen (unit space)
}

export interface EarthPOI {
  id: string;
  name: string;
  zone: ZoneId;
  pos: [number, number];
  specimen: 'salt-crust' | 'halite' | 'yardang' | 'strata' | 'gravel' | 'channel' | 'overhang' | 'ripple' | 'none';
  description: string;
  features?: InspectFeature[];
  categories: CategoryId[]; // categories the inspection observation is relevant to (for classification)
  inspectable: boolean;
  sampleable?: boolean;
  thermal: { absorb: number; inertia: number; material: string };
  spectral?: string; // preliminary handheld-scanner reading
  labResult?: { title: string; result: string; confidence: 'Low' | 'Moderate' | 'High'; note: string };
  bioResult?: { title: string; result: string; confidence: 'Low' | 'Moderate' | 'High'; note: string };
  interactLabel?: string;
}

export const EARTH_POIS: EarthPOI[] = [
  {
    id: 'playa-polygons',
    name: 'Polygonal Salt Crust',
    zone: 'playa',
    pos: [-232, 40],
    specimen: 'salt-crust',
    description: 'A broad expanse of salt crust broken into polygons a few metres across, with raised, whitish rims along the polygon boundaries.',
    features: [
      { label: 'Raised polygon rims', text: 'Polygon boundaries are raised ridges of whitish, crystalline crust, ~5–15 cm high (estimated visually).', pos: [0.55, 0.25, 0.1] },
      { label: 'Polygon interior', text: 'Polygon interiors are flatter and slightly darker, with a fine granular texture.', pos: [-0.2, 0.12, -0.25] },
      { label: 'Desiccation cracks', text: 'Fine cracks subdivide the interior into smaller cells.', pos: [-0.5, 0.15, 0.35] },
    ],
    categories: ['geology', 'water'],
    inspectable: true,
    thermal: { absorb: 0.32, inertia: 0.5, material: 'Salt crust' },
    spectral: 'PRELIMINARY: high reflectance; spectral shape consistent with chloride/sulfate salts. Lab confirmation required.',
  },
  {
    id: 'playa-crust',
    name: 'Salt Crust Sample Site',
    zone: 'playa',
    pos: [-190, 92],
    specimen: 'salt-crust',
    description: 'Flagged sampling site on the playa surface. The crust is brittle and layered beneath a thin white rind.',
    features: [
      { label: 'White surface rind', text: 'A thin (mm-scale) white crystalline rind coats the surface.', pos: [0.1, 0.3, 0.2] },
      { label: 'Layered crust', text: 'In cross-section, the crust shows alternating light and tan sub-layers.', pos: [0.7, 0.0, 0.0] },
    ],
    categories: ['geology', 'water'],
    inspectable: true,
    sampleable: true,
    thermal: { absorb: 0.3, inertia: 0.5, material: 'Salt crust' },
    spectral: 'PRELIMINARY: bright, salt-like spectrum. Possible chloride with sulfate component. Uncertain.',
    labResult: {
      title: 'Field-lab geochemistry (SIMULATED)',
      result: 'Dominant halite (NaCl) with a minor sulfate component (gypsum-like) and detrital silicate grains. Values are illustrative game data, not real measurements.',
      confidence: 'Moderate',
      note: 'Field-portable analysis; mineral proportions are approximate. Confirm with laboratory XRD.',
    },
  },
  {
    id: 'dark-gravel',
    name: 'Dark Gravel Lag Surface',
    zone: 'playa',
    pos: [-75, 70],
    specimen: 'gravel',
    description: 'A surface armoured with dark, wind-polished gravel clasts over finer sediment — a desert-pavement-like lag.',
    features: [
      { label: 'Polished clasts', text: 'Clasts have smooth, polished faces on their upwind sides.', pos: [0.3, 0.3, 0.3] },
      { label: 'Fine matrix', text: 'Fine sediment is visible between and beneath the clasts.', pos: [-0.4, 0.1, -0.2] },
    ],
    categories: ['dust', 'geology'],
    inspectable: true,
    thermal: { absorb: 0.9, inertia: 0.45, material: 'Dark gravel' },
    spectral: 'PRELIMINARY: low albedo, mixed lithic clasts. Composition uncertain.',
  },
  {
    id: 'halite-mounds',
    name: 'Halite Mounds',
    zone: 'saline',
    pos: [-212, -140],
    specimen: 'halite',
    description: 'Knobbly mounds of salt with cubic crystal faces visible where the crust is broken.',
    features: [
      { label: 'Cubic crystals', text: 'Many crystals show cubic habit and right-angle faces.', pos: [0.35, 0.45, 0.2] },
      { label: 'Hopper texture', text: 'Some faces are stepped/hollowed (hopper-like), typical of rapid crystal growth.', pos: [-0.4, 0.3, 0.3] },
      { label: 'Dissolution pits', text: 'Small pits and rounded edges suggest partial dissolution and re-precipitation.', pos: [0.0, 0.2, -0.5] },
    ],
    categories: ['water', 'geology', 'biology'],
    inspectable: true,
    sampleable: true,
    thermal: { absorb: 0.28, inertia: 0.55, material: 'Halite' },
    spectral: 'PRELIMINARY: very high reflectance; consistent with halite. Hydration features weak/uncertain.',
    labResult: {
      title: 'Field-lab geochemistry (SIMULATED)',
      result: 'Halite-dominated sample with fluid inclusions observed under magnification. Illustrative result, not a real measurement.',
      confidence: 'Moderate',
      note: 'Fluid inclusions in halite can preserve information about the brines they formed from; this sample has not been dated.',
    },
    bioResult: {
      title: 'Biological assay — illustrative dataset (SIMULATED)',
      result: 'Illustrative dataset: DNA-stain counts above procedural blank in 2 of 3 sub-samples. Interpreted as consistent with halophilic microbial communities, which are known to inhabit salt deposits on Earth.',
      confidence: 'Low',
      note: 'Simulated dataset for gameplay. Contamination controls limited; result is NOT a real measurement and says nothing directly about Mars.',
    },
  },
  {
    id: 'yardang-major',
    name: 'Large Yardang',
    zone: 'yardang',
    pos: [222, -18],
    specimen: 'yardang',
    description: 'A streamlined ridge of layered, weakly-cemented sediment: blunt and steep on its upwind end, tapering downwind.',
    features: [
      { label: 'Blunt windward face', text: 'The NW-facing end is steep and blunt; the ridge tapers to the SE.', pos: [-0.75, 0.3, 0.0] },
      { label: 'Fluting & grooves', text: 'Flanks show grooves parallel to the ridge axis.', pos: [0.1, 0.35, 0.35] },
      { label: 'Exposed layers', text: 'Horizontal layers of differing resistance are exposed on the flanks.', pos: [0.4, 0.15, -0.3] },
      { label: 'Undercut base', text: 'The base is slightly undercut, with loose sand accumulating in the lee.', pos: [0.6, -0.15, 0.2] },
    ],
    categories: ['dust', 'terrain', 'geology'],
    inspectable: true,
    thermal: { absorb: 0.72, inertia: 0.6, material: 'Cemented sediment' },
    spectral: 'PRELIMINARY: fine-grained clastic sediment; possible clay/carbonate components. Uncertain.',
  },
  {
    id: 'ripples',
    name: 'Sand Ripple Corridor',
    zone: 'yardang',
    pos: [262, 62],
    specimen: 'ripple',
    description: 'Loose sand with regular wind ripples fills the corridor between yardangs.',
    features: [
      { label: 'Ripple crests', text: 'Ripple crests are regularly spaced and roughly perpendicular to the yardang axes.', pos: [0, 0.2, 0] },
      { label: 'Loose sand', text: 'Sand is loose and well sorted; footprints sink a few cm.', pos: [0.4, 0.1, 0.3] },
    ],
    categories: ['dust', 'operations'],
    inspectable: true,
    thermal: { absorb: 0.7, inertia: 0.15, material: 'Loose sand' },
    spectral: 'PRELIMINARY: quartz-rich sand with lithic grains. Uncertain.',
  },
  {
    id: 'strata-cliff',
    name: 'Layered Sedimentary Escarpment',
    zone: 'sediment',
    pos: [38, -183],
    specimen: 'strata',
    description: 'A steep escarpment exposing many sub-horizontal sedimentary layers of contrasting colour and resistance.',
    features: [
      { label: 'Repeated bedding', text: 'Layers repeat in alternating light and reddish-brown beds, decimetres to metres thick.', pos: [0.0, 0.3, 0.5] },
      { label: 'Resistant ledges', text: 'Some beds stand out as ledges, others recess — differential erosion.', pos: [0.5, 0.55, 0.3] },
      { label: 'White veneers', text: 'Thin white coatings occur along some bedding planes.', pos: [-0.5, -0.1, 0.45] },
    ],
    categories: ['geology', 'subsurface', 'water'],
    inspectable: true,
    thermal: { absorb: 0.7, inertia: 0.85, material: 'Bedrock' },
    spectral: 'PRELIMINARY: mixed clastic layers; white veneers possibly evaporitic salts or gypsum. Requires sampling to confirm.',
  },
  {
    id: 'overhang',
    name: 'Erosional Overhang',
    zone: 'sediment',
    pos: [-32, -184],
    specimen: 'overhang',
    description: 'A shallow alcove where weaker layers have eroded beneath a resistant cap bed, creating a sheltered recess. Not a cave system.',
    features: [
      { label: 'Resistant cap bed', text: 'A resistant bed forms the roof of the recess.', pos: [0, 0.55, 0.2] },
      { label: 'Sheltered floor', text: 'The recess floor is shaded and collects fine sediment.', pos: [0, -0.3, 0.3] },
    ],
    categories: ['subsurface', 'temperature'],
    inspectable: true,
    thermal: { absorb: 0.55, inertia: 0.9, material: 'Shaded bedrock' },
  },
  {
    id: 'dry-channel',
    name: 'Dry Drainage Channel',
    zone: 'sediment',
    pos: [-115, -95],
    specimen: 'channel',
    description: 'An ephemeral channel cut into basin sediments; its floor holds rounded cobbles and cross-bedded sand.',
    features: [
      { label: 'Rounded cobbles', text: 'Cobbles are rounded, indicating transport by flowing water at some time.', pos: [0.35, 0.25, 0.1] },
      { label: 'Cross-bedding', text: 'Exposed channel banks show inclined cross-beds.', pos: [-0.4, 0.2, 0.3] },
      { label: 'Salt efflorescence', text: 'White salt efflorescence coats the lowest part of the channel floor.', pos: [0.0, 0.05, -0.45] },
    ],
    categories: ['water', 'geology'],
    inspectable: true,
    thermal: { absorb: 0.65, inertia: 0.5, material: 'Channel sediment' },
    spectral: 'PRELIMINARY: mixed lithics; surface salts present. Uncertain.',
  },
  {
    id: 'relay',
    name: 'Field Comms Relay',
    zone: 'camp',
    pos: [128, 168],
    specimen: 'none',
    description: 'Portable communications relay mast on a low knoll.',
    categories: ['operations'],
    inspectable: false,
    thermal: { absorb: 0.4, inertia: 0.2, material: 'Equipment' },
    interactLabel: 'Run communications link test',
  },
  {
    id: 'tent',
    name: 'Camp Shelter',
    zone: 'camp',
    pos: [-14, 150],
    specimen: 'none',
    description: 'Field shelter.',
    categories: ['temperature'],
    inspectable: false,
    thermal: { absorb: 0.5, inertia: 0.2, material: 'Fabric' },
    interactLabel: 'Rest (change time of day)',
  },
  {
    id: 'vehicle',
    name: 'Expedition Vehicle',
    zone: 'camp',
    pos: [14, 128],
    specimen: 'none',
    description: 'Field vehicle used for extraction.',
    categories: ['operations'],
    inspectable: false,
    thermal: { absorb: 0.5, inertia: 0.3, material: 'Vehicle' },
    interactLabel: 'Return to Mission Control',
  },
];

export const EARTH_POI_BY_ID = Object.fromEntries(EARTH_POIS.map((p) => [p.id, p])) as Record<string, EarthPOI>;

export const EARTH_TASKS: Task[] = [
  { id: 'inspect:playa-polygons', cat: 'geology', kind: 'field', label: 'Inspect the salt polygons', hint: 'Salt flat · walk to the beacon · press E' },
  { id: 'sample:playa-crust', cat: 'water', kind: 'field', label: 'Take a salt sample', hint: 'Salt flat · press E · Collect sample' },
  { id: 'scan:env:playa', cat: 'biology', kind: 'field', label: 'Measure UV and humidity', hint: 'Salt flat · press 6 · click' },
  { id: 'thermal:dark-gravel:day', cat: 'temperature', kind: 'field', label: 'Measure the dark gravel temperature', hint: 'Dark gravel · press 3 · aim · click' },
  { id: 'photo:yardang-major', cat: 'dust', kind: 'field', label: 'Photograph a wind-carved ridge', hint: 'Yardangs · press 1 · aim · click' },
  { id: 'scan:terrain:yardang', cat: 'terrain', kind: 'field', label: 'Make a 3D map of the yardangs', hint: 'Yardangs · press 4 · click' },
  { id: 'probe:sand', cat: 'operations', kind: 'field', label: 'Test how soft the sand is', hint: 'Sand ripples · press 7 · click' },
  { id: 'scan:gpr:sediment', cat: 'subsurface', kind: 'field', label: 'Look under the ground with radar', hint: 'Layered cliff · press 5 · click' },
];

export const EARTH_INTERP: Record<CategoryId, InterpSet> = {
  geology: {
    observation: 'Polygonal salt crust with raised rims; layered crust; bright salt-like spectra; lab result dominated by halite with minor sulfate.',
    options: [
      { id: 'g1', text: 'The playa surface is an evaporite crust dominated by chloride with minor sulfate; polygon rims reflect crust growth and cracking.', quality: 'supported', suggestedConfidence: 'Moderate' },
      { id: 'g2', text: 'The crust proves a permanent lake existed here for millions of years.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'g3', text: 'Composition cannot be determined from the data collected.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'Field-lab mineral proportions are approximate; formal XRD is needed.', good: true },
      { id: 'l2', text: 'No limitations — the analysis is definitive.', good: false },
    ],
  },
  terrain: {
    observation: 'LiDAR model shows streamlined ridges and corridors; slopes on yardang flanks exceed safe rover limits.',
    options: [
      { id: 't1', text: 'Yardang corridors are traversable, but flanks are steep hazards; routes should follow corridor axes.', quality: 'supported', suggestedConfidence: 'High' },
      { id: 't2', text: 'The whole field is impassable for any rover.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 't3', text: 'Terrain data is insufficient to draw conclusions.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'The scan covers a limited radius; it cannot be extrapolated to the whole basin.', good: true },
      { id: 'l2', text: 'Terrain on Mars will be identical to this field.', good: false },
    ],
  },
  temperature: {
    observation: 'Dark gravel was markedly warmer than salt crust by day; temperatures dropped strongly at night.',
    options: [
      { id: 'h1', text: 'Albedo and thermal inertia control surface temperature contrasts; the diurnal range is large in this arid, high-altitude basin.', quality: 'supported', suggestedConfidence: 'Moderate' },
      { id: 'h2', text: 'Qaidam temperatures match Mars surface temperatures.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'h3', text: 'No pattern can be identified.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'Readings are single-point, simulated values; a full diurnal series was not recorded.', good: true },
      { id: 'l2', text: 'Two readings fully characterise the site climate.', good: false },
    ],
  },
  water: {
    observation: 'Halite with hopper textures and fluid inclusions; rounded cobbles and cross-beds in a dry channel; salt efflorescence.',
    options: [
      { id: 'w1', text: 'Evaporites and channel deposits record past water activity and evaporation; no surface water was observed during this survey.', quality: 'supported', suggestedConfidence: 'Moderate' },
      { id: 'w2', text: 'Liquid water is currently present beneath the entire basin surface.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'w3', text: 'There is no evidence relating to water.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'Timing and duration of water activity were not determined (no dating).', good: true },
      { id: 'l2', text: 'The deposits prove water persisted continuously to the present.', good: false },
    ],
  },
  dust: {
    observation: 'Yardangs aligned with prevailing wind, blunt windward ends, grooves; ripples in corridors; measured gusty winds.',
    options: [
      { id: 'd1', text: 'Wind abrasion and deflation shaped the yardangs; their orientation records the prevailing wind direction.', quality: 'supported', suggestedConfidence: 'High' },
      { id: 'd2', text: 'The yardangs were carved mainly by flowing water.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'd3', text: 'Erosion processes cannot be inferred.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'Erosion rates were not measured; wind data covers a short window.', good: true },
      { id: 'l2', text: 'One wind reading defines the long-term wind regime.', good: false },
    ],
  },
  biology: {
    observation: 'High UV, very low humidity, hypersaline crust; illustrative assay suggests possible halophilic communities (low confidence).',
    options: [
      { id: 'b1', text: 'Evaporites are a plausible niche for halophilic microbes on Earth; the assay is inconclusive-to-suggestive and requires controls. This says nothing definitive about Mars.', quality: 'supported', suggestedConfidence: 'Low' },
      { id: 'b2', text: 'Because microbes may live here, life must exist on Mars too.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'b3', text: 'Biological evidence: absent.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'Simulated dataset; contamination controls limited; environmental similarity does not imply Martian life.', good: true },
      { id: 'l2', text: 'The assay confirms specific species.', good: false },
    ],
  },
  subsurface: {
    observation: 'GPR profile shows layered reflectors; erosional overhang forms a shallow sheltered recess (not a cave).',
    options: [
      { id: 's1', text: 'Subsurface layering continues below the surface; the overhang is a shallow erosional shelter, not an extensive cave.', quality: 'supported', suggestedConfidence: 'Moderate' },
      { id: 's2', text: 'A large cave network exists beneath the basin.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 's3', text: 'Subsurface structure is unknown.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'GPR interpretation is non-unique; profile is simulated and limited in depth.', good: true },
      { id: 'l2', text: 'GPR directly images rock types with certainty.', good: false },
    ],
  },
  operations: {
    observation: 'Salt crust had high bearing strength; loose sand had low bearing strength; relay link stable; flat playa site found.',
    options: [
      { id: 'o1', text: 'Crusted playa is favourable for wheeled mobility and siting; loose sand is a sinkage risk; comms relays need line-of-sight.', quality: 'supported', suggestedConfidence: 'Moderate' },
      { id: 'o2', text: 'Any surface is safe for rovers if driven slowly.', quality: 'overclaim', suggestedConfidence: 'High' },
      { id: 'o3', text: 'No operational lessons can be drawn.', quality: 'inconclusive', suggestedConfidence: 'Low' },
    ],
    limitations: [
      { id: 'l1', text: 'Tests used Earth gravity and a human operator on site; Mars has 0.38 g and long signal delays.', good: true },
      { id: 'l2', text: 'Earth trafficability tests transfer directly to Mars.', good: false },
    ],
  },
};
