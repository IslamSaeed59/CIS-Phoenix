// First-person action animations (kneel to inspect, pick up a sample, push the probe into the ground).
import { audio } from '../core/audio';

export type FPAnimType = 'kneel' | 'pickup' | 'probe';

export const fpAnim = {
  type: null as FPAnimType | null,
  t0: 0,
  dur: 1,
  pitch0: 0,
  onDone: null as null | (() => void),
};

/** 0..1 progress of the running animation, or -1 when idle. */
export function fpProgress(now = performance.now()) {
  if (!fpAnim.type) return -1;
  return Math.min(1, (now - fpAnim.t0) / fpAnim.dur);
}

export function playFP(type: FPAnimType, durMs: number, pitch0: number, onDone?: () => void) {
  if (fpAnim.type) return false;
  fpAnim.type = type;
  fpAnim.t0 = performance.now();
  fpAnim.dur = durMs;
  fpAnim.pitch0 = pitch0;
  fpAnim.onDone = onDone ?? null;
  if (type === 'pickup') {
    audio.footstep('gravel');
    setTimeout(() => audio.noiseBurst(0.25, 2600, 1.2, 0.12, 'bandpass'), durMs * 0.42);
    setTimeout(() => { audio.tone(880, 0.08, 'sine', 0.05); audio.tone(1320, 0.12, 'sine', 0.05, undefined, 0.08); }, durMs * 0.62);
  } else if (type === 'probe') {
    setTimeout(() => audio.thud(), durMs * 0.45);
  } else {
    audio.footstep('gravel');
  }
  return true;
}

/** Called every frame by the player controller; finishes the animation when done. */
export function tickFP() {
  const k = fpProgress();
  if (k >= 1) {
    const cb = fpAnim.onDone;
    fpAnim.type = null;
    fpAnim.onDone = null;
    cb?.();
  }
}

/** Crouch amount 0..1 for the current animation. */
export function crouch(k: number, type: FPAnimType | null) {
  if (!type || k < 0) return 0;
  if (type === 'kneel') return Math.sin(Math.min(1, k) * Math.PI * 0.5); // stays down (panel opens at end)
  return Math.sin(k * Math.PI); // down then back up
}
