import { useEffect, useState, lazy, Suspense } from 'react';
import { useGame } from './game/core/store';
import { useUI, fadeTo, wait } from './game/core/ui';
import { installInput } from './game/core/input';
import { audio } from './game/core/audio';
import { BootScreen, MainMenu } from './ui/MainMenu';
import { Briefing } from './ui/briefing/Briefing';
import { FadeLayer } from './ui/common';
import { IntroScene } from './game/environments/space/IntroScene';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { DiscoveryCard } from './ui/DiscoveryCard';
import { PhotoOverlay, Banner } from './ui/FX';

const EarthScene = lazy(() => import('./game/environments/qaidam/EarthScene').then((m) => ({ default: m.EarthScene })));
const HQScene = lazy(() => import('./game/environments/hq/HQScene').then((m) => ({ default: m.HQScene })));
const EndingScene = lazy(() => import('./game/environments/space/EndingScene').then((m) => ({ default: m.EndingScene })));

function Loading({ label }: { label: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#040607', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div className="mono teal" style={{ letterSpacing: '0.4em', fontSize: 12 }}>LOADING</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{label}</div>
      <div className="progress" style={{ width: 280 }}><div className="pulse" style={{ width: '100%' }} /></div>
      <div className="tiny dim">Generating procedural terrain…</div>
    </div>
  );
}

function TransitionToHQ() {
  const setPhase = useGame((s) => s.setPhase);
  const [step, setStep] = useState(0);
  useEffect(() => {
    (async () => {
      audio.stopAll();
      await fadeTo(0, 800);
      setStep(1);
      await wait(2600);
      setStep(2);
      await wait(2800);
      await fadeTo(1, 900);
      setPhase('hq');
    })();
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div className="mono teal" style={{ letterSpacing: '0.5em', fontSize: 12, opacity: step >= 1 ? 1 : 0, transition: 'opacity 1s' }}>CHAPTER 03</div>
      <div style={{ fontSize: 34, fontWeight: 600, opacity: step >= 1 ? 1 : 0, transition: 'opacity 1s' }}>Return to Mission Control</div>
      <div className="dim" style={{ opacity: step >= 2 ? 1 : 0, transition: 'opacity 1s' }}>72 hours later · IPARC Mission Operations Centre</div>
    </div>
  );
}

export default function App() {
  const phase = useGame((s) => s.phase);
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    installInput();
    const v = useGame.getState().settings.volume;
    audio.setVolume(v);
  }, []);
  useEffect(() => {
    // Reset transient UI between chapters
    useUI.setState({ panel: null, prompt: null, toolRaised: false, readout: null });
    if (phase === 'menu') { audio.stopAll(); fadeTo(0, 600); }
  }, [phase]);

  if (!booted) return <BootScreen onDone={() => setBooted(true)} />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading label="Preparing chapter" />}>
        {phase === 'menu' && <MainMenu />}
        {phase === 'intro' && <IntroScene />}
        {phase === 'briefing' && <Briefing />}
        {phase === 'earth' && <EarthScene />}
        {phase === 'toHQ' && <TransitionToHQ />}
        {phase === 'hq' && <HQScene />}
        {phase === 'ending' && <EndingScene />}
      </Suspense>
      {phase !== 'menu' && <DiscoveryCard />}
      <PhotoOverlay />
      <Banner />
      <FadeLayer />
    </ErrorBoundary>
  );
}
