import { useState } from 'react';
import { CATEGORIES, CAT_BY_ID, type CategoryId } from '../../data/scientific-checklist/categories';
import { useGame, catStatus, catTasks, interpFor, type World, type Interp } from '../../game/core/store';
import { StatusChip, fmtTime } from '../common';
import { audio } from '../../game/core/audio';
import { toast } from '../../game/core/ui';
import { EARTH_INTERP, EARTH_POI_BY_ID } from '../../data/earth/earthData';

export function ChecklistView({ world, compact = false }: { world: World; compact?: boolean }) {
  const [sel, setSel] = useState<CategoryId>('geology');
  const s = useGame();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '220px 1fr' : '280px 1fr', height: '100%', minHeight: 0 }}>
      <div className="scroll" style={{ borderRight: '1px solid var(--line)', padding: 8 }}>
        {CATEGORIES.map((c) => {
          const st = catStatus(world, c.id, s);
          const tasks = catTasks(world, c.id);
          const ev = world === 'earth' ? s.earthEvidence : s.marsEvidence;
          const done = tasks.filter((t) => ev[t.id]).length;
          return (
            <div
              key={c.id}
              className={`card ${sel === c.id ? 'sel' : ''}`}
              style={{ marginBottom: 6, cursor: 'pointer' }}
              onClick={() => { setSel(c.id); audio.ui('click'); }}
            >
              <div className="between">
                <span className="mono small teal">{c.num} {c.glyph}</span>
                <StatusChip s={st} />
              </div>
              <div style={{ fontSize: 12.5, marginTop: 5, fontWeight: 500 }}>{c.title}</div>
              <div className="tiny dim mono" style={{ marginTop: 3 }}>{done}/{tasks.length} TASKS</div>
            </div>
          );
        })}
      </div>
      <CategoryDetail world={world} cat={sel} />
    </div>
  );
}

function CategoryDetail({ world, cat }: { world: World; cat: CategoryId }) {
  const s = useGame();
  const c = CAT_BY_ID[cat];
  const st = catStatus(world, cat, s);
  const tasks = catTasks(world, cat);
  const ev = world === 'earth' ? s.earthEvidence : s.marsEvidence;
  const interp = (world === 'earth' ? s.earthInterp : s.marsInterp)[cat];
  const set = interpFor(world)[cat];
  const photos = s.photos.filter((p) => p.world === world && (p.category === cat || p.pois.some((id) => tasks.some((t) => t.id === `photo:${id}`))));
  const samples = s.samples.filter((x) => tasks.some((t) => t.id.endsWith(x.poi)));
  const canInterp = st === 'EVIDENCE COLLECTED' || st === 'COMPLETED';
  const earthI = s.earthInterp[cat];
  return (
    <div className="scroll" style={{ padding: '14px 18px' }}>
      <div className="between">
        <div>
          <div className="label">Checklist {c.num} · {world === 'earth' ? 'Earth — Qaidam Basin' : 'Mars — Research Zone'}</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{c.title}</div>
        </div>
        <StatusChip s={st} />
      </div>
      <p style={{ color: 'var(--dim)', fontSize: 13, lineHeight: 1.5 }}>{c.objective}</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {c.investigates.map((x) => <span key={x} className="tag">{x}</span>)}
      </div>
      <div className="small"><span className="label">Method · </span>{world === 'earth' ? c.earthMethod : c.marsMethod}</div>

      {world === 'mars' && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="label" style={{ marginBottom: 6 }}>Earth → Mars investigation frame</div>
          <div className="small" style={{ lineHeight: 1.6 }}>
            <div><span className="teal">1. Observed on Earth:</span> {EARTH_INTERP[cat].observation}</div>
            <div><span className="teal">2. Investigate on Mars:</span> {c.objective}</div>
            <div><span className="teal">3. Instrument:</span> {c.marsMethod}</div>
            <div><span className="teal">4. Evidence collected:</span> {tasks.filter((t) => ev[t.id]).length}/{tasks.length} items</div>
            <div><span className="teal">5. Suggests:</span> {interp ? set.options.find((o) => o.id === interp.optionId)?.text : '— record interpretation when evidence is complete'}</div>
            <div><span className="teal">6. Uncertain:</span> {interp ? set.limitations.find((l) => l.id === interp.limitationId)?.text : '—'}</div>
          </div>
          {earthI && <div className="tiny dim" style={{ marginTop: 6 }}>Your Earth interpretation: “{EARTH_INTERP[cat].options.find((o) => o.id === earthI.optionId)?.text}”</div>}
        </div>
      )}

      <div className="hr" />
      <div className="label" style={{ marginBottom: 8 }}>Investigation tasks — completed only by in-game evidence</div>
      {tasks.map((t) => {
        const rec = ev[t.id];
        return (
          <div key={t.id + t.cat} className="row" style={{ alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px dashed var(--line)' }}>
            <span className={`chk ${rec ? 'on' : ''}`}>{rec ? '✓' : ''}</span>
            <div style={{ flex: 1 }}>
              <div className="between">
                <span style={{ fontSize: 13, color: rec ? 'var(--text)' : '#c5d0d2' }}>{t.label}</span>
                <span className={`tag ${t.kind === 'analysis' ? 'prelim' : ''}`}>{t.kind}</span>
              </div>
              {rec ? (
                <div className="tiny mono dim" style={{ marginTop: 3 }}>
                  {rec.instrument} · {rec.location} · {fmtTime(rec.time)} — <span style={{ color: 'var(--text)' }}>{rec.summary}</span>
                </div>
              ) : (
                <div className="tiny dim" style={{ marginTop: 3 }}>↳ {t.hint}</div>
              )}
            </div>
          </div>
        );
      })}

      {(photos.length > 0 || samples.length > 0) && (
        <>
          <div className="label" style={{ margin: '12px 0 6px' }}>Linked evidence</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {photos.slice(-8).map((p) => (
              <div key={p.id}>
                <img className="thumb" src={p.thumb} />
                <div className="tiny mono dim">IMG {String(p.id).padStart(4, '0')}{p.important ? ' ★' : ''}</div>
              </div>
            ))}
          </div>
          {samples.map((x) => (
            <div key={x.id} className="tiny mono" style={{ marginTop: 4 }}>
              SAMPLE {x.id} · {x.name} · lab: {x.lab}{x.bio !== 'none' ? ` · bio: ${x.bio}` : ''}
            </div>
          ))}
        </>
      )}

      <div className="hr" />
      <InterpretationForm world={world} cat={cat} enabled={canInterp} current={interp} />
    </div>
  );
}

function InterpretationForm({ world, cat, enabled, current }: { world: World; cat: CategoryId; enabled: boolean; current?: Interp }) {
  const set = interpFor(world)[cat];
  const [opt, setOpt] = useState(current?.optionId ?? '');
  const [conf, setConf] = useState<Interp['confidence']>(current?.confidence ?? 'Moderate');
  const [lim, setLim] = useState(current?.limitationId ?? '');
  const [note, setNote] = useState(current?.note ?? '');
  const setInterp = useGame((s) => s.setInterp);
  const addJournal = useGame((s) => s.addJournal);

  if (!enabled) {
    return (
      <div className="card" style={{ opacity: 0.6 }}>
        <div className="label">Scientific interpretation — locked</div>
        <div className="small dim" style={{ marginTop: 4 }}>Collect all evidence and complete required analyses before recording an interpretation.</div>
      </div>
    );
  }
  const save = () => {
    if (!opt || !lim) { audio.ui('error'); return; }
    const chosen = set.options.find((o) => o.id === opt)!;
    setInterp(world, cat, { optionId: opt, confidence: conf, limitationId: lim, note });
    addJournal({ world, kind: 'interpretation', cat, title: `Interpretation — ${CAT_BY_ID[cat].title}`, text: `${chosen.text} [Confidence: ${conf}] Limitation: ${set.limitations.find((l) => l.id === lim)?.text}${note ? ' Note: ' + note : ''}` });
    toast(current ? 'INTERPRETATION UPDATED' : 'CATEGORY COMPLETED', `${CAT_BY_ID[cat].num} ${CAT_BY_ID[cat].title}`, 'complete');
  };
  return (
    <div className="col">
      <div className="label">Observation (direct)</div>
      <div className="small" style={{ lineHeight: 1.5 }}>{set.observation}</div>
      <div className="label" style={{ marginTop: 6 }}>Interpretation — choose the statement your evidence supports</div>
      {set.options.map((o) => (
        <div key={o.id} className={`card ${opt === o.id ? 'sel' : ''}`} style={{ cursor: 'pointer', fontSize: 12.5, lineHeight: 1.45 }} onClick={() => { setOpt(o.id); audio.ui('click'); }}>
          {o.text}
        </div>
      ))}
      <div className="row" style={{ marginTop: 4 }}>
        <span className="label">Confidence</span>
        {(['Low', 'Moderate', 'High'] as const).map((c) => (
          <button key={c} className={`btn sm ${conf === c ? 'active' : ''}`} onClick={() => setConf(c)}>{c}</button>
        ))}
      </div>
      <div className="label" style={{ marginTop: 4 }}>Limitations</div>
      {set.limitations.map((l) => (
        <div key={l.id} className={`card ${lim === l.id ? 'sel' : ''}`} style={{ cursor: 'pointer', fontSize: 12.5 }} onClick={() => { setLim(l.id); audio.ui('click'); }}>
          {l.text}
        </div>
      ))}
      <textarea className="input" rows={2} placeholder="Optional field note…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      <div className="row">
        <button className="btn primary" disabled={!opt || !lim} onClick={save}>{current ? 'Update interpretation' : 'Record interpretation'}</button>
        {current && <span className="tiny green mono">RECORDED · {current.confidence.toUpperCase()} CONFIDENCE</span>}
      </div>
    </div>
  );
}

export { EARTH_POI_BY_ID };
