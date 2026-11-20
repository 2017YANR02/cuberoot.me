/**
 * Web Audio cues — beeps for the inspection state machine and timer events.
 *
 * No external audio files: every cue is a short oscillator note synthesized
 * on demand. AudioContext is created lazily on the first play() so we don't
 * burn audio resources for users who never trigger a cue.
 */

import type { TimerSoundSettings } from '@cuberoot/shared/timer';
import {
  TIMER_AUDIO_CUES,
  TIMER_AUDIO_NOTE_ATTACK_MS,
  TIMER_AUDIO_NOTE_GAIN,
  TIMER_AUDIO_NOTE_GAP_MS,
  TIMER_INSPECTION_BEEP,
  isTimerInspectionVoiceCue,
  type TimerAudioCue,
  type TimerAudioNote,
} from '@cuberoot/shared/timer/sound-feedback';
import { createTimerVoice } from './timer-voice';

export type Cue = TimerAudioCue;

export function createTimerSound(getSettings: () => TimerSoundSettings & { inspectionBeepAt?: readonly number[] }) {
  const voice = createTimerVoice(getSettings);
  const { isVoiceAvailable, speakInspectionCue } = voice;
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

  function playNote(c: AudioContext, note: TimerAudioNote, when: number, volume: number): number {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = note.type ?? 'sine';
    osc.frequency.setValueAtTime(note.freq, when);
    const peak = TIMER_AUDIO_NOTE_GAIN * volume;
    const attack = TIMER_AUDIO_NOTE_ATTACK_MS / 1000;
    // Quick attack/release envelope to avoid clicks.
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + attack);
    gain.gain.linearRampToValueAtTime(0, when + note.ms / 1000);
    osc.connect(gain).connect(c.destination);
    osc.start(when);
    osc.stop(when + note.ms / 1000 + 0.01);
    return when + (note.ms + TIMER_AUDIO_NOTE_GAP_MS) / 1000;
  }

  function playBeep(cue: Cue): void {
    const s = getSettings();
    if (!s.soundsEnabled || s.volume <= 0) return;
    const c = ctx();
    if (!c) return;
    try {
      if (c.state === 'suspended') void c.resume().catch(() => undefined);
      let when = c.currentTime + 0.005;
      for (const note of TIMER_AUDIO_CUES[cue]) when = playNote(c, note, when, s.volume);
    } catch { /* Audio failure must not interrupt a timer transition. */ }
  }

  function play(cue: Cue): void {
    const s = getSettings();
    if (!s.soundsEnabled || s.volume <= 0) return;
    // Voice override for inspection cues.
    if (
      s.voiceInspection !== 'none' &&
      isTimerInspectionVoiceCue(cue) &&
      isVoiceAvailable()
    ) {
      if (speakInspectionCue(cue, s.voiceInspection.startsWith('zh'), () => playBeep(cue))) return;
    }
    playBeep(cue);
  }

  /**
   * A single short beep for the configurable "beep at N inspection seconds" list.
   * Independent of `soundsEnabled` — populating the beep-at list IS the opt-in —
   * but still respects master volume (0 = silent).
   */
  function playInspectionBeep(): void {
    const s = getSettings();
    if (s.volume <= 0) return;
    const c = ctx();
    if (!c) return;
    try {
      if (c.state === 'suspended') void c.resume().catch(() => undefined);
      playNote(c, TIMER_INSPECTION_BEEP, c.currentTime + 0.005, s.volume);
    } catch { /* Device audio may be unavailable. */ }
  }

  /**
   * Pre-warm the audio context with a silent note. Call this on the first user
   * gesture to satisfy mobile autoplay policies.
   */
  function warmupSound(): void {
    const c = ctx();
    if (!c) return;
    try { if (c.state === 'suspended') void c.resume().catch(() => undefined); } catch { /* Audio unavailable. */ }
  }
  return {
    play, playInspectionBeep, warmupSound, ...voice,
    getInspectionBeepAt: () => getSettings().inspectionBeepAt ?? [],
    dispose() {
      voice.cancelVoice();
      const current = _ctx;
      _ctx = null;
      try { if (current) void current.close().catch(() => undefined); } catch { /* Already closed. */ }
    },
  };
}
