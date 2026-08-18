/**
 * User-facing settings — persisted to localStorage as a single JSON blob.
 *
 * Settings are read via `useSettings()` and updated via `updateSettings(patch)`.
 * Components that depend on settings should subscribe via the hook so they
 * re-render when settings change.
 */

import { DEFAULT_ROUND_CONFIG, type RoundConfig } from '../round';
import { useSyncExternalStore } from 'react';
import { persistItem } from '@/lib/safe-storage';
import {
  DEFAULT_ROLLING_STAT_COLUMNS,
  normalizeRollingStatColumns,
  rollingStatColumnsFromLegacy,
  type RollingStatKey,
} from '../rolling_stats';

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

  /** Hide the running-time display until the timer stops. */
  hideTime: boolean;

  /** When the event changes, activate a session associated with that event. */
  autoSessionForEvent: boolean;

  /** When the active session changes, select its associated event. */
  autoEventForSession: boolean;

  /** Show the cube net preview alongside the scramble. */
  showCubePreview: boolean;

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

  /** Track CFOP stage splits (cross / F2L / OLL / PLL) on NxN events. */
  multiStage: boolean;

  /** Track memo / execution split on BLD events (Enter to mark memo done). */
  bldMemo: boolean;

  /** OLL trainer case-id whitelist (e.g. ["OLL 21"]). undefined / [] = all 57. */
  ollSubset?: string[];

  /** PLL trainer case-id whitelist (e.g. ["T", "Y"]). undefined / [] = all 21. */
  pllSubset?: string[];

  /** Pre-scramble orientation for normal scrambles — rotation prefix applied
   *  to the scramble image only ('' = UF). See scramble/pre_scramble.ts. */
  preScr: string;

  /** Same, for training scrambles (CFOP-step / LL-subset events). */
  preScrT: string;

  /** Color neutral scramble mode (3x3-shaped events only). */
  cnMode: 'none' | 'single' | 'dual' | 'six';

  /** Speech-synthesis voice for inspection cues. 'none' = beeps as before. */
  voiceInspection: 'none' | 'en-male' | 'en-female' | 'zh-male' | 'zh-female';

  /** Rolling statistics shown in the history and current/best tables. */
  statsRollingColumns: RollingStatKey[];

  /** Scramble source: 'random' = locally generated, 'wca' = real past WCA competition
   *  scrambles, 'manual' = a user-typed queue (manualScrambles), walked one per solve. */
  scrambleSource: 'random' | 'wca' | 'manual';

  /** Manual-source queue: raw textarea text, one scramble per line. Blank lines are
   *  ignored; the timer walks the non-empty lines in order (wrapping) as the scramble
   *  queue when scrambleSource === 'manual'. ←/→ navigate the shown history as usual. */
  manualScrambles: string;

  /** Timing on/off. Off = practice mode: press / space / tap just advances to the next
   *  scramble, no timer runs and no solve is recorded (mirrors the /alg trainer run page).
   *  Default on. */
  timingEnabled: boolean;

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
  /** 难度筛跨整个 3x3 族取题(333/oh/bf/ft/fm),而不是只在当前项目里找。默认开,与 /scramble/stats
   *  难度 tab 的合并口径一致 —— 那里的直方图是全族计数,分项目查会「图上有、这里查无」(稀有档
   *  尤其明显:BG 十字 8 步全库仅 1 条,还落在 333bf 决赛)。关掉 = 只用当前项目的真题。 */
  wcaDiffMerged: boolean;

  /** 随机状态来源的「难度」(3×3 族):不是过滤,而是**直接按所选阶段的最优步数生成状态** ——
   *  真题源筛不到的稀有档(六色十字 0 步、10 步 XCross)这里也出得来。方法/阶段/底色子集/步数区间
   *  与真题难度筛同口径(lib/scramble-variants),多一个 F2L 槽位维度(or18 训练器的口径:定色 + 定槽)。
   *  genDiffSlot = 槽位序号,-1 = 四槽取最优。引擎见 lib/cross-trainer。 */
  genDiffOn: boolean;
  genDiffVariant: string;
  genDiffStage: string;
  genDiffColors: string;
  genDiffSlot: number;
  genDiffSteps: number[];

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

  /**
   * One-shot marker: `recordGyro` 的默认值从关翻成开(2026-08-03),这个标记负责把
   * **老存档里那个 false** 也翻过来。
   *
   * 为什么光改 `DEFAULTS` 不够:`load()` 只要跑过一次迁移就会 `save()` 整个对象,
   * 于是每个动过设置的用户存档里都躺着一份**当时的默认值**。改 `DEFAULTS` 只对
   * 「从没存过设置」的人生效 —— 老用户的 `recordGyro` 会永远是那个没人选过的
   * `false`,而它决定复盘对不对(见 `recordGyro` 的注释)。
   *
   * 翻过之后再关掉的会留着:标记先落盘,此后的 `false` 才是用户的意思。
   */
  recordGyroMigrated?: boolean;

  /** Hide entire UI (topbar / scramble / charts) while timer is running. */
  hideAllUiWhileRunning: boolean;

  /**
   * Tick along during inspection / solve. Tempo is not stored here — it lives
   * in the site-wide metronome (`lib/metronome`) that the floating panel shares,
   * so the two can't fight over one audio source.
   */
  metronomeOn: boolean;

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
   * Bluetooth auto-ready: arm the attempt automatically when the cube says the
   * user is ready. Arming is passive — the clock only starts on the first turn —
   * which is why 'scrambled' can be the default without ever surprising anyone
   * with a running timer.
   *   'scrambled'    — the cube matches the scramble (default; csTimer's `giiSD='s'`)
   *   'off'          — manual: press space
   *   'still'        — 2s without any move
   *   'double-flick' — confirm via U U' U U' (any quarter-turn pair pattern)
   */
  bluetoothAutoReady: 'off' | 'still' | 'double-flick' | 'scrambled';

  /**
   * How the live smart-cube mirror (which takes over the picture under the
   * digits once a cube is connected) renders.
   *   '3d'  — the /sim engine's cube, turning with your own, its orientation
   *           following the cube's gyroscope (default). Only some protocols
   *           carry orientation at all, so this is a request, not a guarantee:
   *           with no gyro samples, on a phone, or before the state has been
   *           anchored at a solved cube, it falls back to the net rather than
   *           showing a 3D cube that is lying about something. It also turns the
   *           gyro stream on, which costs the cube some battery.
   *   'net' — the unfolded WCA net. All six faces flat, which is the view you
   *           can check face-by-face against the cube in your hands, and the
   *           only one csTimer has. This is also what every fallback lands on.
   *   'q2look' — compact U + F + R projection for two-look recognition.
   *   '2d'  — the isometric still. Legacy value name, kept so a stored setting
   *           keeps meaning what it meant: three faces visible, three hidden.
   */
  liveCubeView: '2d' | 'net' | '3d' | 'q2look';

  /**
   * 把陀螺仪的姿态流一起存进成绩,好在复盘里重放「怎么拧的」——转体在哪儿发生、
   * 握持怎么换。动作流答不了这些。
   *
   * **2026-08-03 改成默认开。** 原来默认关,理由是「一把几百字节也是在花别人的
   * 存储配额」。那个理由把这条当成了「回放的一个可选装饰」——它不是。姿态流是
   * 中心核转没转的唯一证据,而那件事决定了两个**每把都在用**的东西:
   *
   *   - 谱子里有没有转体(魔方一手也不报,只能从这儿推);
   *   - 那一对相对面到底是一个 `M` 还是两手真转(没有它只能靠时间猜,猜错了
   *     `ρ` 从此就错,后面每一手的名字跟着错 —— 用户看到的就是「PLL 不像公式」)。
   *
   * 默认关的代价因此不是「少一个回放功能」,而是**复盘默认是错的**。几百字节
   * (死区 + int8 定点 + base64,见 `_lib/bluetooth/gyro_track.ts`)换这个,值。
   *
   * 开着会让魔方一直发姿态(有些型号要显式开),费电 —— 所以开关留着。
   */
  recordGyro: boolean;

  /**
   * Keyboard-binding OVERRIDES for the rebindable timer actions — not the
   * resolved map. Merged over `DEFAULT_KEYMAP` (see ../keymap.ts), so bindings
   * added in a later release still reach a user who customised one key. An
   * explicit `null` means "unbound" and survives the merge.
   */
  keymap: Record<string, import('../keymap').TimerActionId | null>;

  /**
   * Round simulation — practise under real WCA round conditions (format,
   * cutoff, time limit). The round's attempts are NOT persisted: solves are
   * stored as usual and the round is just a tail slice of them, so there is no
   * second source of truth to keep in sync. See ../round.ts.
   */
  round: RoundConfig;

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
   * 是否显示排名徽章(停表后成绩旁的 WR / CR / NR 名次药丸)。默认开;关掉则完全隐去,
   * 连占位高度也不保留。旧存档无此键 -> 视为 true。
   */
  showRankBadge?: boolean;

  /**
   * 排名徽章的「用户国家」(ISO2,如 'US' / 'CN')。空 = 不限定,徽章只显 WR(世界);
   * 设了才额外显 CR(大洲)/ NR(国家)。未设时前端回退登录 WCA 账号的国家。
   */
  rankCountry?: string;

  /**
   * 智能魔方拧完一把后,复盘直接摊在计时页上(不遮挡,开下一把即收起)。默认开。
   * 只对录到动作流的成绩生效 —— 手动/键盘计时那些没有可复盘的东西。旧存档无此键
   * -> 视为 true。
   */
  autoRecap?: boolean;
}

export const DEFAULTS: TimerSettings = {
  inspection: 0,
  soundsEnabled: false,
  volume: 0.5,
  hideTime: false,
  autoSessionForEvent: false,
  autoEventForSession: false,
  showCubePreview: true,
  precision: 3,
  runningPrecision: 3,
  timerFontScale: 1,
  timerFont: 'lcd',
  scrambleFontScale: 1,
  scrambleFont: 'liberation',
  holdMs: 550,
  compactScramble: false,
  prefer3D: false,
  multiStage: false,
  bldMemo: true,
  preScr: '',    // (UF)
  preScrT: 'z2', // (DF) — LL cases are read yellow-up (csTimer's default)
  cnMode: 'none',
  voiceInspection: 'none',
  statsRollingColumns: [...DEFAULT_ROLLING_STAT_COLUMNS],
  scrambleSource: 'wca',
  manualScrambles: '',
  timingEnabled: true,
  wcaScrambleMode: 'comp',
  wcaComp: '',
  wcaCompName: '',
  wcaCompCountry: '',
  wcaRound: '',
  wcaGroup: '',
  wcaDateFrom: '',
  wcaDateTo: '',
  wcaUseOptimal: true,
  wcaDifficultyOn: false,
  wcaDiffVariant: 'std',
  wcaDiffStage: 'cross',
  wcaDiffColors: 'BGORWY',
  wcaDiffSteps: [],
  wcaDiffMerged: true,
  genByStepsOn: false,
  genStepsMetric: 'face',
  genSteps: [],
  genDiffOn: false,
  genDiffVariant: 'std',
  genDiffStage: 'cross',
  genDiffColors: 'BGORWY',
  genDiffSlot: -1,
  genDiffSteps: [],
  autoMarkWcaScramble: true,
  scrambleClickAction: 'copy',
  scrambleClickMigrated: false,
  recordGyroMigrated: false,
  hideAllUiWhileRunning: false,
  metronomeOn: false,
  inspectionBeepAt: [],
  syncSeed: null,
  syncSeedCounter: 0,
  autoBackupEvery: 10,
  bluetoothAutoReady: 'scrambled',
  liveCubeView: '3d',
  recordGyro: true,
  keymap: {},
  round: DEFAULT_ROUND_CONFIG,
  targetMsByEvent: {},
  dailySolveGoal: null,
  showRankBadge: true,
  rankCountry: '',
  autoRecap: true,
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
    const parsed = JSON.parse(raw) as Partial<TimerSettings> & {
      statsAoWindows?: unknown;
      inspectionTrigger?: unknown;
    };
    const merged = { ...DEFAULTS, ...parsed };

    // These two controls are entry defaults, not preferences to restore. A
    // fresh /timer visit (including a reload) always starts from real WCA
    // scrambles with difficulty filtering off. The user can still change both
    // for the rest of the current visit; the next page load resets them again.
    // Keep the detailed difficulty selection so turning the filter on during
    // the visit restores its method / stage / step range.
    merged.scrambleSource = 'wca';
    merged.wcaDifficultyOn = false;

    // 迁移都先改 `merged`,末尾只落一次盘 —— 每条自己 `save()` 会在一次加载里写三遍。
    let dirty = false;
    // One-shot migration: scramble-click now copies by default. Flip the legacy
    // 'next' default once (leave a deliberate 'none' alone), then persist the marker.
    if (!merged.scrambleClickMigrated) {
      if (merged.scrambleClickAction === 'next') merged.scrambleClickAction = 'copy';
      merged.scrambleClickMigrated = true;
      dirty = true;
    }
    // 录姿态默认从关翻成开 —— 存档里那个 false 是旧默认值,不是用户选的。
    // 见 `recordGyroMigrated`。
    if (!merged.recordGyroMigrated) {
      merged.recordGyro = true;
      merged.recordGyroMigrated = true;
      dirty = true;
    }
    // ao-only columns predate mo3 support. Preserve the user's chosen windows,
    // then store the new typed keys so both history and stats use one setting.
    if (!Array.isArray(parsed.statsRollingColumns)) {
      merged.statsRollingColumns = rollingStatColumnsFromLegacy(parsed.statsAoWindows);
      dirty = true;
    }
    const normalizedColumns = normalizeRollingStatColumns(merged.statsRollingColumns);
    if (JSON.stringify(normalizedColumns) !== JSON.stringify(merged.statsRollingColumns)) {
      merged.statsRollingColumns = normalizedColumns;
      dirty = true;
    }
    if ('statsAoWindows' in merged) {
      delete (merged as TimerSettings & { statsAoWindows?: unknown }).statsAoWindows;
      dirty = true;
    }
    if ('inspectionTrigger' in merged) {
      delete (merged as TimerSettings & { inspectionTrigger?: unknown }).inspectionTrigger;
      dirty = true;
    }
    if (dirty) save(merged);
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: TimerSettings): void {
  persistItem(KEY, JSON.stringify(s));
}

export function getSettings(): TimerSettings {
  return _cache;
}

export function updateSettings(patch: Partial<TimerSettings>): void {
  const normalizedPatch: Partial<TimerSettings> = 'statsRollingColumns' in patch
    ? { ...patch, statsRollingColumns: normalizeRollingStatColumns(patch.statsRollingColumns) }
    : patch;
  _cache = { ...(_cache), ...normalizedPatch };
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

// 计时器曾经有自己独立于站点的明暗(data-timer-theme + settings.theme,cstimer 遗留),
// 于是同一个 <html> 上挂两套主题:shell 走站点 token、内层走那套硬码灰阶,二者可能相反
// (站点浅色 + 计时器深色 → 浅底配深控件)。现已整体并入站点主题,颜色全走 :root token。
