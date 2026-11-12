import { create } from 'zustand';
import { audio } from './audio';
import { useGame } from './store';

export type Panel = null | 'tablet' | 'pause' | 'inspect' | 'photoTag' | 'rest';
export type TabletTab = 'checklist' | 'journal' | 'map' | 'lab' | 'scans' | 'gallery';
export type ToolId = 'camera' | 'spectral' | 'thermal' | 'lidar' | 'gpr' | 'env' | 'probe';

export interface RadioMsg { id: number; from: string; text: string; level: 'info' | 'warn' | 'alert'; t: number }
export interface Toast { id: number; title: string; text?: string; kind: 'evidence' | 'info' | 'warn' | 'complete' }

interface UIState {
  panel: Panel;
  tabletTab: TabletTab;
  tool: ToolId;
  toolRaised: boolean;
  thirdPerson: boolean;
  prompt: string | null;
  inspectPoi: string | null;
  lastPhotoId: number | null;
  radio: RadioMsg[];
  radioLog: RadioMsg[];
  toasts: Toast[];
  fade: number; // 0..1 black overlay
  locked: boolean;
  scanBusy: boolean;
  readout: { title: string; lines: string[]; t: number } | null;
  setPanel: (p: Panel) => void;
  setTabletTab: (t: TabletTab) => void;
  setTool: (t: ToolId) => void;
  setRaised: (b: boolean) => void;
  setThird: (b: boolean) => void;
  setPrompt: (p: string | null) => void;
  setInspect: (id: string | null) => void;
  setFade: (f: number) => void;
  setLocked: (b: boolean) => void;
  setScanBusy: (b: boolean) => void;
  setReadout: (r: UIState['readout']) => void;
  setLastPhoto: (id: number | null) => void;
}

let seq = 1;
export const useUI = create<UIState>()((set) => ({
  panel: null,
  tabletTab: 'checklist',
  tool: 'camera',
  toolRaised: false,
  thirdPerson: false,
  prompt: null,
  inspectPoi: null,
  lastPhotoId: null,
  radio: [],
  radioLog: [],
  toasts: [],
  fade: 0,
  locked: false,
  scanBusy: false,
  readout: null,
  setPanel: (p) => set({ panel: p }),
  setTabletTab: (t) => set({ tabletTab: t }),
  setTool: (t) => set({ tool: t }),
  setRaised: (b) => set({ toolRaised: b }),
  setThird: (b) => set({ thirdPerson: b }),
  setPrompt: (p) => set((s) => (s.prompt === p ? s : { prompt: p })),
  setInspect: (id) => set({ inspectPoi: id }),
  setFade: (f) => set({ fade: f }),
  setLocked: (b) => set({ locked: b }),
  setScanBusy: (b) => set({ scanBusy: b }),
  setReadout: (r) => set({ readout: r }),
  setLastPhoto: (id) => set({ lastPhotoId: id }),
}));

/** Mission Control radio transmission (subtitled, optional synthesized voice). */
export function radio(from: string, text: string, level: RadioMsg['level'] = 'info', speak = true) {
  const msg: RadioMsg = { id: seq++, from, text, level, t: Date.now() };
  audio.radio();
  if (speak) {
    audio.voiceEnabled = useGame.getState().settings.voice;
    setTimeout(() => audio.speak(text), 250);
  }
  useUI.setState((s) => ({ radio: [...s.radio, msg].slice(-3), radioLog: [msg, ...s.radioLog].slice(0, 80) }));
  const dur = Math.min(14000, 4500 + text.length * 55);
  setTimeout(() => useUI.setState((s) => ({ radio: s.radio.filter((m) => m.id !== msg.id) })), dur);
}

export function toast(title: string, text?: string, kind: Toast['kind'] = 'info') {
  const t: Toast = { id: seq++, title, text, kind };
  useUI.setState((s) => ({ toasts: [...s.toasts, t].slice(-4) }));
  if (kind === 'evidence' || kind === 'complete') audio.ui('confirm');
  else if (kind === 'warn') audio.warning();
  setTimeout(() => useUI.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), kind === 'complete' ? 6000 : 4200);
}

export async function fadeTo(target: number, ms = 800) {
  const start = useUI.getState().fade;
  const t0 = performance.now();
  return new Promise<void>((res) => {
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      useUI.getState().setFade(start + (target - start) * k);
      if (k < 1) requestAnimationFrame(step);
      else res();
    };
    step();
  });
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Developer hook (only with ?dev=1) for automated playtesting.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev')) {
  (window as any).__pd = { useGame, useUI };
}
