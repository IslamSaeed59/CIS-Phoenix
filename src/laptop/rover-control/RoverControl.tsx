import { useEffect, useRef, useState } from 'react';
import { RoverFeedCanvas, feedState } from '../../game/camera/RoverFeed';
import { rover, useRover, CAMS, VISIBLE_CAMS, instruments, type CamId } from '../../game/rover/roverSim';
import { useGame, worldProgress } from '../../game/core/store';
import { audio } from '../../game/core/audio';
import { Rovi } from '../../ui/common';
import { Icon } from '../../ui/icons';
import { totalStars } from '../../game/core/discovery';
import { STATIONS, useStations, goTo, doAction, backOut, tickStations, stationDone, nextStation } from '../../game/missions/marsStations';

function Noise() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0, f = 0;
    const draw = () => {
      f++;
      if (f % 2 === 0) {
        const img = ctx.createImageData(c.width, c.height);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = 128 + (Math.random() - 0.5) * 30;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 18;
        }
        ctx.putImageData(img, 0, 0);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={320} height={180} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'overlay', pointerEvents: 'none', imageRendering: 'pixelated' }} />;
}

function Hint() {
  const s = useStations();
  const g = useGame();
  let title = '', sub = '';
  const nxt = nextStation();
  if (s.sand === 'stuck') { title = 'We are stuck in the sand!'; sub = 'Press “Back out slowly”.'; }
  else if (s.sand === 'reversing') { title = 'Backing out slowly…'; sub = 'Patience — that is how real rover drivers do it.'; }
  else if (s.sand === 'driving') { title = 'Driving into the soft sand…'; sub = 'Watch the wheels.'; }
  else if (s.driving) {
    const st = STATIONS.find((x) => x.id === s.driving)!;
    const d = Math.hypot(st.approach[0] - rover.x, st.approach[1] - rover.z);
    title = `Driving to ${st.name}…`; sub = `${Math.round(d)} m to go · ⏩ time-lapse`;
  } else if (s.at && !stationDone(STATIONS.find((x) => x.id === s.at)!)) { title = 'We arrived!'; sub = 'Pick an action below.'; }
  else if (nxt) { title = `Next: drive to ${nxt.name}`; sub = `Click station ${nxt.num} below.`; }
  else if (worldProgress('mars', g).done) { title = 'All stations done!'; sub = 'Open “Compare” in the left menu.'; }
  else { title = 'Answer the discovery questions'; sub = ''; }
  return (
    <div className="panel" style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', padding: '8px 16px', display: 'flex', gap: 12, alignItems: 'center', borderTop: '2px solid var(--teal)', borderRadius: 10, pointerEvents: 'none', minWidth: 340 }}>
      <Rovi size={40} />
      <div>
        <div className="mono tiny teal" style={{ letterSpacing: '0.2em' }}>ROVI</div>
        <div className="kid" style={{ fontSize: 19, fontWeight: 600 }}>{title}</div>
        {sub && <div className="small dim">{sub}</div>}
      </div>
    </div>
  );
}

export function RoverControl({ active, onOpen }: { active: boolean; onOpen: (app: string) => void }) {
  useRover((s) => s.snap);
  const g = useGame();
  const st = useStations();
  const [dragging, setDragging] = useState(false);
  const mp = worldProgress('mars', g);

  useEffect(() => { rover.inputEnabled = active; return () => { rover.inputEnabled = false; }; }, [active]);
  useEffect(() => {
    const id = setInterval(tickStations, 100);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyP') instruments.capture();
      if (e.code === useGame.getState().settings.keys.camera) {
        const i = VISIBLE_CAMS.findIndex((c) => c.id === rover.cam);
        rover.cam = VISIBLE_CAMS[(i + 1) % VISIBLE_CAMS.length].id;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
  useEffect(() => {
    const up = () => setDragging(false);
    const move = (e: MouseEvent) => {
      if (!dragging || (rover.cam !== 'NAVCAM' && rover.cam !== 'MASTCAM')) return;
      rover.camYaw = Math.max(-2.6, Math.min(2.6, rover.camYaw - e.movementX * 0.004));
      rover.camPitch = Math.max(-1.1, Math.min(0.6, rover.camPitch - e.movementY * 0.004));
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', move);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('mousemove', move); };
  }, [dragging]);

  const here = STATIONS.find((x) => x.id === st.at);
  const next = nextStation();
  const cam = CAMS.find((c) => c.id === rover.cam)!;

  return (
    <div style={{ position: 'relative', height: '100%', background: '#000', overflow: 'hidden' }} onMouseDown={(e) => { if (e.button === 0 && (e.target as HTMLElement).tagName === 'CANVAS') setDragging(true); }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <RoverFeedCanvas />
      </div>
      <Noise />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.5))' }} />

      {/* Top-left: status chips */}
      <div className="row" style={{ position: 'absolute', top: 14, left: 14, gap: 8, pointerEvents: 'none' }}>
        <span className="panel mono small" style={{ padding: '6px 10px', borderRadius: 8 }}><Icon name="battery" size={16} style={{ verticalAlign: '-3px', marginRight: 4 }} />{rover.battery.toFixed(0)}%</span>
        <span className="panel mono small" style={{ padding: '6px 10px', borderRadius: 8 }}><Icon name="star" size={15} color="#ffd166" style={{ verticalAlign: '-2px', marginRight: 4 }} />{totalStars(g.stars)}</span>
        <span className="panel mono small" style={{ padding: '6px 10px', borderRadius: 8 }}>Mars {mp.completed}/8</span>
      </div>
      {/* Top-right: camera */}
      <div className="col" style={{ position: 'absolute', top: 14, right: 14, gap: 4, alignItems: 'flex-end' }}>
        <span className="panel mono tiny" style={{ padding: '5px 9px', borderRadius: 6 }}><Icon name="camera" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />{cam.name}</span>
        <div className="row" style={{ gap: 4 }}>
          {VISIBLE_CAMS.map((c) => (
            <button key={c.id} className={`btn sm ${rover.cam === c.id ? 'active' : ''}`} style={{ padding: '3px 6px', fontSize: 9 }} onClick={() => { rover.cam = c.id as CamId; audio.ui('click'); }}>{c.id}</button>
          ))}
        </div>
      </div>

      {feedState.cine <= 0 && <Hint />}
      {feedState.cine > 0 && (
        <div className="subtitle" style={{ position: 'absolute', bottom: 160 }}>This is your rover on Mars, millions of kilometres away. You control it from here.</div>
      )}

      {/* Bottom: stations + actions */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px', background: 'linear-gradient(transparent, rgba(0,0,0,.85) 40%)' }}>
        {st.sand === 'stuck' && (
          <div className="row" style={{ justifyContent: 'center', marginBottom: 12 }}>
            <button className="action-btn pulse-key" style={{ borderColor: 'var(--amber)', background: 'rgba(240,168,48,.25)' }} onClick={backOut}><span className="ic"><Icon name="reverse" size={22} /></span> Back out slowly</button>
          </div>
        )}
        {here && st.sand === 'none' && !st.driving && (
          <div className="row" style={{ justifyContent: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
            {here.actions.map((a) => {
              const done = !!g.marsEvidence[a.task];
              return (
                <button key={a.id} className={`action-btn ${done ? 'done' : ''} ${!done && !st.busy ? 'pulse-key' : ''}`} disabled={done || !!st.busy} onClick={() => doAction(here, a)}>
                  <span className="ic"><Icon name={done ? 'check' : a.icon} size={22} /></span> {st.busy === a.id ? 'Working…' : a.label}
                </button>
              );
            })}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {STATIONS.map((s) => {
            const done = stationDone(s);
            const isNext = next?.id === s.id;
            return (
              <button
                key={s.id}
                className={`station-btn ${st.at === s.id || st.driving === s.id ? 'active' : ''} ${done ? 'done' : ''} ${isNext && !st.driving && st.at !== s.id ? 'pulse-key' : ''}`}
                disabled={!!st.driving || st.sand !== 'none' || st.at === s.id}
                onClick={() => goTo(s.id)}
              >
                <span className="mono tiny" style={{ color: done ? 'var(--green)' : 'var(--teal)' }}>STATION {s.num} {done ? '✓' : ''}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                <span className="tiny dim">{s.actions.map((a) => (g.marsEvidence[a.task] ? '●' : '○')).join(' ')}</span>
              </button>
            );
          })}
        </div>
        <div className="tiny dim" style={{ textAlign: 'center', marginTop: 8 }}>Optional: drive yourself with W A S D · drag the view to look around · P = photo</div>
      </div>
    </div>
  );
}
