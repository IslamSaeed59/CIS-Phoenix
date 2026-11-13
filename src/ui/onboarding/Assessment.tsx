import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { useGame } from '../../game/core/store';
import { detectHardware, recommend, type BenchResult, type HardwareReport } from '../../game/core/hardware';
import { PRESETS, PRESET_INFO, type Preset } from '../../game/core/graphics';
import { afterAssess } from '../../game/core/onboarding';
import { buildTerrainGeometry } from '../../game/core/terrain';
import { makeRockGeometry, makeRockMaterial, patchMaterial } from '../../game/core/shaders';
import { getQaidamHF, QAIDAM_RES, qaidamColor, qaidamSurf } from '../../game/environments/qaidam/qaidamTerrain';
import { mulberry32 } from '../../game/core/noise';
import { audio } from '../../game/core/audio';
import { Rovi } from '../common';

type Stage = 'scan' | 'bench' | 'summary';
const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
const p95 = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)] ?? 0; };

/** Representative Qaidam scene: real terrain mesh + instanced rocks + shadows + dust, with a moving camera. */
function BenchScene({ onProgress, onDone }: { onProgress: (k: number, label: string) => void; onDone: (r: BenchResult | null) => void }) {
  const { gl, scene, camera, size } = useThree();
  const hf = useMemo(() => getQaidamHF(QAIDAM_RES.high), []);
  const terrain = useMemo(() => buildTerrainGeometry(hf, qaidamColor, qaidamSurf), [hf]);
  const terrainMat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 }), { terrain: true }), []);
  const rockGeo = useMemo(() => makeRockGeometry(4, 1), []);
  const rockMat = useMemo(() => makeRockMaterial('#7d7266'), []);
  const light = useRef<THREE.DirectionalLight>(null);
  const extra = useRef<THREE.InstancedMesh>(null);
  const base = useRef<THREE.InstancedMesh>(null);
  const dust = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) p.set([(Math.random() - 0.5) * 80, Math.random() * 6, 100 + (Math.random() - 0.5) * 80], i * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);

  useEffect(() => {
    const rnd = mulberry32(7);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const fill = (mesh: THREE.InstancedMesh, n: number) => {
      for (let i = 0; i < n; i++) {
        const x = (rnd() - 0.5) * 700, z = (rnd() - 0.5) * 700;
        const sz = 0.15 + Math.pow(rnd(), 3) * 1.4;
        p.set(x, hf.height(x, z) + sz * 0.2, z);
        q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd()));
        s.setScalar(sz);
        mesh.setMatrixAt(i, m.compose(p, q, s));
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    fill(base.current!, 2000);
    fill(extra.current!, 700);
    scene.fog = new THREE.FogExp2('#c9c4bb', 0.0009);
    scene.background = new THREE.Color('#a9bccf');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ctx = gl.getContext();
    const px = new Uint8Array(4);
    const native = Math.min(2, window.devicePixelRatio || 1);
    const setShadow = (size: number) => {
      const l = light.current!;
      l.shadow.map?.dispose();
      (l.shadow as any).map = null;
      l.shadow.mapSize.set(size, size);
    };
    const moveCam = (t: number) => {
      const a = t * 0.00025;
      const x = Math.sin(a) * 160, z = 40 + Math.cos(a) * 160;
      camera.position.set(x, hf.height(x, z) + 6, z);
      camera.lookAt(Math.sin(a + 0.6) * 120, hf.height(0, 0) + 4, 40 + Math.cos(a + 0.6) * 120);
      const l = light.current!;
      l.position.set(camera.position.x - 90, camera.position.y + 120, camera.position.z + 100);
      l.target.position.copy(camera.position);
      l.target.updateMatrixWorld();
    };
    const pass = async (ms: number, from: number, to: number, label: string) => {
      const times: number[] = [];
      const t0 = performance.now();
      while (performance.now() - t0 < ms && !cancelled) {
        moveCam(performance.now());
        const a = performance.now();
        gl.render(scene, camera);
        ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px); // wait for the GPU to finish this frame
        times.push(performance.now() - a);
        onProgress(from + ((performance.now() - t0) / ms) * (to - from), label);
        await nextFrame();
      }
      return times;
    };
    (async () => {
      try {
        await nextFrame();
        // HIGH configuration
        gl.setPixelRatio(native);
        gl.shadowMap.enabled = true;
        setShadow(2048);
        extra.current!.visible = false;
        for (let i = 0; i < 20 && !cancelled; i++) { moveCam(performance.now()); gl.render(scene, camera); await nextFrame(); } // shader warm-up
        const high = await pass(3000, 0, 0.55, 'Rendering terrain, rocks & shadows');
        // ULTRA configuration: more pixels, bigger shadow maps, more objects
        gl.setPixelRatio(Math.min(2, native * 1.25));
        setShadow(4096);
        extra.current!.visible = true;
        for (let i = 0; i < 6 && !cancelled; i++) { gl.render(scene, camera); await nextFrame(); }
        const ultra = await pass(2400, 0.55, 1, 'Stress test: high resolution & detail');
        if (cancelled) return;
        onDone({
          frames: high.length + ultra.length,
          highMedianMs: median(high),
          highP95Ms: p95(high),
          ultraMedianMs: median(ultra),
          ultraP95Ms: p95(ultra),
          resolution: `${Math.round(size.width * native)}×${Math.round(size.height * native)}`,
        });
      } catch (e) {
        console.warn('[PD2077] benchmark failed', e);
        if (!cancelled) onDone(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <hemisphereLight args={['#cfd9e6', '#8a7a64', 0.75]} />
      <directionalLight ref={light} intensity={2.6} castShadow shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70} shadow-camera-far={500} />
      <mesh geometry={terrain} material={terrainMat} receiveShadow />
      <instancedMesh ref={base} args={[rockGeo, rockMat, 2000]} castShadow receiveShadow />
      <instancedMesh ref={extra} args={[rockGeo, rockMat, 700]} castShadow receiveShadow />
      <points geometry={dust}><pointsMaterial size={0.06} color="#d8c8a8" transparent opacity={0.5} depthWrite={false} /></points>
    </>
  );
}

function Row({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)', gap: 16 }}>
      <span className="small dim">{k}</span>
      <span className="small" style={{ textAlign: 'right' }}>{v}{note && <div className="tiny dim">{note}</div>}</span>
    </div>
  );
}

export function Assessment() {
  const [stage, setStage] = useState<Stage>('scan');
  const [prog, setProg] = useState({ k: 0, label: '' });
  const [report, setReport] = useState<HardwareReport | null>(null);
  const [choice, setChoice] = useState<Preset>('medium');
  const caps = useMemo(() => detectHardware(), []);

  useEffect(() => {
    audio.ui('boot');
    if (caps.webgl === 'none') {
      const rec = recommend({ ...caps, bench: null });
      setReport({ ...caps, bench: null, recommended: rec.preset, reasons: rec.reasons, time: Date.now() });
      setStage('summary');
      return;
    }
    const id = setTimeout(() => setStage('bench'), 1600);
    return () => clearTimeout(id);
  }, []);

  const finishBench = (bench: BenchResult | null) => {
    const rec = recommend({ ...caps, bench });
    const r: HardwareReport = { ...caps, bench, recommended: rec.preset, reasons: rec.reasons, time: Date.now() };
    setReport(r);
    setChoice(rec.preset);
    setStage('summary');
    audio.ui('confirm');
  };

  const accept = () => {
    if (!report) return;
    const g = useGame.getState();
    const rec = { ...PRESETS[report.recommended] };
    g.setSettings({ hw: report, recommended: rec, assessDone: true });
    g.applyGfx({ ...PRESETS[choice] }, { custom: choice !== report.recommended });
    audio.ui('confirm');
    afterAssess();
  };

  const estFps = (ms: number) => Math.round(1000 / (ms * 1.35 + 2));

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05080a' }}>
      {stage === 'bench' && (
        <div style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
          <Canvas frameloop="never" shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance' }} camera={{ fov: 60, near: 0.1, far: 4000, position: [0, 10, 200] }}>
            <BenchScene onProgress={(k, label) => setProg({ k, label })} onDone={finishBench} />
          </Canvas>
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(5,8,10,.35), rgba(5,8,10,.92) 75%)', pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(640px, 92vw)' }}>
        <div className="row" style={{ gap: 14, marginBottom: 16 }}>
          <Rovi size={52} />
          <div>
            <div className="mono teal small" style={{ letterSpacing: '0.3em' }}>SYSTEM CHECK</div>
            <div className="kid" style={{ fontSize: 28, fontWeight: 600 }}>
              {stage === 'scan' ? 'Checking your computer…' : stage === 'bench' ? 'Testing graphics speed…' : 'Your computer is ready!'}
            </div>
          </div>
        </div>

        {stage === 'scan' && (
          <div className="panel" style={{ padding: 16, borderRadius: 10 }}>
            <Row k="Graphics API" v={caps.webgl === 'webgl2' ? 'WebGL 2' : caps.webgl === 'webgl1' ? 'WebGL 1' : 'Not available'} />
            <Row k="Graphics chip (as reported)" v={caps.rendererHidden ? 'Hidden by your browser' : (caps.renderer ?? '—')} />
            <Row k="Logical processors" v={caps.cores ? String(caps.cores) : 'Not reported'} />
            <Row k="Device memory" v={caps.memoryGB ? `≈ ${caps.memoryGB} GB` : 'Not reported'} />
            <div className="progress" style={{ marginTop: 12 }}><div className="pulse" style={{ width: '40%' }} /></div>
          </div>
        )}

        {stage === 'bench' && (
          <div className="panel" style={{ padding: 16, borderRadius: 10 }}>
            <div className="small" style={{ marginBottom: 8 }}>{prog.label || 'Preparing test scene…'}</div>
            <div className="progress" style={{ height: 8, borderRadius: 4 }}><div style={{ width: `${prog.k * 100}%`, borderRadius: 4 }} /></div>
            <div className="tiny dim" style={{ marginTop: 8 }}>About 6 seconds · rendering a real Qaidam scene to measure your graphics speed</div>
          </div>
        )}

        {stage === 'summary' && report && (
          <div className="panel" style={{ padding: 18, borderRadius: 12 }}>
            {report.webgl === 'none' ? (
              <div className="small" style={{ lineHeight: 1.6 }}>
                <b className="amber">WebGL is not available.</b> The game needs WebGL to draw 3D. Try enabling hardware acceleration in your browser settings, updating your graphics driver, or using a recent Chrome, Edge or Firefox.
              </div>
            ) : (
              <>
                <div className="label">Recommended settings</div>
                <div className="row" style={{ gap: 8, margin: '8px 0 12px', flexWrap: 'wrap' }}>
                  {(['low', 'medium', 'high', 'ultra'] as Preset[]).map((p) => (
                    <button key={p} className={`btn ${choice === p ? 'primary' : ''}`} style={{ flex: 1, minWidth: 110, padding: '10px 8px', position: 'relative' }} onClick={() => setChoice(p)}>
                      {PRESET_INFO[p].title}
                      <div className="tiny" style={{ textTransform: 'none', letterSpacing: 0, opacity: 0.75 }}>{PRESET_INFO[p].sub}</div>
                      {report.recommended === p && <span className="tag" style={{ position: 'absolute', top: -9, right: 6, background: '#0b0e11', color: 'var(--green)', borderColor: 'var(--green)' }}>BEST FOR YOU</span>}
                    </button>
                  ))}
                </div>
                {report.bench && (
                  <Row
                    k="Measured render time"
                    v={`${report.bench.highMedianMs.toFixed(1)} ms per frame (≈ ${estFps(report.bench.highMedianMs)} FPS estimate)`}
                    note={`${report.bench.frames} test frames at ${report.bench.resolution} · uneven frames (95th %): ${report.bench.highP95Ms.toFixed(1)} ms`}
                  />
                )}
                <Row k="Graphics chip" v={report.rendererHidden ? 'Hidden by your browser (privacy)' : (report.renderer ?? '—')} />
                <Row k="Processors · memory" v={`${report.cores ?? '?'} logical · ${report.memoryGB ? `≈${report.memoryGB} GB` : 'memory not reported'}`} note="Browsers round or hide these values" />
                <div className="tiny dim" style={{ marginTop: 10, lineHeight: 1.6 }}>
                  {report.reasons.map((r, i) => <div key={i}>• {r}</div>)}
                </div>
                {choice !== report.recommended && <div className="tiny amber" style={{ marginTop: 6 }}>You picked a different preset — it will be saved as your custom choice.</div>}
              </>
            )}
            <div className="between" style={{ marginTop: 16 }}>
              <span className="tiny dim">Change anytime: Settings → Graphics</span>
              <button className="btn primary" style={{ padding: '11px 26px' }} onClick={accept}>Continue ▸</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
