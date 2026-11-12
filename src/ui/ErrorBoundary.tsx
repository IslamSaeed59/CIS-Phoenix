import { Component, type ReactNode } from 'react';
import { useGame } from '../game/core/store';

export class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error) {
    console.error('[PD2077] Fatal render error', err);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#07090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="window" style={{ width: 560, padding: 24 }}>
          <div className="win-title" style={{ color: 'var(--amber)' }}>System fault</div>
          <p className="small" style={{ lineHeight: 1.6 }}>
            The simulation hit an unexpected error. Your progress is saved locally. If this persists, try a lower graphics setting
            (WebGL memory) or a recent desktop browser.
          </p>
          <pre className="mono tiny dim" style={{ whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>{String(this.state.err?.message)}</pre>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => { useGame.getState().setSettings({ quality: 'low' }); this.setState({ err: null }); }}>Retry on low graphics</button>
            <button className="btn" onClick={() => { useGame.getState().setPhase('menu'); this.setState({ err: null }); }}>Main menu</button>
          </div>
        </div>
      </div>
    );
  }
}
