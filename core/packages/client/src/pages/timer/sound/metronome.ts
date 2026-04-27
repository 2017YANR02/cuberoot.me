/**
 * Singleton metronome — short sine ticks at a configurable BPM. Auto-stops
 * when the page goes hidden / unloads so it doesn't keep ticking on other
 * routes.
 */

export interface Metronome {
  start(bpm: number): void;
  stop(): void;
  isRunning(): boolean;
  setBpm(bpm: number): void;
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

function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 60;
  return Math.max(30, Math.min(240, Math.round(bpm)));
}

function tick(c: AudioContext): void {
  const t = c.currentTime + 0.005;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.4, t + 0.003);
  gain.gain.linearRampToValueAtTime(0, t + 0.05);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.06);
}

let _bpm = 60;
let _timer: number | null = null;

const impl: Metronome = {
  start(bpm: number): void {
    _bpm = clampBpm(bpm);
    if (_timer != null) {
      clearInterval(_timer);
      _timer = null;
    }
    const c = ctx();
    if (!c) return;
    if (c.state === 'suspended') void c.resume();
    const interval = 60000 / _bpm;
    tick(c);
    _timer = window.setInterval(() => {
      const cc = ctx();
      if (cc) tick(cc);
    }, interval);
  },
  stop(): void {
    if (_timer != null) {
      clearInterval(_timer);
      _timer = null;
    }
  },
  isRunning(): boolean {
    return _timer != null;
  },
  setBpm(bpm: number): void {
    const next = clampBpm(bpm);
    if (next === _bpm) return;
    const wasRunning = _timer != null;
    if (wasRunning) {
      this.stop();
      this.start(next);
    } else {
      _bpm = next;
    }
  },
};

if (typeof window !== 'undefined') {
  const stopOnHide = () => {
    if (document.visibilityState === 'hidden') impl.stop();
  };
  window.addEventListener('visibilitychange', stopOnHide);
  window.addEventListener('beforeunload', () => impl.stop());
}

export function getMetronome(): Metronome {
  return impl;
}
