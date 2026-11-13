// Lightweight performance monitoring. Frame deltas are recorded from inside the render loop (so a
// frame-rate cap is respected) and evaluated every few seconds with a stability threshold + cooldown.
import { create } from 'zustand';
import { useGame } from './store';
import { stepDown } from './graphics';
import { toast } from './ui';

const samples: number[] = [];
let lastFrame = 0;
let phaseStart = performance.now();
let lowWindows = 0;
let cooldownUntil = 0;

export const usePerf = create<{ fps: number; p95: number; notice: null | { what: string } }>()(() => ({ fps: 0, p95: 0, notice: null }));

/** Called once per rendered frame by GameCanvas. */
export function recordFrame(now: number) {
  if (lastFrame) {
    const d = now - lastFrame;
    if (d > 0 && d < 250) samples.push(d); // ignore tab switches / long stalls
    if (samples.length > 600) samples.splice(0, samples.length - 600);
  }
  lastFrame = now;
}

export function resetPerfWindow() {
  samples.length = 0;
  lastFrame = 0;
  lowWindows = 0;
  phaseStart = performance.now();
}

/** Don't touch settings during cinematics or for the first seconds after a scene loads. */
const blocked = { cinematic: false };
export function setCinematic(b: boolean) { blocked.cinematic = b; }

export function applyOptimizationStep() {
  const g = useGame.getState();
  const step = stepDown(g.settings.gfx);
  usePerf.setState({ notice: null });
  if (!step) { toast('Already at lowest settings', 'Close other apps or browser tabs for more speed.', 'info'); return; }
  g.applyGfx(step.next);
  cooldownUntil = performance.now() + 60000;
  resetPerfWindow();
  toast('Graphics optimized', step.what, 'info');
}

export function dismissNotice() {
  usePerf.setState({ notice: null });
  cooldownUntil = performance.now() + 5 * 60000;
}

function evaluate() {
  if (document.hidden || samples.length < 60) return;
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const fps = 1000 / avg;
  usePerf.setState({ fps, p95 });
  samples.length = 0;

  const g = useGame.getState();
  const phase = g.phase;
  const now = performance.now();
  if (!['earth', 'hq', 'tutorial'].includes(phase) || blocked.cinematic) { lowWindows = 0; return; }
  if (now - phaseStart < 10000 || now < cooldownUntil || usePerf.getState().notice) return;
  const gfx = g.settings.gfx;
  const target = gfx.fpsLimit ? Math.min(gfx.fpsLimit, gfx.targetFps) : gfx.targetFps;
  const struggling = fps < target * 0.75 || p95 > (1000 / target) * 2.2;
  lowWindows = struggling ? lowWindows + 1 : 0;
  if (lowWindows < 2) return; // needs two consecutive bad windows (~12 s)
  lowWindows = 0;
  const step = stepDown(gfx);
  if (!step) return;
  if (g.settings.gfxAuto && !g.settings.gfxCustom) applyOptimizationStep();
  else usePerf.setState({ notice: { what: step.what } });
}

let started = false;
export function startPerfMonitor() {
  if (started) return;
  started = true;
  setInterval(evaluate, 6000);
  useGame.subscribe((s, prev) => { if (s.phase !== prev.phase) resetPerfWindow(); });
}
