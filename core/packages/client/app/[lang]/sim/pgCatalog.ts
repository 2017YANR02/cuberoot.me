// cubing.js PuzzleGeometry puzzles rendered via TwistyPlayer's
// `experimentalPuzzleDescription` — no in-house Three.js engine. The `def`
// strings are copied verbatim from cubing.js
// `src/cubing/puzzle-geometry/pgPuzzles.ts` (data, not code): TwistyPlayer's
// PuzzleGeometry pipeline (already shipped inside the installed `cubing` npm
// package) turns each string into a full 3D, drag-to-turn puzzle.
//
// These are "twisty-class": cubing.js gives 3D + drag for free, but the
// engine-only toggles (立体贴片 / 镂空 / 结构着色 / 提示贴片) do NOT apply, and
// there's no WCA scramble (a generic random-move generator is used instead).
//
// Coverage = the whole alpha.twizzle.net/explore set EXCEPT the puzzles /sim
// already renders with its own engine/twisty loaders (every NxNxN cube, skewb,
// dino, helicopter, pyraminx, megaminx). Heavy near-bandwidth puzzles
// (peta/exa/zeta/yotta-minx, royal/emperor pyraminx) are intentionally kept —
// they render, just slowly, because cubing.js builds thousands of pieces.
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

// Spans all five platonic shapes — cube c / tetra t / octa o / dodeca d /
// icosa i — plus multi-cut combos. `icon` is a real repo icon where one exists
// (see EventIcon/svg-map.ts), else a shape-appropriate fallback so the picker
// never renders a blank slot (icosa has no dedicated icon → reuse minx).
// Def strings ⟵ cubing.js pgPuzzles.ts, verbatim.
// Chinese name review (2026-10-08): use wiki/glossary.json for the minx family,
// Pentultimate and Starminx. Keep IDs/geometry untouched when localizing labels.
// Tetraminx = 截顶金字塔: https://lib.xmu.edu.cn/puzzles/puzzles_list/6
// Higher Tetraminx labels describe the corresponding Pyraminx order without tips;
// compare the paired cut definitions below (not a new claimed commercial name).
// Jing = 晶氏金字塔: https://www.bilibili.com/video/BV1yJ411X7tA/
// Diamond: https://www.bilibili.com/video/BV1kt411c7BD/
// Master FTO has four layers: https://cubingcontests.com/rankings/mfto/single
// Crystal = 菊花五魔: https://bkso.baidu.com/item/菊花五魔方/4607481
// IMPORTANT: PG's two morphix entries have different cuts and differ from the
// ordinary shape-changing retail Mastermorphix. Do not translate both as 魔粽
// merely because retail sources call Master Pyramorphix a synonym:
// https://github.com/cs0x7f/cstimer/wiki/Number-of-states-for-twisty-puzzles
// Unverified rare proper names remain in English instead of fabricated Chinese.
// Pending Chinese-name evidence: Compy, Master Pyramorphix, Christopher's Jewel,
// Octastar, Trajber, Master/Elite Pentultimate, Chopasaurus, Radio Chop,
// Icosamate, Redicosahedron, Icosaminx and Eitan's Star.
// Astrominx: glossary's generic 正二十面体 cannot distinguish the variants;
// this exact cut is Regular Astrominx, not every retail puzzle called Astrominx.
// https://twisty-puzzles.weebly.com/single-cut.html
export const PG_PUZZLES = [
  // cube (c)
  { id: 'littlechop',       def: 'c e 0',                  zh: '小切',       en: 'Little Chop',       icon: 'event-333' },
  { id: 'curvycopter',      def: 'c e 0.83',               zh: '曲面直升机', en: 'Curvy Copter',      icon: 'unofficial-curvycopter' },
  { id: 'compycube',        def: 'c v 0.915641442663986',  zh: 'Compy',      en: 'Compy Cube',        icon: 'event-skewb' },
  { id: 'masterskewb',      def: 'c v 0.275',              zh: '大斜转',     en: 'Master Skewb',      icon: 'unofficial-mskewb' },
  { id: 'professorskewb',   def: 'c v 0 v 0.38',           zh: '教授斜转',   en: 'Professor Skewb',   icon: 'event-skewb' },
  // tetra (t)
  { id: 'pyramorphix',      def: 't e 0',                  zh: '魔金',       en: 'Pyramorphix',       icon: 'unofficial-pyramorphix' },
  { id: 'mastermorphix',    def: 't e 0.346184634065199',  zh: '大魔金',     en: 'Mastermorphix',     icon: 'event-pyram' },
  { id: 'masterpyramorphix', def: 't e 0.866025403784437', zh: 'Master Pyramorphix', en: 'Master Pyramorphix', icon: 'unofficial-pyramorphix' },
  { id: 'tetraminx',        def: 't v 0.333333333333333',  zh: '截顶金字塔',  en: 'Tetraminx',         icon: 'unofficial-mtetram' },
  { id: 'masterpyraminx',   def: 't v 0 v 1 v 2',          zh: '四阶金字塔',   en: 'Master Pyraminx',   icon: 'unofficial-mpyram' },
  { id: 'mastertetraminx',  def: 't v 0 v 1',              zh: '四阶截顶金字塔', en: 'Master Tetraminx', icon: 'unofficial-mtetram' },
  { id: 'professorpyraminx', def: 't v -0.2 v 0.6 v 1.4 v 2.2', zh: '五阶金字塔', en: 'Professor Pyraminx', icon: 'unofficial-mpyram' },
  { id: 'professortetraminx', def: 't v -0.2 v 0.6 v 1.4', zh: '五阶截顶金字塔', en: 'Professor Tetraminx', icon: 'unofficial-mtetram' },
  { id: 'royalpyraminx',    def: 't v -0.333333333333333 v 0.333333333333333 v 1 v 1.66666666666667 v 2.33333333333333', zh: '六阶金字塔', en: 'Royal Pyraminx', icon: 'unofficial-mpyram' },
  { id: 'royaltetraminx',   def: 't v -0.333333333333333 v 0.333333333333333 v 1 v 1.66666666666667', zh: '六阶截顶金字塔', en: 'Royal Tetraminx', icon: 'unofficial-mtetram' },
  { id: 'emperorpyraminx',  def: 't v -0.428571428571429 v 0.142857142857143 v 0.714285714285714 v 1.28571428571429 v 1.85714285714286 v 2.42857142857143', zh: '七阶金字塔', en: 'Emperor Pyraminx', icon: 'unofficial-mpyram' },
  { id: 'emperortetraminx', def: 't v -0.428571428571429 v 0.142857142857143 v 0.714285714285714 v 1.28571428571429 v 1.85714285714286', zh: '七阶截顶金字塔', en: 'Emperor Tetraminx', icon: 'unofficial-mtetram' },
  { id: 'jingpyraminx',     def: 't f 0',                  zh: '晶氏金字塔', en: 'Jing Pyraminx',  icon: 'event-pyram' },
  // octa (o) — FTO is promoted to a first-class /sim engine kind (dual renderer); see
  // PlayerControls SimPuzzle + ENGINE_TWISTY. Its cubing.js `def` lives in SimPage's
  // ENGINE_TWISTY_DEF, fed to TwistyPlayer.experimentalPuzzleDescription as before.
  { id: 'masterfto',        def: 'o f 0.5 f 0',            zh: '四阶 FTO', en: 'Master FTO',        icon: 'unofficial-fto' },
  { id: 'skewbdiamond',     def: 'o f 0',                  zh: '钻石', en: 'Skewb Diamond',  icon: 'unofficial-fto' },
  { id: 'christophersjewel', def: 'o v 0.577350269189626', zh: "Christopher's Jewel", en: "Christopher's Jewel", icon: 'unofficial-fto' },
  { id: 'octastar',         def: 'o e 0',                  zh: 'Octastar',   en: 'Octastar',          icon: 'unofficial-fto' },
  { id: 'trajbersoctahedron', def: 'o v 0.433012701892219', zh: "Trajber 八面体", en: "Trajber's Octahedron", icon: 'unofficial-fto' },
  // dodeca (d) — megaminx itself is in /sim via its own loader
  { id: 'gigaminx',         def: 'd f 0.64 f 0.82',        zh: '五阶五魔',   en: 'Gigaminx',          icon: 'unofficial-gigaminx' },
  { id: 'teraminx',         def: 'd f 0.64 f 0.76 f 0.88', zh: '七阶五魔',   en: 'Teraminx',          icon: 'unofficial-gigaminx' },
  { id: 'petaminx',         def: 'd f 0.64 f 0.73 f 0.82 f 0.91', zh: '九阶五魔', en: 'Petaminx',     icon: 'unofficial-gigaminx' },
  { id: 'examinx',          def: 'd f 0.64 f 0.712 f 0.784 f 0.856 f 0.928', zh: '十一阶五魔', en: 'Examinx', icon: 'unofficial-gigaminx' },
  { id: 'zetaminx',         def: 'd f 0.64 f 0.7 f 0.76 f 0.82 f 0.88 f 0.94', zh: '十三阶五魔', en: 'Zetaminx', icon: 'unofficial-gigaminx' },
  { id: 'yottaminx',        def: 'd f 0.64 f 0.6914 f 0.7429 f 0.7943 f 0.8457 f 0.8971 f 0.9486', zh: '十五阶五魔', en: 'Yottaminx', icon: 'unofficial-gigaminx' },
  { id: 'pentultimate',     def: 'd f 0',                  zh: '斜转五魔', en: 'Pentultimate',    icon: 'event-minx' },
  { id: 'masterpentultimate', def: 'd f 0.1',              zh: 'Master Pentultimate', en: 'Master Pentultimate', icon: 'event-minx' },
  { id: 'elitepentultimate', def: 'd f 0 f 0.145905',      zh: 'Elite Pentultimate', en: 'Elite Pentultimate', icon: 'event-minx' },
  { id: 'starminx',         def: 'd v 0.937962370425399',  zh: '五星五魔',   en: 'Starminx',          icon: 'event-minx' },
  { id: 'starminx2',        def: 'd f 0.23606797749979',   zh: '五星五魔二代', en: 'Starminx 2',        icon: 'event-minx' },
  { id: 'pyraminxcrystal',  def: 'd f 0.447213595499989',  zh: '菊花五魔', en: 'Pyraminx Crystal', icon: 'event-minx' },
  { id: 'chopasaurus',      def: 'd v 0',                  zh: 'Chopasaurus', en: 'Chopasaurus',      icon: 'event-minx' },
  { id: 'bigchop',          def: 'd e 0',                  zh: '大切',       en: 'Big Chop',          icon: 'event-minx' },
  // icosa (i) — no dedicated icon, fall back to the round minx glyph
  { id: 'radiochop',        def: 'i f 0',                  zh: 'Radio Chop', en: 'Radio Chop',        icon: 'event-minx' },
  { id: 'icosamate',        def: 'i v 0',                  zh: 'Icosamate',  en: 'Icosamate',         icon: 'event-minx' },
  { id: 'astrominx',        def: 'i v 0.18759247376021',   zh: 'Astrominx',  en: 'Astrominx',         icon: 'event-minx' },
  { id: 'astrominxbigchop', def: 'i v 0.18759247376021 e 0', zh: 'Astrominx + Big Chop', en: 'Astrominx + Big Chop', icon: 'event-minx' },
  { id: 'redicosahedron',   def: 'i v 0.794654472291766',  zh: 'Redicosahedron', en: 'Redicosahedron', icon: 'event-minx' },
  { id: 'redicosahedroncenters', def: 'i v 0.84',          zh: 'Redicosahedron + 中心', en: 'Redicosahedron + Centers', icon: 'event-minx' },
  { id: 'icosaminx',        def: 'i v 0.73',               zh: 'Icosaminx',  en: 'Icosaminx',         icon: 'event-minx' },
  { id: 'eitansstar',       def: 'i f 0.61803398874989',   zh: "Eitan's Star", en: "Eitan's Star",    icon: 'event-minx' },
  // multi-cut combos
  { id: 'cube2dino',        def: 'c f 0 v 0.577350269189626', zh: '二阶 + 恐龙', en: '2x2 + Dino',     icon: 'event-333' },
  { id: 'cube2littlechop',  def: 'c f 0 e 0',              zh: '二阶 + 小切', en: '2x2 + Little Chop', icon: 'event-333' },
  { id: 'dinolittlechop',   def: 'c v 0.577350269189626 e 0', zh: '恐龙 + 小切', en: 'Dino + Little Chop', icon: 'event-333' },
  { id: 'cube2dinolittlechop', def: 'c f 0 v 0.577350269189626 e 0', zh: '二阶 + 恐龙 + 小切', en: '2x2 + Dino + Little Chop', icon: 'event-333' },
  { id: 'megaminxchopasaurus', def: 'd f 0.61803398875 v 0', zh: '五魔 + Chopasaurus', en: 'Megaminx + Chopasaurus', icon: 'event-minx' },
  { id: 'starminxcombo',    def: 'd f 0.23606797749979 v 0.937962370425399', zh: '五星五魔组合', en: 'Starminx Combo', icon: 'event-minx' },
] as const satisfies readonly PgPuzzleDef[];

export type PgPuzzleId = typeof PG_PUZZLES[number]['id'];

export const PG_DEF_BY_ID: Record<string, string> = Object.fromEntries(
  PG_PUZZLES.map((p) => [p.id, p.def]),
);

export const PG_IDS = new Set<string>(PG_PUZZLES.map((p) => p.id));

export function isPgPuzzleId(s: string): boolean {
  return PG_IDS.has(s);
}
