/**
 * User-facing settings — persisted to localStorage as a single JSON blob.
 *
 * Settings are read via `useSettings()` and updated via `updateSettings(patch)`.
 * Components that depend on settings should subscribe via the hook so they
 * re-render when settings change.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

const KEY = 'cuberoot-timer.settings.v1';

export interface TimerSettings {
  /** Inspection time in seconds. 0 = disabled. WCA standard = 15. */
  inspection: number;

  /** Play start/stop/8s/12s sounds via Web Audio. */
  soundsEnabled: boolean;
  /** 0..1 master volume. */
  volume: number;

  /** Hide running time (show only "...") until the timer stops. */
  hideTime: boolean;

  /** UI theme. 'auto' follows OS preference. */
  theme: 'dark' | 'light' | 'auto';

  /** Cube preview color override (hex). null → use WCA defaults. */
  colors: Partial<Record<'U'|'D'|'F'|'B'|'L'|'R', string>>;

  /** Show the cube net preview alongside the scramble. */
  showCubePreview: boolean;

  /** Show histogram + trend charts in the bottom panel. */
  showCharts: boolean;

  /** Time precision: 2 = centiseconds, 3 = milliseconds. */
  precision: 2 | 3;

  /** Scale factor for the big timer display (0.5..2). */
  timerFontScale: number;

  /** Hold-to-ready threshold in ms (cstimer default = 550). */
  holdMs: number;

  /** Show only the latest scramble line on phones (compact mode). */
  compactScramble: boolean;

  /** Use the three.js 3D cube preview instead of the 2D net. */
  use3D: boolean;

  /** Show the GitHub-style practice heatmap in the bottom panel. */
  showHeatmap: boolean;

  /** Track CFOP stage splits (cross / F2L / OLL / PLL) on NxN events. */
  multiStage: boolean;

  /** Track memo / execution split on BLD events (Enter to mark memo done). */
  bldMemo: boolean;

  /** OLL trainer case-id whitelist (e.g. ["OLL 21"]). undefined / [] = all 57. */
  ollSubset?: string[];

  /** PLL trainer case-id whitelist (e.g. ["T", "Y"]). undefined / [] = all 21. */
  pllSubset?: string[];

  /** Color neutral scramble mode (3x3-shaped events only). */
  cnMode: 'none' | 'single' | 'dual' | 'six';

  /** Speech-synthesis voice for inspection cues. 'none' = beeps as before. */
  voiceInspection: 'none' | 'en-male' | 'en-female' | 'zh-male' | 'zh-female';

  /** Custom average windows in addition to ao5/ao12 (e.g. [7, 25]). */
  customAoWindows: number[];

  /** Action when user clicks the scramble strip. */
  scrambleClickAction: 'none' | 'next' | 'copy';

  /** Hide entire UI (topbar / scramble / charts) while timer is running. */
  hideAllUiWhileRunning: boolean;

  /** Metronome on/off and tempo. */
  metronomeEnabled: boolean;
  metronomeBpm: number;

  /** Sync seed: when set, scramble RNG is deterministic across devices. */
  syncSeed: string | null;

  /** Auto-backup every N saves. 0 = disabled, max 30. */
  autoBackupEvery: number;

  /**
   * Bluetooth auto-ready: trigger the hold cycle automatically when the cube
   * indicates the user is ready to start.
   *   'off'          — manual (default)
   *   'still'        — solved + 2s without any move
   *   'double-flick' — confirm via U U' U U' (any quarter-turn pair pattern)
   */
  bluetoothAutoReady: 'off' | 'still' | 'double-flick';

  /**
   * When the inspection countdown begins.
   *   'down' — first space-down (current cstimer behaviour)
   *   'up'   — only on key release; matches stackmat habit
   */
  inspectionTrigger: 'down' | 'up';
}

export const DEFAULTS: TimerSettings = {
  inspection: 0,
  soundsEnabled: true,
  volume: 0.5,
  hideTime: false,
  theme: 'dark',
  colors: {},
  showCubePreview: true,
  showCharts: true,
  precision: 2,
  timerFontScale: 1,
  holdMs: 550,
  compactScramble: false,
  use3D: false,
  showHeatmap: true,
  multiStage: false,
  bldMemo: true,
  cnMode: 'none',
  voiceInspection: 'none',
  customAoWindows: [7],
  scrambleClickAction: 'next',
  hideAllUiWhileRunning: false,
  metronomeEnabled: false,
  metronomeBpm: 60,
  syncSeed: null,
  autoBackupEvery: 10,
  bluetoothAutoReady: 'off',
  inspectionTrigger: 'down',
};

let _cache: TimerSettings = load();
const _listeners = new Set<() => void>();

function load(): TimerSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<TimerSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: TimerSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

export function getSettings(): TimerSettings {
  return _cache;
}

export function updateSettings(patch: Partial<TimerSettings>): void {
  _cache = { ...(_cache), ...patch };
  save(_cache);
  for (const fn of _listeners) fn();
}

export function resetSettings(): void {
  _cache = { ...DEFAULTS };
  save(_cache);
  for (const fn of _listeners) fn();
}

function subscribe(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/**
 * React hook that re-renders when settings change. Returns the live cache.
 */
export function useSettings(): TimerSettings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

/**
 * Apply theme to the document root by toggling a data-attribute. Other CSS
 * keys can target `:root[data-timer-theme="light"]`.
 */
export function useApplyTheme(): void {
  const settings = useSettings();
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const effective =
      settings.theme === 'auto' ? (systemDark ? 'dark' : 'light') : settings.theme;
    root.setAttribute('data-timer-theme', effective);
    return () => root.removeAttribute('data-timer-theme');
  }, [settings.theme, systemDark]);
}
