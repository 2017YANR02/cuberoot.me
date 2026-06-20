/*
 * Bridge to vendored cs0x7f/cstimer scramble core.
 *
 * Source lives at tools/cstimer-scramble/ (GPLv3 — see UPSTREAM.txt there);
 * we drive it through a single classic Web Worker at
 *   tools/cstimer-scramble/scrambler.worker.js
 * served by Vite's serveRepoRoot plugin in dev and by deploy_core/mirror in
 * prod. Catalog below maps our event ids to cstimer's internal keys + a
 * default length for random-move scramblers.
 */

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (s: string) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker('/tools/cstimer-scramble/scrambler.worker.js');
  worker.onmessage = (e: MessageEvent) => {
    const { id, result, error } = e.data || {};
    const slot = pending.get(id);
    if (!slot) return;
    pending.delete(id);
    if (error) slot.reject(new Error(error));
    else slot.resolve(result);
  };
  worker.onerror = (e) => {
    for (const slot of pending.values()) slot.reject(new Error(e.message || 'worker error'));
    pending.clear();
  };
  return worker;
}

/**
 * Catalog of cstimer-only events we expose in /scramble/gen. `key` is the
 * cstimer internal scramble id (passed verbatim to scrMgr.scramblers[key]).
 * `length` is the cstimer 2nd argument — only meaningful for random-move
 * scramblers; random-state ones ignore it but we still pass a default for
 * sanity. `iconClass` reuses cubing-icons where available; otherwise we
 * render a short text label via `textLabel`.
 */
/**
 * Family buckets for the non-WCA grouped picker (NonWcaPuzzlePicker). Every
 * cstimer puzzle is tagged with one — the picker groups its dropdown by family
 * so future puzzles slot into a category instead of crowding an icon row.
 *   cuboid    长方体(1×3×3 / 2×2×3 / 3×3×N …)
 *   twist     异形扭转(齿轮 / 恐龙 / 五魔金字塔 / 直升机 …)
 *   slide     滑块(8 / 15 数码)
 *   siamese   联体(Bicube / Siamese …)
 *   sq        Square 家族(Sq2 / Super Sq1 / Bandaged Sq1)
 *   other     其他(无明确分类)
 */
export type CstimerFamily = 'cuboid' | 'twist' | 'slide' | 'siamese' | 'sq' | 'other';

export interface CstimerEvent {
  /** Our event id (used in UI state, must be unique across all event sources). */
  id: string;
  /** cstimer internal scramble key (scrMgr.scramblers[key]). */
  key: string;
  /** Default scramble length passed to cstimer (random-move puzzles only). */
  length?: number;
  /** cubing-icons class if available, else use textLabel. */
  iconClass?: string;
  /** Fallback short text rendered when no iconClass. */
  textLabel?: string;
  zh: string;
  en: string;
  /** Grouped-picker family bucket. */
  family: CstimerFamily;
  /**
   * Has an in-site solver (its own /scramble/solver?event=<id> branch + dist
   * view)? The grouped picker only surfaces solvable puzzles — the NONWCA loop
   * just flips this true per puzzle as A1+ ships its solver, no UI surgery.
   */
  solvable?: boolean;
}

export const CSTIMER_EVENTS: ReadonlyArray<CstimerEvent> = [
  // Random-state (length ignored by solver)
  { id: 'gear',    key: 'gearso',  zh: '齿轮魔方',         en: 'Gear Cube',         textLabel: 'Gear',   family: 'twist'
},
  { id: 'ivy',     key: 'ivyso',   zh: '枫叶魔方',         en: 'Ivy Cube',          textLabel: 'Ivy',    family: 'twist',  solvable: true
},
  { id: 'dino',    key: 'dinoso',  zh: '恐龙魔方',         en: 'Dino Cube',         textLabel: 'Dino',   family: 'twist'
},
  { id: 'mpyrso',  key: 'mpyrso',  zh: '大金字塔(随态)',   en: 'Master Pyra (RS)',  iconClass: 'unofficial-mpyram', family: 'twist'
},
  { id: '223',     key: '223',     zh: '2×2×3',            en: '2×2×3',             textLabel: '2×2×3',  family: 'cuboid', solvable: true },
  { id: '133',     key: '133',     zh: '1×3×3 花型',       en: '1×3×3 Floppy',      textLabel: '1×3×3',  family: 'cuboid', solvable: true },
  { id: '15p',     key: '15prp',   zh: '数字华容道',       en: '15-Puzzle',         textLabel: '15',     family: 'slide'
},
  { id: '8p',      key: '8prp',    zh: '八数码',           en: '8-Puzzle',          textLabel: '8',      family: 'slide',  solvable: true },

  // Random-move with sensible defaults
  { id: 'heli',    key: 'heli',    length: 20, zh: '直升机',           en: 'Helicopter',        iconClass: 'unofficial-helicopter', family: 'twist'
},
  { id: 'helicv',  key: 'helicv',  length: 20, zh: '弧面直升机',       en: 'Curvy Copter',      iconClass: 'unofficial-curvycopter', family: 'twist'
},
  { id: 'sq2',     key: 'sq2',     length: 10, zh: '方块二',           en: 'Square-2',          textLabel: 'Sq2',  family: 'sq'
},
  { id: 'ssq1',    key: 'ssq1t',   length: 10, zh: '超 Sq-1',          en: 'Super Sq-1',        textLabel: 'SSq1', family: 'sq' },
  { id: 'bsq',     key: 'bsq',     length: 10, zh: '受限 Sq-1',        en: 'Bandaged Sq-1',     textLabel: 'BSq1', family: 'sq' },
  { id: 'giga',    key: 'giga',    length: 30, zh: '六阶五魔',         en: 'Gigaminx',          textLabel: 'Giga', family: 'twist'
},
  { id: 'prcp',    key: 'prcp',    length: 70, zh: '五魔金字塔',       en: 'Pyra Crystal',      textLabel: 'PrC',  family: 'twist' },
  { id: '233',     key: '233',     length: 25, zh: '多米诺 2×3×3',     en: '2×3×3 Domino',      textLabel: '2×3×3', family: 'cuboid'
},
  { id: '334',     key: '334',     length: 40, zh: '3×3×4',            en: '3×3×4',             textLabel: '3×3×4', family: 'cuboid' },
  { id: '335',     key: '335',     length: 50, zh: '3×3×5',            en: '3×3×5',             textLabel: '3×3×5', family: 'cuboid' },
  { id: '336',     key: '336',     length: 50, zh: '3×3×6',            en: '3×3×6',             textLabel: '3×3×6', family: 'cuboid' },
  { id: '337',     key: '337',     length: 60, zh: '3×3×7',            en: '3×3×7',             textLabel: '3×3×7', family: 'cuboid' },
  { id: 'sfl',     key: 'sfl',     length: 25, zh: '超薄花型',         en: 'Super Floppy',      textLabel: 'SFl',  family: 'cuboid', solvable: true },
  { id: 'ufo',     key: 'ufo',     length: 25, zh: 'UFO',              en: 'UFO',               textLabel: 'UFO',  family: 'twist',  solvable: true },
  { id: 'ctico',   key: 'ctico',   length: 25, zh: '二十面体',         en: 'Icosamate',         textLabel: 'Ico',  family: 'twist'
},
  { id: 'crz3a',   key: 'crz3a',   length: 25, zh: '疯狂 3×3',         en: 'Crazy 3×3',         textLabel: 'Crz',  family: 'other'
},
  { id: 'cm3',     key: 'cm3',     length: 16, zh: 'Cmetrick',         en: 'Cmetrick',          textLabel: 'Cm3',  family: 'twist' },
  { id: 'cm2',     key: 'cm2',     length: 16, zh: 'Cmetrick Mini',    en: 'Cmetrick Mini',     textLabel: 'Cm2',  family: 'twist',  solvable: true },
  { id: 'bic',     key: 'bic',     length: 25, zh: '联体魔方',         en: 'Bicube',            textLabel: 'Bic',  family: 'siamese'
},
  { id: 'sia113',  key: 'sia113',  length: 25, zh: '联体 1×1×3',       en: 'Siamese 1×1×3',     textLabel: 'Sia113', family: 'siamese'
},
  { id: 'sia123',  key: 'sia123',  length: 25, zh: '联体 1×2×3',       en: 'Siamese 1×2×3',     textLabel: 'Sia123', family: 'siamese'
},
  { id: 'sia222',  key: 'sia222',  length: 12, zh: '联体 2×2×2',       en: 'Siamese 2×2×2',     iconClass: 'unofficial-333_siamese', family: 'siamese'
},
  { id: 'dmd',     key: 'dmdso',   zh: '钻石',             en: 'Diamond',           textLabel: 'Dmd',  family: 'twist'
},
];

/** Family display labels (zh/en) for the grouped picker section headers. */
export const CSTIMER_FAMILY_LABEL: Record<CstimerFamily, { zh: string; en: string }> = {
  cuboid:  { zh: '长方体',   en: 'Cuboids' },
  twist:   { zh: '异形扭转', en: 'Twisty' },
  slide:   { zh: '滑块',     en: 'Sliding' },
  siamese: { zh: '联体',     en: 'Siamese' },
  sq:      { zh: 'Square 系', en: 'Square family' },
  other:   { zh: '其他',     en: 'Other' },
};

/** Section render order for the grouped picker. */
export const CSTIMER_FAMILY_ORDER: ReadonlyArray<CstimerFamily> =
  ['cuboid', 'twist', 'sq', 'slide', 'siamese', 'other'];

const BY_ID = new Map(CSTIMER_EVENTS.map((e) => [e.id, e] as const));

export const CSTIMER_EVENT_IDS: ReadonlySet<string> = new Set(CSTIMER_EVENTS.map((e) => e.id));

/** appendEvents shape for WcaEventSelector. iconClass='' triggers textLabel fallback.
 *  tooltip 走 eventDisplayName(id, isZh) → cstimerEventDisplayName(),自动跟语言切换。 */
export const CSTIMER_NONWCA_APPEND: ReadonlyArray<{ id: string; iconClass: string; label?: string; textLabel?: string }> =
  CSTIMER_EVENTS.map((e) => ({
    id: e.id,
    iconClass: e.iconClass ?? '',
    textLabel: e.iconClass ? undefined : e.textLabel,
  }));

export function isCstimerEvent(id: string): boolean {
  return CSTIMER_EVENT_IDS.has(id);
}

/** Non-WCA puzzles that have an in-site solver (drive the grouped picker). */
export const CSTIMER_SOLVABLE: ReadonlyArray<CstimerEvent> =
  CSTIMER_EVENTS.filter((e) => e.solvable);

export const CSTIMER_SOLVABLE_IDS: ReadonlySet<string> =
  new Set(CSTIMER_SOLVABLE.map((e) => e.id));

/** Look up a registered cstimer event by id (null if unknown). */
export function cstimerEvent(id: string): CstimerEvent | null {
  return BY_ID.get(id) ?? null;
}

/**
 * Group a set of cstimer event ids by family, in CSTIMER_FAMILY_ORDER, dropping
 * empty families. Each family keeps CSTIMER_EVENTS insertion order. Used by the
 * grouped picker — pass CSTIMER_SOLVABLE_IDS for the solve/dist centers, or any
 * subset for other surfaces.
 */
export function groupCstimerByFamily(
  ids: ReadonlySet<string>,
): ReadonlyArray<{ family: CstimerFamily; events: ReadonlyArray<CstimerEvent> }> {
  const buckets = new Map<CstimerFamily, CstimerEvent[]>();
  for (const e of CSTIMER_EVENTS) {
    if (!ids.has(e.id)) continue;
    const arr = buckets.get(e.family) ?? [];
    arr.push(e);
    buckets.set(e.family, arr);
  }
  return CSTIMER_FAMILY_ORDER
    .filter((f) => buckets.has(f))
    .map((family) => ({ family, events: buckets.get(family)! }));
}

export function cstimerEventDisplayName(id: string, isZh: boolean): string | null {
  const e = BY_ID.get(id);
  if (!e) return null;
  return (isZh ? e.zh : e.en);
}

/** Resolve a cstimer event's textLabel for selector buttons that lack an icon. */
export function cstimerEventTextLabel(id: string): string | null {
  const e = BY_ID.get(id);
  if (!e || e.iconClass) return null;
  return e.textLabel ?? e.en;
}

export async function cstimerScramble(id: string): Promise<string> {
  const e = BY_ID.get(id);
  if (!e) throw new Error('unknown cstimer event: ' + id);
  const w = getWorker();
  const reqId = nextId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(reqId, { resolve, reject });
    w.postMessage({ id: reqId, key: e.key, length: e.length });
  });
}
