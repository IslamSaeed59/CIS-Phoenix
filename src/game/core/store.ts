import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CATEGORIES, type CategoryId, type Status, type Task } from '../../data/scientific-checklist/categories';
import { EARTH_INTERP, EARTH_TASKS } from '../../data/earth/earthData';
import { MARS_INTERP, MARS_TASKS } from '../../data/mars/marsData';
import { APPLICATIONS, COMPARISON_STATEMENTS, type StatementClass } from '../../data/scientific-checklist/comparison';
import { PRESETS, type Gfx, type Preset } from './graphics';
import type { HardwareReport } from './hardware';

const DEFAULT_GFX_SETTINGS = {
  gfx: { ...PRESETS.medium },
  gfxAuto: true,
  gfxCustom: false,
  recommended: null as Gfx | null,
  hw: null as HardwareReport | null,
  assessDone: false,
  tutorialDone: false,
};

export type World = 'earth' | 'mars';
export type Phase = 'menu' | 'intro' | 'assess' | 'tutorial' | 'briefing' | 'earth' | 'toHQ' | 'hq' | 'ending';

export interface EvidenceRecord {
  key: string;
  time: number;
  instrument: string;
  location: string;
  summary: string;
}
export interface Photo {
  id: number;
  world: World;
  thumb: string;
  time: number;
  pos: [number, number];
  location: string;
  pois: string[];
  category: CategoryId | null;
  caption: string;
  important: boolean;
  instrument: string;
  status: 'Awaiting analysis' | 'Reviewed' | 'Downlinked';
  onboard?: boolean; // mars: still in rover storage
}
export interface Sample {
  id: string;
  poi: string;
  name: string;
  time: number;
  location: string;
  lab: 'none' | 'running' | 'done';
  bio: 'none' | 'running' | 'done';
}
export interface ThermalReading {
  world: World;
  poi: string;
  material: string;
  tempC: number;
  day: boolean;
  time: number;
}
export interface ScanRecord {
  id: string;
  world: World;
  kind: 'terrain' | 'gpr' | 'wind' | 'env' | 'spectral' | 'multispec' | 'spectro' | 'probe';
  zone: string;
  pos: [number, number];
  data: Record<string, any>;
  time: number;
}
export interface JournalEntry {
  id: number;
  world: World | 'hq';
  time: number;
  title: string;
  text: string;
  kind: 'observation' | 'interpretation' | 'event' | 'sample' | 'photo' | 'scan' | 'lab';
  cat?: CategoryId;
}
export interface Interp {
  optionId: string;
  confidence: 'Low' | 'Moderate' | 'High';
  limitationId: string;
  note: string;
}
export type KeyAction =
  | 'forward' | 'back' | 'left' | 'right' | 'sprint' | 'interact' | 'scanner' | 'camera' | 'journal' | 'map' | 'checklist'
  | 'brake' | 'diagnostics';

export const DEFAULT_KEYS: Record<KeyAction, string> = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', interact: 'KeyE', scanner: 'KeyF',
  camera: 'KeyC', journal: 'KeyJ', map: 'KeyM', checklist: 'Tab', brake: 'Space', diagnostics: 'KeyR',
};

export interface Settings {
  quality: Preset; // terrain mesh detail (kept in sync with gfx.terrain)
  sensitivity: number;
  volume: number;
  voice: boolean;
  invertY: boolean;
  fov: number;
  keys: Record<KeyAction, string>;
  subtitles: boolean;
  gfx: Gfx;
  gfxAuto: boolean; // let the game lower settings automatically when performance drops
  gfxCustom: boolean; // player changed settings manually — never overwrite silently
  recommended: Gfx | null; // what the hardware assessment recommended
  hw: HardwareReport | null;
  assessDone: boolean;
  tutorialDone: boolean;
}

interface GameState {
  phase: Phase;
  checkpoint: Phase;
  started: boolean;
  missionStart: number;
  settings: Settings;
  earthEvidence: Record<string, EvidenceRecord>;
  marsEvidence: Record<string, EvidenceRecord>;
  earthInterp: Partial<Record<CategoryId, Interp>>;
  marsInterp: Partial<Record<CategoryId, Interp>>;
  inspectClass: Record<string, CategoryId>; // poi -> category chosen during inspection
  earthTime: 'day' | 'night';
  playerPos: [number, number, number] | null;
  photos: Photo[];
  photoSeq: number;
  samples: Sample[];
  thermal: ThermalReading[];
  scans: ScanRecord[];
  journal: JournalEntry[];
  journalSeq: number;
  hqVisited: boolean;
  marsStarted: boolean;
  classified: Record<string, StatementClass>;
  apps: string[];
  simsRun: string[];
  reportSubmitted: boolean;
  completedOnce: boolean;
  stars: Record<string, number>;
  addStar: (key: string) => void;

  setPhase: (p: Phase) => void;
  newGame: () => void;
  setSettings: (s: Partial<Settings>) => void;
  applyGfx: (g: Gfx, opts?: { custom?: boolean }) => void;
  addEvidence: (w: World, rec: Omit<EvidenceRecord, 'time'>) => boolean;
  setInterp: (w: World, cat: CategoryId, i: Interp) => void;
  setInspectClass: (poi: string, cat: CategoryId) => void;
  setEarthTime: (t: 'day' | 'night') => void;
  addPhoto: (p: Omit<Photo, 'id' | 'time'>) => Photo;
  updatePhoto: (id: number, patch: Partial<Photo>) => void;
  deletePhoto: (id: number) => void;
  addSample: (s: Omit<Sample, 'time' | 'lab' | 'bio'>) => boolean;
  updateSample: (id: string, patch: Partial<Sample>) => void;
  addThermal: (t: Omit<ThermalReading, 'time'>) => void;
  addScan: (s: Omit<ScanRecord, 'time' | 'id'>) => ScanRecord;
  addJournal: (j: Omit<JournalEntry, 'id' | 'time'>) => void;
  setPlayerPos: (p: [number, number, number]) => void;
  classify: (id: string, c: StatementClass) => void;
  toggleApp: (id: string) => void;
  runSim: (id: string) => void;
  submitReport: () => void;
  devFill: (w: World) => void;
}

const now = () => Date.now();

const initialProgress = () => ({
  earthEvidence: {},
  marsEvidence: {},
  earthInterp: {},
  marsInterp: {},
  inspectClass: {},
  earthTime: 'day' as const,
  playerPos: null,
  photos: [],
  photoSeq: 1,
  samples: [],
  thermal: [],
  scans: [],
  journal: [],
  journalSeq: 1,
  hqVisited: false,
  marsStarted: false,
  classified: {},
  apps: [],
  simsRun: [],
  reportSubmitted: false,
  stars: {} as Record<string, number>,
});

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'menu',
      started: false,
      missionStart: now(),
      completedOnce: false,
      settings: {
        quality: 'medium',
        sensitivity: 1,
        volume: 0.8,
        voice: true,
        invertY: false,
        fov: 70,
        keys: { ...DEFAULT_KEYS },
        subtitles: true,
        ...DEFAULT_GFX_SETTINGS,
      },
      ...initialProgress(),

      checkpoint: 'intro',
      setPhase: (p) => set(p === 'menu' || p === 'intro' || p === 'ending' || p === 'assess' || p === 'tutorial' ? { phase: p } : { phase: p, checkpoint: p }),
      newGame: () => set({ ...initialProgress(), started: true, missionStart: now(), phase: 'intro' }),
      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      applyGfx: (g, opts) => set({ settings: { ...get().settings, gfx: { ...g }, quality: g.terrain, gfxCustom: opts?.custom ?? get().settings.gfxCustom } }),
      addEvidence: (w, rec) => {
        const k = w === 'earth' ? 'earthEvidence' : 'marsEvidence';
        const cur = get()[k];
        if (cur[rec.key]) return false;
        set({ [k]: { ...cur, [rec.key]: { ...rec, time: now() } } } as any);
        return true;
      },
      setInterp: (w, cat, i) => {
        const k = w === 'earth' ? 'earthInterp' : 'marsInterp';
        set({ [k]: { ...get()[k], [cat]: i } } as any);
      },
      setInspectClass: (poi, cat) => set({ inspectClass: { ...get().inspectClass, [poi]: cat } }),
      setEarthTime: (t) => set({ earthTime: t }),
      addPhoto: (p) => {
        const photo: Photo = { ...p, id: get().photoSeq, time: now() };
        set({ photos: [...get().photos, photo].slice(-60), photoSeq: get().photoSeq + 1 });
        return photo;
      },
      updatePhoto: (id, patch) => set({ photos: get().photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
      deletePhoto: (id) => set({ photos: get().photos.filter((p) => p.id !== id) }),
      addSample: (s) => {
        if (get().samples.find((x) => x.id === s.id)) return false;
        set({ samples: [...get().samples, { ...s, time: now(), lab: 'none', bio: 'none' }] });
        return true;
      },
      updateSample: (id, patch) => set({ samples: get().samples.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
      addThermal: (t) => set({ thermal: [...get().thermal, { ...t, time: now() }] }),
      addScan: (s) => {
        const rec: ScanRecord = { ...s, id: `${s.world[0].toUpperCase()}-${s.kind.toUpperCase()}-${String(get().scans.length + 1).padStart(3, '0')}`, time: now() };
        set({ scans: [...get().scans, rec] });
        return rec;
      },
      addJournal: (j) => set({ journal: [{ ...j, id: get().journalSeq, time: now() }, ...get().journal].slice(0, 300), journalSeq: get().journalSeq + 1 }),
      setPlayerPos: (p) => set({ playerPos: p }),
      classify: (id, c) => set({ classified: { ...get().classified, [id]: c } }),
      toggleApp: (id) => {
        const a = get().apps;
        set({ apps: a.includes(id) ? a.filter((x) => x !== id) : [...a, id] });
      },
      runSim: (id) => { if (!get().simsRun.includes(id)) set({ simsRun: [...get().simsRun, id] }); },
      addStar: (key) => { if (!get().stars[key]) set({ stars: { ...get().stars, [key]: 1 } }); },
      submitReport: () => set({ reportSubmitted: true, completedOnce: true }),
      devFill: (w) => {
        const tasks = w === 'earth' ? EARTH_TASKS : MARS_TASKS;
        const ev: Record<string, EvidenceRecord> = {};
        tasks.forEach((t) => (ev[t.id] = { key: t.id, time: now(), instrument: 'DEV', location: 'DEV', summary: 'Filled by developer chapter select' }));
        const interpSet = w === 'earth' ? EARTH_INTERP : MARS_INTERP;
        const interp: any = {};
        CATEGORIES.forEach((c) => {
          const o = interpSet[c.id].options[0];
          interp[c.id] = { optionId: o.id, confidence: o.suggestedConfidence, limitationId: 'l1', note: '' };
        });
        if (w === 'earth') set({ earthEvidence: ev, earthInterp: interp, started: true });
        else set({ marsEvidence: ev, marsInterp: interp, marsStarted: true, hqVisited: true });
      },
    }),
    {
      name: 'pd2077-save-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { phase, ...rest } = s as any;
        return rest;
      },
      // Older saves don't have the newer settings fields — merge them with defaults instead of replacing.
      merge: (persisted: any, current) => ({
        ...current,
        ...(persisted ?? {}),
        settings: { ...current.settings, ...(persisted?.settings ?? {}), keys: { ...current.settings.keys, ...(persisted?.settings?.keys ?? {}) } },
      }),
    },
  ),
);

// ---------------- Derived helpers ----------------
export const tasksFor = (w: World): Task[] => (w === 'earth' ? EARTH_TASKS : MARS_TASKS);
export const interpFor = (w: World) => (w === 'earth' ? EARTH_INTERP : MARS_INTERP);

export function catTasks(w: World, cat: CategoryId) {
  return tasksFor(w).filter((t) => t.cat === cat);
}

export function catStatus(w: World, cat: CategoryId, s = useGame.getState()): Status {
  const ev = w === 'earth' ? s.earthEvidence : s.marsEvidence;
  const interp = (w === 'earth' ? s.earthInterp : s.marsInterp)[cat];
  const tasks = catTasks(w, cat);
  const done = tasks.filter((t) => ev[t.id]);
  if (done.length === tasks.length && interp) return 'COMPLETED';
  if (done.length === 0) return 'NOT STARTED';
  const field = tasks.filter((t) => t.kind === 'field');
  const fieldDone = field.every((t) => ev[t.id]);
  if (fieldDone) {
    const analysisDone = tasks.filter((t) => t.kind === 'analysis').every((t) => ev[t.id]);
    return analysisDone ? 'EVIDENCE COLLECTED' : 'ANALYSIS REQUIRED';
  }
  return 'IN PROGRESS';
}

export function worldProgress(w: World, s = useGame.getState()) {
  const statuses = CATEGORIES.map((c) => catStatus(w, c.id, s));
  const completed = statuses.filter((x) => x === 'COMPLETED').length;
  const ev = w === 'earth' ? s.earthEvidence : s.marsEvidence;
  const tasks = tasksFor(w);
  const uniqueIds = [...new Set(tasks.map((t) => t.id))];
  const tasksDone = uniqueIds.filter((id) => ev[id]).length;
  return { completed, total: CATEGORIES.length, tasksDone, tasksTotal: uniqueIds.length, done: completed === CATEGORIES.length };
}

export function comparisonProgress(s = useGame.getState()) {
  const classified = COMPARISON_STATEMENTS.filter((c) => s.classified[c.id]).length;
  return {
    classified,
    total: COMPARISON_STATEMENTS.length,
    sims: s.simsRun.length,
    apps: s.apps.length,
    ready: classified === COMPARISON_STATEMENTS.length,
  };
}

export function scienceScore(s = useGame.getState()) {
  let interp = 0, interpMax = 0;
  (['earth', 'mars'] as World[]).forEach((w) => {
    const set = interpFor(w);
    const chosen = w === 'earth' ? s.earthInterp : s.marsInterp;
    CATEGORIES.forEach((c) => {
      interpMax += 16;
      const i = chosen[c.id];
      if (!i) return;
      const opt = set[c.id].options.find((o) => o.id === i.optionId);
      const lim = set[c.id].limitations.find((l) => l.id === i.limitationId);
      if (opt?.quality === 'supported') interp += 10;
      else if (opt?.quality === 'inconclusive') interp += 4;
      if (opt && i.confidence === opt.suggestedConfidence && opt.quality !== 'overclaim') interp += 3;
      if (lim?.good) interp += 3;
    });
  });
  let comp = 0;
  const compMax = COMPARISON_STATEMENTS.length * 3 + APPLICATIONS.filter((a) => a.valid).length * 2 + 32;
  COMPARISON_STATEMENTS.forEach((c) => { if (s.classified[c.id] === c.answer) comp += 3; });
  comp += Object.keys(s.stars).length; // stars from discoveries
  s.apps.forEach((id) => {
    const a = APPLICATIONS.find((x) => x.id === id);
    comp += a?.valid ? 2 : -2;
  });
  const evidence = s.photos.length + s.scans.length + s.thermal.length + s.samples.length;
  const total = Math.max(0, Math.round(((interp + comp) / (interpMax + compMax)) * 100));
  const grade = total >= 90 ? 'EXEMPLARY' : total >= 75 ? 'COMMENDED' : total >= 55 ? 'SATISFACTORY' : 'NEEDS REVIEW';
  return { interp, interpMax, comp, compMax, evidence, total, grade };
}

/** Where "Continue" resumes, derived from progress. */
export function resumePhase(s = useGame.getState()): Phase {
  if (!s.started) return 'intro';
  if (s.reportSubmitted) return 'hq';
  if (worldProgress('earth', s).done && s.hqVisited) return 'hq';
  if (s.checkpoint === 'hq' || s.checkpoint === 'toHQ') return 'hq';
  if (s.checkpoint === 'earth') return 'earth';
  return 'briefing';
}
