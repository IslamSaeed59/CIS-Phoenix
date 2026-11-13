import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { GameCanvas } from '../../game/core/GameCanvas';
import { QaidamWorld, useQaidamHF } from '../../game/environments/qaidam/QaidamWorld';
import { PlayerController, runtime, type Obstacle } from '../../game/player/PlayerController';
import { FirstPersonRig } from '../../game/player/FirstPersonRig';
import { playFP } from '../../game/player/fpAnim';
import { GuideBeacon } from '../../game/missions/GuideBeacon';
import { surfaceAt } from '../../game/environments/qaidam/qaidamTerrain';
import { makeRockGeometry, makeRockMaterial } from '../../game/core/shaders';
import { useUI, radio, fadeTo } from '../../game/core/ui';
import { audio } from '../../game/core/audio';
import { keys, isTyping } from '../../game/core/input';
import { photoWithFX, celebrate } from '../../game/core/fx';
import { captureThumb } from '../../game/instruments/earthInstruments';
import { TOOLS } from '../../game/instruments/earthInstruments';
import { useGame } from '../../game/core/store';
import { afterTutorial } from '../../game/core/onboarding';
import { TUT_STEPS, useTut, complete, inStep, isDone, resetTutorial, skipStep, repeatInstruction, resetTrainingRover, curStep } from '../../game/missions/tutorial';
import { rover, CAMS, VISIBLE_CAMS, useRover } from '../../game/rover/roverSim';
import { RoverFeedCanvas, useRoverLoop, feedState } from '../../game/camera/RoverFeed';
import { setupSimpleMars } from '../../game/missions/marsStations';
import { Tablet } from '../journal/Tablet';
import { PauseMenu } from '../pause/PauseMenu';
import { RadioFeed, Toasts, Rovi } from '../common';
import { Icon } from '../icons';
import { travelTo } from '../../game/missions/travel';

const START: [number, number] = [0, 122];
const MARKER_A: [number, number] = [0, 92];
const ROCK: [number, number] = [-14, 82];
const MARKER_B: [number, number] = [26, 62];
const MAST: [number, number] = [0, 158];
const LAPTOP: [number, number] = [6.6, 151.2];

const OBSTACLES: Obstacle[] = [
  { x: -14, z: 150, r: 3.2 }, { x: -24, z: 138, r: 2.6 }, { x: 14, z: 128, r: 3.0 }, { x: 0, z: 158, r: 0.4 },
  { x: ROCK[0], z: ROCK[1], r: 2.2 }, { x: 6.6, z: 151, r: 1.2 },
];

function tutTarget(): [number, number] | null {
  const st = curStep();
  if (!st) return null;
  if (st.id === 'move' && !isDone('reach')) return MARKER_A;
  if (st.id === 'science') return ROCK;
  if (st.id === 'nav') return MARKER_B;
  if (st.id === 'mission' && isDone('checklist')) return MAST;
  if (st.id === 'laptop') return LAPTOP;
  return null;
}

const dist = (p: [number, number]) => Math.hypot(runtime.pos.x - p[0], runtime.pos.z - p[1]);

function aimedAt(camera: THREE.Camera, hf: { height: (x: number, z: number) => number }, p: [number, number], maxDist: number) {
  const target = new THREE.Vector3(p[0], hf.height(p[0], p[1]) + 1.2, p[1]);
  const to = target.sub(camera.position);
  const d = to.length();
  if (d > maxDist) return false;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  const ang = (fwd.angleTo(to.normalize()) * 180) / Math.PI;
  return ang < Math.atan2(2.5, Math.max(1, d)) * (180 / Math.PI) + 6;
}

function TrainingProps() {
  const hf = useQaidamHF();
  const rockGeo = useMemo(() => makeRockGeometry(21, 2), []);
  const rockMat = useMemo(() => makeRockMaterial('#9a7a5c', 0.75, 0.85), []);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.6; });
  const ry = hf.height(ROCK[0], ROCK[1]);
  const ly = hf.height(LAPTOP[0], LAPTOP[1]);
  return (
    <group>
      <mesh geometry={rockGeo} material={rockMat} position={[ROCK[0], ry + 0.9, ROCK[1]]} scale={[2.2, 2.4, 1.9]} castShadow receiveShadow />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[ROCK[0], ry + 0.08, ROCK[1]]}>
        <ringGeometry args={[3.2, 3.45, 48, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color="#f0a830" transparent opacity={0.8} fog={false} />
      </mesh>
      {/* Field laptop on the crates */}
      <group position={[LAPTOP[0], ly + 0.71, LAPTOP[1]]} rotation={[0, Math.PI, 0]}>
        <mesh><boxGeometry args={[0.42, 0.02, 0.29]} /><meshStandardMaterial color="#3a3f45" metalness={0.7} roughness={0.3} /></mesh>
        <group position={[0, 0.01, -0.145]} rotation={[-0.32, 0, 0]}>
          <mesh position={[0, 0.14, 0]}><boxGeometry args={[0.42, 0.28, 0.012]} /><meshStandardMaterial color="#3a3f45" metalness={0.7} /></mesh>
          <mesh position={[0, 0.14, 0.007]}><planeGeometry args={[0.39, 0.25]} /><meshBasicMaterial color="#1d6e68" toneMapped={false} /></mesh>
        </group>
      </group>
    </group>
  );
}

function TutorialSystems() {
  const { camera, gl } = useThree();
  const hf = useQaidamHF();
  const lastYaw = useRef(runtime.yaw);
  const look = useRef(0);
  const acc = useRef(0);

  // Clicks (pointer-locked mousedown, or plain click when pointer lock is unavailable)
  useEffect(() => {
    const use = () => {
      const ui = useUI.getState();
      if (ui.panel || useTut.getState().laptop !== 'closed') return;
      if (!ui.toolRaised) { ui.setRaised(true); audio.servo(0.15); return; }
      if (!inStep('science')) return;
      const onRock = aimedAt(camera, hf, ROCK, 40);
      if (ui.tool === 'spectral') {
        if (!onRock) { ui.setReadout({ title: 'NO TARGET', lines: ['Aim at the training rock'], t: Date.now() }); audio.ui('error'); return; }
        audio.scanner();
        ui.setScanBusy(true);
        setTimeout(() => {
          useUI.getState().setScanBusy(false);
          audio.scanDone();
          useUI.getState().setReadout({ title: 'SCAN — TRAINING ROCK', lines: ['Rock type: sandstone (training data)'], t: Date.now() });
          complete('science', 'scan');
        }, 1200);
      } else if (ui.tool === 'camera') {
        photoWithFX(() => {
          audio.shutter();
          if (onRock) complete('science', 'photo');
          return { thumb: captureThumb(gl.domElement), label: onRock ? 'Training rock' : 'Practice photo' };
        });
      }
    };
    const onDown = (e: MouseEvent) => { if (e.button === 0 && document.pointerLockElement) use(); };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || runtime.dragDist >= 6) return;
      setTimeout(() => { if (!document.pointerLockElement) use(); }, 180);
    };
    document.addEventListener('mousedown', onDown);
    gl.domElement.addEventListener('click', onClick);
    return () => { document.removeEventListener('mousedown', onDown); gl.domElement.removeEventListener('click', onClick); };
  }, [camera, gl, hf]);

  useFrame((_, dt) => {
    acc.current += dt;
    // Look-around detection
    look.current += Math.abs(runtime.yaw - lastYaw.current);
    lastYaw.current = runtime.yaw;
    if (acc.current < 0.1) return;
    acc.current = 0;
    if (inStep('move')) {
      if (runtime.speed > 7.5) complete('move', 'sprint');
      if (dist(MARKER_A) < 4) complete('move', 'reach');
    }
    if (inStep('camera') && look.current > 2.2) complete('camera', 'look');
    if (inStep('nav') && isDone('map') && dist(MARKER_B) < 4) complete('nav', 'follow');
    if (inStep('laptop') && dist(LAPTOP) < 3.5) complete('laptop', 'reachLaptop');
    // Interaction prompt
    const ui = useUI.getState();
    let prompt: string | null = null;
    if (inStep('science') && dist(ROCK) < 6) prompt = 'Take a sample';
    if (inStep('mission') && dist(MAST) < 6) prompt = 'Call Mission Control';
    if (inStep('laptop') && dist(LAPTOP) < 3.5) prompt = 'Open the laptop';
    if (!ui.panel) ui.setPrompt(prompt); else ui.setPrompt(null);
  });
  return null;
}

function useTutorialKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const ui = useUI.getState();
      const t = useTut.getState();
      const k = useGame.getState().settings.keys;
      if (e.code === 'Escape') {
        if (ui.panel === 'tablet') { ui.setPanel(null); audio.ui('close'); }
        else if (!ui.panel && t.laptop === 'closed' && !document.pointerLockElement) { ui.setPanel('pause'); audio.ui('open'); }
        return;
      }
      if (t.laptop !== 'closed' || ui.panel === 'pause' || ui.panel === 'discovery') return;
      const openTab = (tab: any) => { ui.setTabletTab(tab); ui.setPanel('tablet'); audio.ui('open'); };
      if (e.code === k.checklist) { e.preventDefault(); if (ui.panel === 'tablet') { ui.setPanel(null); return; } openTab('checklist'); complete('mission', 'checklist'); return; }
      if (e.code === k.journal) { if (ui.panel === 'tablet') { ui.setPanel(null); return; } openTab('journal'); complete('science', 'journal'); return; }
      if (e.code === k.map) { if (ui.panel === 'tablet') { ui.setPanel(null); return; } openTab('map'); complete('nav', 'map'); return; }
      if (ui.panel) return;
      if (e.code === 'KeyT' && inStep('nav')) {
        if (!isDone('map')) { audio.ui('error'); return; }
        travelTo(MARKER_B, 'Training marker').then(() => complete('nav', 'teleport'));
        return;
      }
      if (e.code === k.camera) {
        const third = !ui.thirdPerson;
        ui.setThird(third);
        if (third) complete('camera', 'third');
        else if (useTut.getState().done['camera:third']) complete('camera', 'first');
        return;
      }
      if (e.code === k.scanner) { ui.setRaised(!ui.toolRaised); audio.servo(0.15); if (!ui.toolRaised) complete('science', 'raise'); return; }
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'].indexOf(e.code);
      if (idx >= 0) { ui.setTool(TOOLS[idx].id); ui.setRaised(true); audio.ui('click'); complete('science', 'raise'); return; }
      if (e.code === k.interact) {
        if (inStep('science') && dist(ROCK) < 6) {
          ui.setRaised(false);
          playFP('pickup', 2600, runtime.pitch, () => complete('science', 'sample'));
        } else if (inStep('mission') && dist(MAST) < 6) {
          radio('MISSION CONTROL', 'Loud and clear, trainee! We will guide you by radio during the mission.');
          complete('mission', 'radio');
        } else if (inStep('laptop') && dist(LAPTOP) < 3.5) {
          audio.ui('boot');
          ui.setPanel('rest'); // blocks walking and keeps the pause menu from opening when the mouse is released
          useTut.setState({ laptop: 'desktop' });
          complete('laptop', 'openLaptop');
          if (document.pointerLockElement) document.exitPointerLock();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const KEY_LABEL: Record<string, string> = { Escape: 'Esc', KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', ShiftLeft: 'Shift', KeyC: 'C', KeyF: 'F', Digit1: '1', Digit2: '2', KeyE: 'E', KeyJ: 'J', KeyM: 'M', Tab: 'Tab', Space: 'Space', KeyP: 'P', KeyT: 'T' };

function KeyCaps({ codes }: { codes: string[] }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 80); return () => clearInterval(id); }, []);
  const map = useGame((s) => s.settings.keys);
  // show the player's remapped keys where the action is remappable
  const remap: Record<string, string> = { KeyW: map.forward, KeyA: map.left, KeyS: map.back, KeyD: map.right, ShiftLeft: map.sprint, KeyC: map.camera, KeyF: map.scanner, KeyE: map.interact, KeyJ: map.journal, KeyM: map.map, Tab: map.checklist, Space: map.brake };
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {codes.map((c) => {
        const code = remap[c] ?? c;
        const down = keys.has(code) || (c === 'ShiftLeft' && keys.has('ShiftRight'));
        const label = code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : KEY_LABEL[code] ?? code;
        return <span key={c} className={`tut-key ${down ? 'down' : ''}`}>{label}</span>;
      })}
    </div>
  );
}

function MouseDemo({ kind }: { kind: 'look' | 'click' | 'scroll' }) {
  return (
    <span className={`tut-mouse ${kind}`} title={kind === 'look' ? 'Move the mouse' : kind === 'click' ? 'Left click' : 'Scroll wheel'}>
      <svg width="26" height="36" viewBox="0 0 26 36"><rect x="2" y="2" width="22" height="32" rx="11" fill="none" stroke="#cfe" strokeWidth="2" /><path d="M13 2v12" stroke="#cfe" strokeWidth="2" />{kind === 'click' && <path className="tut-mouse-btn" d="M3 13V12A10 10 0 0112 3v10z" fill="#4fd1c5" />}{kind === 'scroll' && <rect className="tut-mouse-wheel" x="11" y="7" width="4" height="6" rx="2" fill="#4fd1c5" />}</svg>
    </span>
  );
}

function TutorialHUD() {
  const t = useTut();
  const step = TUT_STEPS[t.step];
  const panel = useUI((s) => s.panel);
  const prompt = useUI((s) => s.prompt);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);
  if (!step) return null;
  const showHint = now - t.lastProgress > 15000;
  const target = tutTarget();
  let rel = 0, d = 0;
  if (target) {
    const dx = target[0] - runtime.pos.x, dz = target[1] - runtime.pos.z;
    d = Math.hypot(dx, dz);
    rel = Math.atan2(-dx, -dz) - runtime.yaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
  }
  const firstOpen = step.tasks.findIndex((x) => !t.done[`${step.id}:${x.id}`]);
  return (
    <>
      <div key={t.replayKey} className="tut-card panel">
        <div className="between">
          <span className="mono tiny teal" style={{ letterSpacing: '0.2em' }}>{step.title} · {t.step + 1}/{TUT_STEPS.length}</span>
          <div className="row" style={{ gap: 3 }}>
            {TUT_STEPS.map((s, i) => <span key={s.id} className={`tut-dot ${i < t.step ? 'done' : i === t.step ? 'cur' : ''}`} />)}
          </div>
        </div>
        <div className="row" style={{ gap: 12, marginTop: 6 }}>
          <Rovi size={28} />
          <div className="kid" style={{ fontSize: 17, fontWeight: 600, flex: 1 }}>{step.instr}</div>
          {target && d > 5 && (
            <div style={{ textAlign: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 30 30" style={{ transform: `rotate(${(-rel * 180) / Math.PI}deg)` }}><path d="M15 3 L24 25 L15 19 L6 25 Z" fill="#4fd1c5" /></svg>
              <div className="mono tiny teal">{Math.round(d)} m</div>
            </div>
          )}
        </div>
        <div className="col" style={{ gap: 3, marginTop: 8 }}>
          {step.tasks.map((x, i) => {
            const done = !!t.done[`${step.id}:${x.id}`];
            // Rover info is introduced gradually: only show tasks up to the current one.
            if (step.id === 'rover' && i > firstOpen + 1 && firstOpen >= 0) return null;
            return (
              <div key={x.id} className={`tut-task ${done ? 'done' : i === firstOpen ? 'cur' : ''}`}>
                <span className="tut-check">{done ? <Icon name="check" size={13} /> : null}</span>{x.label}
              </div>
            );
          })}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 6, justifyContent: 'center' }}>
          <KeyCaps codes={step.keys} />
          {step.mouse && <MouseDemo kind={step.mouse} />}
        </div>
        {showHint && <div className="tut-hint"><Icon name="sparkle" size={14} color="#ffd166" /> {step.hint}</div>}
        <div className="row" style={{ gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
          <button className="btn sm ghost" onClick={skipStep}>Skip step</button>
          <button className="btn sm ghost" onClick={() => finishTutorial(true)}>Skip tutorial</button>
        </div>
      </div>
      {t.stepFlash && <div className="tut-flash kid"><Icon name="check" size={28} /> {t.stepFlash} complete!</div>}
      {!panel && prompt && t.laptop === 'closed' && (
        <div className="prompt panel"><span className="kbd">E</span> {prompt}</div>
      )}
      {!panel && t.laptop === 'closed' && <div className="crosshair"><div className="dot" /></div>}
    </>
  );
}

let finishing = false;
async function finishTutorial(skipped: boolean) {
  if (finishing) return;
  finishing = true;
  useTut.setState({ laptop: 'closed' });
  resetTrainingRover();
  if (skipped) audio.ui('click');
  else celebrate('MISSION READY!', 'Training complete — the Qaidam expedition begins', 3);
  await new Promise((r) => setTimeout(r, skipped ? 200 : 3200));
  await fadeTo(1, 800);
  finishing = false;
  afterTutorial();
}

/** Laptop + rover training (step 6 and 7). */
function TrainingLaptop() {
  const t = useTut();
  useRover((s) => s.snap);
  const g = useGame();
  const roverOn = t.laptop === 'rover';
  useRoverLoop(roverOn);
  const base = useRef({ odo: 0, heading: 0, cams: 0, movingBrake: false });

  useEffect(() => {
    if (!roverOn) return;
    resetTrainingRover();
    setupSimpleMars();
    rover.started = true;
    rover.inputEnabled = true;
    feedState.cine = 0;
    base.current = { odo: 0, heading: rover.heading, cams: 0, movingBrake: false };
    audio.startLoop('rover');
    return () => { rover.inputEnabled = false; audio.stopLoop('rover'); };
  }, [roverOn]);

  // Rover task detection
  useEffect(() => {
    if (!roverOn) return;
    const id = setInterval(() => {
      if (rover.odometry > 4) complete('rover', 'drive');
      if (Math.abs(rover.heading - base.current.heading) > 0.5) complete('rover', 'steer');
      const braking = keys.has(useGame.getState().settings.keys.brake);
      if (braking && Math.abs(rover.v) > 0.3) base.current.movingBrake = true;
      if (base.current.movingBrake && Math.abs(rover.v) < 0.05) complete('rover', 'stop');
      if (rover.cam === 'MASTCAM' && rover.zoom >= 2) complete('rover', 'zoom');
    }, 100);
    return () => clearInterval(id);
  }, [roverOn]);

  useEffect(() => {
    if (!roverOn) return;
    const onKey = (e: KeyboardEvent) => {
      const k = useGame.getState().settings.keys;
      if (e.code === k.camera) {
        const i = VISIBLE_CAMS.findIndex((c) => c.id === rover.cam);
        rover.cam = VISIBLE_CAMS[(i + 1) % VISIBLE_CAMS.length].id;
        audio.servo(0.2);
        base.current.cams++;
        if (base.current.cams >= 2) complete('rover', 'cam');
      }
      if (e.code === 'KeyP' && rover.canvas) {
        photoWithFX(() => { audio.shutter(); complete('rover', 'photo'); return { thumb: captureThumb(rover.canvas!), label: 'Training photo' }; });
      }
      if (e.code === 'KeyT') { rover.thermalView = !rover.thermalView; audio.ui('click'); complete('rover', 'thermal'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [roverOn]);

  useEffect(() => { if (t.finished) finishTutorial(false); }, [t.finished]);
  useEffect(() => {
    if (t.laptop !== 'closed' && !useUI.getState().panel) useUI.getState().setPanel('rest');
    if (t.laptop !== 'closed' && document.pointerLockElement) document.exitPointerLock();
  }, [t.laptop]);

  if (t.laptop === 'closed') return null;
  const cam = CAMS.find((c) => c.id === rover.cam)!;
  return (
    <div className="overlay" style={{ zIndex: 20, background: 'rgba(0,0,0,.55)' }}>
      <div style={{ width: 'min(1100px, 94vw)', height: 'min(640px, 78vh)', background: 'linear-gradient(#1a1d21, #121417)', borderRadius: 16, padding: '14px 14px 22px', boxShadow: '0 30px 100px rgba(0,0,0,.85)', display: 'flex', flexDirection: 'column', marginTop: 110 }}>
        <div style={{ flex: 1, minHeight: 0, background: '#07090b', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          {t.laptop === 'desktop' ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
              <div className="mono teal small" style={{ letterSpacing: '0.3em' }}>ORBITAL OS · TRAINING</div>
              <button className="station-btn pulse-key" style={{ alignItems: 'center', padding: '18px 26px' }} onClick={() => { audio.ui('confirm'); complete('laptop', 'openRover'); useTut.setState({ laptop: 'rover' }); }}>
                <Icon name="rover" size={40} />
                <span style={{ fontSize: 18, fontWeight: 600 }}>Rover</span>
              </button>
              <div className="small dim">Click the Rover app</div>
            </div>
          ) : (
            <div
              style={{ position: 'absolute', inset: 0 }}
              onWheel={(e) => { if (rover.cam === 'MASTCAM') rover.zoom = Math.max(1, Math.min(8, rover.zoom * (e.deltaY < 0 ? 1.18 : 0.85))); }}
            >
              <RoverFeedCanvas />
              <div className="row" style={{ position: 'absolute', top: 12, left: 12, gap: 8 }}>
                <button className={`panel mono small ${inStep('rover') && isDone('thermal') && !isDone('battery') ? 'pulse-key' : ''}`} style={{ padding: '6px 10px', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', border: '1px solid var(--line2)' }} onClick={() => { complete('rover', 'battery'); radio('ROVI', `Battery at ${Math.round(rover.battery)}%. Driving uses power; sunlight recharges it.`); }}>
                  <Icon name="battery" size={16} style={{ verticalAlign: '-3px', marginRight: 4 }} />{rover.battery.toFixed(0)}%
                </button>
                <span className="panel mono small" style={{ padding: '6px 10px', borderRadius: 8 }}>{Math.abs(rover.v).toFixed(1)} m/s</span>
              </div>
              <span className="panel mono tiny" style={{ position: 'absolute', top: 12, right: 12, padding: '5px 9px', borderRadius: 6 }}>
                <Icon name="camera" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />{cam.name}{rover.cam === 'MASTCAM' ? ` · ${rover.zoom.toFixed(1)}×` : ''}
              </span>
              <div className="tiny dim" style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center' }}>Training simulator — nothing here counts toward the real mission</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Scene() {
  const hf = useQaidamHF();
  const playerRef = useRef(runtime.pos);
  return (
    <>
      <QaidamWorld playerRef={playerRef} />
      <PlayerController hf={hf} obstacles={OBSTACLES} bounds={{ radius: 70, center: [0, 110] }} surfaceAt={surfaceAt} walk={6.5} sprint={13} />
      <FirstPersonRig />
      <GuideBeacon hf={hf} getTarget={tutTarget} />
      <TrainingProps />
      <TutorialSystems />
    </>
  );
}

export function TutorialScene() {
  useTutorialKeys();
  // Menu step: opening the pause menu, then resuming
  useEffect(() => useUI.subscribe((u, prev) => {
    if (!inStep('menu')) return;
    if (u.panel === 'pause' && prev.panel !== 'pause') complete('menu', 'open');
    if (prev.panel === 'pause' && u.panel !== 'pause' && isDone('open')) complete('menu', 'close');
  }), []);
  const panel = useUI((s) => s.panel);
  useEffect(() => {
    finishing = false;
    resetTutorial();
    runtime.pos.set(START[0], 0, START[1]);
    runtime.yaw = 0;
    runtime.pitch = -0.05;
    const ui = useUI.getState();
    ui.setThird(false);
    ui.setRaised(false);
    ui.setTool('camera');
    useGame.getState().setEarthTime('day');
    audio.startLoop('wind');
    fadeTo(0, 1200);
    setTimeout(() => radio('ROVI', 'Quick training — 3 steps!'), 1000);
    return () => { audio.stopLoop('wind'); resetTrainingRover(); };
  }, []);

  return (
    <>
      <GameCanvas preserve camera={{ fov: 70, near: 0.1, far: 6000, position: [0, 2, 122] }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </GameCanvas>
      <div className="layer" style={{ zIndex: 25 }}>
        <TutorialHUD />
        <RadioFeed />
        <Toasts />
        {panel === 'tablet' && <Tablet world="earth" />}
        {panel === 'pause' && <PauseMenu />}
      </div>
      <TrainingLaptop />
    </>
  );
}
