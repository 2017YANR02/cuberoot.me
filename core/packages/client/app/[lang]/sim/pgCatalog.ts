// cubing.js PuzzleGeometry puzzles rendered via TwistyPlayer's
// `experimentalPuzzleDescription` — no in-house Three.js engine. The `def`
// strings are copied verbatim from cubing.js
// `src/cubing/puzzle-geometry/pgPuzzles.ts` (data, not code): TwistyPlayer's
// PuzzleGeometry pipeline (already shipped inside the installed `cubing` npm
// package) turns each string into a full 3D, drag-to-turn puzzle.
//
// These are "twisty-class": cubing.js gives 3D + drag for free, but the
// engine-only toggles (立体贴片 / 镂空 / 结构着色 / 提示贴片) do NOT apply, and
// there's no WCA scramble (would need a generic random-move generator).
export interface PgPuzzleDef {
  /** Stable URL/id slug (no spaces). */
  id: string;
  /** PuzzleGeometry description fed to TwistyPlayer.experimentalPuzzleDescription. */
  def: string;
  zh: string;
  en: string;
  /** CubingIcon key (see EventIcon/svg-map.ts). */
  icon: string;
}

// PoC subset — distinct shapes (cube / tetra / octa / dodeca), all with real
// icons, none already in /sim. Expand to the full ~80-puzzle catalog once scope
// is agreed.
export const PG_PUZZLES = [
  { id: 'fto',            def: 'o f 0.333333333333333', zh: 'FTO',        en: 'FTO',             icon: 'unofficial-fto' },
  { id: 'curvycopter',    def: 'c e 0.83',              zh: '曲面直升机', en: 'Curvy Copter',    icon: 'unofficial-curvycopter' },
  { id: 'masterpyraminx', def: 't v 0 v 1 v 2',         zh: '大金字塔',   en: 'Master Pyraminx', icon: 'unofficial-mpyram' },
  { id: 'pyramorphix',    def: 't e 0',                 zh: '魔金',       en: 'Pyramorphix',     icon: 'unofficial-pyramorphix' },
  { id: 'masterskewb',    def: 'c v 0.275',             zh: '大斜转',     en: 'Master Skewb',    icon: 'unofficial-mskewb' },
  { id: 'gigaminx',       def: 'd f 0.64 f 0.82',       zh: 'Gigaminx',   en: 'Gigaminx',        icon: 'unofficial-gigaminx' },
] as const satisfies readonly PgPuzzleDef[];

export type PgPuzzleId = typeof PG_PUZZLES[number]['id'];

export const PG_DEF_BY_ID: Record<string, string> = Object.fromEntries(
  PG_PUZZLES.map((p) => [p.id, p.def]),
);

export const PG_IDS = new Set<string>(PG_PUZZLES.map((p) => p.id));

export function isPgPuzzleId(s: string): boolean {
  return PG_IDS.has(s);
}
