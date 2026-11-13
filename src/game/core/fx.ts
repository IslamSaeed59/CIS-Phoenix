import { create } from 'zustand';
import { audio } from './audio';

/** Camera zoom used by the photo effect (read every frame by the Earth player camera and the rover feed). */
export const fxState = { zoom: 0, zoomTarget: 0 };

export interface PhotoFX { id: number; thumb: string; label: string }
export interface BannerFX { id: number; title: string; sub: string; stars: number }

let seq = 1;
export const useFX = create<{ photo: PhotoFX | null; banner: BannerFX | null; bannerQueue: BannerFX[] }>()(() => ({ photo: null, banner: null, bannerQueue: [] }));

/** Zoom in, run `capture` at full zoom, then show shutter/flash and the flying photo. */
export function photoWithFX(capture: () => { thumb: string; label: string } | null) {
  fxState.zoomTarget = 1;
  audio.servo(0.15);
  setTimeout(() => {
    const r = capture();
    setTimeout(() => { fxState.zoomTarget = 0; }, 250);
    if (!r) return;
    const p: PhotoFX = { id: seq++, thumb: r.thumb, label: r.label };
    useFX.setState({ photo: p });
    setTimeout(() => { if (useFX.getState().photo?.id === p.id) useFX.setState({ photo: null }); }, 2000);
  }, 300);
}

export function celebrate(title: string, sub: string, stars = 3) {
  const b: BannerFX = { id: seq++, title, sub, stars };
  const s = useFX.getState();
  if (s.banner) useFX.setState({ bannerQueue: [...s.bannerQueue, b] });
  else showBanner(b);
}

function showBanner(b: BannerFX) {
  useFX.setState({ banner: b });
  [523, 659, 784, 1046].forEach((f, i) => audio.tone(f, 0.22, 'triangle', 0.07, undefined, i * 0.12));
  setTimeout(() => [784, 1046].forEach((f, i) => audio.tone(f, 0.4, 'sine', 0.06, undefined, i * 0.08)), 700);
}

export function closeBanner() {
  const q = useFX.getState().bannerQueue;
  if (q.length) { useFX.setState({ bannerQueue: q.slice(1) }); showBanner(q[0]); }
  else useFX.setState({ banner: null });
}
