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
  // Relays
  | 'r3' | 'r4' | 'r5'
  // CFOP step training
  | 'cross' | 'f2l' | 'll' | 'oll' | 'pll'
  // LL training subsets
  | 'coll' | 'cmll' | 'zbll' | 'eg1' | 'eg2'
  // Free-form (user types own scramble)
  | 'custom';

export type Penalty = 'ok' | '+2' | 'DNF';

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
  /** Trainer case id — set only for OLL/PLL/COLL/CMLL/ZBLL/EG1/EG2 events.
   * For OLL/PLL it's the case key from oll.json/pll.json (e.g. "OLL 1", "Aa").
   * For other trainers it's the alg string used to build the scramble. */
  caseId?: string;
  /** Bluetooth-recorded move stream for solve reconstruction.
   * Each entry is { m: face notation move, ts: ms since solve start
   * (i.e. since timer phase became 'running'). Inspection-time moves are
   * NOT recorded — only moves received during the running phase. */
  moves?: Array<{ m: string; ts: number }>;
  /** Result of running `computeStageSegments(scramble, moves, timeMs)`.
   *  Populated lazily — either at solve-finish time, when ReconstructModal
   *  is opened, or by the SettingsPanel "Reanalyze stage data" migration.
   *  Distinct from the legacy `stages` field which is just three numbers
   *  set by the user during a multi-stage solve; this carries the richer
   *  HTM counts + cross-side / OLL-case / PLL-case labels. */
  stageSegments?: StageSegments;
  /** Optional auto-tags. Reserved for future persistence; HistoryPanel
   *  currently recomputes tags on the fly from solve + history. */
  tags?: string[];
}

const BLD_EVENT_IDS = new Set<EventId>(['333bld','333mbld','333ni','444bld','555bld','666bld','777bld']);
export function isBldEvent(id: EventId): boolean {
  return BLD_EVENT_IDS.has(id);
}

/** Effective time after penalty (Infinity for DNF). */
export function effectiveMs(s: Solve): number {
  if (s.penalty === 'DNF') return Infinity;
  if (s.penalty === '+2') return s.timeMs + 2000;
  return s.timeMs;
}

export interface EventInfo {
  id: EventId;
  nameEn: string;
  nameZh: string;
  /** Group for picker UI; events of same group are listed together */
  group: 'wca' | 'bld' | 'relay' | 'puzzle' | 'cfop' | 'll' | 'misc';
}

export const EVENTS: EventInfo[] = [
  // WCA standard
  { id: '333',    nameEn: '3x3',         nameZh: '三阶',       group: 'wca' },
  { id: '222',    nameEn: '2x2',         nameZh: '二阶',       group: 'wca' },
  { id: '444',    nameEn: '4x4',         nameZh: '四阶',       group: 'wca' },
  { id: '555',    nameEn: '5x5',         nameZh: '五阶',       group: 'wca' },
  { id: '666',    nameEn: '6x6',         nameZh: '六阶',       group: 'wca' },
  { id: '777',    nameEn: '7x7',         nameZh: '七阶',       group: 'wca' },
  { id: '333oh',  nameEn: '3x3 OH',      nameZh: '三阶单手',   group: 'wca' },
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
  { id: 'skewb',  nameEn: 'Skewb',       nameZh: '斜转',       group: 'puzzle' },
  { id: 'sq1',    nameEn: 'Square-1',    nameZh: 'SQ-1',       group: 'puzzle' },
  { id: 'mega',   nameEn: 'Megaminx',    nameZh: '五魔',       group: 'puzzle' },
  { id: 'clock',  nameEn: 'Clock',       nameZh: '魔表',       group: 'puzzle' },
  { id: '333mr',  nameEn: 'Mirror Blocks', nameZh: '镜面',     group: 'puzzle' },
  { id: 'magic',  nameEn: 'Magic',       nameZh: '魔板',       group: 'puzzle' },
  { id: 'mmagic', nameEn: 'Master Magic',nameZh: '六块魔板',   group: 'puzzle' },

  // CFOP step training
  { id: 'cross',  nameEn: 'Cross only',  nameZh: '十字训练',   group: 'cfop' },
  { id: 'f2l',    nameEn: 'F2L',         nameZh: 'F2L 训练',   group: 'cfop' },
  { id: 'll',     nameEn: 'LL',          nameZh: 'LL 训练',    group: 'cfop' },

  // Last-layer training
  { id: 'oll',    nameEn: 'OLL',         nameZh: 'OLL',        group: 'll' },
  { id: 'pll',    nameEn: 'PLL',         nameZh: 'PLL',        group: 'll' },
  { id: 'coll',   nameEn: 'COLL',        nameZh: 'COLL',       group: 'll' },
  { id: 'cmll',   nameEn: 'CMLL',        nameZh: 'CMLL',       group: 'll' },
  { id: 'zbll',   nameEn: 'ZBLL',        nameZh: 'ZBLL',       group: 'll' },
  { id: 'eg1',    nameEn: 'EG-1',        nameZh: 'EG-1',       group: 'll' },
  { id: 'eg2',    nameEn: 'EG-2',        nameZh: 'EG-2',       group: 'll' },

  // Misc
  { id: 'custom', nameEn: 'Custom',      nameZh: '自定义',     group: 'misc' },
];

export function eventInfo(id: EventId): EventInfo {
  return EVENTS.find(e => e.id === id) ?? EVENTS[0];
}
