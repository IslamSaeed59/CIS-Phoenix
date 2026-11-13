import { GraphicsPanel } from '../settings/GraphicsPanel';
import { replay } from '../../game/core/onboarding';
import { useEffect, useState } from 'react';
import { useGame, DEFAULT_KEYS, type KeyAction } from '../../game/core/store';
import { useUI, fadeTo } from '../../game/core/ui';
import { audio } from '../../game/core/audio';
import { keyLabel } from '../../game/core/input';

const ACTION_LABELS: Record<KeyAction, string> = {
  forward: 'Move forward / Rover forward', back: 'Move back / Rover reverse', left: 'Strafe left / Steer left', right: 'Strafe right / Steer right',
  sprint: 'Sprint', interact: 'Interact / Confirm', scanner: 'Raise/lower scientific scanner', camera: 'Camera perspective / Switch rover camera',
  journal: 'Scientific journal', map: 'Map', checklist: 'Mission checklist', brake: 'Rover brake', diagnostics: 'Rover diagnostics',
};

export function SettingsPanel() {
  const s = useGame((x) => x.settings);
  const set = useGame((x) => x.setSettings);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => replay('tutorial')}>Replay controls tutorial</button>
        <span className="tiny dim">Graphics options are in the Graphics tab.</span>
      </div>
      <Slider label="Master volume" v={s.volume} min={0} max={1} step={0.05} onChange={(v) => { set({ volume: v }); audio.setVolume(v); }} fmt={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Mouse sensitivity" v={s.sensitivity} min={0.3} max={2.5} step={0.05} onChange={(v) => set({ sensitivity: v })} fmt={(v) => v.toFixed(2)} />
      <Slider label="Field of view" v={s.fov} min={55} max={95} step={1} onChange={(v) => set({ fov: v })} fmt={(v) => `${v}°`} />
      <label className="row small"><input type="checkbox" checked={s.invertY} onChange={(e) => set({ invertY: e.target.checked })} /> Invert mouse Y</label>
      <label className="row small"><input type="checkbox" checked={s.voice} onChange={(e) => set({ voice: e.target.checked })} /> Synthesised radio voice (browser speech)</label>
      <label className="row small"><input type="checkbox" checked={s.subtitles} onChange={(e) => set({ subtitles: e.target.checked })} /> Radio subtitles</label>
    </div>
  );
}

function Slider({ label, v, min, max, step, onChange, fmt }: { label: string; v: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div>
      <div className="between"><span className="label">{label}</span><span className="mono small teal">{fmt(v)}</span></div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#4fd1c5' }} />
    </div>
  );
}

export function ControlsPanel() {
  const keys = useGame((x) => x.settings.keys);
  const set = useGame((x) => x.setSettings);
  const [listen, setListen] = useState<KeyAction | null>(null);
  useEffect(() => {
    if (!listen) return;
    const on = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') set({ keys: { ...keys, [listen]: e.code } });
      setListen(null);
      audio.ui('confirm');
    };
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [listen, keys, set]);
  return (
    <div>
      <div className="label" style={{ marginBottom: 8 }}>Key bindings — click to remap</div>
      {(Object.keys(ACTION_LABELS) as KeyAction[]).map((a) => (
        <div key={a} className="between" style={{ padding: '5px 0', borderBottom: '1px dashed var(--line)' }}>
          <span className="small">{ACTION_LABELS[a]}</span>
          <button className={`btn sm ${listen === a ? 'amber' : ''}`} style={{ minWidth: 90 }} onClick={() => setListen(a)}>{listen === a ? 'Press key…' : keyLabel(keys[a])}</button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn sm" onClick={() => set({ keys: { ...DEFAULT_KEYS } })}>Reset defaults</button>
      </div>
      <div className="hr" />
      <div className="small dim" style={{ lineHeight: 1.7 }}>
        <b>Earth:</b> Mouse look · 1–7 select instrument · LMB use instrument · Scroll cycle instruments · Esc pause<br />
        <b>Laptop:</b> Mouse interact · Scroll zoom · Esc exit laptop<br />
        <b>Rover:</b> W/S drive · A/D steer · Drag feed to pan camera · Scroll zoom · Space brake · R diagnostics · C switch camera · P capture
      </div>
    </div>
  );
}

export function PauseMenu() {
  const [tab, setTab] = useState<'main' | 'settings' | 'graphics' | 'controls'>('main');
  const setPanel = useUI((s) => s.setPanel);
  const setPhase = useGame((s) => s.setPhase);
  const resume = () => { setPanel(null); audio.ui('close'); };
  const quit = async () => {
    await fadeTo(1, 500);
    setPanel(null);
    setPhase('menu');
    fadeTo(0, 600);
  };
  return (
    <div className="overlay" style={{ background: 'rgba(3,5,7,.75)' }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="window" style={{ width: 560, maxHeight: '86vh' }}>
        <div className="win-head">
          <span className="win-title">Mission paused</span>
          <span className="mono tiny dim">PROGRESS AUTO-SAVED LOCALLY</span>
        </div>
        <div className="tabs">
          {(['main', 'settings', 'graphics', 'controls'] as const).map((t) => (
            <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t === 'main' ? 'Mission' : t}</button>
          ))}
        </div>
        <div className="scroll" style={{ padding: 18 }}>
          {tab === 'main' && (
            <div className="col">
              <button className="btn primary" onClick={resume}>Resume mission</button>
              <button className="btn" onClick={() => setTab('settings')}>Settings</button>
              <button className="btn" onClick={() => setTab('graphics')}>Graphics</button>
              <button className="btn" onClick={() => setTab('controls')}>Controls</button>
              <button className="btn danger" onClick={quit}>Save &amp; return to main menu</button>
            </div>
          )}
          {tab === 'settings' && <SettingsPanel />}
          {tab === 'controls' && <ControlsPanel />}
          {tab === 'graphics' && <GraphicsPanel />}
        </div>
      </div>
    </div>
  );
}
