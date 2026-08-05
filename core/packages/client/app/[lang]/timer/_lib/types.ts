/**
 * Shared timer types — keep this file dependency-free (no React, no DOM).
 *
 * After the v2 refactor we no longer model "sessions" — solves are stored as
 * a flat list per event id. Round 1 agents extending this file should add
 * new EventIds (BLD / relay / CFOP step / PLL / OLL / COLL / ZBLL training
 * etc.) and update EVENTS to surface them in the picker.
 */

// Type-only import — fully erased at runtime, does not pull cube/recognizer deps.
import type { StageSegments } from './reconstruct/stage_segments';

export type EventId =
  // NxN
  | '222' | '333' | '444' | '555' | '666' | '777'
  // 3x3 variants
  | '333oh' | '333bld' | '333mbld' | '333ni' | '333fm' | '333mr'
  // BLD
  | '444bld' | '555bld' | '666bld' | '777bld'
  // Other puzzles
  | 'pyra' | 'skewb' | 'sq1' | 'mega' | 'clock'
  | 'magic' | 'mmagic'
  // Non-WCA puzzles (scrambled by the vendored csTimer engine — see
  // _lib/scramble/nonwca.ts for the id → scrambler-key table)
  | 'fto' | 'kilominx' | 'gear' | 'ivy' | 'redi' | 'mpyram'
  // Relays
  | 'r3' | 'r4' | 'r5'
  // CFOP step training
  | 'cross' | 'f2l' | 'll' | 'oll' | 'pll'
  // LL training subsets
  | 'coll' | 'cmll' | 'zbll' | 'eg1' | 'eg2'
  // Free-form (user types own scramble)
  | 'custom';

/**
 * 'DNS' = Did Not Start (WCA 9f2 / A1a4): the attempt was never begun. It is
 * scored exactly like a DNF everywhere (Infinity in every average, excluded
 * from "solved" counts) — the distinction is purely a record-keeping /
 * display one, so keep the two branches separate at display sites and use
 * `penaltyLabel()` from `stats.ts` rather than `formatMs()`.
 */
export type Penalty = 'ok' | '+2' | 'DNF' | 'DNS';

export interface Solve {
  /** Sortable id: timestamp + random suffix; sorted by ts not id */
  id: string;
  /** Raw recorded time in milliseconds, BEFORE penalty */
  timeMs: number;
  penalty: Penalty;
  scramble: string;
  event: EventId;
  /** Unix ms */
  ts: number;
  /** User-supplied comment (optional, multi-line OK) */
  comment?: string;
  /** CFOP stage splits in ms from solve start. PLL == timeMs by definition.
   * Each split is the elapsed time at the moment that stage *completed*.
   * Any subset may be present (a user may only mark F2L, etc.). */
  stages?: {
    cross?: number;
    f2l?: number;
    oll?: number;
    pll: number;
  };
  /** Blindfolded memo split. memoMs is elapsed at the moment user marked
   *  "memo done". Execution time = timeMs - memoMs. */
  bld?: { memoMs: number };
  /** 3x3x3 Multi-Blind attempt (event '333mbld'): how many of the puzzles
   *  taken on were actually solved.
   *
   *  `timeMs` stays a REAL millisecond duration. We deliberately do NOT store
   *  the WCA's packed `DDDTTTTTMM` integer: packing would poison every
   *  `formatMs` call site, all three charts (they plot `effectiveMs` on a time
   *  axis), `bestSingle`, and every sort. Keeping the time real means charts
   *  and history stay correct for free, and only *ranking* and *labelling*
   *  special-case MBLD — see `mbldPoints` / `isMbldDnf` / `compareMbld` /
   *  `formatMbldResult` in stats.ts. Being an optional field, no stored solve
   *  needs migrating. */
  mbld?: { solved: number; attempted: number };
  /** Trainer case id — set only for OLL/PLL/COLL/CMLL/ZBLL/EG1/EG2 events.
   * For OLL/PLL it's the case key from oll.json/pll.json (e.g. "OLL 1", "Aa").
   * For other trainers it's the alg string used to build the scramble. */
  caseId?: string;
  /** Bluetooth-recorded move stream for solve reconstruction.
   * Each entry is { m: face notation move, ts: ms since solve start
   * (i.e. since timer phase became 'running'). Inspection-time moves are
   * NOT recorded — with a smart cube the first turn of an armed attempt
   * IS the start signal, so there is no window in which an inspection
   * turn could exist without starting the clock. */
  moves?: Array<{ m: string; ts: number }>;
  /** Inspection time actually used before the start, ms. Recorded only when
   *  inspection ran (settings.inspection > 0 and the countdown was entered);
   *  absent on old solves and on attempts started without inspection. */
  inspectionMs?: number;
  /** The smart cube this attempt was solved on. Snapshotted when the attempt
   *  STARTS (not when it's recorded — a mid-solve disconnect must not erase
   *  it), and only persisted when the solve actually has a move stream.
   *  `model` is the protocol family (CubeBrand: 'gan-v4', 'qiyi', …);
   *  `name` is the advertised BLE name ("GAN 356 i3 (AB:CD)"). */
  device?: { model: string; name: string };
  /** Result of running `computeStageSegments(scramble, moves, timeMs)`.
   *  Populated lazily — either at solve-finish time, when ReconstructModal
   *  is opened, or by the SettingsPanel "Reanalyze stage data" migration.
   *  Distinct from the legacy `stages` field which is just three numbers
   *  set by the user during a multi-stage solve; this carries the richer
   *  HTM counts + cross-side / OLL-case / PLL-case labels. */
  stageSegments?: StageSegments;
  /** Recorded orientation stream, base64 of the packed format in
   *  `_lib/bluetooth/gyro_track.ts`. Written only when the cube reports
   *  orientation AND `settings.recordGyro` is on, because it roughly doubles a
   *  solve's footprint in a localStorage-backed store. Absent everywhere else,
   *  which is exactly how the playback panel decides whether to offer the
   *  gyro replay. */
  gyro?: string;
  /** User-verified reconstruction lines. Displayed verbatim over the automatic
   * notation while timing/state analysis still uses moves + gyro. */
  reconstruction?: string[];
  /** Did the reconstruction match what the cuber actually did? Set only when
   *  they answered 👍/👎 in the report; `undefined` means "not asked / not
   *  answered", which is NOT the same as 👎. Nothing reads it to change a
   *  number — it exists so a segmentation bug has somewhere to be recorded
   *  next to the solve that shows it. */
  reconOk?: boolean;
  /** Optional auto-tags. Reserved for future persistence; HistoryPanel
   *  currently recomputes tags on the fly from solve + history. */
  tags?: string[];
}

const BLD_EVENT_IDS = new Set<EventId>(['333bld','333mbld','333ni','444bld','555bld','666bld','777bld']);
export function isBldEvent(id: EventId): boolean {
  return BLD_EVENT_IDS.has(id);
}

/** Effective time after penalty (Infinity for DNS / DNF). */
export function effectiveMs(s: Solve): number {
  // DNS first: it must never fall through to the +2 / raw branches. Returning
  // Infinity here is what makes DNS behave as DNF in every stat — stats.ts
  // only ever looks at effective times, never at `penalty` itself.
  if (s.penalty === 'DNS') return Infinity;
  if (s.penalty === 'DNF') return Infinity;
  if (s.penalty === '+2') return s.timeMs + 2000;
  return s.timeMs;
}

export interface EventInfo {
  id: EventId;
  nameEn: string;
  nameZh: string;
  /** Group for picker UI; events of same group are listed together */
  group: 'wca' | 'bld' | 'relay' | 'puzzle' | 'nonwca' | 'cfop' | 'll' | 'misc';
  /**
   * cubing-icons key for pickers that render an icon grid (components/EventIcon
   * `CubingIcon`). Only set for events the WCA icon set doesn't cover by id —
   * i.e. the non-WCA puzzles, whose glyphs live under `unofficial-*`. WCA events
   * are looked up as `event-<wca id>` and need nothing here.
   */
  icon?: string;
}

export const EVENTS: EventInfo[] = [
  // WCA standard
  { id: '333',    nameEn: '3x3',         nameZh: '三阶',       group: 'wca'
},
  { id: '222',    nameEn: '2x2',         nameZh: '二阶',       group: 'wca'
},
  { id: '444',    nameEn: '4x4',         nameZh: '四阶',       group: 'wca'
},
  { id: '555',    nameEn: '5x5',         nameZh: '五阶',       group: 'wca'
},
  { id: '666',    nameEn: '6x6',         nameZh: '六阶',       group: 'wca'
},
  { id: '777',    nameEn: '7x7',         nameZh: '七阶',       group: 'wca'
},
  { id: '333oh',  nameEn: '3x3 OH',      nameZh: '三阶单手',   group: 'wca'
},
  { id: '333fm',  nameEn: 'FMC',         nameZh: '最少步',     group: 'wca' },

  // BLD
  { id: '333bld', nameEn: '3BLD',        nameZh: '三盲',       group: 'bld' },
  { id: '333mbld',nameEn: 'MBLD',        nameZh: '多盲',       group: 'bld' },
  { id: '333ni',  nameEn: '3x3 NI',      nameZh: '三盲 NI',    group: 'bld' },
  { id: '444bld', nameEn: '4BLD',        nameZh: '四盲',       group: 'bld' },
  { id: '555bld', nameEn: '5BLD',        nameZh: '五盲',       group: 'bld' },
  { id: '666bld', nameEn: '6BLD',        nameZh: '六盲',       group: 'bld' },
  { id: '777bld', nameEn: '7BLD',        nameZh: '七盲',       group: 'bld' },

  // Relays
  { id: 'r3',     nameEn: '2-3 Relay',   nameZh: '2-3 接力',   group: 'relay' },
  { id: 'r4',     nameEn: '2-4 Relay',   nameZh: '2-4 接力',   group: 'relay' },
  { id: 'r5',     nameEn: '2-5 Relay',   nameZh: '2-5 接力',   group: 'relay' },

  // Other puzzles
  { id: 'pyra',   nameEn: 'Pyraminx',    nameZh: '金字塔',     group: 'puzzle' },
  { id: 'skewb',  nameEn: 'Skewb',       nameZh: '斜转',       group: 'puzzle'
},
  { id: 'sq1',    nameEn: 'Square-1',    nameZh: 'SQ-1',       group: 'puzzle' },
  { id: 'mega',   nameEn: 'Megaminx',    nameZh: '五魔',       group: 'puzzle' },
  { id: 'clock',  nameEn: 'Clock',       nameZh: '魔表',       group: 'puzzle'
},
  { id: '333mr',  nameEn: 'Mirror Blocks', nameZh: '镜面',     group: 'puzzle'
},
  { id: 'magic',  nameEn: 'Magic',       nameZh: '魔板',       group: 'puzzle' },
  { id: 'mmagic', nameEn: 'Master Magic',nameZh: '六块魔板',   group: 'puzzle'
},

  // Non-WCA puzzles. Names follow wiki/glossary.json (the site's term base),
  // trimmed of the generic 「魔方」 suffix the way the WCA entries above are.
  { id: 'fto',      nameEn: 'FTO',             nameZh: '转面八面体', group: 'nonwca', icon: 'unofficial-fto' },
  { id: 'kilominx', nameEn: 'Kilominx',        nameZh: '二阶五魔',   group: 'nonwca', icon: 'unofficial-kilominx' },
  { id: 'gear',     nameEn: 'Gear Cube',       nameZh: '齿轮魔方',   group: 'nonwca', icon: 'unofficial-gear' },
  { id: 'ivy',      nameEn: 'Ivy Cube',        nameZh: '枫叶魔方',   group: 'nonwca', icon: 'unofficial-ivy' },
  { id: 'redi',     nameEn: 'Redi Cube',       nameZh: '热帝魔方',   group: 'nonwca', icon: 'unofficial-redi' },
  { id: 'mpyram',   nameEn: 'Master Pyraminx', nameZh: '四阶金字塔', group: 'nonwca', icon: 'unofficial-mpyram' },

  // CFOP step training
  { id: 'cross',  nameEn: 'Cross only',  nameZh: '十字训练',   group: 'cfop'
},
  { id: 'f2l',    nameEn: 'F2L',         nameZh: 'F2L 训练',   group: 'cfop'
},
  { id: 'll',     nameEn: 'LL',          nameZh: 'LL 训练',    group: 'cfop'
},

  // Last-layer training
  { id: 'oll',    nameEn: 'OLL',         nameZh: 'OLL',        group: 'll' },
  { id: 'pll',    nameEn: 'PLL',         nameZh: 'PLL',        group: 'll' },
  { id: 'coll',   nameEn: 'COLL',        nameZh: 'COLL',       group: 'll' },
  { id: 'cmll',   nameEn: 'CMLL',        nameZh: 'CMLL',       group: 'll' },
  { id: 'zbll',   nameEn: 'ZBLL',        nameZh: 'ZBLL',       group: 'll' },
  { id: 'eg1',    nameEn: 'EG-1',        nameZh: 'EG-1',       group: 'll' },
  { id: 'eg2',    nameEn: 'EG-2',        nameZh: 'EG-2',       group: 'll' },

  // Misc
  { id: 'custom', nameEn: 'Custom',      nameZh: '自定义',     group: 'misc'
},
];

export function eventInfo(id: EventId): EventInfo {
  return EVENTS.find(e => e.id === id) ?? EVENTS[0];
}

/* ------------------------------------------------------------------ */
/* Timer EventId ⇄ WCA / cubing.js spelling                            */
/* ------------------------------------------------------------------ */
//
// Two other surfaces key on the WCA / cubing.js spelling of an event rather
// than on our EventId:
//
//   1. the 1v1 Battle engine (app/[lang]/timer/_battle/engine/*) — ported
//      code whose puzzle ids double as the key of its own csTimer scrambler
//      table (EVENT_TO_CSTIMER). Renaming them there would break that table,
//      so we map instead.
//   2. components/WcaEventSelector — its icon grid is keyed on WCA event ids.
//
// Both want the SAME spelling, so one table serves both. Only ids that
// genuinely differ are listed; everything else round-trips unchanged.

const TIMER_TO_WCA_SPELLING: Partial<Record<EventId, string>> = {
  '333bld': '333bf',
  '333mbld': '333mbf',
  '444bld': '444bf',
  '555bld': '555bf',
  mega: 'minx',
  pyra: 'pyram',
};

const WCA_SPELLING_TO_TIMER: Record<string, EventId> = Object.fromEntries(
  Object.entries(TIMER_TO_WCA_SPELLING).map(([timerId, wcaId]) => [wcaId, timerId as EventId]),
);

/** Timer EventId → the WCA / cubing.js spelling (battle puzzle id, selector id). */
export function toWcaSpelling(id: EventId): string {
  return TIMER_TO_WCA_SPELLING[id] ?? id;
}

/** Inverse of `toWcaSpelling`. Unknown ids pass through (cast, not validated). */
export function fromWcaSpelling(id: string): EventId {
  return WCA_SPELLING_TO_TIMER[id] ?? (id as EventId);
}

/**
 * The events 1v1 Battle offers, in the order its picker lists them — the single
 * source of truth for the battle puzzle list. `_battle/engine/
 * constants.ts` builds its `PUZZLES` array from this, so an event can never be
 * added to one side only.
 *
 * Solo offers strictly more (relays, CFOP/LL trainers, custom, extra non-WCA
 * puzzles); that asymmetry is intended — battle is a head-to-head race, so it
 * only carries puzzles both players can actually be scored on.
 */
export const BATTLE_EVENT_IDS: ReadonlyArray<EventId> = [
  '222', '333', '444', '555', '666', '777', '333oh',
  '333bld', '444bld', '555bld', '333mbld',
  'clock', 'mega', 'pyra', 'skewb', 'sq1',
  'fto', 'kilominx',
];

/** `BATTLE_EVENT_IDS` in the battle engine's own spelling, same order. */
export const BATTLE_PUZZLE_IDS: ReadonlyArray<string> = BATTLE_EVENT_IDS.map(toWcaSpelling);
