import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { useGame } from './store';
import { gfxDpr } from './graphics';
import { recordFrame } from './perf';

/** Caps the frame rate by switching R3F to on-demand rendering and invalidating at the target interval. */
function FrameLimiter({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let raf = 0, last = 0;
    const interval = 1000 / fps;
    const loop = (t: number) => {
      if (t - last >= interval - 1) { last = t; invalidate(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps, invalidate]);
  return null;
}

function PerfProbe() {
  useFrame(() => recordFrame(performance.now()));
  return null;
}

interface Props {
  children: ReactNode;
  camera: { fov: number; near: number; far: number; position: [number, number, number] };
  preserve?: boolean; // keep the drawing buffer (needed for photo capture)
  shadowsAllowed?: boolean;
  monitor?: boolean; // feed the performance monitor
  onCreated?: (s: RootState) => void;
}

/**
 * The game's main canvas. Applies the graphics settings (resolution, antialiasing, shadows, view
 * distance, frame cap) and recovers from WebGL context loss by recreating the canvas.
 */
export function GameCanvas({ children, camera, preserve = false, shadowsAllowed = true, monitor = true, onCreated }: Props) {
  const gfx = useGame((s) => s.settings.gfx);
  const [gen, setGen] = useState(0);
  const [lost, setLost] = useState(false);
  const cleanup = useRef<() => void>();
  useEffect(() => () => cleanup.current?.(), []);

  const created = (s: RootState) => {
    const el = s.gl.domElement;
    const onLost = (e: Event) => { e.preventDefault(); setLost(true); };
    const onRestored = () => { setLost(false); setGen((g) => g + 1); };
    el.addEventListener('webglcontextlost', onLost);
    el.addEventListener('webglcontextrestored', onRestored);
    cleanup.current?.();
    cleanup.current = () => { el.removeEventListener('webglcontextlost', onLost); el.removeEventListener('webglcontextrestored', onRestored); };
    onCreated?.(s);
  };

  return (
    <>
      <Canvas
        key={`${gen}-${gfx.aa ? 'aa' : 'noaa'}`}
        frameloop={gfx.fpsLimit ? 'demand' : 'always'}
        shadows={shadowsAllowed && gfx.shadows !== 'off'}
        dpr={gfxDpr(gfx)}
        gl={{ preserveDrawingBuffer: preserve, antialias: gfx.aa, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance' }}
        camera={{ ...camera, far: camera.far * gfx.viewDistance }}
        onCreated={created}
      >
        {gfx.fpsLimit ? <FrameLimiter fps={gfx.fpsLimit} /> : null}
        {monitor && <PerfProbe />}
        {children}
      </Canvas>
      {lost && (
        <div className="overlay" style={{ zIndex: 95 }}>
          <div className="window" style={{ padding: 22, width: 420 }}>
            <div className="win-title" style={{ color: 'var(--amber)' }}>Graphics reset</div>
            <p className="small" style={{ lineHeight: 1.6 }}>The graphics driver reset (WebGL context lost). The game is trying to recover. If it doesn’t, reload the scene or use a lower preset.</p>
            <div className="row">
              <button className="btn primary" onClick={() => { setLost(false); setGen((g) => g + 1); }}>Reload scene</button>
              <button className="btn" onClick={() => { const g = useGame.getState(); g.applyGfx({ ...g.settings.gfx, resScale: 0.7, shadows: 'off', density: 0.5, particles: 0.35, preset: 'custom' }, { custom: true }); setLost(false); setGen((x) => x + 1); }}>Use lighter settings</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
