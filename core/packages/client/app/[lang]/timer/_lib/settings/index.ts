/**
 * User-facing settings — persisted to localStorage as a single JSON blob.
 *
 * Settings are read via `useSettings()` and updated via `updateSettings(patch)`.
 * Components that depend on settings should subscribe via the hook so they
 * re-render when settings change.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { readPalette } from '@/lib/theme';
import { paletteScheme } from '@/lib/palettes';

const KEY = 'cuberoot-timer.settings.v1';

/** Big-digit typeface ids — shared vocabulary with the /alg trainer's picker. */
export type TimerFontId = 'lcd' | 'mono' | 'liberation' | 'sans';

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

  /** Final-result precision: 2 = centiseconds (x.xx), 3 = milliseconds (x.xxx). */
  precision: 2 | 3;

  /** Running (live) display precision: 0 = whole seconds (cstimer style),
   *  1 = x.x, 2 = x.xx, 3 = x.xxx. */
  runningPrecision: 0 | 1 | 2 | 3;

  /** Scale factor for the big timer display (0.5..2). */
  timerFontScale: number;

  /** Big-digit typeface. 'lcd' = 7-segment Segment7Standard (default);
   *  the rest are self-hosted site fonts (same four options as the /alg trainer). */
  timerFont: TimerFontId;

  /** Scale factor for the scramble strip text (0.6..2.5). */
  scrambleFontScale: number;

  /** Scramble strip typeface. 'liberation' = LiberationMono (the long-standing
   *  default); no 'lcd' here — 7-seg has no usable letterforms for notation. */
  scrambleFont: TimerFontId;

  /** Hold-to-ready threshold in ms (cstimer default = 550). */
  holdMs: number;

  /** Show only the latest scramble line on phones (compact mode). */
  compactScramble: boolean;

  /** Render the scramble preview as 3D drag-rotatable cube instead of 2D net. */
  prefer3D: boolean;

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

  /**
   * Average windows shown in the cstimer-style current/best stats table
   * (e.g. [5, 12]). User-editable inline on the Times panel — presets
   * 5/12/25/50/100/200/1000/10000 plus a custom value. Sorted ascending.
   */
  statsAoWindows: number[];

  /** Scramble source: 'random' = locally generated, 'wca' = real past WCA competition scrambles. */
  scrambleSource: 'random' | 'wca';

  /** WCA sub-mode: 'date' = uniformly random within a date range, 'comp' = a specific
   *  competition (optionally narrowed to one round / group). */
  wcaScrambleMode: 'date' | 'comp';
  wcaComp: string;       // competition_id (comp mode)
  wcaCompName: string;   // competition display name (comp mode)
  wcaCompCountry: string; // competition country iso2, for the selected-comp flag (comp mode)
  wcaRound: string;      // round_type_id filter, '' = all rounds (comp mode)
  wcaGroup: string;      // group_id filter, '' = all groups (comp mode)
  wcaDateFrom: string;   // 'YYYY-MM-DD', '' = no lower bound (date mode)
  wcaDateTo: string;     // 'YYYY-MM-DD', '' = no upper bound (date mode)

  /** Use the God's-number shortest equivalent scramble (same cube state, fewer moves) instead of the
   *  original WCA scramble. Only same-state events (333/333oh/333ft/333fm) have one; others ignore it. */
  wcaUseOptimal: boolean;

  /** Draw only WCA scrambles matching a cross/method difficulty — a filter layered on the date-range
   *  random sampler (3x3-family events only; comp mode serves the comp's scrambles as-is and ignores it).
   *  variant/stage/colors pick the metric (same selectors as /scramble/stats); wcaDiffSteps = the exact
   *  optimal step-counts to allow. Empty wcaDiffSteps (or off) = no difficulty filter. */
  wcaDifficultyOn: boolean;
  wcaDiffVariant: string;   // method key, e.g. 'std'
  wcaDiffStage: string;     // stage key, e.g. 'cross'
  wcaDiffColors: string;    // subset key, e.g. 'BGORWY' (six-color) / 'W' / 'WY'
  wcaDiffSteps: number[];   // allowed optimal step-counts; empty = no filter

  /** "按步数" scramble filter for 2×2 (face/layer/cube-HTM/QTM) and pyraminx (V / cube-HTM). Works under
   *  both sources: random = uniform full-space sampling + reject; WCA = filter real scrambles by the metric.
   *  genStepsMetric is a metric key from _lib/scramble/step-metrics (validated per event); genSteps = the
   *  allowed inclusive step range [lo..hi], empty = the metric's default band. */
  genByStepsOn: boolean;
  genStepsMetric: string;
  genSteps: number[];

  /** Auto-mark each WCA real scramble as done (public) after a non-DNF solve,
   *  when signed in. Default on — saves a manual click per solve. */
  autoMarkWcaScramble: boolean;

  /** Action when user clicks the scramble strip. */
  scrambleClickAction: 'none' | 'next' | 'copy';

  /** One-shot marker: the scramble-click default flipped to 'copy' (migrate legacy 'next'). */
  scrambleClickMigrated?: boolean;

  /** Hide entire UI (topbar / scramble / charts) while timer is running. */
  hideAllUiWhileRunning: boolean;

  /** Metronome on/off and tempo (BPM range 30..300). */
  metronomeOn: boolean;
  metronomeBpm: number;

  /**
   * Inspection seconds at which to play a short beep (cstimer "beep at"
   * feature), e.g. [5, 10, 15]. Empty = off. Independent of the WCA 8s/12s
   * voice/warn cues. Each value 1..60, sorted, de-duped.
   */
  inspectionBeepAt: number[];

  /** Sync seed: when set, scramble RNG is deterministic across devices. */
  syncSeed: string | null;

  /**
   * Persisted scramble counter for the active sync seed. Increments each time
   * `generateScramble` produces a seeded scramble, so reloading the page
   * resumes the same sequence. Reset whenever `syncSeed` changes or is cleared.
   */
  syncSeedCounter: number;

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

  /**
   * Per-event target time (time-attack mode). Map keyed by EventId; missing or
   * null entries disable the indicator for that event. Positive integer ms only.
   */
  targetMsByEvent: Record<string, number>;

  /**
   * Daily solve-count goal. null / 0 / missing → disabled (no progress pill).
   * Positive integer count of solves the user wants to complete each local
   * calendar day. Per-event variants are intentionally deferred.
   */
  dailySolveGoal?: number | null;

  /**
   * 排名徽章的「用户国家」(ISO2,如 'US' / 'CN')。空 = 不限定,徽章只显 WR(世界);
   * 设了才额外显 CR(大洲)/ NR(国家)。未设时前端回退登录 WCA 账号的国家。
   */
  rankCountry?: string;
}

/** Max ao windows shown as stats/history columns (the ao5/ao12-style picker). */
export const MAX_AO_WINDOWS = 2;

export const DEFAULTS: TimerSettings = {
  inspection: 0,
  soundsEnabled: false,
  volume: 0.5,
  hideTime: false,
  theme: 'dark',
  colors: {},
  showCubePreview: true,
  showCharts: true,
  precision: 3,
  runningPrecision: 3,
  timerFontScale: 1,
  timerFont: 'lcd',
  scrambleFontScale: 1,
  scrambleFont: 'liberation',
  holdMs: 550,
  compactScramble: false,
  prefer3D: false,
  showHeatmap: true,
  multiStage: false,
  bldMemo: true,
  cnMode: 'none',
  voiceInspection: 'none',
  statsAoWindows: [5, 12],
  scrambleSource: 'wca',
  wcaScrambleMode: 'date',
  wcaComp: '',
  wcaCompName: '',
  wcaCompCountry: '',
  wcaRound: '',
  wcaGroup: '',
  wcaDateFrom: '',
  wcaDateTo: '',
  wcaUseOptimal: false,
  wcaDifficultyOn: false,
  wcaDiffVariant: 'std',
  wcaDiffStage: 'cross',
  wcaDiffColors: 'BGORWY',
  wcaDiffSteps: [],
  genByStepsOn: false,
  genStepsMetric: 'face',
  genSteps: [],
  autoMarkWcaScramble: true,
  scrambleClickAction: 'copy',
  scrambleClickMigrated: false,
  hideAllUiWhileRunning: false,
  metronomeOn: false,
  metronomeBpm: 120,
  inspectionBeepAt: [],
  syncSeed: null,
  syncSeedCounter: 0,
  autoBackupEvery: 10,
  bluetoothAutoReady: 'off',
  inspectionTrigger: 'down',
  targetMsByEvent: {},
  dailySolveGoal: null,
  rankCountry: '',
};

/**
 * Parse a daily-solve-goal string. Empty / 0 / negative / non-finite → null
 * (treated as "disabled" by the progress pill).
 */
export function parseDailySolveGoal(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/**
 * Parse a time-attack target time string (`m:ss.ms` style, e.g. `0:10.50`,
 * `1:23.4`, or plain seconds like `10.5`) into milliseconds.
 *
 * Returns null for empty / invalid / non-positive / non-finite input — callers
 * should treat null as "disable the target".
 */
export function parseTargetTime(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Accept: "m:ss.ms", "m:ss", "s.ms", or plain integer seconds.
  // Use a permissive parse — a single colon splits minutes:seconds.
  let mins = 0;
  let secStr = trimmed;
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx >= 0) {
    const mPart = trimmed.slice(0, colonIdx);
    secStr = trimmed.slice(colonIdx + 1);
    const m = Number(mPart);
    if (!Number.isFinite(m) || m < 0) return null;
    mins = Math.floor(m);
  }
  const sec = Number(secStr);
  if (!Number.isFinite(sec) || sec < 0) return null;
  const totalMs = Math.round(mins * 60_000 + sec * 1000);
  if (!Number.isFinite(totalMs) || totalMs <= 0) return null;
  return totalMs;
}

/**
 * Format a target-time ms value back into `m:ss.ms` for display in the
 * settings input. 0 / null / non-finite → empty string.
 */
export function formatTargetTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '';
  const totalCs = Math.round(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${min}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

let _cache: TimerSettings = load();
const _listeners = new Set<() => void>();

function load(): TimerSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<TimerSettings>;
    const merged = { ...DEFAULTS, ...parsed };
    // One-shot migration: scramble-click now copies by default. Flip the legacy
    // 'next' default once (leave a deliberate 'none' alone), then persist the marker.
    if (!merged.scrambleClickMigrated) {
      if (merged.scrambleClickAction === 'next') merged.scrambleClickAction = 'copy';
      merged.scrambleClickMigrated = true;
      save(merged);
    }
    // Cap legacy selections at MAX_AO_WINDOWS (the stats/history ao columns).
    if (Array.isArray(merged.statsAoWindows) && merged.statsAoWindows.length > MAX_AO_WINDOWS) {
      merged.statsAoWindows = merged.statsAoWindows.slice(0, MAX_AO_WINDOWS);
      save(merged);
    }
    return merged;
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
  // 站点配色主题(克劳德/中国色)自带明暗,且 shell 背景走 var(--background) 跟配色。
  // 选了配色时必须让 data-timer-theme 跟配色的明暗,否则计时器那套 [data-timer-theme]
  // 灰阶仍按 OS prefers-color-scheme 走,会出现「浅配色 + OS 暗 → 浅底配暗灰文字」看不清。
  const [paletteSch, setPaletteSch] = useState<'light' | 'dark' | null>(() =>
    typeof window === 'undefined' ? null : paletteScheme(readPalette()),
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    const onPalette = () => setPaletteSch(paletteScheme(readPalette()));
    window.addEventListener('theme-change', onPalette);
    window.addEventListener('storage', onPalette);
    return () => {
      mq.removeEventListener?.('change', onChange);
      window.removeEventListener('theme-change', onPalette);
      window.removeEventListener('storage', onPalette);
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const effective =
      paletteSch ?? (settings.theme === 'auto' ? (systemDark ? 'dark' : 'light') : settings.theme);
    root.setAttribute('data-timer-theme', effective);
    return () => root.removeAttribute('data-timer-theme');
  }, [settings.theme, systemDark, paletteSch]);
}
