/**
 * Web Audio cues — beeps for the inspection state machine and timer events.
 *
 * No external audio files: every cue is a short oscillator note synthesized
 * on demand. AudioContext is created lazily on the first play() so we don't
 * burn audio resources for users who never trigger a cue.
 */

import { getSettings } from '../settings';

export type Cue =
  /** Inspection started (15s countdown begins) */
  | 'inspection-start'
  /** 8-second warning during inspection */
  | 'warn-8'
  /** 12-second warning during inspection */
  | 'warn-12'
  /** Timer just started running (release after green) */
  | 'start'
  /** Timer just stopped (recorded a solve) */
  | 'stop'
  /** Solve was a +2 or DNF (penalty audible cue) */
  | 'penalty';

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
  // Quick attack/release envelope to avoid clicks.
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(peak, when + 0.005);
  gain.gain.linearRampToValueAtTime(0, when + note.ms / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(when);
  osc.stop(when + note.ms / 1000 + 0.01);
  return when + note.ms / 1000 + 0.02; // small gap between notes
}

export function play(cue: Cue): void {
  const s = getSettings();
  if (!s.soundsEnabled || s.volume <= 0) return;
  const c = ctx();
  if (!c) return;
  // Resume in case the context started suspended (autoplay policy).
  if (c.state === 'suspended') void c.resume();
  let when = c.currentTime + 0.005;
  for (const note of CUES[cue]) {
    when = playNote(c, note, when, s.volume);
  }
}

/**
 * Pre-warm the audio context with a silent note. Call this on the first user
 * gesture to satisfy mobile autoplay policies.
 */
export function warmupSound(): void {
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
}
