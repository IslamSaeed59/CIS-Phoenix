import { useEffect, useState } from 'react';
import { useGame } from '../../game/core/store';
import { PRESETS, PRESET_INFO, gfxCost, matchPreset, sameGfx, type Gfx, type Preset, type ShadowQ, type TexQ } from '../../game/core/graphics';
import { usePerf } from '../../game/core/perf';
import { replay } from '../../game/core/onboarding';
import { audio } from '../../game/core/audio';

function Seg<T extends string | number>({ value, options, onChange, labels }: { value: T; options: T[]; onChange: (v: T) => void; labels?: Record<string, string> }) {
  return (
    <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button key={String(o)} className={`btn sm ${value === o ? 'active' : ''}`} onClick={() => onChange(o)}>{labels?.[String(o)] ?? String(o)}</button>
      ))}
    </div>
  );
}

function Line({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
      <div className="between" style={{ gap: 12 }}>
        <span className="small">{label}</span>
        {children}
      </div>
      {hint && <div className="tiny dim" style={{ marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function Slider({ v, min, max, step, onChange, fmt }: { v: number; min: number; max: number; step: number; onChange: (n: number) => void; fmt: (n: number) => string }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: 150, accentColor: '#4fd1c5' }} />
      <span className="mono small teal" style={{ width: 48, textAlign: 'right' }}>{fmt(v)}</span>
    </div>
  );
}

export function GraphicsPanel() {
  const s = useGame((x) => x.settings);
  const applyGfx = useGame((x) => x.applyGfx);
  const setSettings = useGame((x) => x.setSettings);
  const perf = usePerf();
  const [draft, setDraft] = useState<Gfx>(s.gfx);
  useEffect(() => setDraft(s.gfx), [s.gfx]);

  const dirty = !sameGfx(draft, s.gfx);
  const rec = s.recommended;
  const isRec = rec ? sameGfx(s.gfx, rec) : false;
  const upd = (patch: Partial<Gfx>) => setDraft((d) => {
    const n = { ...d, ...patch };
    return { ...n, preset: matchPreset(n) };
  });
  const costNow = gfxCost(s.gfx), costNew = gfxCost(draft);
  const heavier = costNew / costNow;

  const apply = () => {
    const custom = rec ? !sameGfx(draft, rec) : true;
    applyGfx(draft, { custom });
    audio.ui('confirm');
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12, borderColor: isRec ? 'var(--green)' : 'var(--amber)' }}>
        <div className="between">
          <div>
            <div className="label">{isRec ? 'Recommended settings' : 'Custom settings'}</div>
            <div className="small" style={{ marginTop: 3 }}>
              {isRec ? `Chosen by the hardware check (${rec ? PRESET_INFO[rec.preset as Preset]?.title ?? '' : ''})` : rec ? `Recommended for this PC: ${PRESET_INFO[rec.preset as Preset]?.title}` : 'Run the hardware check to get a recommendation'}
            </div>
          </div>
          <span className="mono small">{perf.fps ? `${Math.round(perf.fps)} FPS` : '— FPS'}</span>
        </div>
        <label className="row small" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={s.gfxAuto} onChange={(e) => setSettings({ gfxAuto: e.target.checked })} />
          Automatic optimization — lower settings gently if the game runs slowly
        </label>
        {s.gfxCustom && s.gfxAuto && <div className="tiny dim" style={{ marginTop: 3 }}>Because you customised settings, the game will ask before changing them.</div>}
      </div>

      <div className="label" style={{ marginBottom: 6 }}>Preset</div>
      <div className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        {(['low', 'medium', 'high', 'ultra'] as Preset[]).map((p) => (
          <button key={p} className={`btn sm ${draft.preset === p ? 'active' : ''}`} onClick={() => setDraft({ ...PRESETS[p], fpsLimit: draft.fpsLimit, targetFps: PRESETS[p].targetFps })}>
            {PRESET_INFO[p].title}{rec?.preset === p ? ' ★' : ''}
          </button>
        ))}
        {draft.preset === 'custom' && <span className="tag prelim">custom</span>}
      </div>

      <Line label="Resolution scale" hint="Fewer pixels = faster. Biggest single effect on speed.">
        <Slider v={draft.resScale} min={0.5} max={1.5} step={0.05} onChange={(v) => upd({ resScale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
      </Line>
      <Line label="Shadow quality" hint="Shadow maps: 1024 / 2048 / 4096 px.">
        <Seg<ShadowQ> value={draft.shadows} options={['off', 'low', 'medium', 'high']} onChange={(v) => upd({ shadows: v })} />
      </Line>
      <Line label="Texture quality" hint="Planet texture resolution and sharpness at angles.">
        <Seg<TexQ> value={draft.textures} options={['low', 'medium', 'high']} onChange={(v) => upd({ textures: v })} />
      </Line>
      <Line label="Terrain detail" hint="Number of terrain vertices. Changing it rebuilds the world (a short pause).">
        <Seg<Preset> value={draft.terrain} options={['low', 'medium', 'high', 'ultra']} onChange={(v) => upd({ terrain: v })} />
      </Line>
      <Line label="Anti-aliasing" hint="Smooths jagged edges. The 3D view reloads when this changes.">
        <Seg<string> value={draft.aa ? 'on' : 'off'} options={['off', 'on']} onChange={(v) => upd({ aa: v === 'on' })} />
      </Line>
      <Line label="View distance" hint="How far you can see before the haze.">
        <Slider v={draft.viewDistance} min={0.6} max={1.4} step={0.05} onChange={(v) => upd({ viewDistance: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
      </Line>
      <Line label="Rock & pebble density">
        <Slider v={draft.density} min={0.4} max={1.5} step={0.05} onChange={(v) => upd({ density: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
      </Line>
      <Line label="Dust particles">
        <Slider v={draft.particles} min={0.2} max={1} step={0.05} onChange={(v) => upd({ particles: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
      </Line>
      <Line label="Frame-rate limit" hint="“Display” follows your screen's refresh rate (browsers always use VSync).">
        <Seg<number> value={draft.fpsLimit} options={[0, 30, 60, 90]} labels={{ 0: 'Display', 30: '30', 60: '60', 90: '90' }} onChange={(v) => upd({ fpsLimit: v as Gfx['fpsLimit'] })} />
      </Line>
      <Line label="Performance target" hint="The monitor suggests optimizations below this frame rate.">
        <Seg<number> value={draft.targetFps} options={[30, 60, 90]} onChange={(v) => upd({ targetFps: v as Gfx['targetFps'] })} />
      </Line>

      {dirty && heavier > 1.25 && <div className="small amber" style={{ marginTop: 10 }}>These settings are about {Math.round((heavier - 1) * 100)}% heavier for your graphics chip — the game may run slower.</div>}
      {dirty && heavier < 0.85 && <div className="small green" style={{ marginTop: 10 }}>These settings are lighter — the game should run smoother.</div>}

      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 6 }}>
        <button className="btn primary" disabled={!dirty} onClick={apply}>Apply changes</button>
        <button className="btn" disabled={!dirty} onClick={() => setDraft(s.gfx)}>Revert</button>
        <button className="btn" disabled={!rec} onClick={() => { if (rec) { applyGfx(rec, { custom: false }); audio.ui('confirm'); } }}>Restore recommended</button>
        <button className="btn ghost" onClick={() => { applyGfx({ ...PRESETS.medium }, { custom: !rec || !sameGfx(PRESETS.medium, rec) }); audio.ui('click'); }}>Reset to defaults</button>
      </div>

      <div className="hr" />
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => replay('assess')}>Re-run hardware check</button>
        <button className="btn sm" onClick={() => replay('tutorial')}>Replay controls tutorial</button>
      </div>
      <div className="tiny dim" style={{ marginTop: 8, lineHeight: 1.5 }}>
        Not offered: ambient occlusion, screen-space reflections and other post-processing — this game doesn’t use a post-processing pass, so those switches would do nothing. VSync is always handled by the browser.
      </div>
    </div>
  );
}
