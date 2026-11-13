import { useEffect, useState } from 'react';
import { useDiscovery, answerDiscovery, closeDiscovery, totalStars, MAX_STARS } from '../game/core/discovery';
import { EARTH_DISCOVERIES, MARS_DISCOVERIES, type Discovery } from '../data/scientific-checklist/discoveries';
import { CAT_BY_ID } from '../data/scientific-checklist/categories';
import { useGame, worldProgress } from '../game/core/store';
import { useUI } from '../game/core/ui';
import { audio } from '../game/core/audio';
import { Icon, SceneArt } from './icons';
import { celebrate } from '../game/core/fx';
import { EARTH_TASKS } from '../data/earth/earthData';
import { MARS_TASKS } from '../data/mars/marsData';
import type { CategoryId } from '../data/scientific-checklist/categories';

// Groups of tasks that make one "place" — finishing a whole place earns a celebration.
const EARTH_PLACES: { name: string; tasks: string[] }[] = [
  { name: 'Salt flat', tasks: ['inspect:playa-polygons', 'sample:playa-crust', 'scan:env:playa'] },
  { name: 'Dark gravel', tasks: ['thermal:dark-gravel:day'] },
  { name: 'Layered cliff', tasks: ['scan:gpr:sediment'] },
  { name: 'Yardang field', tasks: ['photo:yardang-major', 'scan:terrain:yardang', 'probe:sand'] },
];
const MARS_PLACES: { name: string; tasks: string[] }[] = [
  { name: 'Crater', tasks: ['photo:m-crater'] },
  { name: 'Sand ripples', tasks: ['photo:m-dunes', 'thermal:m-dunes:day', 'recover:fault'] },
  { name: 'Layered rock', tasks: ['spectro:m-layers', 'multispec:m-layers', 'scan:env'] },
  { name: 'Mysterious pit', tasks: ['photo:m-pit'] },
];

function celebrateIfDone(world: 'earth' | 'mars', cat: CategoryId) {
  const g = useGame.getState();
  const ev = world === 'earth' ? g.earthEvidence : g.marsEvidence;
  const task = (world === 'earth' ? EARTH_TASKS : MARS_TASKS).find((t) => t.cat === cat);
  const place = (world === 'earth' ? EARTH_PLACES : MARS_PLACES).find((p) => task && p.tasks.includes(task.id));
  const stars = Object.keys(g.stars).filter((k) => k.startsWith(world)).length;
  if (worldProgress(world, g).done) {
    celebrate(world === 'earth' ? 'EARTH COMPLETE!' : 'MARS COMPLETE!', world === 'earth' ? 'Great job, scientist! Next stop: Mars' : 'Amazing! Now compare Earth and Mars', 3);
  } else if (place && place.tasks.every((t) => ev[t])) {
    celebrate(`${place.name} done!`, `${stars} stars collected`, place.tasks.length >= 3 ? 3 : 2);
  }
}

function Scene({ d, world }: { d: Discovery; world: 'earth' | 'mars' }) {
  const ground = world === 'earth' ? '#c9b48f' : '#b4643f';
  const sky = world === 'earth' ? 'linear-gradient(#9fc2dc, #dfe7ea)' : 'linear-gradient(#c58e68, #e2b896)';
  const particles = ['wind', 'sand', 'scan', 'air'].includes(d.anim);
  const drops = ['water', 'salt', 'microbe'].includes(d.anim);
  return (
    <div className="dc-scene" style={{ background: sky }}>
      <div className="dc-ground" style={{ background: ground }} />
      {particles && Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="dc-particle" style={{ top: `${20 + (i * 37) % 60}%`, animationDelay: `${(i * 0.23) % 2}s`, animationDuration: `${1.4 + (i % 4) * 0.3}s` }} />
      ))}
      {drops && Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="dc-drop" style={{ left: `${12 + i * 9.5}%`, animationDelay: `${(i * 0.31) % 2}s` }} />
      ))}
      {d.anim === 'heat' && (
        <div className="dc-thermo"><div className="dc-thermo-fill" style={{ background: world === 'earth' ? '#ff7a45' : '#5fb4ff' }} /></div>
      )}
      {(d.anim === 'radar' || d.anim === 'map') && <div className="dc-sweep" />}
      <div className="dc-icon"><SceneArt anim={d.anim} /></div>
      <div className="dc-tag">{world === 'earth' ? 'EARTH · QAIDAM' : 'MARS'}</div>
    </div>
  );
}

function Confetti() {
  return (
    <div className="dc-confetti">
      {Array.from({ length: 26 }).map((_, i) => (
        <span key={i} style={{ left: `${(i * 37) % 100}%`, background: ['#4fd1c5', '#f0a830', '#a78bfa', '#6ee7a0', '#ff7a45'][i % 5], animationDelay: `${(i % 7) * 0.05}s`, transform: `rotate(${i * 40}deg)` }} />
      ))}
    </div>
  );
}

export function DiscoveryCard() {
  const item = useDiscovery((s) => s.queue[0]);
  const g = useGame();
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (!item) return;
    setPicked(null);
    audio.ui('confirm');
    audio.tone(1568, 0.25, 'sine', 0.06, undefined, 0.15);
    const ui = useUI.getState();
    if (!ui.panel) ui.setPanel('discovery' as any);
    if (document.pointerLockElement) document.exitPointerLock();
  }, [item?.id]);

  if (!item) return null;
  const d = (item.world === 'earth' ? EARTH_DISCOVERIES : MARS_DISCOVERIES)[item.cat];
  const cat = CAT_BY_ID[item.cat];
  const prog = worldProgress(item.world, g);
  const stars = totalStars(g.stars);
  const correct = picked !== null && d.answers[picked].correct;

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = d.answers[i].correct;
    answerDiscovery(item, ok);
    if (ok) { audio.ui('confirm'); [1046, 1318, 1568].forEach((f, k) => audio.tone(f, 0.15, 'sine', 0.06, undefined, k * 0.09)); }
    else audio.ui('error');
  };
  const close = () => {
    audio.ui('close');
    closeDiscovery(item.id);
    if (useDiscovery.getState().queue.length === 0 && useUI.getState().panel === ('discovery' as any)) useUI.getState().setPanel(null);
    celebrateIfDone(item.world, item.cat);
  };

  return (
    <div className="overlay" style={{ zIndex: 80, background: 'rgba(3,6,8,.55)' }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="dc-card">
        <Scene d={d} world={item.world} />
        <div style={{ padding: '18px 24px 22px' }}>
          <div className="between">
            <span className="mono tiny teal" style={{ letterSpacing: '0.2em' }}>DISCOVERY · {cat.num} {cat.short}</span>
            <span className="dc-star-pop" style={{ display: 'flex', alignItems: 'center', gap: 2, fontWeight: 700, color: '#ffd166' }}>+<Icon name="star" size={22} color="#ffd166" /></span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 8px' }}>{d.title}</div>
          <div style={{ fontSize: 16, lineHeight: 1.5, color: '#dbe6e8' }}>
            <span className="amber" style={{ fontWeight: 600 }}>Did you know? </span>{d.fact}
          </div>

          <div style={{ marginTop: 16, fontSize: 15, fontWeight: 600 }}>{d.question}</div>
          <div className="col" style={{ marginTop: 8, gap: 8 }}>
            {d.answers.map((a, i) => {
              const state = picked === null ? '' : a.correct ? 'ok' : picked === i ? 'bad' : 'dim';
              return (
                <button key={i} className={`dc-answer ${state}`} onClick={() => pick(i)} disabled={picked !== null}>
                  {a.text} {picked !== null && a.correct && '✓'}
                </button>
              );
            })}
          </div>

          {picked !== null && (
            <div className="between" style={{ marginTop: 16, animation: 'slideIn .3s' }}>
              <div style={{ fontSize: 14 }}>
                {correct ? <span className="green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Great thinking! +<Icon name="star" size={16} color="#ffd166" /></span> : <span className="amber">Good try — the green answer is the scientific one.</span>}
                <div className="tiny dim" style={{ marginTop: 3 }}>★ {stars}/{MAX_STARS} · {item.world === 'earth' ? 'Earth' : 'Mars'} {prog.completed}/8 done</div>
              </div>
              <button className="btn primary" style={{ padding: '10px 22px' }} onClick={close}>Continue ▸</button>
            </div>
          )}
        </div>
        {correct && <Confetti />}
      </div>
    </div>
  );
}
