import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGame, type World, type ScanRecord } from '../../game/core/store';
import { CATEGORIES, CAT_BY_ID, type CategoryId } from '../../data/scientific-checklist/categories';
import { fmtTime } from '../common';
import { audio } from '../../game/core/audio';
import { toast } from '../../game/core/ui';
import type { Heightfield } from '../../game/core/terrain';
import { mulberry32 } from '../../game/core/noise';

// ---------------------------------------------------------------- Journal
export function JournalView({ world }: { world: World | 'all' }) {
  const journal = useGame((s) => s.journal);
  const [filter, setFilter] = useState<string>('all');
  const list = journal.filter((j) => (world === 'all' || j.world === world || j.world === 'hq') && (filter === 'all' || j.kind === filter));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="row" style={{ padding: 10, gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--line)' }}>
        {['all', 'observation', 'interpretation', 'scan', 'photo', 'sample', 'lab', 'event'].map((f) => (
          <button key={f} className={`btn sm ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="scroll" style={{ padding: 12, flex: 1 }}>
        {list.length === 0 && <div className="dim small">No journal entries yet.</div>}
        {list.map((j) => (
          <div key={j.id} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
            <div className="between">
              <span style={{ fontSize: 13, fontWeight: 500 }}>{j.title}</span>
              <span className="tiny mono dim">{j.world.toUpperCase()} · {fmtTime(j.time)}</span>
            </div>
            <div className="row" style={{ gap: 6, margin: '4px 0' }}>
              <span className={`tag ${j.kind === 'interpretation' ? 'prelim' : ''}`}>{j.kind === 'interpretation' ? 'INTERPRETATION' : j.kind === 'observation' ? 'OBSERVATION' : j.kind}</span>
              {j.cat && <span className="tag">{CAT_BY_ID[j.cat].num} {CAT_BY_ID[j.cat].short}</span>}
            </div>
            <div className="small" style={{ color: '#b9c6c8', lineHeight: 1.5 }}>{j.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Gallery
export function GalleryView({ world, mapImage, mapExtent, storage }: { world: World; mapImage?: HTMLCanvasElement; mapExtent?: number; storage?: { onDownlink: (id: number) => void; busy: number | null } }) {
  const photos = useGame((s) => s.photos).filter((p) => p.world === world);
  const update = useGame((s) => s.updatePhoto);
  const remove = useGame((s) => s.deletePhoto);
  const lastId = photos.length ? photos[photos.length - 1].id : null;
  const [sel, setSel] = useState<number | null>(lastId);
  const p = photos.find((x) => x.id === sel) ?? photos[photos.length - 1];
  const [cap, setCap] = useState(p?.caption ?? '');
  useEffect(() => setCap(p?.caption ?? ''), [p?.id]);
  if (!photos.length) return <div className="dim small" style={{ padding: 16 }}>No photographs in the archive yet. {world === 'earth' ? 'Use the Field Camera [1].' : 'Capture from the rover camera feed.'}</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', height: '100%', minHeight: 0 }}>
      <div className="scroll" style={{ padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {[...photos].reverse().map((ph) => (
            <div key={ph.id} className={`card ${p?.id === ph.id ? 'sel' : ''}`} style={{ padding: 5, cursor: 'pointer' }} onClick={() => { setSel(ph.id); audio.ui('click'); }}>
              <img className="thumb" src={ph.thumb} />
              <div className="between tiny mono" style={{ marginTop: 4 }}>
                <span>IMAGE {String(ph.id).padStart(4, '0')}</span>
                <span className={ph.important ? 'amber' : 'dim'}>{ph.important ? '★' : ph.category ? CAT_BY_ID[ph.category].short : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {p && (
        <div className="scroll" style={{ borderLeft: '1px solid var(--line)', padding: 12 }}>
          <img className="thumb" src={p.thumb} style={{ marginBottom: 8 }} />
          <div className="mono small" style={{ lineHeight: 1.7 }}>
            <div><span className="dim">IMAGE</span> {String(p.id).padStart(4, '0')}</div>
            <div><span className="dim">LOCATION</span> {p.location}</div>
            <div><span className="dim">INSTRUMENT</span> {p.instrument}</div>
            <div><span className="dim">SUBJECTS</span> {p.pois.length ? p.pois.join(', ') : 'none catalogued'}</div>
            <div><span className="dim">STATUS</span> {p.onboard ? <span className="amber">ONBOARD — awaiting downlink</span> : p.status}</div>
            <div><span className="dim">CAPTURED</span> {fmtTime(p.time)}</div>
          </div>
          <div className="label" style={{ marginTop: 10 }}>Caption</div>
          <input className="input" value={cap} onChange={(e) => setCap(e.target.value)} onBlur={() => update(p.id, { caption: cap })} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') update(p.id, { caption: cap }); }} />
          <div className="label" style={{ marginTop: 10 }}>Research category</div>
          <select className="select" style={{ width: '100%' }} value={p.category ?? ''} onChange={(e) => update(p.id, { category: (e.target.value || null) as CategoryId | null })}>
            <option value="">— unassigned —</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.num} {c.title}</option>)}
          </select>
          <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <button className={`btn sm ${p.important ? 'amber' : ''}`} onClick={() => update(p.id, { important: !p.important })}>{p.important ? '★ Important' : '☆ Mark important'}</button>
            <button className="btn sm" onClick={() => { update(p.id, { status: 'Reviewed' }); audio.ui('confirm'); }} disabled={p.status !== 'Awaiting analysis' || !!p.onboard}>Mark reviewed</button>
            {storage && p.onboard && <button className="btn sm primary" disabled={storage.busy !== null} onClick={() => storage.onDownlink(p.id)}>{storage.busy === p.id ? 'Downlinking…' : 'Downlink'}</button>}
            <button className="btn sm danger" onClick={() => { remove(p.id); setSel(null); }}>Delete</button>
          </div>
          {mapImage && mapExtent && (
            <>
              <div className="label" style={{ marginTop: 12 }}>Capture location</div>
              <MiniLocation img={mapImage} extent={mapExtent} pos={p.pos} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MiniLocation({ img, extent, pos }: { img: HTMLCanvasElement; extent: number; pos: [number, number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const x = (pos[0] / extent + 0.5) * c.width, y = (pos[1] / extent + 0.5) * c.height;
    ctx.strokeStyle = '#4fd1c5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#4fd1c5'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
  }, [img, extent, pos]);
  return <canvas ref={ref} width={300} height={300} style={{ width: '100%', border: '1px solid var(--line)' }} />;
}

// ---------------------------------------------------------------- Topographic model (3D)
export function TopoModel({
  hf, center, radius = 150, onHazard, hazardMarked,
}: { hf: Heightfield; center: [number, number]; radius?: number; onHazard?: (slope: number, x: number, z: number) => void; hazardMarked?: boolean }) {
  const { geo, cells } = useMemo(() => {
    const N = 64;
    const g = new THREE.PlaneGeometry(2, 2, N, N);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    let minH = Infinity;
    const hs: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const x = center[0] + p.getX(i) * radius, z = center[1] + p.getZ(i) * radius;
      const h = hf.height(x, z);
      hs.push(h);
      minH = Math.min(minH, h);
    }
    const cells: { x: number; z: number; slope: number }[] = [];
    for (let i = 0; i < p.count; i++) {
      const x = center[0] + p.getX(i) * radius, z = center[1] + p.getZ(i) * radius;
      const s = hf.slope(x, z);
      p.setY(i, ((hs[i] - minH) / radius) * 2.2);
      if (s > 25) c.set('#ff5a4e');
      else if (s > 15) c.set('#f0a830');
      else if (s > 6) c.set('#7fd8b0');
      else c.set('#2f8f86');
      const shade = 0.75 + ((hs[i] - minH) / 40) * 0.5;
      c.multiplyScalar(Math.min(1.2, shade));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return { geo: g, cells };
  }, [hf, center[0], center[1], radius]);
  const [mark, setMark] = useState<THREE.Vector3 | null>(null);
  return (
    <Canvas camera={{ position: [0, 1.6, 2.2], fov: 45 }} style={{ background: '#070a0c' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 1]} intensity={1.4} />
      <mesh
        geometry={geo}
        onClick={(e) => {
          e.stopPropagation();
          const x = center[0] + e.point.x * radius, z = center[1] + e.point.z * radius;
          const s = hf.slope(x, z);
          setMark(e.point.clone());
          onHazard?.(s, x, z);
        }}
      >
        <meshStandardMaterial vertexColors roughness={0.9} flatShading />
      </mesh>
      <mesh geometry={geo} position={[0, 0.002, 0]}>
        <meshBasicMaterial color="#9ff" wireframe transparent opacity={0.06} />
      </mesh>
      {mark && (
        <mesh position={mark}>
          <coneGeometry args={[0.03, 0.12, 8]} />
          <meshBasicMaterial color={hazardMarked ? '#ff5a4e' : '#fff'} />
        </mesh>
      )}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.02, 0.035, 24]} />
        <meshBasicMaterial color="#4fd1c5" />
      </mesh>
      <OrbitControls enablePan={false} minDistance={1.2} maxDistance={5} maxPolarAngle={1.45} />
    </Canvas>
  );
}

// ---------------------------------------------------------------- GPR cross-section
export function GPRSection({ scan, world }: { scan: ScanRecord; world: World }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const rnd = mulberry32(scan.data.seed ?? 3);
    const img = ctx.createImageData(W, H);
    const layers = scan.data.layers ?? 4;
    const depths = Array.from({ length: layers }, (_, i) => (i + 0.6 + rnd() * 0.5) / (layers + 0.5));
    const phases = depths.map(() => rnd() * 10);
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const d = y / H;
        let v = (rnd() - 0.5) * 0.25 * (0.3 + d);
        depths.forEach((dp, i) => {
          const yy = dp + Math.sin(x * 0.02 + phases[i]) * 0.02 + Math.sin(x * 0.07 + phases[i] * 2) * 0.006;
          const dist = (d - yy) * H;
          v += Math.sin(dist * 0.9) * Math.exp(-(dist * dist) / 18) * (1 - d * 0.6);
        });
        if (scan.data.void) {
          const vx = (x / W - 0.6) * 4, vy = (d - 0.45) * 6;
          const r = vx * vx + vy * vy;
          if (r < 1.4) v += Math.sin(r * 9) * 0.7 * (1.4 - r);
        }
        const g = Math.max(0, Math.min(255, 128 + v * 110));
        const o = (y * W + x) * 4;
        img.data[o] = g * 0.92; img.data[o + 1] = g; img.data[o + 2] = g * 0.95; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = 'rgba(79,209,197,.9)';
    ctx.font = '10px JetBrains Mono, monospace';
    for (let m = 0; m <= 8; m += 2) ctx.fillText(`${m} m`, 4, (m / 8) * H - 2 + (m === 0 ? 12 : 0));
  }, [scan.id]);
  return (
    <div>
      <canvas ref={ref} width={560} height={220} style={{ width: '100%', border: '1px solid var(--line)', imageRendering: 'pixelated' }} />
      <div className="tiny dim" style={{ marginTop: 4 }}>
        Radargram (SIMULATED). Bright/dark banding = reflectors at dielectric contrasts, e.g. layer boundaries. Interpretation is non-unique; depth scale assumes a nominal wave velocity.
        {world === 'mars' && ' Mars profiles: conceptual.'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Scans list
export function ScansView({ world, hf, hazardKey, onHazardEvidence }: { world: World; hf: Heightfield; hazardKey: string; onHazardEvidence: (slope: number) => void }) {
  const scans = useGame((s) => s.scans).filter((x) => x.world === world);
  const ev = useGame((s) => (world === 'earth' ? s.earthEvidence : s.marsEvidence));
  const [sel, setSel] = useState<string | null>(null);
  const cur = scans.find((x) => x.id === sel) ?? scans.filter((x) => x.kind === 'terrain' || x.kind === 'gpr').slice(-1)[0];
  const [msg, setMsg] = useState('');
  if (!scans.length) return <div className="dim small" style={{ padding: 16 }}>No scans acquired yet.</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: '100%', minHeight: 0 }}>
      <div className="scroll" style={{ borderRight: '1px solid var(--line)', padding: 8 }}>
        {[...scans].reverse().map((s) => (
          <div key={s.id} className={`card ${cur?.id === s.id ? 'sel' : ''}`} style={{ marginBottom: 6, cursor: 'pointer', padding: '7px 10px' }} onClick={() => setSel(s.id)}>
            <div className="between"><span className="mono small">{s.id}</span><span className="tag">{s.kind}</span></div>
            <div className="tiny dim" style={{ marginTop: 3 }}>{s.zone}</div>
          </div>
        ))}
      </div>
      <div className="scroll" style={{ padding: 12 }}>
        {cur && cur.kind === 'terrain' && (
          <>
            <div className="between">
              <div className="label">3D topographic model · {cur.id}</div>
              <span className="tag sim">model from game terrain</span>
            </div>
            <div style={{ height: 330, marginTop: 8, border: '1px solid var(--line)' }}>
              <TopoModel
                hf={hf}
                center={cur.pos}
                hazardMarked={!!ev[hazardKey]}
                onHazard={(slope) => {
                  if (slope > 20) {
                    onHazardEvidence(slope);
                    setMsg(`Hazard marked: slope ${slope.toFixed(0)}° exceeds rover limit (~20–25°).`);
                    audio.ui('confirm');
                  } else {
                    setMsg(`Slope ${slope.toFixed(0)}° — within safe limits. Click a red/amber cell to mark a hazard.`);
                    audio.ui('click');
                  }
                }}
              />
            </div>
            <div className="row" style={{ gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <Legend c="#2f8f86" t="< 6°" /><Legend c="#7fd8b0" t="6–15°" /><Legend c="#f0a830" t="15–25°" /><Legend c="#ff5a4e" t="> 25° hazard" />
            </div>
            {msg && <div className="small" style={{ marginTop: 6, color: msg.startsWith('Hazard') ? 'var(--amber)' : 'var(--dim)' }}>{msg}</div>}
            <div className="mono small" style={{ marginTop: 10, lineHeight: 1.7 }}>
              MEAN SLOPE {cur.data.meanSlope?.toFixed(1)}° · MAX {cur.data.maxSlope?.toFixed(0)}° · STEEP CELLS {cur.data.steepPct?.toFixed(0)}% · RELIEF {cur.data.relief?.toFixed(1)} m
            </div>
            <ElevationProfile hf={hf} center={cur.pos} />
          </>
        )}
        {cur && cur.kind === 'gpr' && (
          <>
            <div className="label" style={{ marginBottom: 8 }}>GPR cross-section · {cur.id}</div>
            <GPRSection scan={cur} world={world} />
          </>
        )}
        {cur && cur.kind !== 'terrain' && cur.kind !== 'gpr' && (
          <div className="mono small" style={{ lineHeight: 1.8 }}>
            {Object.entries(cur.data).map(([k, v]) => <div key={k}><span className="dim">{k.toUpperCase()}</span> {String(v)}</div>)}
            <div className="tag sim" style={{ display: 'inline-block', marginTop: 8 }}>simulated</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return <span className="row tiny mono"><span style={{ width: 10, height: 10, background: c, display: 'inline-block' }} />{t}</span>;
}

function ElevationProfile({ hf, center }: { hf: Heightfield; center: [number, number] }) {
  const pts = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i <= 80; i++) arr.push(hf.height(center[0] - 150 + i * 3.75, center[1]));
    return arr;
  }, [hf, center[0], center[1]]);
  const min = Math.min(...pts), max = Math.max(...pts) + 0.01;
  const d = pts.map((h, i) => `${i === 0 ? 'M' : 'L'}${(i / 80) * 560},${90 - ((h - min) / (max - min)) * 80}`).join(' ');
  return (
    <div style={{ marginTop: 10 }}>
      <div className="label">Elevation profile W→E through scan centre (relief {(max - min).toFixed(1)} m)</div>
      <svg viewBox="0 0 560 95" style={{ width: '100%', border: '1px solid var(--line)', background: '#070a0c', marginTop: 4 }}>
        <path d={`${d} L560,95 L0,95 Z`} fill="rgba(79,209,197,.12)" />
        <path d={d} stroke="#4fd1c5" fill="none" strokeWidth={1.5} />
      </svg>
    </div>
  );
}
