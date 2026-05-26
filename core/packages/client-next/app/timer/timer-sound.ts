/**
 * Web Audio cues — beeps for the inspection state machine and timer events.
 * Lazy AudioContext + speech-synthesis voice override (browser TTS).
 * Ported subset of packages/client/src/pages/timer/sound/.
 */

export type Cue =
  | 'inspection-start'
  | 'warn-8'
  | 'warn-12'
  | 'start'
  | 'stop'
  | 'penalty';

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  voiceInspection: 'none' | 'en-male' | 'en-female' | 'zh-male' | 'zh-female';
}

let _settings: SoundSettings = {
  enabled: true,
  volume: 0.5,
  voiceInspection: 'none',
};

export function setSoundSettings(s: SoundSettings): void {
  _settings = s;
}

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (_ctx) return _ctx;
  if (typeof window === 'undefined') return null;
  try {
    const W = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) return null;
    _ctx = new Ctor();
    return _ctx;
  } catch {
    return null;
  }
}

interface Note { freq: number; ms: number; type?: OscillatorType; gain?: number }

const CUES: Record<Cue, Note[]> = {
  'inspection-start': [{ freq: 660, ms: 80 }],
  'warn-8':           [{ freq: 880, ms: 100 }, { freq: 880, ms: 100 }],
  'warn-12':          [{ freq: 990, ms: 120 }, { freq: 990, ms: 120 }, { freq: 990, ms: 120 }],
  'start':            [{ freq: 440, ms: 50 }],
  'stop':             [{ freq: 740, ms: 50 }, { freq: 880, ms: 80 }],
  'penalty':          [{ freq: 220, ms: 200, type: 'sawtooth' }],
};

function playNote(c: AudioContext, note: Note, when: number, volume: number): number {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = note.type ?? 'sine';
  osc.frequency.setValueAtTime(note.freq, when);
  const peak = (note.gain ?? 0.6) * volume;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(peak, when + 0.005);
  gain.gain.linearRampToValueAtTime(0, when + note.ms / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(when);
  osc.stop(when + note.ms / 1000 + 0.01);
  return when + note.ms / 1000 + 0.02;
}

const _lastVoice: Partial<Record<Cue, number>> = {};

function phrase(cue: Cue, isZh: boolean): string {
  if (isZh) {
    switch (cue) {
      case 'warn-8': return '8 秒';
      case 'warn-12': return '12 秒';
      case 'start': return '开始';
      case 'inspection-start': return '观察';
      default: return '';
    }
  }
  switch (cue) {
    case 'warn-8': return '8 seconds';
    case 'warn-12': return '12 seconds';
    case 'start': return 'go';
    case 'inspection-start': return 'inspection';
    default: return '';
  }
}

function speak(cue: Cue): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const variant = _settings.voiceInspection;
  if (variant === 'none') return false;
  const now = Date.now();
  if (_lastVoice[cue] && now - _lastVoice[cue]! < 1000) return true;
  _lastVoice[cue] = now;
  try {
    const isZh = variant.startsWith('zh');
    const u = new SpeechSynthesisUtterance(phrase(cue, isZh));
    u.lang = isZh ? 'zh-CN' : 'en-US';
    u.rate = 1.1;
    u.volume = 1;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function play(cue: Cue): void {
  if (!_settings.enabled || _settings.volume <= 0) return;
  if (
    _settings.voiceInspection !== 'none' &&
    (cue === 'warn-8' || cue === 'warn-12' || cue === 'start' || cue === 'inspection-start')
  ) {
    if (speak(cue)) return;
  }
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  let when = c.currentTime + 0.005;
  for (const note of CUES[cue]) {
    when = playNote(c, note, when, _settings.volume);
  }
}

/** Pre-warm the audio context (call on first user gesture for mobile autoplay). */
export function warmupSound(): void {
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
}

export function cancelVoice(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
}
