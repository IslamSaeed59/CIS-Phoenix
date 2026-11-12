import { runtime } from '../player/PlayerController';
import { useUI, fadeTo, wait, toast } from '../core/ui';
import { audio } from '../core/audio';

let busy = false;

/** Quick travel with the field vehicle: fade out, move next to the target, face it, fade in. */
export async function travelTo(target: [number, number], place: string) {
  if (busy) return;
  const dx = target[0] - runtime.pos.x, dz = target[1] - runtime.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 25) { toast('Already close', 'Your goal is right here — follow the cyan light.', 'info'); return; }
  busy = true;
  useUI.getState().setPanel(null);
  audio.ui('confirm');
  await fadeTo(1, 450);
  // Stop ~9 m short of the target, on the side we came from
  const stop = 9;
  runtime.pos.x = target[0] - (dx / d) * stop;
  runtime.pos.z = target[1] - (dz / d) * stop;
  runtime.pos.y = 0;
  runtime.yaw = Math.atan2(-dx, -dz);
  runtime.pitch = -0.08;
  await wait(250);
  await fadeTo(0, 550);
  toast('Arrived', place, 'info');
  busy = false;
}
