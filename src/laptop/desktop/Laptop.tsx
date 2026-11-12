import { useEffect, useState } from 'react';
import { useGame, worldProgress, comparisonProgress } from '../../game/core/store';
import { radio, toast, useUI } from '../../game/core/ui';
import { audio } from '../../game/core/audio';
import { rover, resetRover, useRover, instruments } from '../../game/rover/roverSim';
import { RoverControl } from '../rover-control/RoverControl';
import { NavigationApp, TelemetryApp, InstrumentsApp, CommsApp, OverviewApp, sampleHistory, marsReliefMap } from '../applications/MarsApps';
import { ChecklistView } from '../../ui/checklist/ChecklistView';
import { GalleryView, JournalView } from '../../ui/journal/Views';
import { AnalysisApp } from '../analysis/AnalysisApp';
import { ReportApp } from '../analysis/ReportApp';
import { useRoverLoop, feedState } from '../../game/camera/RoverFeed';
import { RadioFeed, Toasts, useMissionClock } from '../../ui/common';
import { isTyping, matches } from '../../game/core/input';
import { earthRelief } from '../../ui/journal/Tablet';
import { PLAY_SIZE } from '../../game/environments/qaidam/qaidamTerrain';
import { MARS_SIZE } from '../../game/environments/mars/marsTerrain';

type AppId = 'overview' | 'rover' | 'nav' | 'telemetry' | 'instruments' | 'checklist' | 'archive' | 'comms' | 'analysis' | 'report';

const APPS: { id: AppId; name: string; glyph: string; needsMars?: boolean }[] = [
  { id: 'overview', name: 'Mission', glyph: '◎' },
  { id: 'rover', name: 'Rover Control', glyph: '◉', needsMars: true },
  { id: 'nav', name: 'Navigation', glyph: '⌖', needsMars: true },
  { id: 'telemetry', name: 'Telemetry', glyph: '∿', needsMars: true },
  { id: 'instruments', name: 'Instruments', glyph: '⚙', needsMars: true },
  { id: 'checklist', name: 'Checklist', glyph: '☑' },
  { id: 'archive', name: 'Archive', glyph: '▤' },
  { id: 'comms', name: 'Comms', glyph: '⟟' },
  { id: 'analysis', name: 'Analysis', glyph: '⇄' },
  { id: 'report', name: 'Report', glyph: '✉' },
];

function Archive() {
  const [w, setW] = useState<'mars' | 'earth'>('mars');
  const [t, setT] = useState<'gallery' | 'journal'>('gallery');
  const [busy, setBusy] = useState<number | null>(null);
  const photos = useGame((s) => s.photos);
  const onboard = photos.filter((p) => p.world === 'mars' && p.onboard);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="between" style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)' }}>
        <div className="row">
          <button className={`btn sm ${t === 'gallery' ? 'active' : ''}`} onClick={() => setT('gallery')}>Image archive</button>
          <button className={`btn sm ${t === 'journal' ? 'active' : ''}`} onClick={() => setT('journal')}>Mission journal</button>
          <span style={{ width: 12 }} />
          <button className={`btn sm ${w === 'mars' ? 'active' : ''}`} onClick={() => setW('mars')}>Mars</button>
          <button className={`btn sm ${w === 'earth' ? 'active' : ''}`} onClick={() => setW('earth')}>Earth</button>
        </div>
        {w === 'mars' && (
          <div className="row">
            <span className="mono tiny dim">ONBOARD {onboard.length}/{rover.storageCap}</span>
            <button className="btn sm" disabled={!onboard.length} onClick={() => onboard.forEach((p, i) => setTimeout(() => instruments.downlink(p.id), i * 250))}>Downlink all</button>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {t === 'gallery' ? (
          <GalleryView
            key={w}
            world={w}
            mapImage={w === 'mars' ? marsReliefMap() : earthRelief()}
            mapExtent={w === 'mars' ? MARS_SIZE : PLAY_SIZE}
            storage={w === 'mars' ? { busy, onDownlink: (id) => { setBusy(id); instruments.downlink(id); setTimeout(() => setBusy(null), 2500); } } : undefined}
          />
        ) : (
          <JournalView world={w} />
        )}
      </div>
    </div>
  );
}

function ChecklistApp() {
  const [w, setW] = useState<'mars' | 'earth'>('mars');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="row" style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)' }}>
        <button className={`btn sm ${w === 'mars' ? 'active' : ''}`} onClick={() => setW('mars')}>Mars checklist</button>
        <button className={`btn sm ${w === 'earth' ? 'active' : ''}`} onClick={() => setW('earth')}>Earth checklist (read-only evidence)</button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}><ChecklistView key={w} world={w} compact /></div>
    </div>
  );
}

export function Laptop({ onExit, onSubmit }: { onExit: () => void; onSubmit: () => void }) {
  const g = useGame();
  const [app, setApp] = useState<AppId>(g.marsStarted ? 'rover' : 'overview');
  const [boot, setBoot] = useState(0);
  const clock = useMissionClock();
  const mp = worldProgress('mars', g);
  const cp = comparisonProgress(g);
  const locked = (id: AppId) => (id === 'analysis' ? !mp.done : id === 'report' ? !mp.done : APPS.find((a) => a.id === id)!.needsMars && !g.marsStarted);
  useRover((s) => s.snap);
  useRoverLoop(g.marsStarted);

  useEffect(() => {
    audio.ui('boot');
    const t1 = setTimeout(() => setBoot(1), 900);
    const t2 = setTimeout(() => setBoot(2), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  useEffect(() => {
    if (g.marsStarted) audio.startLoop('rover');
    return () => audio.stopLoop('rover');
  }, [g.marsStarted]);
  useEffect(() => {
    const id = setInterval(() => { if (useGame.getState().marsStarted) sampleHistory(); }, 1000);
    return () => clearInterval(id);
  }, []);
  // Mars completion notice
  useEffect(() => {
    let notified = worldProgress('mars').done;
    return useGame.subscribe((s) => {
      const d = worldProgress('mars', s).done;
      if (d && !notified) {
        notified = true;
        toast('MARS INVESTIGATION COMPLETE', 'Analysis workstation unlocked.', 'complete');
        radio('MISSION DIRECTOR', 'Both datasets are in. Open the Analysis application and compare Earth and Mars — carefully. Tell us where the analogue works, and where it does not.');
      }
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || boot < 2) return;
      if (e.code === 'Escape') { onExit(); return; }
      if (matches(e, 'checklist')) { e.preventDefault(); open('checklist'); }
      if (matches(e, 'map') && g.marsStarted) open('nav');
      if (matches(e, 'journal')) open('archive');
      if (app !== 'rover' && matches(e, 'diagnostics') && g.marsStarted) open('telemetry');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [boot, app, g.marsStarted]);

  const open = (id: string) => {
    const a = id as AppId;
    if (locked(a)) { audio.ui('error'); toast('Application locked', a === 'analysis' || a === 'report' ? 'Complete the Mars checklist first.' : 'Initialise rover operations from the Mission app.', 'warn'); return; }
    setApp(a);
    audio.ui('open');
  };

  const beginMars = () => {
    useGame.setState({ marsStarted: true });
    rover.started = true;
    rover.startTime = performance.now() / 1000;
    resetRover();
    feedState.cine = 9;
    rover.cam = 'NAVCAM';
    setApp('rover');
    audio.ui('confirm');
    g.addJournal({ world: 'mars', kind: 'event', title: 'Mars rover operations initiated', text: 'Link established with ARES-6. Establishing view reconstructed from telemetry; switching to live navigation camera.' });
    radio('MISSION CONTROL', 'Mission Control confirms: all stations go for Mars surface operations.');
    setTimeout(() => radio('ROVER OPS — CAPCOM', 'ARES-6 reports healthy. Navigation camera is live. Remember — every command takes time to reach the rover. Drive with intent.'), 5000);
    setTimeout(() => radio('DR. LIN — GEOLOGY', 'Use your Qaidam experience: the layered outcrop to the north, the ripple field to the east, wind-eroded ridges to the north-east. Check the Navigation app.'), 14000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn .6s' }}>
      {/* Laptop bezel */}
      <div style={{ width: 'min(1500px, 98vw)', height: 'min(900px, 94vh)', background: 'linear-gradient(#1a1d21, #121417)', borderRadius: 18, padding: '18px 18px 30px', boxShadow: '0 40px 120px rgba(0,0,0,.9), inset 0 0 0 1px #2c3036', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 6, display: 'flex', justifyContent: 'center', marginTop: -10, marginBottom: 6 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: '#0b0d0f', boxShadow: 'inset 0 0 2px #39f' }} /></div>
        <div style={{ flex: 1, minHeight: 0, background: '#07090b', borderRadius: 4, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', border: '1px solid #000' }}>
          {boot < 2 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, background: boot ? '#07090b' : '#000', transition: 'background .4s' }}>
              {boot >= 1 && (
                <>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '0.2em' }}>ORBITAL OS</div>
                  <div className="mono tiny dim">IPARC PLANETARY ROBOTICS WORKSTATION · v9.4.2077</div>
                  <div className="progress" style={{ width: 220, marginTop: 8 }}><div className="pulse" style={{ width: '70%' }} /></div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Top bar */}
              <div className="between mono tiny" style={{ height: 28, padding: '0 12px', background: '#0d1115', borderBottom: '1px solid var(--line)', flex: 'none' }}>
                <span><span className="teal">◆ ORBITAL OS</span> · {APPS.find((a) => a.id === app)!.name.toUpperCase()}</span>
                <span className="dim">MISSION {clock} · {g.marsStarted ? `SOL ${rover.sol}` : 'MARS LINK STANDBY'} · BAT {rover.battery.toFixed(0)}% · LINK {(rover.commQuality * 100).toFixed(0)}%</span>
                <span className="row" style={{ gap: 10 }}>
                  <span className="dim">MARS {mp.completed}/8 · CMP {cp.classified}/{cp.total}</span>
                  <button className="btn sm" style={{ padding: '2px 8px' }} onClick={onExit}>Exit [Esc]</button>
                </span>
              </div>
              <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                {/* Dock */}
                <div style={{ width: 74, background: '#0a0d10', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 4, flex: 'none' }}>
                  {APPS.map((a) => {
                    const lk = locked(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => open(a.id)}
                        onMouseEnter={() => audio.ui('hover')}
                        title={a.name}
                        style={{
                          width: 62, height: 54, background: app === a.id ? 'rgba(79,209,197,.15)' : 'transparent', border: `1px solid ${app === a.id ? 'var(--teal)' : 'transparent'}`,
                          color: lk ? 'var(--dim2)' : 'var(--text)', cursor: 'pointer', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{lk ? '🔒︎' : a.glyph}</span>
                        <span style={{ fontSize: 8.5, letterSpacing: '0.05em' }}>{a.name}</span>
                      </button>
                    );
                  })}
                </div>
                {/* App area */}
                <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                  {g.marsStarted && (
                    <div style={{ position: 'absolute', inset: 0, visibility: app === 'rover' ? 'visible' : 'hidden' }}>
                      <RoverControl active={app === 'rover'} onOpen={open} />
                    </div>
                  )}
                  {app !== 'rover' && (
                    <div style={{ position: 'absolute', inset: 0, background: '#07090b' }}>
                      {app === 'overview' && <OverviewApp onBegin={beginMars} begun={g.marsStarted} onOpen={open} />}
                      {app === 'nav' && <NavigationApp />}
                      {app === 'telemetry' && <TelemetryApp />}
                      {app === 'instruments' && <InstrumentsApp />}
                      {app === 'checklist' && <ChecklistApp />}
                      {app === 'archive' && <Archive />}
                      {app === 'comms' && <CommsApp />}
                      {app === 'analysis' && <AnalysisApp />}
                      {app === 'report' && <ReportApp onSubmit={onSubmit} />}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          <RadioFeed style={{ position: 'absolute', left: 'auto', right: 226, bottom: 110, width: 380, zIndex: 5 }} />
          <Toasts />
        </div>
        <div className="mono" style={{ textAlign: 'center', fontSize: 9, color: '#4a5058', letterSpacing: '0.4em', marginTop: 8 }}>IPARC FIELDBOOK X9</div>
      </div>
    </div>
  );
}
