import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Heightfield } from '../core/terrain';
import { runtime } from '../player/PlayerController';
import { nextEarthStep } from './earthGuide';

/** A tall cyan light pillar + ground ring marking the next objective. */
export function GuideBeacon({ hf, getTarget }: { hf: Heightfield; getTarget?: () => [number, number] | null }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pillar = useRef<THREE.Mesh>(null);
  const pillarMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; uniform float uAlpha; varying vec2 vUv;
          void main(){
            float fade = (1.0 - vUv.y) * (0.55 + 0.45*sin(uTime*2.5 - vUv.y*12.0));
            float edge = 1.0 - abs(vUv.x - 0.5)*2.0;
            gl_FragColor = vec4(vec3(0.31,0.82,0.77) * fade * (0.4 + edge), fade * uAlpha * 0.9);
          }`,
      }),
    [],
  );
  const acc = useRef(10);
  const target = useRef<[number, number] | null>(null);
  useFrame(({ clock }, dt) => {
    acc.current += dt;
    if (acc.current > (getTarget ? 0.1 : 0.4)) {
      acc.current = 0;
      target.current = getTarget ? getTarget() : nextEarthStep().target ?? null;
    }
    const g = group.current;
    if (!g) return;
    const t = target.current;
    g.visible = !!t;
    if (!t) return;
    g.position.set(t[0], hf.height(t[0], t[1]), t[1]);
    const d = Math.hypot(runtime.pos.x - t[0], runtime.pos.z - t[1]);
    pillarMat.uniforms.uTime.value = clock.elapsedTime;
    if (pillar.current) { const w = Math.min(4, Math.max(1, d / 70)); pillar.current.scale.set(w, 1, w); }
    pillarMat.uniforms.uAlpha.value = Math.min(1, Math.max(0.15, (d - 6) / 30));
    if (ring.current) {
      const s = 1 + (clock.elapsedTime % 1.6) * 1.2;
      ring.current.scale.setScalar(s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.9 - (clock.elapsedTime % 1.6) / 1.8;
    }
  });
  return (
    <group ref={group}>
      <mesh ref={pillar} material={pillarMat} position={[0, 45, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 90, 16, 1, true]} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[2.2, 2.6, 48]} />
        <meshBasicMaterial color="#4fd1c5" transparent opacity={0.8} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}
