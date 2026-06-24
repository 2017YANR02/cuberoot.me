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

// Curated breadth set spanning all five platonic shapes (cube c / tetra t /
// octa o / dodeca d). `icon` is a real repo icon where one exists (see
// EventIcon/svg-map.ts), else a shape-appropriate fallback so the picker never
// renders a blank slot. Heavy near-duplicates (tera/peta/yotta-minx, royal/
// emperor pyraminx) are left out on purpose. Def strings ⟵ cubing.js pgPuzzles.ts.
export const PG_PUZZLES = [
  // cube
  { id: 'littlechop',       def: 'c e 0',                  zh: '小切',       en: 'Little Chop',       icon: 'event-333' },
  { id: 'curvycopter',      def: 'c e 0.83',               zh: '曲面直升机', en: 'Curvy Copter',      icon: 'unofficial-curvycopter' },
  { id: 'compycube',        def: 'c v 0.915641442663986',  zh: 'Compy',      en: 'Compy Cube',        icon: 'event-skewb' },
  { id: 'masterskewb',      def: 'c v 0.275',              zh: '大斜转',     en: 'Master Skewb',      icon: 'unofficial-mskewb' },
  { id: 'professorskewb',   def: 'c v 0 v 0.38',           zh: '教授斜转',   en: 'Professor Skewb',   icon: 'event-skewb' },
  // tetra
  { id: 'pyramorphix',      def: 't e 0',                  zh: '魔金',       en: 'Pyramorphix',       icon: 'unofficial-pyramorphix' },
  { id: 'mastermorphix',    def: 't e 0.346184634065199',  zh: '大魔金',     en: 'Mastermorphix',     icon: 'event-pyram' },
  { id: 'masterpyraminx',   def: 't v 0 v 1 v 2',          zh: '大金字塔',   en: 'Master Pyraminx',   icon: 'unofficial-mpyram' },
  { id: 'professorpyraminx', def: 't v -0.2 v 0.6 v 1.4 v 2.2', zh: '教授金字塔', en: 'Professor Pyraminx', icon: 'unofficial-mpyram' },
  { id: 'mastertetraminx',  def: 't v 0 v 1',              zh: 'Master Tetraminx', en: 'Master Tetraminx', icon: 'unofficial-mtetram' },
  { id: 'jingpyraminx',     def: 't f 0',                  zh: 'Jing Pyraminx', en: 'Jing Pyraminx',  icon: 'event-pyram' },
  // octa
  { id: 'fto',              def: 'o f 0.333333333333333',  zh: 'FTO',        en: 'FTO',               icon: 'unofficial-fto' },
  { id: 'masterfto',        def: 'o f 0.5 f 0',            zh: 'Master FTO', en: 'Master FTO',        icon: 'unofficial-fto' },
  { id: 'skewbdiamond',     def: 'o f 0',                  zh: 'Skewb Diamond', en: 'Skewb Diamond',  icon: 'unofficial-fto' },
  // dodeca (megaminx itself is already in /sim via the registered loader)
  { id: 'gigaminx',         def: 'd f 0.64 f 0.82',        zh: 'Gigaminx',   en: 'Gigaminx',          icon: 'unofficial-gigaminx' },
  { id: 'pentultimate',     def: 'd f 0',                  zh: 'Pentultimate', en: 'Pentultimate',    icon: 'event-minx' },
  { id: 'starminx',         def: 'd v 0.937962370425399',  zh: 'Starminx',   en: 'Starminx',          icon: 'event-minx' },
  { id: 'pyraminxcrystal',  def: 'd f 0.447213595499989',  zh: 'Pyraminx Crystal', en: 'Pyraminx Crystal', icon: 'event-minx' },
  { id: 'chopasaurus',      def: 'd v 0',                  zh: 'Chopasaurus', en: 'Chopasaurus',      icon: 'event-minx' },
] as const satisfies readonly PgPuzzleDef[];

export type PgPuzzleId = typeof PG_PUZZLES[number]['id'];

export const PG_DEF_BY_ID: Record<string, string> = Object.fromEntries(
  PG_PUZZLES.map((p) => [p.id, p.def]),
);

export const PG_IDS = new Set<string>(PG_PUZZLES.map((p) => p.id));

export function isPgPuzzleId(s: string): boolean {
  return PG_IDS.has(s);
}
