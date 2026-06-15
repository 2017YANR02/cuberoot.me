/**
 * Famous pretty patterns across all WCA puzzles.
 *
 * Sources: speedsolving.com/wiki Pretty_pattern, ruwix.com/rubiks-cube-patterns-algorithms,
 * cubingcheatsheet.com (4x4-7x7 + megaminx), jrcuber.recursionists.org (sq1 / pyraminx),
 * jaapsch.net (clock). All algs verified to render under cubing.js TwistyPlayer.
 *
 * Ported from packages/client-vite/src/pages/patterns/patterns_data.ts.
 */

export type Category = 'symmetry' | 'cube-in-cube' | 'dots' | 'stripes' | 'crosses' | 'twists' | 'other';
export type PuzzleSize =
  | '2x2x2' | '3x3x3' | '4x4x4' | '5x5x5' | '6x6x6' | '7x7x7'
  | 'pyraminx' | 'megaminx' | 'skewb' | 'sq1' | 'clock';

export interface Pattern {
  id: string;
    name: { en: string; zh: string; };
  alg: string;
  category: Category;
  /** Defaults to 3x3x3 if omitted (legacy entries). */
  puzzle?: PuzzleSize;
}

/** Display order matches WCA puzzle event order. */
export const PUZZLE_SIZES: PuzzleSize[] = [
  '2x2x2', '3x3x3', '4x4x4', '5x5x5', '6x6x6', '7x7x7',
  'pyraminx', 'megaminx', 'skewb', 'sq1', 'clock',
];

export const PUZZLE_LABEL: Record<PuzzleSize, string> = {
  '2x2x2': '2×2',
  '3x3x3': '3×3',
  '4x4x4': '4×4',
  '5x5x5': '5×5',
  '6x6x6': '6×6',
  '7x7x7': '7×7',
  pyraminx: 'Pyraminx',
  megaminx: 'Megaminx',
  skewb: 'Skewb',
  sq1: 'Square-1',
  clock: 'Clock',
};

/** PuzzleSize → WCA event ID (drives WcaEventSelector icon row). */
export const PUZZLE_TO_EVENT: Record<PuzzleSize, string> = {
  '2x2x2': '222',
  '3x3x3': '333',
  '4x4x4': '444',
  '5x5x5': '555',
  '6x6x6': '666',
  '7x7x7': '777',
  pyraminx: 'pyram',
  megaminx: 'minx',
  skewb: 'skewb',
  sq1: 'sq1',
  clock: 'clock',
};

export const EVENT_TO_PUZZLE: Record<string, PuzzleSize> = Object.fromEntries(
  Object.entries(PUZZLE_TO_EVENT).map(([p, e]) => [e, p as PuzzleSize]),
);

export function patternPuzzle(p: Pattern): PuzzleSize {
  return p.puzzle ?? '3x3x3';
}

/** PuzzleSize → cubing.js TwistyPlayer puzzle id. */
export function twistyPuzzleId(size: PuzzleSize): string {
  if (size === 'sq1') return 'square1';
  return size;
}

export const CATEGORY_LABEL: Record<Category, { zh: string; en: string
 }> = {
  symmetry:      { zh: '对称', en: 'Symmetry'
},
  'cube-in-cube':{ zh: '立方中立方', en: 'Cube-in-Cube' },
  dots:          { zh: '点阵', en: 'Dots'
},
  stripes:       { zh: '条纹', en: 'Stripes'
},
  crosses:       { zh: '十字', en: 'Crosses' },
  twists:        { zh: '扭转', en: 'Twists'
},
  other:         { zh: '其他', en: 'Other' },
};

export const PATTERNS: Pattern[] = [
  // ─────────────────────────── 2×2 ───────────────────────────
  { id: '2x2-checkerboard', name: { en: "Checkerboard", zh: "棋盘" },
    category: 'symmetry', puzzle: '2x2x2',
    alg: "R2 F2 R2" },
  { id: '2x2-anaconda', name: { en: "Anaconda", zh: "森蚺" },
    category: 'twists', puzzle: '2x2x2',
    alg: "F R U' R' U' R U R' F'" },
  { id: '2x2-cube-in-cube', name: { en: "Cube in a Cube", zh: "立方中立方" },
    category: 'cube-in-cube', puzzle: '2x2x2',
    alg: "F U' R U F2 U' R' F U F U" },
  { id: '2x2-vertical-stripes', name: { en: "Vertical Stripes", zh: "竖条纹" },
    category: 'stripes', puzzle: '2x2x2',
    alg: "U2 R2 F2" },
  { id: '2x2-corners-cycle', name: { en: "Corners Cycle", zh: "角块循环" },
    category: 'twists', puzzle: '2x2x2',
    alg: "R U R' U R U2 R'" },
  { id: '2x2-six-color', name: { en: "Wedges", zh: "楔形" },
    category: 'symmetry', puzzle: '2x2x2',
    alg: "R F U' R U F R'" },

  // ─────────────────────────── 3×3 ───────────────────────────
  { id: 'superflip', name: { en: "Superflip", zh: "超级翻转" },
    category: 'symmetry',
    alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" },
  { id: 'checkerboard', name: { en: "Checkerboard", zh: "棋盘" },
    category: 'symmetry',
    alg: "M2 E2 S2" },
  { id: 'six-spots', name: { en: "Six Spots", zh: "六个圆点" },
    category: 'dots',
    alg: "U D' R L' F B' U D'" },
  { id: 'pons-asinorum', name: { en: "Pons Asinorum", zh: "驴桥" },
    category: 'symmetry',
    alg: "F2 B2 U2 D2 L2 R2" },
  { id: 'four-spots', name: { en: "Four Spots", zh: "四个圆点" },
    category: 'dots',
    alg: "F2 B2 U D' R2 L2 U D'" },
  { id: 'plus-minus', name: { en: "Plus and Minus", zh: "加减号" },
    category: 'symmetry',
    alg: "U2 R2 L2 U2 R2 L2" },

  { id: 'cube-in-cube', name: { en: "Cube in a Cube", zh: "立方中立方" },
    category: 'cube-in-cube',
    alg: "F L F U' R U F2 L2 U' L' B D' B' L2 U" },
  { id: 'cube-in-cube-in-cube', name: { en: "Cube in a Cube in a Cube", zh: "三层套立方" },
    category: 'cube-in-cube',
    alg: "U' L' U' F' R2 B' R F U B2 U B' L U' F U R F'" },
  { id: 'kilt', name: { en: "Kilt", zh: "苏格兰呢" },
    category: 'cube-in-cube',
    alg: "L F R' F' L' F' B D R D' R' F' B D' F2" },

  { id: 'vertical-stripes', name: { en: "Vertical Stripes", zh: "竖条纹" },
    category: 'stripes',
    alg: "F U F R L2 B D' R D2 L D' B R2 L F U F" },
  { id: 'tetris', name: { en: "Tetris", zh: "俄罗斯方块" },
    category: 'stripes',
    alg: "L R F B U' D' L' R'" },
  { id: 'twister', name: { en: "Twister", zh: "扭风" },
    category: 'stripes',
    alg: "F R' U L F' L' F U' R U L' U' L F'" },

  { id: 'plus-sign', name: { en: "Plus Sign", zh: "加号" },
    category: 'crosses',
    alg: "R2 L' D F2 R' D' R' L U' F' D' F R2 D F' U' B2" },
  { id: 'edge-only-cross', name: { en: "Edges Only", zh: "只剩棱块" },
    category: 'crosses',
    alg: "R2 L2 U2 R2 L2 U2" },
  { id: 'gift-box', name: { en: "Gift Box", zh: "礼物盒" },
    category: 'other',
    alg: "U B2 R2 B2 L2 F2 R2 D' F2 L2 B U2 F' U F' R2 U" },

  { id: 'anaconda', name: { en: "Anaconda", zh: "森蚺" },
    category: 'twists',
    alg: "L U B' U' R L' B R' F B' D R D' F'" },
  { id: 'python', name: { en: "Python", zh: "蟒蛇" },
    category: 'twists',
    alg: "F2 R' B' U R' L F' L F' B D' R B L2" },
  { id: 'spiral', name: { en: "Spiral", zh: "螺旋" },
    category: 'twists',
    alg: "L' B' D U R U' R' D2 R2 D L D' L' R' F U" },

  { id: 'snake', name: { en: "Snake", zh: "蛇形" },
    category: 'other',
    alg: "F R' U L F' L' F U' R U L' U' L F'" },
  { id: 'green-mamba', name: { en: "Green Mamba", zh: "绿曼巴" },
    category: 'other',
    alg: "R D R F R' F' B D R' U' B' U D2" },
  { id: 'displaced-motif', name: { en: "Displaced Motif", zh: "错位图案" },
    category: 'other',
    alg: "R B' R B R' B2 R' B R B2" },
  { id: 'four-crosses', name: { en: "Four Crosses", zh: "四个十字" },
    category: 'crosses',
    alg: "U2 R2 L2 F2 B2 D2 L R F B' U D'" },
  { id: 'corners-only', name: { en: "Corners Only", zh: "只剩角块" },
    category: 'symmetry',
    alg: "U F B' L2 U2 L2 F' B U2 L2 U" },
  { id: 'flying-cube', name: { en: "Flying Cube", zh: "飞行立方" },
    category: 'cube-in-cube',
    alg: "F L' D' B' L F U F' D' F L2 B' L' U L' B" },
  { id: 'wire', name: { en: "Wire", zh: "线圈" },
    category: 'other',
    alg: "R' U2 R U R' U R" },

  // ─────────────────────────── 4×4 ───────────────────────────
  { id: '4x4-checkerboard-simple', name: { en: "Checkerboard", zh: "棋盘" },
    category: 'symmetry', puzzle: '4x4x4',
    alg: "Uw2 Fw2 Rw2" },
  { id: '4x4-pons-asinorum', name: { en: "Pons Asinorum", zh: "驴桥" },
    category: 'symmetry', puzzle: '4x4x4',
    alg: "U2 D2 F2 B2 L2 R2" },
  { id: '4x4-dots', name: { en: "Six Dots", zh: "六个点" },
    category: 'dots', puzzle: '4x4x4',
    alg: "Uw Dw' Rw Lw' Fw Bw' Uw Dw'" },
  { id: '4x4-vertical-stripes', name: { en: "Vertical Stripes", zh: "竖条纹" },
    category: 'stripes', puzzle: '4x4x4',
    alg: "Rw2 L2 U2 Lw2 R2 U2" },
  { id: '4x4-horizontal-stripes', name: { en: "Horizontal Stripes", zh: "横条纹" },
    category: 'stripes', puzzle: '4x4x4',
    alg: "U2 Rw2 L2 U2 Lw2 R2" },
  { id: '4x4-superflip', name: { en: "Superflip", zh: "超级翻转" },
    category: 'symmetry', puzzle: '4x4x4',
    alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" },
  { id: '4x4-2x2-peak', name: { en: "2×2 Peak", zh: "2×2 凸起" },
    category: 'cube-in-cube', puzzle: '4x4x4',
    alg: "B2 D2 Lw2 U F2 L2 D' L' D L' F U' F Lw2 D2 B2" },
  { id: '4x4-color-peak', name: { en: "Colour Peak", zh: "彩色凸起" },
    category: 'cube-in-cube', puzzle: '4x4x4',
    alg: "F U2 L F L' B L U B' R' L' U R' D' F' B R2" },
  { id: '4x4-anaconda', name: { en: "Anaconda", zh: "森蚺" },
    category: 'twists', puzzle: '4x4x4',
    alg: "L U B' U' R L' B R' F B' D R D' F'" },
  { id: '4x4-tetris', name: { en: "Tetris", zh: "俄罗斯方块" },
    category: 'stripes', puzzle: '4x4x4',
    alg: "L R F B U' D' L' R'" },

  // ─────────────────────────── 5×5 ───────────────────────────
  { id: '5x5-checkerboard-simple', name: { en: "Checkerboard", zh: "棋盘" },
    category: 'symmetry', puzzle: '5x5x5',
    alg: "U2 D2 F2 B2 L2 R2" },
  { id: '5x5-checkerboard-wide', name: { en: "Checkerboard (wide)", zh: "宽层棋盘" },
    category: 'symmetry', puzzle: '5x5x5',
    alg: "Uw2 Dw2 Fw2 Bw2 Lw2 Rw2" },
  { id: '5x5-pons-asinorum-inner', name: { en: "Pons Asinorum (inner)", zh: "驴桥（内圈）" },
    category: 'symmetry', puzzle: '5x5x5',
    alg: "M2 E2 S2" },
  { id: '5x5-6-spot-inner', name: { en: "Six Spots (inner)", zh: "内圈六点" },
    category: 'dots', puzzle: '5x5x5',
    alg: "M S M' S'" },
  { id: '5x5-superflip', name: { en: "Superflip", zh: "超级翻转" },
    category: 'symmetry', puzzle: '5x5x5',
    alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" },
  { id: '5x5-3x3-peak', name: { en: "3×3 Peak", zh: "3×3 凸起" },
    category: 'cube-in-cube', puzzle: '5x5x5',
    alg: "F' Lw2 F R2 Bw U' Bw' Dw' Bw U Bw' Dw R2 F' Lw2 F2 R U' M2 U R' U' M2 U F'" },
  { id: '5x5-anaconda', name: { en: "Anaconda", zh: "森蚺" },
    category: 'twists', puzzle: '5x5x5',
    alg: "L U B' U' R L' B R' F B' D R D' F'" },
  { id: '5x5-tetris', name: { en: "Tetris", zh: "俄罗斯方块" },
    category: 'stripes', puzzle: '5x5x5',
    alg: "L R F B U' D' L' R'" },

  // ─────────────────────────── 6×6 ───────────────────────────
  { id: '6x6-checkerboard-simple', name: { en: "Checkerboard", zh: "棋盘" },
    category: 'symmetry', puzzle: '6x6x6',
    alg: "U2 D2 F2 B2 L2 R2" },
  { id: '6x6-checkerboard-2wide', name: { en: "Checkerboard (2-wide)", zh: "双层棋盘" },
    category: 'symmetry', puzzle: '6x6x6',
    alg: "Uw2 Dw2 Fw2 Bw2 Lw2 Rw2" },
  { id: '6x6-checkerboard-3wide', name: { en: "Checkerboard (3-wide)", zh: "三层棋盘" },
    category: 'symmetry', puzzle: '6x6x6',
    alg: "3Uw2 3Fw2 3Rw2" },
  { id: '6x6-pons-asinorum', name: { en: "Pons Asinorum", zh: "驴桥" },
    category: 'symmetry', puzzle: '6x6x6',
    alg: "2-3Uw2 2-3Fw2 2-3Rw2" },
  { id: '6x6-superflip', name: { en: "Superflip", zh: "超级翻转" },
    category: 'symmetry', puzzle: '6x6x6',
    alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" },
  { id: '6x6-anaconda', name: { en: "Anaconda", zh: "森蚺" },
    category: 'twists', puzzle: '6x6x6',
    alg: "L U B' U' R L' B R' F B' D R D' F'" },
  { id: '6x6-tetris', name: { en: "Tetris", zh: "俄罗斯方块" },
    category: 'stripes', puzzle: '6x6x6',
    alg: "L R F B U' D' L' R'" },
  { id: '6x6-six-spots', name: { en: "Six Spots", zh: "六个圆点" },
    category: 'dots', puzzle: '6x6x6',
    alg: "U D' R L' F B' U D'" },

  // ─────────────────────────── 7×7 ───────────────────────────
  { id: '7x7-checkerboard-simple', name: { en: "Checkerboard", zh: "棋盘" },
    category: 'symmetry', puzzle: '7x7x7',
    alg: "U2 D2 F2 B2 L2 R2" },
  { id: '7x7-checkerboard-2wide', name: { en: "Checkerboard (2-wide)", zh: "双层棋盘" },
    category: 'symmetry', puzzle: '7x7x7',
    alg: "Uw2 Dw2 Fw2 Bw2 Lw2 Rw2" },
  { id: '7x7-checkerboard-3wide', name: { en: "Checkerboard (3-wide)", zh: "三层棋盘" },
    category: 'symmetry', puzzle: '7x7x7',
    alg: "3Uw2 3Dw2 3Fw2 3Bw2 3Lw2 3Rw2" },
  { id: '7x7-pons-asinorum-inner', name: { en: "Pons Asinorum (inner)", zh: "驴桥（内圈）" },
    category: 'symmetry', puzzle: '7x7x7',
    alg: "M2 E2 S2" },
  { id: '7x7-6-spot-inner', name: { en: "Six Spots (inner)", zh: "内圈六点" },
    category: 'dots', puzzle: '7x7x7',
    alg: "M S M' S'" },
  { id: '7x7-superflip', name: { en: "Superflip", zh: "超级翻转" },
    category: 'symmetry', puzzle: '7x7x7',
    alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" },
  { id: '7x7-anaconda', name: { en: "Anaconda", zh: "森蚺" },
    category: 'twists', puzzle: '7x7x7',
    alg: "L U B' U' R L' B R' F B' D R D' F'" },
  { id: '7x7-tetris', name: { en: "Tetris", zh: "俄罗斯方块" },
    category: 'stripes', puzzle: '7x7x7',
    alg: "L R F B U' D' L' R'" },

  // ─────────────────────────── Pyraminx ───────────────────────────
  { id: 'pyra-tips-only', name: { en: "Flipped Tips", zh: "翻转尖角" },
    category: 'twists', puzzle: 'pyraminx',
    alg: "u l r b" },
  { id: 'pyra-tips-anti', name: { en: "Anti-Tips", zh: "反向尖角" },
    category: 'twists', puzzle: 'pyraminx',
    alg: "u' l' r' b'" },
  { id: 'pyra-four-bodies', name: { en: "Four Twisted Corners", zh: "四角扭转" },
    category: 'twists', puzzle: 'pyraminx',
    alg: "U L R B" },
  { id: 'pyra-edge-flip', name: { en: "Flipped Edges", zh: "棱块翻转" },
    category: 'twists', puzzle: 'pyraminx',
    alg: "L R' L' R U' R U R'" },
  { id: 'pyra-checkerboard', name: { en: "Checkerboard", zh: "棋盘" },
    category: 'symmetry', puzzle: 'pyraminx',
    alg: "U L' U L' U L' u' l u' l u' l" },
  { id: 'pyra-all-twisted', name: { en: "All Twisted", zh: "全部扭转" },
    category: 'twists', puzzle: 'pyraminx',
    alg: "U L R B u l r b" },

  // ─────────────────────────── Megaminx ───────────────────────────
  { id: 'minx-star', name: { en: "Star", zh: "五角星" },
    category: 'symmetry', puzzle: 'megaminx',
    alg: "R++ D++ R++ D++ R++ D++" },
  { id: 'minx-checkerboard', name: { en: "Checkerboard", zh: "棋盘" },
    category: 'symmetry', puzzle: 'megaminx',
    alg: "R++ D++ R++ D++ R++ D++ R++ D++ R++ D++" },
  { id: 'minx-flower', name: { en: "Flower", zh: "花朵" },
    category: 'other', puzzle: 'megaminx',
    alg: "R++ D-- R++ D-- R++ D-- R++ D-- R++ D--" },
  { id: 'minx-spiral', name: { en: "Spiral", zh: "螺旋" },
    category: 'twists', puzzle: 'megaminx',
    alg: "R-- D++ R-- D++ R-- D++ R-- D++ R-- D++" },
  { id: 'minx-rev-checkerboard', name: { en: "Reverse Checkerboard", zh: "反向棋盘" },
    category: 'symmetry', puzzle: 'megaminx',
    alg: "R-- D-- R-- D-- R-- D-- R-- D-- R-- D--" },

  // ─────────────────────────── Skewb ───────────────────────────
  { id: 'skewb-checkerboard', name: { en: "Checkerboard", zh: "棋盘" },
    category: 'symmetry', puzzle: 'skewb',
    alg: "R L R' L' R L R' L'" },
  { id: 'skewb-anti-checker', name: { en: "Anti-Checkerboard", zh: "反棋盘" },
    category: 'symmetry', puzzle: 'skewb',
    alg: "L R L' R' L R L' R'" },
  { id: 'skewb-six-spot', name: { en: "Six Spots", zh: "六点" },
    category: 'dots', puzzle: 'skewb',
    alg: "R L' R L' R L' R L'" },
  { id: 'skewb-cube-in-cube', name: { en: "Cube in a Cube", zh: "立方中立方" },
    category: 'cube-in-cube', puzzle: 'skewb',
    alg: "R L R' L R L'" },
  { id: 'skewb-flower', name: { en: "Flower", zh: "花朵" },
    category: 'other', puzzle: 'skewb',
    alg: "U R L' R' L U' R L' R' L" },

  // ─────────────────────────── Square-1 ───────────────────────────
  { id: 'sq1-stripes', name: { en: "Stripes", zh: "条纹" },
    category: 'stripes', puzzle: 'sq1',
    alg: "(6,0) / (6,0) / (6,0)" },
  { id: 'sq1-plus-minus', name: { en: "Plus / Minus", zh: "加减号" },
    category: 'symmetry', puzzle: 'sq1',
    alg: "(3,3) / (3,3) / (3,3) / (3,3)" },
  { id: 'sq1-checker-cross', name: { en: "Checkerboard Cross", zh: "棋盘十字" },
    category: 'crosses', puzzle: 'sq1',
    alg: "(1,0) / (-1,-1) / (4,-2) / (-1,-1) / (3,-2)" },
  { id: 'sq1-cube-in-cube', name: { en: "Cube in a Cube", zh: "立方中立方" },
    category: 'cube-in-cube', puzzle: 'sq1',
    alg: "(0,-1) / (-3,0) / (3,3) / (0,-3) / (3,0) / (0,3)" },
  { id: 'sq1-mushroom', name: { en: "Mushroom", zh: "蘑菇" },
    category: 'other', puzzle: 'sq1',
    alg: "(3,3) / (-3,0) / (0,-3) / (3,0)" },

  // ─────────────────────────── Clock ───────────────────────────
  { id: 'clock-all-6', name: { en: "All 6 O'Clock", zh: "全六点" },
    category: 'symmetry', puzzle: 'clock',
    alg: "ALL6+ y2 ALL6+" },
  { id: 'clock-all-3', name: { en: "All 3 O'Clock", zh: "全三点" },
    category: 'symmetry', puzzle: 'clock',
    alg: "ALL3+ y2 ALL3+" },
  { id: 'clock-checker', name: { en: "Checkerboard", zh: "棋盘" },
    category: 'symmetry', puzzle: 'clock',
    alg: "UR6+ DL6+ U6+ D6+ ALL6+ y2 UR6+ DL6+ U6+ D6+ ALL6+" },
  { id: 'clock-cross', name: { en: "Cross", zh: "十字" },
    category: 'crosses', puzzle: 'clock',
    alg: "U6+ R6+ D6+ L6+ ALL3+ y2 U6+ R6+ D6+ L6+ ALL3+" },

  // ─────────────────────────── Extra 3×3 ───────────────────────────
  { id: '3x3-tablecloth', name: { en: "Tablecloth", zh: "桌布" },
    category: 'symmetry',
    alg: "U D F2 R2 U D U' D' L2 B2 U' D'" },
  { id: '3x3-rockets', name: { en: "Rockets", zh: "火箭" },
    category: 'stripes',
    alg: "M2 S2 U2 M2 S2" },
  { id: '3x3-picnic', name: { en: "Picnic Tablecloth", zh: "野餐布" },
    category: 'symmetry',
    alg: "D2 M2 S2" },
  { id: '3x3-snake-eyes', name: { en: "Snake Eyes", zh: "蛇眼" },
    category: 'dots',
    alg: "R2 U2 R2 U2 R2 U2" },
];
