/**
 * User-facing timer settings — persisted to localStorage as a single JSON blob.
 * Subscribable so React components re-render on change.
 *
 * Ported subset of packages/client/src/pages/timer/settings/index.ts; only the
 * fields actually consumed by the Next.js port are kept.
 */

import { useSyncExternalStore } from 'react';

const KEY = 'cuberoot-timer.settings.v1';

export interface TimerSettings {
  /** Inspection time in seconds. 0 = disabled. WCA = 15. */
  inspection: number;
  soundsEnabled: boolean;
  /** 0..1 master volume. */
  volume: number;
  /** Hold-to-ready threshold in ms (cstimer default = 550). */
  holdMs: number;
  /** Time precision: 2 = centiseconds, 3 = milliseconds. */
  precision: 2 | 3;
  /** Show histogram + trend charts in the bottom panel. */
  showCharts: boolean;
  /** Show celebratory toast on new PB. */
  pbToast: boolean;
  /** Track memo / execution split on BLD events. */
  bldMemo: boolean;
  /** Hide running time while running. */
  hideTime: boolean;
  /** Speech-synthesis voice for inspection cues. */
  voiceInspection: 'none' | 'en-male' | 'en-female' | 'zh-male' | 'zh-female';
  /** When the inspection countdown begins. */
  inspectionTrigger: 'down' | 'up';
}

export const DEFAULTS: TimerSettings = {
  inspection: 0,
  soundsEnabled: true,
  volume: 0.5,
  holdMs: 350,
  precision: 2,
  showCharts: true,
  pbToast: true,
  bldMemo: true,
  hideTime: false,
  voiceInspection: 'none',
  inspectionTrigger: 'down',
};

let _cache: TimerSettings = { ...DEFAULTS };
let _hydrated = false;
const _listeners = new Set<() => void>();

function hydrate(): void {
  if (_hydrated) return;
  _hydrated = true;
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<TimerSettings>;
    _cache = { ...DEFAULTS, ...parsed };
  } catch {
    /* ignore */
  }
}

function save(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(_cache)); } catch { /* quota */ }
}

export function getSettings(): TimerSettings {
  hydrate();
  return _cache;
}

export function updateSettings(patch: Partial<TimerSettings>): void {
  hydrate();
  _cache = { ..._cache, ...patch };
  save();
  for (const fn of _listeners) fn();
}

export function resetSettings(): void {
  _cache = { ...DEFAULTS };
  save();
  for (const fn of _listeners) fn();
}

function subscribe(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

const SERVER_SNAPSHOT: TimerSettings = { ...DEFAULTS };

export function useTimerSettings(): TimerSettings {
  return useSyncExternalStore(subscribe, getSettings, () => SERVER_SNAPSHOT);
}
