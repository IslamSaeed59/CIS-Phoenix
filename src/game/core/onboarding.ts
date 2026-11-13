// First-time flow: Intro → Hardware assessment → Controls tutorial → Briefing → Qaidam.
// Returning players skip what they've already done; both can be replayed from Settings.
import { useGame, type Phase } from './store';
import { useUI, fadeTo } from './ui';

let returnTo: Phase | null = null;

function go(p: Phase) {
  useUI.getState().setPanel(null);
  useGame.getState().setPhase(p);
  fadeTo(0, 700);
}

export function afterIntro() {
  const s = useGame.getState().settings;
  go(!s.assessDone ? 'assess' : !s.tutorialDone ? 'tutorial' : 'briefing');
}

export function afterAssess() {
  if (returnTo) { const p = returnTo; returnTo = null; go(p); return; }
  go(useGame.getState().settings.tutorialDone ? 'briefing' : 'tutorial');
}

export function afterTutorial() {
  useGame.getState().setSettings({ tutorialDone: true });
  if (returnTo) { const p = returnTo; returnTo = null; go(p); return; }
  go('briefing');
}

/** Replay the tutorial or re-run the assessment from Settings, then come back here. */
export async function replay(kind: 'tutorial' | 'assess') {
  const cur = useGame.getState().phase;
  returnTo = cur === 'tutorial' || cur === 'assess' || cur === 'intro' ? 'menu' : cur;
  await fadeTo(1, 500);
  go(kind);
}
