// Interactive controls tutorial: every task is completed by doing the real action with the real controls.
import { create } from 'zustand';
import { audio } from '../core/audio';
import { rover } from '../rover/roverSim';

export interface TutTask { id: string; label: string }
export interface TutStep {
  id: string;
  title: string;
  instr: string;
  keys: string[]; // key codes shown as animated key caps
  mouse?: 'look' | 'click' | 'scroll';
  tasks: TutTask[];
  hint: string;
}

export const TUT_STEPS: TutStep[] = [
  {
    id: 'move', title: 'WALK', instr: 'Walk to the light', keys: ['KeyW', 'KeyA', 'KeyS', 'KeyD'], mouse: 'look',
    tasks: [{ id: 'reach', label: 'Reach the light' }],
    hint: 'Hold W to walk. Move the mouse to turn.',
  },
  {
    id: 'science', title: 'EXPLORE', instr: 'Check out the rock', keys: ['Digit1', 'KeyE'], mouse: 'click',
    tasks: [{ id: 'photo', label: 'Press 1, aim at the rock, click' }, { id: 'sample', label: 'Walk up and press E' }],
    hint: 'Put the rock in the middle of the screen, then click.',
  },
  {
    id: 'nav', title: 'MAP', instr: 'Open the map, then teleport', keys: ['KeyM', 'KeyT'],
    tasks: [{ id: 'map', label: 'Press M — open the map' }, { id: 'teleport', label: 'Close it, then press T — teleport to the light' }],
    hint: 'Press M again (or Esc) to close the map, then press T.',
  },
  {
    id: 'menu', title: 'MENU', instr: 'Open the menu', keys: ['Escape'],
    tasks: [{ id: 'open', label: 'Press Esc — open the menu' }, { id: 'close', label: 'Click Resume' }],
    hint: 'The menu has Settings, Graphics and Controls. Press Esc to open it.',
  },
  {
    id: 'rover', title: 'ROVER', instr: 'Drive the robot', keys: ['KeyW', 'KeyA', 'KeyD'],
    tasks: [{ id: 'drive', label: 'Hold W to drive' }, { id: 'steer', label: 'A / D to turn' }],
    hint: 'Hold W for a second — the robot needs a moment to start.',
  },
];

interface TutState {
  step: number;
  done: Record<string, boolean>;
  lastProgress: number;
  replayKey: number;
  laptop: 'closed' | 'desktop' | 'rover';
  finished: boolean;
  stepFlash: string | null;
}

export const useTut = create<TutState>()(() => ({ step: 0, done: {}, lastProgress: Date.now(), replayKey: 0, laptop: 'closed', finished: false, stepFlash: null }));

export const curStep = () => TUT_STEPS[useTut.getState().step];
export const isDone = (task: string) => !!useTut.getState().done[`${curStep()?.id}:${task}`];
export const inStep = (id: string) => curStep()?.id === id;

export function resetTutorial() {
  useTut.setState({ step: 0, done: {}, lastProgress: Date.now(), replayKey: 0, laptop: 'closed', finished: false, stepFlash: null });
}

/** Mark a task of the CURRENT step as done (ignored for other steps). */
export function complete(stepId: string, task: string) {
  const s = useTut.getState();
  const step = TUT_STEPS[s.step];
  if (!step || step.id !== stepId) return;
  const key = `${stepId}:${task}`;
  if (s.done[key]) return;
  const done = { ...s.done, [key]: true };
  useTut.setState({ done, lastProgress: Date.now() });
  audio.tone(1175, 0.08, 'sine', 0.06);
  audio.tone(1568, 0.12, 'sine', 0.06, undefined, 0.07);
  if (step.tasks.every((t) => done[`${stepId}:${t.id}`])) {
    useTut.setState({ stepFlash: step.title });
    [784, 988, 1175].forEach((f, i) => audio.tone(f, 0.16, 'triangle', 0.06, undefined, i * 0.1));
    setTimeout(() => advance(), 900);
  }
}

export function advance() {
  const s = useTut.getState();
  if (s.step >= TUT_STEPS.length - 1) { useTut.setState({ finished: true, stepFlash: null }); return; }
  const next = TUT_STEPS[s.step + 1];
  useTut.setState({ step: s.step + 1, lastProgress: Date.now(), stepFlash: null, replayKey: s.replayKey + 1, laptop: next.id === 'rover' ? 'rover' : s.laptop });
}

export function skipStep() {
  const s = useTut.getState();
  const step = TUT_STEPS[s.step];
  // Opening the laptop is needed to reach the rover step, so skipping steps 6 opens it for you.
  advance();
}

export function repeatInstruction() {
  const s = useTut.getState();
  useTut.setState({ replayKey: s.replayKey + 1, lastProgress: Date.now() });
  audio.ui('open');
}

/** Put the shared rover back where the real mission expects it. */
export function resetTrainingRover() {
  Object.assign(rover, {
    x: 0, z: 60, heading: 0, v: 0, steer: 0, odometry: 0, trail: [], cam: 'NAVCAM', zoom: 1, thermalView: false,
    camYaw: 0, camPitch: -0.12, queue: [], cmd: { throttle: 0, steer: 0, brake: false }, mode: 'IDLE', stuck: false,
    slip: 0, battery: 86, inputEnabled: false, waypoints: [],
  });
  rover.lastSent = { throttle: 0, steer: 0, brake: false, t: 0 };
}
