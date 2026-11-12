import { useGame, type KeyAction } from './store';

export const keys = new Set<string>();
let installed = false;

export function installInput() {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    // Prevent browser defaults for game keys (Tab focus, Space scroll)
    if (['Tab', 'Space'].includes(e.code) && !(e.target as HTMLElement)?.closest?.('input,textarea,select')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

export function isDown(a: KeyAction) {
  const code = useGame.getState().settings.keys[a];
  if (a === 'sprint') return keys.has(code) || keys.has('ShiftRight');
  return keys.has(code);
}

export function matches(e: KeyboardEvent, a: KeyAction) {
  return e.code === useGame.getState().settings.keys[a];
}

export function keyLabel(code: string) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = { ShiftLeft: 'Shift', ShiftRight: 'R-Shift', Space: 'Space', Tab: 'Tab', ControlLeft: 'Ctrl', AltLeft: 'Alt', Escape: 'Esc' };
  return map[code] ?? code;
}

export function isTyping(e: Event) {
  const t = e.target as HTMLElement;
  return !!t?.closest?.('input,textarea,select,[contenteditable=true]');
}
