import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { rover } from './roverSim';
import { patchMaterial } from '../core/shaders';

const WHEELS: [number, number][] = [[-1.05, -1.25], [-1.1, 0], [-1.05, 1.15], [1.05, -1.25], [1.1, 0], [1.05, 1.15]];
export const MAST_HEAD = new THREE.Vector3(0.55, 2.05, -0.85); // local position of the mast camera head

function Wheel() {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.26, 0.26, 0.4, 28, 1);
    g.rotateZ(Math.PI / 2);
    return g;
  }, []);
  const tread = useMemo(() => {
    const g = new THREE.BoxGeometry(0.42, 0.03, 0.05);
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color="#a9adb1" metalness={0.7} roughness={0.45} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} geometry={tread} position={[0, Math.cos(a) * 0.262, Math.sin(a) * 0.262]} rotation={[-a, 0, 0]}>
            <meshStandardMaterial color="#6d7176" metalness={0.6} roughness={0.5} />
          </mesh>
        );
      })}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.42, 12]} />
        <meshStandardMaterial color="#3a3d40" metalness={0.5} />
      </mesh>
    </group>
  );
}

export function RoverModel({ showArm = true, local = false }: { showArm?: boolean; local?: boolean }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const spins = useRef<(THREE.Group | null)[]>([]);
  const mastHead = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const forearm = useRef<THREE.Group>(null);
  const mats = useMemo(() => {
    const white = patchMaterial(new THREE.MeshStandardMaterial({ color: '#e7e4dc', metalness: 0.2, roughness: 0.55 }), { absorb: 0.3, inertia: 0.2 });
    const gold = patchMaterial(new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.85, roughness: 0.3 }), { absorb: 0.3, inertia: 0.1 });
    const dark = patchMaterial(new THREE.MeshStandardMaterial({ color: '#2b2e33', metalness: 0.5, roughness: 0.4 }), { absorb: 0.9, inertia: 0.2 });
    const metal = patchMaterial(new THREE.MeshStandardMaterial({ color: '#9ea3a8', metalness: 0.8, roughness: 0.35 }), { absorb: 0.5, inertia: 0.2 });
    const panel = patchMaterial(new THREE.MeshStandardMaterial({ color: '#1b2a4a', metalness: 0.6, roughness: 0.25, emissive: '#05080f' }), { absorb: 0.95, inertia: 0.1 });
    return { white, gold, dark, metal, panel };
  }, []);

  useFrame(() => {
    if (!root.current) return;
    root.current.rotation.order = 'YXZ';
    if (local) {
      root.current.position.set(0, 0, 0);
      root.current.rotation.set(0, 0, 0);
    } else {
      root.current.position.set(rover.x, rover.y + 0.62, rover.z);
      root.current.rotation.set(rover.pitch, rover.heading, rover.roll);
    }
    WHEELS.forEach(([, lz], i) => {
      const w = wheels.current[i];
      if (w) {
        w.position.y = -0.36 + rover.wheelOffsets[i];
        const steerable = i % 3 !== 1;
        w.rotation.y = steerable ? rover.steer * 0.45 * (lz < 0 ? 1 : -1) : 0;
      }
      const s = spins.current[i];
      if (s) s.rotation.x = -rover.wheelRot;
    });
    if (mastHead.current) {
      mastHead.current.rotation.y = rover.camYaw;
      mastHead.current.children[0] && (mastHead.current.children[0].rotation.x = rover.camPitch);
    }
    if (arm.current && forearm.current) {
      const k = rover.armOut;
      arm.current.rotation.x = -0.2 - k * 0.9;
      forearm.current.rotation.x = 2.4 - k * 2.2;
    }
  });

  return (
    <group ref={root}>
      <group ref={body}>
        {/* Chassis / warm electronics box */}
        <mesh material={mats.white} position={[0, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.5, 2.3]} />
        </mesh>
        <mesh material={mats.gold} position={[0, -0.18, 0]} castShadow>
          <boxGeometry args={[1.4, 0.08, 2.2]} />
        </mesh>
        {/* Solar array deck */}
        <mesh material={mats.panel} position={[0, 0.39, 0.15]} castShadow>
          <boxGeometry args={[2.4, 0.04, 2.1]} />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i} position={[-1.0 + i * 0.4, 0.415, 0.15]}>
            <boxGeometry args={[0.01, 0.005, 2.05]} />
            <meshStandardMaterial color="#8aa0c8" metalness={0.8} />
          </mesh>
        ))}
        {/* Calibration target */}
        <mesh position={[0.85, 0.44, 0.9]}>
          <boxGeometry args={[0.18, 0.02, 0.18]} />
          <meshStandardMaterial color="#d8d8d8" />
        </mesh>
        {[['#c33', -0.04, -0.04], ['#3a3', 0.04, -0.04], ['#36c', -0.04, 0.04], ['#ddd', 0.04, 0.04]].map(([c, x, z], i) => (
          <mesh key={i} position={[0.85 + (x as number), 0.455, 0.9 + (z as number)]}>
            <cylinderGeometry args={[0.025, 0.025, 0.01, 12]} />
            <meshStandardMaterial color={c as string} />
          </mesh>
        ))}
        {/* High-gain antenna */}
        <group position={[-0.55, 0.55, 0.65]}>
          <mesh material={mats.metal} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.25, 8]} />
          </mesh>
          <mesh material={mats.white} position={[0, 0.28, 0]} rotation={[0.5, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.04, 24]} />
          </mesh>
        </group>
        {/* UHF antenna */}
        <mesh material={mats.metal} position={[-0.6, 0.75, 1.0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.7, 6]} />
        </mesh>
        {/* Mast */}
        <mesh material={mats.white} position={[0.55, 1.2, -0.85]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, 1.7, 10]} />
        </mesh>
        <group ref={mastHead} position={[0.55, 2.05, -0.85]}>
          <group>
            <mesh material={mats.white} castShadow>
              <boxGeometry args={[0.55, 0.22, 0.25]} />
            </mesh>
            {[-0.18, -0.06, 0.06, 0.18].map((x, i) => (
              <mesh key={i} material={mats.dark} position={[x, 0, -0.13]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.04, 12]} />
              </mesh>
            ))}
          </group>
        </group>
        {/* Hazcams */}
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} material={mats.dark} position={[x, -0.05, -1.17]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.05, 10]} />
          </mesh>
        ))}
        {[-0.3, 0.3].map((x) => (
          <mesh key={'r' + x} material={mats.dark} position={[x, -0.05, 1.17]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.05, 10]} />
          </mesh>
        ))}
        {/* Robotic arm with turret */}
        {showArm && (
          <group position={[-0.5, 0.0, -1.2]}>
            <group ref={arm}>
              <mesh material={mats.metal} position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
              </mesh>
              <group ref={forearm} position={[0, 0, -0.7]}>
                <mesh material={mats.metal} position={[0, 0, -0.32]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.035, 0.035, 0.64, 8]} />
                </mesh>
                <mesh material={mats.white} position={[0, -0.08, -0.68]} castShadow>
                  <boxGeometry args={[0.2, 0.2, 0.18]} />
                </mesh>
                <mesh material={mats.dark} position={[0, -0.2, -0.68]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.08, 10]} />
                </mesh>
              </group>
            </group>
          </group>
        )}
        {/* Rocker-bogie suspension legs */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh material={mats.metal} position={[side * 0.95, -0.05, -0.55]} rotation={[0.55, 0, 0]} castShadow>
              <boxGeometry args={[0.06, 0.06, 1.4]} />
            </mesh>
            <mesh material={mats.metal} position={[side * 0.95, -0.15, 0.6]} rotation={[-0.35, 0, 0]} castShadow>
              <boxGeometry args={[0.06, 0.06, 1.2]} />
            </mesh>
            <mesh material={mats.dark} position={[side * 0.86, 0.05, 0.05]}>
              <sphereGeometry args={[0.07, 10, 10]} />
            </mesh>
          </group>
        ))}
      </group>
      {WHEELS.map(([lx, lz], i) => (
        <group key={i} ref={(el) => (wheels.current[i] = el)} position={[lx, -0.36, lz]}>
          <mesh material={mats.metal} position={[0, 0.25, 0]}>
            <boxGeometry args={[0.05, 0.5, 0.05]} />
          </mesh>
          <group ref={(el) => (spins.current[i] = el)}>
            <Wheel />
          </group>
        </group>
      ))}
    </group>
  );
}
