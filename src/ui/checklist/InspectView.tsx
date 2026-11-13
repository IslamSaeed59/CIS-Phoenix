import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { useUI } from '../../game/core/ui';
import { useGame } from '../../game/core/store';
import { EARTH_POI_BY_ID, type EarthPOI } from '../../data/earth/earthData';
import { CATEGORIES, CAT_BY_ID, type CategoryId } from '../../data/scientific-checklist/categories';
import { audio } from '../../game/core/audio';
import { logEvidence, earthLocation } from '../../game/instruments/earthInstruments';
import { makeRockGeometry } from '../../game/core/shaders';
import { mulberry32 } from '../../game/core/noise';
import { toast } from '../../game/core/ui';
import { playFP } from '../../game/player/fpAnim';
import { runtime } from '../../game/player/PlayerController';

function Specimen({ type }: { type: EarthPOI['specimen'] }) {
  const content = useMemo(() => {
    const rnd = mulberry32(type.length * 7);
    switch (type) {
      case 'salt-crust':
      case 'gravel':
      case 'ripple':
      case 'channel': {
        const g = new THREE.BoxGeometry(2, 0.4, 2, 90, 6, 90);
        const p = g.attributes.position as THREE.BufferAttribute;
        const col = new Float32Array(p.count * 3);
        const c = new THREE.Color();
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          let h = 0;
          if (y > 0.19) {
            if (type === 'salt-crust') {
              // polygon rims via distance to pseudo-voronoi seeds
              let d1 = 9, d2 = 9;
              for (let k = 0; k < 9; k++) {
                const sx = ((k % 3) - 1) * 0.75 + Math.sin(k * 3.1) * 0.25, sz = (Math.floor(k / 3) - 1) * 0.75 + Math.cos(k * 1.7) * 0.25;
                const d = Math.hypot(x - sx, z - sz);
                if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
              }
              const rim = Math.max(0, 1 - (d2 - d1) / 0.12);
              h = rim * 0.12 + Math.sin(x * 40) * Math.cos(z * 37) * 0.006;
              c.set(rim > 0.3 ? '#f2efe8' : '#c8bda6').lerp(new THREE.Color('#b0a185'), Math.random() * 0.2);
            } else if (type === 'ripple') {
              h = Math.pow(Math.sin((x + z) * 9) * 0.5 + 0.5, 2) * 0.05;
              c.set('#c9ad84').multiplyScalar(0.9 + h * 3);
            } else if (type === 'gravel') {
              h = Math.random() * 0.005;
              c.set('#a99a82');
            } else {
              h = Math.random() * 0.01;
              c.set(z < -0.4 ? '#e7e3da' : '#958b7c');
            }
          } else c.set(type === 'salt-crust' ? (Math.floor((y + 0.2) * 20) % 2 ? '#e4ddcf' : '#b9a58a') : '#8c7f6c');
          p.setY(i, y + h);
          col.set([c.r, c.g, c.b], i * 3);
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.computeVertexNormals();
        const extras: JSX.Element[] = [];
        if (type === 'gravel' || type === 'channel') {
          for (let k = 0; k < 40; k++) {
            const geo = makeRockGeometry(k, 1);
            const s = 0.06 + rnd() * 0.12;
            extras.push(
              <mesh key={k} geometry={geo} position={[(rnd() - 0.5) * 1.8, 0.22 + s * 0.3, (rnd() - 0.5) * 1.8]} scale={[s * 1.3, s * (type === 'channel' ? 1 : 0.6), s]} castShadow>
                <meshStandardMaterial color={type === 'gravel' ? '#3c3833' : '#8a8073'} roughness={type === 'gravel' ? 0.35 : 0.8} metalness={0.05} />
              </mesh>,
            );
          }
        }
        return (
          <>
            <mesh geometry={g} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={0.85} /></mesh>
            {extras}
          </>
        );
      }
      case 'halite': {
        const items: JSX.Element[] = [];
        for (let k = 0; k < 34; k++) {
          const s = 0.1 + Math.pow(rnd(), 2) * 0.45;
          items.push(
            <mesh key={k} position={[(rnd() - 0.5) * 1.4, rnd() * 0.5, (rnd() - 0.5) * 1.4]} rotation={[rnd(), rnd() * 6, rnd()]} castShadow receiveShadow>
              <boxGeometry args={[s, s, s]} />
              <meshPhysicalMaterial color="#f4f1ea" roughness={0.25} transmission={0.25} thickness={0.5} clearcoat={0.5} />
            </mesh>,
          );
        }
        return (
          <>
            <mesh position={[0, -0.1, 0]} receiveShadow><cylinderGeometry args={[1, 1.1, 0.25, 32]} /><meshStandardMaterial color="#d9d3c6" roughness={0.9} /></mesh>
            {items}
          </>
        );
      }
      case 'yardang':
      case 'strata':
      case 'overhang': {
        const layers: JSX.Element[] = [];
        const n = type === 'yardang' ? 9 : 12;
        for (let k = 0; k < n; k++) {
          const resist = rnd() > 0.5;
          const w = type === 'yardang' ? 2 * (1 - k / (n + 3)) : 2;
          const inset = resist ? 0 : 0.08;
          const colr = k % 2 ? '#c2a47e' : resist ? '#9a6c50' : '#b38e6b';
          layers.push(
            <mesh key={k} position={[type === 'yardang' ? k * 0.03 : 0, -0.6 + k * 0.13, 0]} castShadow receiveShadow>
              <boxGeometry args={[w - inset, 0.13, (type === 'yardang' ? 0.9 : 1.2) - inset]} />
              <meshStandardMaterial color={colr} roughness={0.95} />
            </mesh>,
          );
          if (type === 'strata' && k % 4 === 2) {
            layers.push(
              <mesh key={'v' + k} position={[0, -0.6 + k * 0.13 + 0.066, 0.61]}>
                <boxGeometry args={[2, 0.015, 0.01]} />
                <meshStandardMaterial color="#ffffff" emissive="#555" />
              </mesh>,
            );
          }
        }
        if (type === 'overhang') {
          layers.push(
            <mesh key="cut" position={[0, -0.25, 0.4]}>
              <boxGeometry args={[1.6, 0.5, 0.5]} />
              <meshStandardMaterial color="#1b130e" />
            </mesh>,
          );
        }
        return <group rotation={[0, type === 'yardang' ? -0.4 : 0, 0]}>{layers}</group>;
      }
      default:
        return null;
    }
  }, [type]);
  return <group>{content}</group>;
}

export function InspectView() {
  const id = useUI((s) => s.inspectPoi)!;
  const poi = EARTH_POI_BY_ID[id];
  const setPanel = useUI((s) => s.setPanel);
  const g = useGame();
  const [seen, setSeen] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [cat, setCat] = useState<CategoryId | ''>((g.inspectClass[id] as CategoryId) ?? '');
  const [feedback, setFeedback] = useState<string>('');
  const evKey = `inspect:${id}`;
  const done = !!g.earthEvidence[evKey];
  const features = poi.features ?? [];
  const allSeen = done || seen.length >= features.length;
  const sampled = g.samples.some((s) => s.poi === id);

  const close = () => { setPanel(null); useUI.getState().setInspect(null); audio.ui('close'); };

  const record = () => recordAs(cat as CategoryId);
  const recordAs = (cat: CategoryId) => {
    if (!cat) return;
    if (!poi.categories.includes(cat)) {
      audio.ui('error');
      setFeedback(`Reconsider: these observations relate most directly to ${poi.categories.map((c) => CAT_BY_ID[c].title).join(' / ')}. Which do they support?`);
      return;
    }
    g.setInspectClass(id, cat);
    setPanel(null);
    useUI.getState().setInspect(null);
    logEvidence(evKey, 'Visual inspection', `${features.length} features observed · filed under ${CAT_BY_ID[cat].short}`);
    features.forEach((f) =>
      g.addJournal({ world: 'earth', kind: 'observation', title: `${poi.name}: ${f.label}`, text: f.text, cat }),
    );
    setFeedback('Recorded! Close this window to keep exploring.');
  };

  const collect = () => {
    const n = g.samples.length;
    if (n >= 6) { toast('Sample case full', 'You can carry 6 samples.', 'warn'); return; }
    const sid = `QB-${String(n + 1).padStart(3, '0')}`;
    setPanel(null);
    useUI.getState().setInspect(null);
    useUI.getState().setRaised(false);
    // Kneel, scoop the sample into a jar, lift it up to look at it — then log it
    playFP('pickup', 2600, runtime.pitch, () => {
      if (useGame.getState().addSample({ id: sid, poi: id, name: poi.name, location: earthLocation() })) {
        logEvidence(`sample:${id}`, 'Sampling kit', `Sample ${sid}`);
        useGame.getState().addJournal({ world: 'earth', kind: 'sample', title: `Sample ${sid} collected`, text: `${poi.name}. Stored in a sealed jar.`, cat: poi.categories[0] });
      }
    });
  };

  return (
    <div className="overlay" style={{ background: 'rgba(3,5,7,.82)' }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="window" style={{ width: 'min(1200px, 94vw)', height: 'min(760px, 90vh)' }}>
        <div className="win-head">
          <span className="win-title">Inspection · {poi.name}</span>
          <div className="row">
            <span className="tag">{earthLocation()}</span>
            <button className="btn sm" onClick={close}>Close [Esc]</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', flex: 1, minHeight: 0 }}>
          <div style={{ position: 'relative', background: 'radial-gradient(circle at 50% 40%, #1b2329, #07090b)' }}>
            <Canvas shadows camera={{ position: [2.2, 1.8, 2.6], fov: 40 }}>
              <ambientLight intensity={0.5} />
              <directionalLight position={[3, 5, 2]} intensity={2.2} castShadow />
              <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#9cc" />
              <Specimen type={poi.specimen} />
              {features.map((f, i) => (
                <Html key={i} position={f.pos} center>
                  <button
                    onClick={() => { setActive(i); if (!seen.includes(i)) setSeen([...seen, i]); audio.ui('click'); }}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', border: `2px solid ${seen.includes(i) || done ? '#6ee7a0' : '#4fd1c5'}`,
                      background: active === i ? '#4fd1c5' : 'rgba(0,0,0,.5)', color: '#fff', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--mono)',
                      boxShadow: '0 0 12px rgba(79,209,197,.6)',
                    }}
                    className={seen.includes(i) || done ? '' : 'pulse'}
                  >
                    {i + 1}
                  </button>
                </Html>
              ))}
              <OrbitControls enablePan={false} minDistance={1.8} maxDistance={6} />
            </Canvas>
            <div className="mono tiny dim" style={{ position: 'absolute', left: 12, bottom: 10 }}>DRAG TO ROTATE · SCROLL TO ZOOM · CLICK MARKERS TO OBSERVE · SPECIMEN: ILLUSTRATIVE MODEL</div>
          </div>
          <div className="scroll" style={{ padding: 16, borderLeft: '1px solid var(--line)' }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 0 }}>{poi.description}</p>
            <div className="label">Observation points {done ? features.length : seen.length}/{features.length}</div>
            {features.map((f, i) => (
              <div key={i} className={`card ${active === i ? 'sel' : ''}`} style={{ marginTop: 6, cursor: 'pointer', opacity: seen.includes(i) || done ? 1 : 0.55 }} onClick={() => { setActive(i); if (!seen.includes(i)) setSeen([...seen, i]); }}>
                <div className="between"><span style={{ fontSize: 12.5, fontWeight: 500 }}>{i + 1}. {f.label}</span>{(seen.includes(i) || done) && <span className="tiny green mono">OBSERVED</span>}</div>
                {(seen.includes(i) || done) && <div className="small dim" style={{ marginTop: 4, lineHeight: 1.45 }}>{f.text}</div>}
              </div>
            ))}
            <div className="hr" />
            <button className="btn primary" style={{ width: '100%', padding: '12px', fontSize: 13 }} disabled={!allSeen || done} onClick={() => { setCat(poi.categories[0]); recordAs(poi.categories[0]); }}>
              {done ? 'Observation recorded ✓' : allSeen ? 'Record observation ▸' : `Click the glowing dots (${seen.length}/${features.length})`}
            </button>
            {feedback && <div className="small" style={{ marginTop: 6, color: feedback.startsWith('Reconsider') ? 'var(--amber)' : 'var(--green)', lineHeight: 1.45 }}>{feedback}</div>}
            {poi.spectral && <div className="tiny" style={{ marginTop: 10, color: 'var(--amber)' }}>Tip: a Spectral Scanner reading gives a PRELIMINARY composition. Lab analysis is needed for confirmation.</div>}
            {poi.sampleable && (
              <>
                <div className="hr" />
                <div className="between">
                  <div>
                    <div className="label">Sampling</div>
                    <div className="tiny dim">Sealed sample bag · field-lab analysis available on tablet</div>
                  </div>
                  <button className="btn amber" disabled={sampled} onClick={collect}>{sampled ? 'Sample collected ✓' : 'Collect sample'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
