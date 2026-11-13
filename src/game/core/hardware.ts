// Hardware assessment. Reports only what the browser genuinely exposes — browsers deliberately hide or
// round many values (exact CPU/GPU model, VRAM) for privacy, so we never invent them.
import type { Preset } from './graphics';

export interface BenchResult {
  frames: number;
  highMedianMs: number; // GPU+CPU render cost per frame at the HIGH test configuration (synchronised)
  highP95Ms: number;
  ultraMedianMs: number;
  ultraP95Ms: number;
  resolution: string;
}

export interface HardwareReport {
  webgl: 'webgl2' | 'webgl1' | 'none';
  renderer: string | null; // as reported by the browser (may be generic / anonymised)
  rendererHidden: boolean;
  vendor: string | null;
  software: boolean; // software rasteriser detected (SwiftShader, llvmpipe…)
  maxTexture: number;
  maxRenderbuffer: number;
  extensions: number;
  anisotropy: number;
  floatRender: boolean;
  cores: number | null; // navigator.hardwareConcurrency (logical processors)
  memoryGB: number | null; // navigator.deviceMemory (Chromium only, rounded and capped at 8)
  browser: string;
  platform: string;
  bench: BenchResult | null;
  recommended: Preset;
  reasons: string[];
  time: number;
}

function browserName() {
  const uad = (navigator as any).userAgentData;
  if (uad?.brands?.length) {
    const b = uad.brands.find((x: any) => !/Not.?A.?Brand|Chromium/i.test(x.brand)) ?? uad.brands[0];
    return `${b.brand} ${b.version}`;
  }
  const ua = navigator.userAgent;
  const m = ua.match(/(Firefox|Edg|OPR|Chrome|Safari)\/(\d+)/);
  return m ? `${m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1]} ${m[2]}` : 'Unknown browser';
}

function platformName() {
  const uad = (navigator as any).userAgentData;
  if (uad?.platform) return uad.platform;
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

/** Static capability probe (instant). */
export function detectHardware(): Omit<HardwareReport, 'bench' | 'recommended' | 'reasons' | 'time'> {
  const base = {
    cores: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
    memoryGB: typeof (navigator as any).deviceMemory === 'number' ? (navigator as any).deviceMemory : null,
    browser: browserName(),
    platform: platformName(),
  };
  const canvas = document.createElement('canvas');
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  let webgl: HardwareReport['webgl'] = 'none';
  try {
    gl = canvas.getContext('webgl2');
    if (gl) webgl = 'webgl2';
    else {
      gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
      if (gl) webgl = 'webgl1';
    }
  } catch { /* no WebGL */ }
  if (!gl) {
    return { ...base, webgl, renderer: null, rendererHidden: true, vendor: null, software: false, maxTexture: 0, maxRenderbuffer: 0, extensions: 0, anisotropy: 0, floatRender: false };
  }
  let renderer: string | null = null, vendor: string | null = null;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  try {
    renderer = (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || null;
    vendor = (dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)) || null;
  } catch { /* hidden */ }
  const rendererHidden = !renderer || /^(WebKit WebGL|Mozilla|Generic Renderer)$/i.test(renderer.trim());
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const exts = gl.getSupportedExtensions() ?? [];
  const report = {
    ...base,
    webgl,
    renderer,
    rendererHidden,
    vendor,
    software: !!renderer && /swiftshader|llvmpipe|softpipe|basic render|microsoft basic|mesa offscreen/i.test(renderer),
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    maxRenderbuffer: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
    extensions: exts.length,
    anisotropy: aniso ? (gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number) : 0,
    floatRender: exts.includes('EXT_color_buffer_float') || exts.includes('WEBGL_color_buffer_float'),
  };
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return report;
}

/** Turn capabilities + measured benchmark into a recommendation, with human-readable reasons. */
export function recommend(hw: Omit<HardwareReport, 'recommended' | 'reasons' | 'time'>): { preset: Preset; reasons: string[] } {
  const reasons: string[] = [];
  if (hw.webgl === 'none') return { preset: 'low', reasons: ['WebGL is not available — the game cannot render 3D on this browser.'] };
  if (hw.software) return { preset: 'low', reasons: ['A software renderer was detected (no hardware graphics acceleration).'] };

  let preset: Preset = 'medium';
  const b = hw.bench;
  if (b) {
    // Add margin for game logic, simulation and UI that the render-only test does not include.
    const estHigh = b.highMedianMs * 1.35 + 2;
    const estUltra = b.ultraMedianMs * 1.35 + 2;
    const stableHigh = b.highP95Ms < b.highMedianMs * 2.2 + 4;
    if (estUltra <= 11.1 && b.ultraP95Ms <= 16) { preset = 'ultra'; reasons.push(`Ultra test frame ≈ ${b.ultraMedianMs.toFixed(1)} ms — headroom for 90 FPS.`); }
    else if (estHigh <= 16.7 && b.highP95Ms <= 24 && stableHigh) { preset = 'high'; reasons.push(`High test frame ≈ ${b.highMedianMs.toFixed(1)} ms — enough for 60 FPS.`); }
    else if (estHigh <= 33) { preset = 'medium'; reasons.push(`High test frame ≈ ${b.highMedianMs.toFixed(1)} ms — Medium keeps 60 FPS more reliably.`); }
    else { preset = 'low'; reasons.push(`High test frame ≈ ${b.highMedianMs.toFixed(1)} ms — Low targets a steady 30+ FPS.`); }
    if (!stableHigh) reasons.push('Frame times were uneven during the test, so a safer preset was chosen.');
  } else {
    reasons.push('Benchmark unavailable — using a safe default.');
  }
  const order: Preset[] = ['low', 'medium', 'high', 'ultra'];
  const cap = (p: Preset, why: string) => {
    if (order.indexOf(preset) > order.indexOf(p)) { preset = p; reasons.push(why); }
  };
  if (hw.memoryGB !== null && hw.memoryGB <= 2) cap('low', `Browser reports about ${hw.memoryGB} GB of device memory.`);
  else if (hw.memoryGB !== null && hw.memoryGB <= 4) cap('medium', `Browser reports about ${hw.memoryGB} GB of device memory.`);
  if (hw.cores !== null && hw.cores <= 2) cap('low', `${hw.cores} logical processors reported.`);
  else if (hw.cores !== null && hw.cores <= 4) cap('high', `${hw.cores} logical processors reported — Ultra not recommended.`);
  if (hw.maxTexture && hw.maxTexture < 4096) cap('medium', `Maximum texture size is ${hw.maxTexture}px.`);
  return { preset, reasons };
}
