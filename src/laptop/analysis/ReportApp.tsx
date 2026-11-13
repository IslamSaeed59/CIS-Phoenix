import { useState } from 'react';
import { useGame, worldProgress, comparisonProgress, scienceScore, interpFor } from '../../game/core/store';
import { CATEGORIES } from '../../data/scientific-checklist/categories';
import { APPLICATIONS } from '../../data/scientific-checklist/comparison';
import { audio } from '../../game/core/audio';

export function ReportApp({ onSubmit }: { onSubmit: () => void }) {
  const g = useGame();
  const ep = worldProgress('earth', g), mp = worldProgress('mars', g), cp = comparisonProgress(g);
  const sc = scienceScore(g);
  const [confirm, setConfirm] = useState(false);
  const ready = ep.done && mp.done && cp.ready;
  return (
    <div className="scroll" style={{ padding: 20, height: '100%' }}>
      <div className="mono teal small" style={{ letterSpacing: '0.3em' }}>FINAL MISSION REPORT · PD-2077</div>
      <div style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 14px' }}>Earth Analogue → Mars Robotic Expedition</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          ['EARTH INVESTIGATION', ep.done],
          ['MARS INVESTIGATION', mp.done],
          ['SCIENTIFIC COMPARISON', cp.ready],
        ].map(([l, ok]) => (
          <div key={l as string} className="card" style={{ borderColor: ok ? 'var(--teal)' : 'var(--line)' }}>
            <div className="mono tiny dim">{l}</div>
            <div className="mono" style={{ color: ok ? 'var(--green)' : 'var(--amber)', marginTop: 4 }}>{ok ? 'COMPLETE' : 'INCOMPLETE'}</div>
          </div>
        ))}
      </div>
      <div className="label" style={{ margin: '16px 0 6px' }}>Summary of interpretations</div>
      <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr className="mono tiny dim" style={{ textAlign: 'left' }}><th style={{ padding: 4 }}>#</th><th>Category</th><th>Earth</th><th>Mars</th></tr>
        </thead>
        <tbody>
          {CATEGORIES.map((c) => {
            const e = g.earthInterp[c.id], m = g.marsInterp[c.id];
            const eo = e && interpFor('earth')[c.id].options.find((o) => o.id === e.optionId);
            const mo = m && interpFor('mars')[c.id].options.find((o) => o.id === m.optionId);
            return (
              <tr key={c.id} style={{ borderTop: '1px solid var(--line)', verticalAlign: 'top' }}>
                <td className="mono teal" style={{ padding: 4 }}>{c.num}</td>
                <td style={{ padding: 4, width: 150 }}>{c.short}</td>
                <td style={{ padding: 4 }} className="tiny">{eo?.text ?? '—'} <span className="dim">({e?.confidence ?? '—'})</span></td>
                <td style={{ padding: 4 }} className="tiny">{mo?.text ?? '—'} <span className="dim">({m?.confidence ?? '—'})</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="label" style={{ margin: '16px 0 6px' }}>Exploration applications &amp; lunar-base relevance</div>
      <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
        {g.apps.map((id) => {
          const a = APPLICATIONS.find((x) => x.id === id)!;
          return <li key={id} style={{ color: a.valid ? undefined : 'var(--amber)' }}>{a.text} {a.lunar && <span className="amber">★ lunar-relevant</span>} {!a.valid && '(not supported by evidence)'}</li>;
        })}
        {g.apps.length === 0 && <li className="dim">None selected yet.</li>}
      </ul>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="between">
          <div>
            <div className="label">Scientific review panel assessment</div>
            <div className="small dim" style={{ marginTop: 4 }}>Rewards evidence-based interpretation, appropriate confidence and honest limitations — not speed.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 30, fontWeight: 700 }} className={sc.total >= 75 ? 'teal' : 'amber'}>{sc.total}</div>
            <div className="mono tiny">{sc.grade}</div>
          </div>
        </div>
        <div className="mono tiny dim" style={{ marginTop: 8 }}>INTERPRETATION {sc.interp}/{sc.interpMax} · COMPARISON {sc.comp}/{sc.compMax} · EVIDENCE ITEMS {sc.evidence}</div>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        {!confirm ? (
          <button className="btn primary" disabled={!ready || g.reportSubmitted} onClick={() => { setConfirm(true); audio.ui('open'); }}>{g.reportSubmitted ? 'Report submitted ✓' : 'Submit final report'}</button>
        ) : (
          <>
            <span className="small">Transmit report to Mission Control? This concludes the mission.</span>
            <button className="btn primary" onClick={() => { g.submitReport(); onSubmit(); }}>Transmit</button>
            <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
          </>
        )}
        {g.reportSubmitted && <button className="btn amber" onClick={onSubmit}>Replay final cinematic</button>}
      </div>
      {!ready && <div className="tiny amber" style={{ marginTop: 8 }}>Finish Earth, Mars, and answer all 8 “Same or different?” questions in Compare.</div>}
    </div>
  );
}
