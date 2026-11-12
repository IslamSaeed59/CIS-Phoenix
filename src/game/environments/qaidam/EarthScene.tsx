import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { QaidamWorld, useQaidamHF } from './QaidamWorld';
import { PlayerController, runtime, type Obstacle } from '../../player/PlayerController';
import { surfaceAt, PLAY_RADIUS } from './qaidamTerrain';
import { useGame, worldProgress } from '../../core/store';
import { useUI, radio, toast, fadeTo, wait } from '../../core/ui';
import { matches, isTyping } from '../../core/input';
import { audio } from '../../core/audio';
import { EARTH_POIS, type EarthPOI } from '../../../data/earth/earthData';
import { TOOLS, useTool, poiRadius, logEvidence } from '../../instruments/earthInstruments';
import { sharedUniforms } from '../../core/shaders';
import { EarthHUD } from '../../../ui/hud/EarthHUD';
import { GuideBeacon } from '../../missions/GuideBeacon';
import { nextEarthStep } from '../../missions/earthGuide';
import { travelTo } from '../../missions/travel';

const OBSTACLES: Obstacle[] = [
  { x: -14, z: 150, r: 3.2 },
  { x: -24, z: 138, r: 2.6 },
  { x: 14, z: 128, r: 3.0 },
  { x: 128, z: 168, r: 0.9 },
  { x: 0, z: 158, r: 0.4 },
  ...[-38, -32, -26].map((x) => ({ x, z: -190.5, r: 2.4 })),
];

let interactTarget: EarthPOI | null = null;

function Systems() {
  const { camera, gl } = useThree();
  const hf = useQaidamHF();
  const acc = useRef(0);
  const tool = useUI((s) => s.tool);
  const raised = useUI((s) => s.toolRaised);

  useEffect(() => {
    sharedUniforms.uThermal.value = tool === 'thermal' && raised ? 1 : 0;
    return () => { sharedUniforms.uThermal.value = 0; };
  }, [tool, raised]);

  // Mouse: use tool
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || !document.pointerLockElement) return;
      const ui = useUI.getState();
      if (ui.panel) return;
      if (!ui.toolRaised) { ui.setRaised(true); audio.servo(0.15); return; }
      useTool(camera as THREE.PerspectiveCamera, gl, hf);
    };
    // Fallback when pointer lock is unavailable: a click (not a drag) on the view uses the tool
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || runtime.dragDist >= 6) return;
      setTimeout(() => {
        if (document.pointerLockElement) return;
        const ui = useUI.getState();
        if (ui.panel) return;
        if (!ui.toolRaised) { ui.setRaised(true); audio.servo(0.15); return; }
        useTool(camera as THREE.PerspectiveCamera, gl, hf);
      }, 180);
    };
    document.addEventListener('mousedown', onDown);
    gl.domElement.addEventListener('click', onClick);
    return () => { document.removeEventListener('mousedown', onDown); gl.domElement.removeEventListener('click', onClick); };
  }, [camera, gl, hf]);

  // Find interactable each 100 ms
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.1) return;
    acc.current = 0;
    const p = runtime.pos;
    const fwd = runtime.forward;
    let best: EarthPOI | null = null, bestD = Infinity;
    for (const poi of EARTH_POIS) {
      const dx = poi.pos[0] - p.x, dz = poi.pos[1] - p.z;
      const d = Math.hypot(dx, dz);
      const reach = poi.specimen === 'none' ? 6 : poiRadius(poi.id) * 0.65 + 4;
      if (d > reach) continue;
      const facing = d < 3 ? 1 : (dx * fwd.x + dz * fwd.z) / d;
      if (facing < 0.25) continue;
      if (d < bestD) { bestD = d; best = poi; }
    }
    interactTarget = best;
    const ui = useUI.getState();
    if (best && !ui.panel) {
      const verb = best.interactLabel ?? (best.inspectable ? `Inspect ${best.name}` : best.name);
      ui.setPrompt(verb);
    } else ui.setPrompt(null);
    // periodically save position
    useGame.getState().setPlayerPos([p.x, p.y, p.z]);
  });
  return null;
}

async function restToggle() {
  const g = useGame.getState();
  const next = g.earthTime === 'day' ? 'night' : 'day';
  useUI.getState().setPanel('rest');
  await fadeTo(1, 900);
  g.setEarthTime(next);
  g.addJournal({ world: 'earth', kind: 'event', title: next === 'night' ? 'Rested until night (23:10 local)' : 'Rested until afternoon (14:20 local)', text: 'Time of day advanced at field camp.' });
  await wait(900);
  useUI.getState().setPanel(null);
  await fadeTo(0, 1100);
  radio('MISSION CONTROL', next === 'night' ? 'Night conditions. Surface temperatures are dropping fast — good time for thermal readings.' : 'Daylight again. Solar heating is back on the surfaces.');
}

async function extraction() {
  const g = useGame.getState();
  const prog = worldProgress('earth');
  if (!prog.done) {
    audio.ui('error');
    toast('Extraction unavailable', `Earth checklist ${prog.completed}/8 categories complete. Finish all investigations and record interpretations.`, 'warn');
    return;
  }
  useUI.getState().setPanel('rest');
  audio.ui('confirm');
  radio('MISSION CONTROL', 'Extraction confirmed. Bring your dataset home — the rover team is waiting.');
  await wait(1500);
  await fadeTo(1, 1600);
  useUI.getState().setPanel(null);
  g.setPhase('toHQ');
}

function useEarthKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const ui = useUI.getState();
      const g = useGame.getState();
      if (e.code === 'Escape') {
        if (ui.panel && ui.panel !== 'pause' && ui.panel !== 'rest') { ui.setPanel(null); ui.setInspect(null); audio.ui('close'); }
        return;
      }
      if (ui.panel === 'pause' || ui.panel === 'rest' || ui.panel === 'inspect') return;
      if (matches(e, 'checklist')) { e.preventDefault(); toggleTablet('checklist'); return; }
      if (matches(e, 'journal')) { toggleTablet('journal'); return; }
      if (matches(e, 'map')) { toggleTablet('map'); return; }
      if (ui.panel === 'tablet') return;
      if (matches(e, 'interact') && interactTarget) {
        const t = interactTarget;
        if (t.id === 'tent') { restToggle(); return; }
        if (t.id === 'vehicle') { extraction(); return; }
        if (t.id === 'relay') {
          audio.scanner();
          ui.setReadout({ title: 'COMMS LINK TEST', lines: ['Establishing link to Mission Control…'], t: Date.now() });
          setTimeout(() => {
            const margin = (10 + Math.random() * 6).toFixed(1);
            logEvidence('comms:relay', 'Comms relay', `Link margin ${margin} dB`);
            g.addJournal({ world: 'earth', kind: 'scan', title: 'Comms link test', text: `Relay link established. Margin ${margin} dB, round-trip latency 0.6 s (SIMULATED). Line-of-sight from the knoll is essential.`, cat: 'operations' });
            useUI.getState().setReadout({ title: 'COMMS LINK — NOMINAL', lines: [`Link margin ${margin} dB · RTT 0.6 s`, 'Line-of-sight maintained from knoll', 'SIMULATED'], t: Date.now() });
            audio.scanDone();
          }, 1800);
          return;
        }
        if (t.inspectable) {
          audio.ui('open');
          ui.setInspect(t.id);
          ui.setPanel('inspect');
        }
        return;
      }
      if (e.code === 'KeyT') { const st = nextEarthStep(); if (st.target) travelTo(st.target, st.place ?? 'goal'); return; }
      if (matches(e, 'scanner')) { ui.setRaised(!ui.toolRaised); audio.servo(0.15); return; }
      if (matches(e, 'camera')) { ui.setThird(!ui.thirdPerson); return; }
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'].indexOf(e.code);
      if (idx >= 0) { ui.setTool(TOOLS[idx].id); ui.setRaised(true); audio.ui('click'); }
    };
    const onWheel = (e: WheelEvent) => {
      const ui = useUI.getState();
      if (ui.panel || !document.pointerLockElement) return;
      const i = TOOLS.findIndex((t) => t.id === ui.tool);
      const n = (i + (e.deltaY > 0 ? 1 : -1) + TOOLS.length) % TOOLS.length;
      ui.setTool(TOOLS[n].id);
      audio.ui('click');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('wheel', onWheel); };
  }, []);
}

function toggleTablet(tab: any) {
  const ui = useUI.getState();
  if (ui.panel === 'tablet' && ui.tabletTab === tab) { ui.setPanel(null); audio.ui('close'); return; }
  ui.setTabletTab(tab);
  ui.setPanel('tablet');
  audio.ui('open');
}

function Scene() {
  const hf = useQaidamHF();
  const playerRef = useRef(runtime.pos);
  return (
    <>
      <QaidamWorld playerRef={playerRef} />
      <PlayerController hf={hf} obstacles={OBSTACLES} bounds={{ radius: PLAY_RADIUS - 15 }} surfaceAt={surfaceAt} walk={6.5} sprint={13} />
      <Systems />
      <GuideBeacon hf={hf} />
    </>
  );
}

export function EarthScene() {
  useEarthKeys();
  const quality = useGame((s) => s.settings.quality);
  useEffect(() => {
    const g = useGame.getState();
    if (g.playerPos) runtime.pos.set(...g.playerPos);
    else { runtime.pos.set(4, 0, 128); runtime.yaw = Math.PI * 0.85; }
    audio.startLoop('wind');
    useUI.getState().setPanel(null);
    fadeTo(0, 1500);
    const first = Object.keys(g.earthEvidence).length === 0;
    if (first) {
      setTimeout(() => radio('FIELD ASSISTANT', 'Welcome to Qaidam. Follow the cyan light — it always shows your next goal.'), 1800);
    }
    return () => { audio.stopLoop('wind'); };
  }, []);

  // Earth completion notice
  useEffect(() => {
    let notified = worldProgress('earth').done;
    return useGame.subscribe((s) => {
      const done = worldProgress('earth', s).done;
      if (done && !notified) {
        notified = true;
        toast('EARTH INVESTIGATION COMPLETE', 'All 8 checklist categories completed.', 'complete');
        radio('MISSION CONTROL', 'Outstanding work. Earth checklist complete. Return to the expedition vehicle at camp for extraction to headquarters.');
      }
    });
  }, []);

  return (
    <>
      <Canvas
        shadows={quality !== 'low'}
        dpr={quality === 'high' ? [1, 2] : quality === 'medium' ? [1, 1.5] : [0.75, 1]}
        gl={{ preserveDrawingBuffer: true, antialias: quality !== 'low', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        camera={{ fov: 70, near: 0.1, far: 6000, position: [0, 2, 130] }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <EarthHUD />
    </>
  );
}
