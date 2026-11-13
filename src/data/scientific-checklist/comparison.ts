import type { CategoryId } from './categories';

export type StatementClass = 'similarity' | 'difference' | 'limitation';

export interface ComparisonStatement {
  id: string;
  cat: CategoryId;
  text: string;
  answer: StatementClass;
  why: string;
}

/** Statements the player must classify. Facts are general, well-established planetary-science knowledge. */
const ALL_STATEMENTS: ComparisonStatement[] = [
  { id: 'c1', cat: 'geology', text: 'Both sites contain sulfate- and/or chloride-bearing deposits associated with evaporation of water.', answer: 'similarity', why: 'Evaporite minerals occur in Qaidam and have been detected on Mars from orbit and by rovers.' },
  { id: 'c2', cat: 'geology', text: 'Martian bedrock is dominated by basaltic (mafic) compositions; Qaidam basin fill is mostly eroded continental sediment.', answer: 'difference', why: 'Source rocks differ: Mars has a largely basaltic crust.' },
  { id: 'c3', cat: 'terrain', text: 'Both landscapes contain wind-streamlined ridges (yardangs or yardang-like forms).', answer: 'similarity', why: 'Yardangs occur in Qaidam and in several regions of Mars.' },
  { id: 'c4', cat: 'terrain', text: 'A rover on Mars experiences 0.38 g, which changes traction and sinkage behaviour versus Earth tests.', answer: 'difference', why: 'Lower gravity alters wheel–soil interaction.' },
  { id: 'c5', cat: 'temperature', text: 'Both are cold, arid environments with large day–night temperature swings.', answer: 'similarity', why: 'High altitude and dry air give Qaidam large diurnal ranges; Mars too.' },
  { id: 'c6', cat: 'temperature', text: 'Mean Martian surface temperature (around −60 °C) is far below Qaidam’s.', answer: 'difference', why: 'Mars is much colder on average.' },
  { id: 'c7', cat: 'water', text: 'Liquid water is not stable at the Martian surface under present average pressure and temperature, unlike on Earth.', answer: 'difference', why: 'Mars’ thin atmosphere (~0.6% of Earth’s sea-level pressure) prevents stable surface liquid water in most places.' },
  { id: 'c8', cat: 'water', text: 'Evaporites at both sites can record past water and evaporation.', answer: 'similarity', why: 'Evaporite formation requires water that later evaporated.' },
  { id: 'c9', cat: 'dust', text: 'At the same wind speed, Martian wind exerts far less force because the atmosphere is about 100× less dense.', answer: 'difference', why: 'Dynamic pressure scales with air density.' },
  { id: 'c10', cat: 'dust', text: 'Dust accumulation on equipment is an operational hazard at both sites.', answer: 'similarity', why: 'Dust degrades optics, mechanisms and solar panels in both settings.' },
  { id: 'c11', cat: 'biology', text: 'Microbes found in Qaidam salts do not demonstrate that life exists or existed on Mars.', answer: 'limitation', why: 'Analogues test methods and hypotheses; they do not prove Martian life.' },
  { id: 'c12', cat: 'biology', text: 'Mars’ surface UV and ionising radiation are much harsher than in Qaidam (Mars lacks a thick atmosphere, ozone layer and global magnetic field).', answer: 'difference', why: 'Radiation environment is a key habitability difference.' },
  { id: 'c13', cat: 'subsurface', text: 'Both sites expose layered sediments that continue below the surface.', answer: 'similarity', why: 'GPR and outcrops show subsurface layering in both cases.' },
  { id: 'c14', cat: 'subsurface', text: 'Qaidam’s erosional overhang is not a meaningful analogue for Martian lava tubes.', answer: 'limitation', why: 'Different origin (erosion vs volcanic); the comparison breaks down here.' },
  { id: 'c15', cat: 'operations', text: 'Earth field teams can react instantly; Mars operations face multi-minute one-way signal delays.', answer: 'difference', why: 'Light-time delay ranges from roughly 3 to 22 minutes one-way.' },
  { id: 'c16', cat: 'operations', text: 'Earth analogue tests cannot reproduce Mars gravity, atmosphere and radiation simultaneously.', answer: 'limitation', why: 'Analogues represent selected aspects only.' },
];

/** The 8 statements shown to the player — one per category, mixed answers. */
export const COMPARISON_STATEMENTS: ComparisonStatement[] = ['c1', 'c3', 'c6', 'c7', 'c9', 'c11', 'c14', 'c15'].map((id) => ALL_STATEMENTS.find((x) => x.id === id)!);

export interface Application {
  id: string;
  text: string;
  valid: boolean;
  lunar: boolean; // also relevant to permanent lunar-base planning
}

export const APPLICATIONS: Application[] = [
  { id: 'a1', text: 'Test rover wheel designs and slip-detection on loose sand vs crusted surfaces.', valid: true, lunar: true },
  { id: 'a2', text: 'Rehearse delay-tolerant operations and autonomous navigation workflows.', valid: true, lunar: true },
  { id: 'a3', text: 'Calibrate spectral instruments on known evaporite minerals before flight.', valid: true, lunar: false },
  { id: 'a4', text: 'Develop dust-mitigation for solar panels, optics and seals.', valid: true, lunar: true },
  { id: 'a5', text: 'Practise contamination-controlled sampling protocols for biosignature work.', valid: true, lunar: false },
  { id: 'a6', text: 'Use thermal-inertia mapping to locate bedrock vs loose regolith for construction sites.', valid: true, lunar: true },
  { id: 'a7', text: 'Prove that astronauts can breathe the Martian atmosphere.', valid: false, lunar: false },
  { id: 'a8', text: 'Skip Mars landing-site reconnaissance because Qaidam is an exact Mars replica.', valid: false, lunar: false },
];
