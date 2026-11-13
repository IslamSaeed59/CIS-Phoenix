import { usePerf, applyOptimizationStep, dismissNotice } from '../game/core/perf';

/** Unobtrusive suggestion shown when the game runs below the performance target. */
export function PerfNotice() {
  const notice = usePerf((s) => s.notice);
  const fps = usePerf((s) => s.fps);
  if (!notice) return null;
  return (
    <div className="panel" style={{ position: 'fixed', right: 22, bottom: 92, width: 320, padding: '12px 14px', zIndex: 65, borderLeft: '2px solid var(--amber)', borderRadius: 8, animation: 'slideInR .3s' }}>
      <div className="mono tiny amber" style={{ letterSpacing: '0.15em' }}>PERFORMANCE · {Math.round(fps)} FPS</div>
      <div className="small" style={{ margin: '4px 0 8px', lineHeight: 1.45 }}>Performance is lower than expected. Optimize graphics settings?</div>
      <div className="tiny dim" style={{ marginBottom: 8 }}>Next step: {notice.what}</div>
      <div className="row">
        <button className="btn sm primary" onClick={applyOptimizationStep}>Optimize</button>
        <button className="btn sm" onClick={dismissNotice}>Not now</button>
      </div>
    </div>
  );
}
