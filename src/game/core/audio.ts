// Procedural Web Audio sound engine. Every sound is synthesised at runtime (original, no licensed assets).

type Loop = { stop: () => void; set: (p: Record<string, number>) => void };

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  amb!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private brownBuf: AudioBuffer | null = null;
  private loops = new Map<string, Loop>();
  volume = 0.8;
  voiceEnabled = true;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.amb = this.ctx.createGain();
    this.amb.gain.value = 0.6;
    this.amb.connect(this.master);
    const len = this.ctx.sampleRate * 3;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brownBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const b = this.brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      b[i] = last * 3.5;
    }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private noiseSrc(brown = false) {
    const s = this.ctx!.createBufferSource();
    s.buffer = brown ? this.brownBuf : this.noiseBuf;
    s.loop = true;
    return s;
  }

  private env(g: GainNode, t: number, a: number, peak: number, dcy: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }

  tone(freq: number, dur = 0.12, type: OscillatorType = 'sine', vol = 0.15, slideTo?: number, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noiseBurst(dur = 0.08, freq = 2000, q = 1, vol = 0.2, type: BiquadFilterType = 'bandpass', delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.noiseSrc();
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, 0.003, vol, dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random() * 2);
    s.stop(t + dur + 0.05);
  }

  // ---------- Named effects ----------
  ui(kind: 'click' | 'hover' | 'open' | 'close' | 'confirm' | 'error' | 'boot' | 'key' = 'click') {
    this.ensure();
    switch (kind) {
      case 'click': this.tone(1400, 0.04, 'square', 0.04); break;
      case 'hover': this.tone(2200, 0.02, 'sine', 0.015); break;
      case 'open': this.tone(600, 0.08, 'sine', 0.06, 1200); break;
      case 'close': this.tone(1100, 0.08, 'sine', 0.05, 500); break;
      case 'confirm': this.tone(880, 0.09, 'sine', 0.08); this.tone(1320, 0.14, 'sine', 0.08, undefined, 0.09); break;
      case 'error': this.tone(220, 0.18, 'sawtooth', 0.06); this.tone(180, 0.22, 'sawtooth', 0.06, undefined, 0.12); break;
      case 'boot': [440, 660, 880, 1320].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.05, undefined, i * 0.12)); break;
      case 'key': this.noiseBurst(0.025, 3500 + Math.random() * 1500, 2, 0.05, 'bandpass'); break;
    }
  }
  shutter() {
    this.ensure();
    this.noiseBurst(0.03, 4000, 1.5, 0.25, 'highpass');
    this.noiseBurst(0.05, 1800, 2, 0.18, 'bandpass', 0.06);
    this.tone(90, 0.05, 'square', 0.04, undefined, 0.02);
  }
  scanner() {
    this.ensure();
    this.tone(700, 0.6, 'sine', 0.05, 2400);
    for (let i = 0; i < 6; i++) this.tone(1800 + i * 120, 0.03, 'square', 0.02, undefined, 0.1 * i);
  }
  scanDone() { this.ensure(); this.tone(1500, 0.08, 'sine', 0.08); this.tone(2000, 0.12, 'sine', 0.08, undefined, 0.1); }
  footstep(surface: 'salt' | 'gravel' | 'sand' | 'hard' = 'gravel') {
    this.ensure();
    const f = surface === 'salt' ? 3200 : surface === 'sand' ? 900 : surface === 'hard' ? 1600 : 2200;
    this.noiseBurst(0.07 + Math.random() * 0.03, f * (0.8 + Math.random() * 0.4), 0.9, surface === 'salt' ? 0.09 : 0.07);
  }
  radio() {
    this.ensure();
    this.noiseBurst(0.18, 2500, 0.6, 0.08, 'bandpass');
    this.tone(1200, 0.06, 'sine', 0.05, undefined, 0.16);
  }
  warning() {
    this.ensure();
    this.tone(990, 0.14, 'square', 0.05);
    this.tone(990, 0.14, 'square', 0.05, undefined, 0.25);
  }
  servo(dur = 0.4) {
    this.ensure();
    this.tone(320, dur, 'sawtooth', 0.025, 520);
    this.noiseBurst(dur, 1200, 4, 0.03, 'bandpass');
  }
  thud() { this.ensure(); this.tone(80, 0.25, 'sine', 0.2, 40); this.noiseBurst(0.1, 400, 1, 0.1, 'lowpass'); }

  // ---------- Loops ----------
  startLoop(name: 'wind' | 'hq' | 'rover' | 'space' | 'marswind') {
    this.ensure();
    if (!this.ctx || this.loops.has(name)) return;
    const ctx = this.ctx;
    const nodes: AudioNode[] = [];
    const srcs: AudioScheduledSourceNode[] = [];
    let set: Loop['set'] = () => {};
    if (name === 'wind' || name === 'marswind') {
      const s = this.noiseSrc();
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = name === 'wind' ? 320 : 220;
      f.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.value = name === 'wind' ? 0.028 : 0.02;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lg = ctx.createGain();
      lg.gain.value = name === 'wind' ? 120 : 60;
      lfo.connect(lg).connect(f.frequency);
      const lfo2 = ctx.createOscillator();
      lfo2.frequency.value = 0.07;
      const lg2 = ctx.createGain();
      lg2.gain.value = 0.01;
      lfo2.connect(lg2).connect(g.gain);
      s.connect(f).connect(g).connect(this.amb);
      s.start(); lfo.start(); lfo2.start();
      srcs.push(s, lfo, lfo2);
      nodes.push(f, g);
      set = (p) => { if (p.intensity !== undefined) g.gain.setTargetAtTime((name === 'wind' ? 0.028 : 0.02) * p.intensity, ctx.currentTime, 0.5); };
    } else if (name === 'hq') {
      const s = this.noiseSrc(true);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 300;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      const hum = ctx.createOscillator();
      hum.frequency.value = 60;
      const hg = ctx.createGain();
      hg.gain.value = 0.012;
      hum.connect(hg).connect(this.amb);
      s.connect(f).connect(g).connect(this.amb);
      s.start(); hum.start();
      srcs.push(s, hum);
      nodes.push(f, g, hg);
    } else if (name === 'space') {
      const o1 = ctx.createOscillator(); o1.frequency.value = 55; o1.type = 'sine';
      const o2 = ctx.createOscillator(); o2.frequency.value = 82.5; o2.type = 'sine';
      const o3 = ctx.createOscillator(); o3.frequency.value = 110.3; o3.type = 'triangle';
      const g = ctx.createGain(); g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 4);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
      const lg = ctx.createGain(); lg.gain.value = 0.02; lfo.connect(lg).connect(g.gain);
      [o1, o2, o3].forEach((o) => o.connect(g));
      g.connect(this.amb);
      [o1, o2, o3, lfo].forEach((o) => o.start());
      srcs.push(o1, o2, o3, lfo);
      nodes.push(g);
    } else if (name === 'rover') {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 90;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      const g = ctx.createGain(); g.gain.value = 0;
      const n = this.noiseSrc(); const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 600; nf.Q.value = 1.5;
      const ng = ctx.createGain(); ng.gain.value = 0;
      o.connect(f).connect(g).connect(this.sfx);
      n.connect(nf).connect(ng).connect(this.sfx);
      o.start(); n.start();
      srcs.push(o, n);
      nodes.push(f, g, nf, ng);
      set = (p) => {
        const sp = Math.min(1, Math.abs(p.speed ?? 0));
        o.frequency.setTargetAtTime(70 + sp * 140, ctx.currentTime, 0.1);
        g.gain.setTargetAtTime(sp > 0.02 ? 0.03 + sp * 0.04 : 0, ctx.currentTime, 0.1);
        ng.gain.setTargetAtTime(sp * 0.05 * (p.rough ?? 1), ctx.currentTime, 0.1);
      };
    }
    this.loops.set(name, {
      stop: () => {
        srcs.forEach((s) => { try { s.stop(); } catch { /* noop */ } });
        nodes.forEach((n) => n.disconnect());
      },
      set,
    });
  }
  setLoop(name: string, p: Record<string, number>) { this.loops.get(name)?.set(p); }
  stopLoop(name: string) {
    const l = this.loops.get(name);
    if (l) { l.stop(); this.loops.delete(name); }
  }
  stopAll() { [...this.loops.keys()].forEach((k) => this.stopLoop(k)); }

  /** Brief radio voice via the browser speech engine (optional; falls back to text only). */
  speak(text: string) {
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 0.9;
      u.volume = Math.min(1, this.volume * 0.9);
      const voices = window.speechSynthesis.getVoices();
      const v = voices.find((x) => /en-(US|GB)/.test(x.lang) && /Male|David|Daniel|Guy|Google UK English Male/i.test(x.name)) || voices.find((x) => x.lang.startsWith('en'));
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }
}

export const audio = new AudioEngine();
