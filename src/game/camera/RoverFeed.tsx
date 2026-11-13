import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MarsWorld } from '../environments/mars/MarsWorld';
import { RoverModel, MAST_HEAD } from '../rover/Rover';
import { rover, stepRover, CAMS } from '../rover/roverSim';
import { sharedUniforms } from '../core/shaders';
import { useGame } from '../core/store';
import { fxState } from '../core/fx';

export const feedState = { cine: 0, exposure: 0, blur: 0 };

function CameraRig() {
  const { camera, gl } = useThree();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const smoothQ = useRef(new THREE.Quaternion());
  const smoothP = useRef(new THREE.Vector3());
  const init = useRef(false);
  useEffect(() => { rover.canvas = gl.domElement; }, [gl]);
  useFrame(({ clock }, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    dummy.position.set(rover.x, rover.y + 0.62, rover.z);
    dummy.rotation.order = 'YXZ';
    dummy.rotation.set(rover.pitch, rover.heading, rover.roll);
    dummy.updateMatrixWorld();
    const local = new THREE.Vector3();
    const look = new THREE.Euler(0, 0, 0, 'YXZ');
    let fov = 60;
    const id = rover.cam;
    if (id === 'NAVCAM' || id === 'MASTCAM') {
      local.copy(MAST_HEAD).add(new THREE.Vector3(0, 0.02, -0.24));
      look.set(rover.camPitch, rover.camYaw, 0);
      fov = id === 'MASTCAM' ? 34 / rover.zoom : 60;
    } else if (id === 'HAZ-F') {
      local.set(0, -0.05, -1.22);
      look.set(-0.42, 0, 0);
      fov = 100;
    } else if (id === 'HAZ-R') {
      local.set(0, -0.05, 1.22);
      look.set(-0.42, Math.PI, 0);
      fov = 100;
    } else if (id === 'ARMCAM') {
      local.set(-0.5, 0.35, -2.0 + (1 - rover.armOut) * 0.6);
      look.set(-1.1, 0.15, 0);
      fov = 42;
    }
    const worldPos = local.clone().applyMatrix4(dummy.matrixWorld);
    const q = new THREE.Quaternion().setFromEuler(look).premultiply(dummy.quaternion);

    // Establishing cinematic orbit (reconstructed visualisation)
    if (feedState.cine > 0) {
      feedState.cine = Math.max(0, feedState.cine - dt);
      const t = 9 - feedState.cine;
      const a = t * 0.22 + 0.6;
      const r = 9 - t * 0.5;
      const pos = new THREE.Vector3(rover.x + Math.sin(a) * r, rover.y + 2.2 + Math.max(0, 4 - t) * 1.2, rover.z + Math.cos(a) * r);
      cam.position.copy(pos);
      cam.lookAt(rover.x, rover.y + 1, rover.z);
      cam.fov = 45;
      cam.updateProjectionMatrix();
      init.current = false;
      return;
    }
    // vibration while driving (mechanical)
    const vib = Math.min(1, Math.abs(rover.v)) * 0.004;
    worldPos.y += Math.sin(clock.elapsedTime * 37) * vib;
    if (!init.current) { smoothP.current.copy(worldPos); smoothQ.current.copy(q); init.current = true; }
    smoothP.current.copy(worldPos);
    smoothQ.current.slerp(q, 1 - Math.exp(-dt * 9)); // slight mechanical stabilisation lag
    cam.position.copy(smoothP.current);
    cam.quaternion.copy(smoothQ.current);
    fxState.zoom += (fxState.zoomTarget - fxState.zoom) * Math.min(1, dt * 14);
    fov *= 1 - 0.45 * fxState.zoom;
    cam.fov += (fov - cam.fov) * Math.min(1, dt * (fxState.zoomTarget > 0 ? 18 : 6));
    cam.near = 0.05;
    cam.updateProjectionMatrix();
    rover.camPos.copy(cam.position);
    cam.getWorldDirection(rover.camDir);
    rover.camFov = cam.fov;
    gl.toneMappingExposure = 1 + feedState.exposure * 0.6;
    sharedUniforms.uThermal.value = rover.thermalView ? 1 : 0;
    // arm animation
    const armTarget = rover.mode === 'ARM' ? 1 : 0;
    rover.armOut += (armTarget - rover.armOut) * Math.min(1, dt * 1.2);
  });
  return null;
}

/** Runs the rover simulation independently of whether the feed is visible. */
export function useRoverLoop(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let raf = 0, last = performance.now();
    const loop = () => {
      const now = performance.now();
      // Sub-step so simulation speed does not depend on frame rate (capped at 0.5 s catch-up)
      let dt = Math.min(0.5, (now - last) / 1000);
      while (dt > 1e-4) {
        const h = Math.min(dt, 0.033);
        stepRover(h);
        dt -= h;
      }
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

export function RoverFeedCanvas() {
  const quality = useGame((s) => s.settings.quality);
  return (
    <Canvas
      shadows={quality !== 'low'}
      dpr={quality === 'high' ? [1, 1.5] : quality === 'medium' ? [1, 1.25] : [0.7, 1]}
      gl={{ preserveDrawingBuffer: true, antialias: quality !== 'low', toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ fov: 60, near: 0.05, far: 6000, position: [0, 3, 60] }}
    >
      <MarsWorld />
      <RoverModel />
      <CameraRig />
    </Canvas>
  );
}

export { CAMS };
