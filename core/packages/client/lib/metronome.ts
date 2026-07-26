/**
 * Site-wide metronome — one WebAudio tick source shared by the floating panel
 * (mounted next to the desk pet so it survives client-side navigation) and the
 * timer page's inspection/solve ticker.
 *
 * Timing: beats are queued onto the audio clock ahead of time by a lookahead
 * scheduler, never fired straight from a JS timer. A setInterval-driven
 * metronome drifts and drops beats whenever the main thread is busy rendering,
 * which is plainly audible at training tempos (2–6 turns per second).
 *
 * One beat = one turn, so TPS = BPM / 60. That is why the ceiling is 600 BPM
 * (10 TPS) rather than a musical 300 — fast solvers turn well past 5 TPS.
 */

import { useSyncExternalStore } from 'react';
import { persistItem } from '@/lib/safe-storage';

const KEY = 'cuberoot.metronome.v1';

export const BPM_MIN = 30;
export const BPM_MAX = 600;

/** Accent every N beats; 0 = every beat identical. 8 ≈ one F2L pair. */
export const ACCENT_CHOICES = [0, 2, 4, 8] as const;

export interface MetronomeState {
  on: boolean;
  bpm: number;
  accent: number;
}

const DEFAULTS: MetronomeState = { on: false, bpm: 120, accent: 0 };

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULTS.bpm;
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(bpm)));
}

/** Turns per second at a given tempo, one beat per turn. */
export function bpmToTps(bpm: number): number {
  return bpm / 60;
}

export function tpsToBpm(tps: number): number {
  return clampBpm(tps * 60);
}

// ── Store ────────────────────────────────────────────────────────

/**
 * One-shot pickup of the tempo the timer page used to own, so anyone who had
 * tuned it there doesn't get silently reset to 120 the first time the shared
 * metronome loads.
 */
function legacyTimerBpm(): number | null {
  try {
    const raw = localStorage.getItem('cuberoot-timer.settings.v1');
    if (!raw) return null;
    const bpm = (JSON.parse(raw) as { metronomeBpm?: unknown }).metronomeBpm;
    return typeof bpm === 'number' && Number.isFinite(bpm) ? clampBpm(bpm) : null;
  } catch {
    return null;
  }
}

function load(): MetronomeState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, bpm: legacyTimerBpm() ?? DEFAULTS.bpm };
    const parsed = JSON.parse(raw) as Partial<MetronomeState>;
    return {
      // `on` is deliberately not restored: a site-wide metronome that starts
      // ticking by itself on page load would be startling, and autoplay policy
      // would block the audio until the first gesture anyway.
      on: false,
      bpm: clampBpm(parsed.bpm ?? DEFAULTS.bpm),
      accent: ACCENT_CHOICES.includes(parsed.accent as 0) ? (parsed.accent as number) : DEFAULTS.accent,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

let _state: MetronomeState = typeof window === 'undefined' ? { ...DEFAULTS } : load();
const _listeners = new Set<() => void>();

function emit(): void {
  for (const fn of _listeners) fn();
}

function subscribe(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function getMetronomeState(): MetronomeState {
  return _state;
}

/** React hook that re-renders on any metronome state change. */
export function useMetronome(): MetronomeState {
  return useSyncExternalStore(subscribe, getMetronomeState, getMetronomeState);
}

export function setMetronome(patch: Partial<MetronomeState>): void {
  const prev = _state;
  const next: MetronomeState = {
    on: patch.on ?? prev.on,
    bpm: patch.bpm != null ? clampBpm(patch.bpm) : prev.bpm,
    accent: patch.accent != null ? patch.accent : prev.accent,
  };
  if (next.on === prev.on && next.bpm === prev.bpm && next.accent === prev.accent) return;
  _state = next;
  persistItem(KEY, JSON.stringify({ bpm: next.bpm, accent: next.accent }));
  if (next.bpm !== prev.bpm) retune();
  syncTransport();
  emit();
}

export function toggleMetronome(): void {
  setMetronome({ on: !_state.on });
}

/**
 * Hold the metronome on for as long as `active`, without touching the user's
 * own on/off choice. The timer page uses this to tick only during inspection /
 * solve and then hand control straight back to the floating panel.
 */
const _holds = new Set<string>();

export function setMetronomeHold(id: string, active: boolean): void {
  const had = _holds.has(id);
  if (active === had) return;
  if (active) _holds.add(id); else _holds.delete(id);
  syncTransport();
  emit();
}

/** Whether ticks are actually sounding right now (user switch or any hold). */
export function isMetronomeSounding(): boolean {
  return _state.on || _holds.size > 0;
}

// ── Transport ────────────────────────────────────────────────────

/** How often the scheduler wakes to top up the queue. */
const LOOKAHEAD_MS = 25;
/** How far past the audio clock beats are queued while the tab is visible. */
const SCHEDULE_AHEAD_S = 0.12;
/**
 * Background tabs throttle timers to ~1/s, which would starve a 0.12s queue and
 * make the beat stutter. Queue further ahead instead so hidden-tab ticks stay
 * on time — the metronome is a tool the user switched on, so silently stopping
 * it when they glance at another tab reads as a bug.
 */
const SCHEDULE_AHEAD_HIDDEN_S = 1.5;

interface QueuedBeat { time: number; index: number; accent: boolean }

let _ctx: AudioContext | null = null;
let _timer: number | null = null;
let _nextBeatTime = 0;
let _beatIndex = 0;
const _queue: QueuedBeat[] = [];

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

function tick(c: AudioContext, at: number, accent: boolean): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(accent ? 1800 : 1200, at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(accent ? 0.5 : 0.32, at + 0.003);
  gain.gain.linearRampToValueAtTime(0, at + 0.05);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + 0.06);
}

function scheduleAhead(): number {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
    ? SCHEDULE_AHEAD_HIDDEN_S
    : SCHEDULE_AHEAD_S;
}

function pump(): void {
  const c = _ctx;
  if (!c) return;
  const horizon = c.currentTime + scheduleAhead();
  while (_nextBeatTime < horizon) {
    const accent = _state.accent > 0 && _beatIndex % _state.accent === 0;
    tick(c, _nextBeatTime, accent);
    _queue.push({ time: _nextBeatTime, index: _beatIndex, accent });
    _nextBeatTime += 60 / _state.bpm;
    _beatIndex += 1;
  }
}

/**
 * Tempo changed mid-run. Beats already queued are on the audio clock and will
 * fire regardless, but the next unqueued beat may still be scheduled a slow
 * interval away — pull it in so dropping the slider takes effect immediately
 * instead of a bar later.
 */
function retune(): void {
  const c = _ctx;
  if (!c || _timer == null) return;
  const interval = 60 / _state.bpm;
  if (_nextBeatTime - c.currentTime > interval) _nextBeatTime = c.currentTime + interval;
}

function start(): void {
  if (_timer != null) return;
  const c = ctx();
  if (!c) return;
  // Autoplay policy parks the context until a gesture; every entry point here
  // (panel switch, timer start) runs inside one.
  if (c.state === 'suspended') void c.resume();
  _beatIndex = 0;
  _queue.length = 0;
  _nextBeatTime = c.currentTime + 0.06;
  pump();
  _timer = window.setInterval(pump, LOOKAHEAD_MS);
  startBeatPump();
}

function stop(): void {
  if (_timer != null) {
    window.clearInterval(_timer);
    _timer = null;
  }
  _queue.length = 0;
}

function syncTransport(): void {
  if (isMetronomeSounding()) start(); else stop();
}

// ── Beat events (visual pulse) ───────────────────────────────────

export interface BeatEvent { index: number; accent: boolean }

const _beatListeners = new Set<(e: BeatEvent) => void>();
let _raf: number | null = null;

/**
 * Fires as each queued beat actually reaches the speakers. Beats are queued up
 * to a second ahead, so visuals must be driven off the audio clock rather than
 * off the scheduler, or the flash would run ahead of the sound.
 */
export function subscribeBeat(fn: (e: BeatEvent) => void): () => void {
  _beatListeners.add(fn);
  startBeatPump();
  return () => { _beatListeners.delete(fn); };
}

/**
 * Runs only while beats are both wanted and sounding — subscribers are
 * long-lived (the desk pet keeps one mounted for the whole session), so an
 * unconditional rAF loop would burn a frame callback on every page forever.
 */
function startBeatPump(): void {
  if (_raf != null || _beatListeners.size === 0 || _timer == null || typeof window === 'undefined') return;
  const step = () => {
    const c = _ctx;
    if (c) {
      while (_queue.length > 0 && _queue[0].time <= c.currentTime) {
        const beat = _queue.shift() as QueuedBeat;
        for (const fn of _beatListeners) fn({ index: beat.index, accent: beat.accent });
      }
      // Drop what the tab-hidden rAF freeze left stale, so coming back to the
      // tab doesn't dump a burst of catch-up flashes.
      if (_queue.length > 24) _queue.splice(0, _queue.length - 24);
    }
    if (_beatListeners.size > 0 && _timer != null) _raf = requestAnimationFrame(step);
    else _raf = null;
  };
  _raf = requestAnimationFrame(step);
}

// ── Tap tempo ────────────────────────────────────────────────────

const TAP_RESET_MS = 3000;
const TAP_WINDOW = 4;
let _taps: number[] = [];

/**
 * Register one tap and return the tempo it implies (null on the first tap of a
 * run). Taps more than 3s apart start a fresh run.
 */
export function tapTempo(): number | null {
  const now = performance.now();
  if (_taps.length > 0 && now - _taps[_taps.length - 1] > TAP_RESET_MS) _taps = [];
  _taps.push(now);
  if (_taps.length > TAP_WINDOW) _taps.shift();
  if (_taps.length < 2) return null;
  const span = _taps[_taps.length - 1] - _taps[0];
  if (span <= 0) return null;
  return clampBpm(60000 / (span / (_taps.length - 1)));
}

export function resetTapTempo(): void {
  _taps = [];
}

if (typeof window !== 'undefined') {
  // Re-arm the queue on tab return: the scheduler was throttled while hidden,
  // and the context may have been suspended out from under it.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || _timer == null) return;
    const c = _ctx;
    if (!c) return;
    if (c.state === 'suspended') void c.resume();
    if (_nextBeatTime < c.currentTime) _nextBeatTime = c.currentTime + 0.06;
  });
  window.addEventListener('pagehide', stop);
}
