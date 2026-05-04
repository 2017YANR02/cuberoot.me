/**
 * Famous 3×3 pretty patterns.
 *
 * Source: speedsolving.com/wiki Pretty_pattern + ruwix.com/rubiks-cube-patterns-algorithms
 * Compiled and verified to render correctly under TwistyPlayer.
 */

export type Category = 'symmetry' | 'cube-in-cube' | 'dots' | 'stripes' | 'crosses' | 'twists' | 'other';
export type PuzzleSize = '3x3x3' | '4x4x4' | '5x5x5' | '6x6x6' | '7x7x7';

export interface Pattern {
  id: string;
  name_en: string;
  name_zh: string;
  alg: string;
  category: Category;
  /** Defaults to 3x3x3 if omitted (legacy entries). */
  puzzle?: PuzzleSize;
}

export const PUZZLE_SIZES: PuzzleSize[] = ['3x3x3', '4x4x4', '5x5x5', '6x6x6', '7x7x7'];

export const PUZZLE_LABEL: Record<PuzzleSize, string> = {
  '3x3x3': '3×3',
  '4x4x4': '4×4',
  '5x5x5': '5×5',
  '6x6x6': '6×6',
  '7x7x7': '7×7',
};

export function patternPuzzle(p: Pattern): PuzzleSize {
  return p.puzzle ?? '3x3x3';
}

export const CATEGORY_LABEL: Record<Category, { zh: string; en: string }> = {
  symmetry:      { zh: '对称', en: 'Symmetry' },
  'cube-in-cube':{ zh: '立方中立方', en: 'Cube-in-Cube' },
  dots:          { zh: '点阵', en: 'Dots' },
  stripes:       { zh: '条纹', en: 'Stripes' },
  crosses:       { zh: '十字', en: 'Crosses' },
  twists:        { zh: '扭转', en: 'Twists' },
  other:         { zh: '其他', en: 'Other' },
};

export const PATTERNS: Pattern[] = [
  // ── Symmetry ──
  { id: 'superflip', name_en: 'Superflip', name_zh: '超级翻转',
    category: 'symmetry',
    alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" },
  { id: 'checkerboard', name_en: 'Checkerboard', name_zh: '棋盘',
    category: 'symmetry',
    alg: "M2 E2 S2" },
  { id: 'six-spots', name_en: 'Six Spots', name_zh: '六个圆点',
    category: 'dots',
    alg: "U D' R L' F B' U D'" },
  { id: 'pons-asinorum', name_en: "Pons Asinorum", name_zh: '驴桥',
    category: 'symmetry',
    alg: "F2 B2 U2 D2 L2 R2" },
  { id: 'four-spots', name_en: 'Four Spots', name_zh: '四个圆点',
    category: 'dots',
    alg: "F2 B2 U D' R2 L2 U D'" },
  { id: 'plus-minus', name_en: 'Plus and Minus', name_zh: '加减号',
    category: 'symmetry',
    alg: "U2 R2 L2 U2 R2 L2" },

  // ── Cube in cube ──
  { id: 'cube-in-cube', name_en: 'Cube in a Cube', name_zh: '立方中立方',
    category: 'cube-in-cube',
    alg: "F L F U' R U F2 L2 U' L' B D' B' L2 U" },
  { id: 'cube-in-cube-in-cube', name_en: 'Cube in a Cube in a Cube', name_zh: '三层套立方',
    category: 'cube-in-cube',
    alg: "U' L' U' F' R2 B' R F U B2 U B' L U' F U R F'" },
  { id: 'kilt', name_en: 'Kilt', name_zh: '苏格兰呢',
    category: 'cube-in-cube',
    alg: "L F R' F' L' F' B D R D' R' F' B D' F2" },

  // ── Stripes / lines ──
  { id: 'vertical-stripes', name_en: 'Vertical Stripes', name_zh: '竖条纹',
    category: 'stripes',
    alg: "F U F R L2 B D' R D2 L D' B R2 L F U F" },
  { id: 'tetris', name_en: 'Tetris', name_zh: '俄罗斯方块',
    category: 'stripes',
    alg: "L R F B U' D' L' R'" },
  { id: 'twister', name_en: 'Twister', name_zh: '扭风',
    category: 'stripes',
    alg: "F R' U L F' L' F U' R U L' U' L F'" },

  // ── Crosses ──
  { id: 'plus-sign', name_en: 'Plus Sign', name_zh: '加号',
    category: 'crosses',
    alg: "R2 L' D F2 R' D' R' L U' F' D' F R2 D F' U' B2" },
  { id: 'edge-only-cross', name_en: 'Edges Only', name_zh: '只剩棱块',
    category: 'crosses',
    alg: "R2 L2 U2 R2 L2 U2" },
  { id: 'gift-box', name_en: 'Gift Box', name_zh: '礼物盒',
    category: 'other',
    alg: "U B2 R2 B2 L2 F2 R2 D' F2 L2 B U2 F' U F' R2 U" },

  // ── Twists ──
  { id: 'anaconda', name_en: 'Anaconda', name_zh: '森蚺',
    category: 'twists',
    alg: "L U B' U' R L' B R' F B' D R D' F'" },
  { id: 'python', name_en: 'Python', name_zh: '蟒蛇',
    category: 'twists',
    alg: "F2 R' B' U R' L F' L F' B D' R B L2" },
  { id: 'spiral', name_en: 'Spiral', name_zh: '螺旋',
    category: 'twists',
    alg: "L' B' D U R U' R' D2 R2 D L D' L' R' F U" },

  // ── Other ──
  { id: 'snake', name_en: 'Snake', name_zh: '蛇形',
    category: 'other',
    alg: "F R' U L F' L' F U' R U L' U' L F'" },
  { id: 'green-mamba', name_en: 'Green Mamba', name_zh: '绿曼巴',
    category: 'other',
    alg: "R D R F R' F' B D R' U' B' U D2" },
  { id: 'displaced-motif', name_en: 'Displaced Motif', name_zh: '错位图案',
    category: 'other',
    alg: "R B' R B R' B2 R' B R B2" },
  { id: 'four-crosses', name_en: 'Four Crosses', name_zh: '四个十字',
    category: 'crosses',
    alg: "U2 R2 L2 F2 B2 D2 L R F B' U D'" },
  { id: 'corners-only', name_en: 'Corners Only', name_zh: '只剩角块',
    category: 'symmetry',
    alg: "U F B' L2 U2 L2 F' B U2 L2 U" },
  { id: 'flying-cube', name_en: 'Flying Cube', name_zh: '飞行立方',
    category: 'cube-in-cube',
    alg: "F L' D' B' L F U F' D' F L2 B' L' U L' B" },
  { id: 'wire', name_en: 'Wire', name_zh: '线圈',
    category: 'other',
    alg: "R' U2 R U R' U R" },

  // ─────────────────────────── 4×4 ───────────────────────────
  // Sources: cubingcheatsheet, cubelelo, ruwix, speedsolving wiki.
  { id: '4x4-checkerboard-simple', name_en: 'Checkerboard', name_zh: '棋盘',
    category: 'symmetry', puzzle: '4x4x4',
    alg: "Uw2 Fw2 Rw2" },
  { id: '4x4-checkerboard-4face', name_en: 'Checkerboard (4 faces)', name_zh: '四面棋盘',
    category: 'symmetry', puzzle: '4x4x4',
    alg: "3Rw2 Rw2' R2 3Fw2 2Fw2' F2 3Rw2 Rw2' R2 3Dw2 Dw2' D2" },
  { id: '4x4-pons-asinorum', name_en: 'Pons Asinorum', name_zh: '驴桥',
    category: 'symmetry', puzzle: '4x4x4',
    alg: "2-3Uw2 2-3Fw2 2-3Rw2" },
  { id: '4x4-checker', name_en: 'Checker', name_zh: '错色棋盘',
    category: 'symmetry', puzzle: '4x4x4',
    alg: "B2 R2 D' F2 D2 B2 U B2 L2 U L' R' B D U L2 R Fw2 Lw2 D U Bw2 Dw2 R2 B U2 R L" },
  { id: '4x4-dots', name_en: 'Six Dots', name_zh: '六个点',
    category: 'dots', puzzle: '4x4x4',
    alg: "U D' R L' F B' U D'" },
  { id: '4x4-checkered-dot', name_en: 'Checkered Dot', name_zh: '棋盘点',
    category: 'dots', puzzle: '4x4x4',
    alg: "2-3Dw' 2-3Rw' 2U' 2D2 2F' 2D' 2U' 2B 2U 2-3Fw 2-3Rw" },
  { id: '4x4-parallel-stripes', name_en: 'Parallel Stripes', name_zh: '平行条纹',
    category: 'stripes', puzzle: '4x4x4',
    alg: "d 2-3Rw2 d2 2-3Fw2 d 2-3Rw2 b2 r2 B2 2F2" },
  { id: '4x4-stripes', name_en: 'Stripes', name_zh: '条纹',
    category: 'stripes', puzzle: '4x4x4',
    alg: "F R2 2-3Dw' R2 B 2-3Dw R D2 B 2-3Rw 2-3Dw' F' R2 U' B2 u2 r2 U2 R2 f2 r2 2U2" },
  { id: '4x4-cube-in-cube', name_en: 'Cube in a Cube', name_zh: '立方中立方',
    category: 'cube-in-cube', puzzle: '4x4x4',
    alg: "F L F U' R U F2 L2 U' L' B D' B' L2 U" },
  { id: '4x4-3-cube-in-cube', name_en: 'Triple Cube in a Cube', name_zh: '三层立方',
    category: 'cube-in-cube', puzzle: '4x4x4',
    alg: "B' 2R2 2L2 U2 2R2 2L2 B F2 R U' R U R2 U R2 F' U F' u l u' f2 d r' u f d2 r2" },
  { id: '4x4-small-big-box', name_en: 'Small Box Big Box', name_zh: '盒中盒',
    category: 'cube-in-cube', puzzle: '4x4x4',
    alg: "B' U' B' L' D B U D2 B U L D' L' U' L2 D" },
  { id: '4x4-opposite-boxes', name_en: 'Opposite Boxes', name_zh: '对角双盒',
    category: 'cube-in-cube', puzzle: '4x4x4',
    alg: "Bw2 Rw' Dw Rw Dw' Rw' Dw Rw Uw Rw' Dw' Rw Dw Rw' Dw' Rw Uw' Bw2" },
  { id: '4x4-2x2-peak', name_en: '2×2 Peak', name_zh: '2×2 凸起',
    category: 'other', puzzle: '4x4x4',
    alg: "2B2 2D2 l2 U F2 L2 D' L' D L' F U' F l2 2D2 2B2" },
  { id: '4x4-color-peak', name_en: 'Colour Peak', name_zh: '彩色凸起',
    category: 'other', puzzle: '4x4x4',
    alg: "F U2 L F L' B L U B' R' L' U R' D' F' B R2" },
  { id: '4x4-corner-wrapper', name_en: 'Corner Wrapper', name_zh: '角块包裹',
    category: 'other', puzzle: '4x4x4',
    alg: "L U B' U' R L' B R' F B' D R D' F'" },
  { id: '4x4-rings', name_en: 'Rings', name_zh: '环',
    category: 'other', puzzle: '4x4x4',
    alg: "Uw Lw Uw' Fw2 Dw Rw' Uw Fw Dw2 Rw2" },

  // ─────────────────────────── 5×5 ───────────────────────────
  // Sources: cubingcheatsheet, rubikscubers blog, speedsolving wiki.
  { id: '5x5-checkerboard-simple', name_en: 'Checkerboard', name_zh: '棋盘',
    category: 'symmetry', puzzle: '5x5x5',
    alg: "Fw2 Bw2 Lw2 Rw2 Uw2 Dw2" },
  { id: '5x5-checkerboard-4face', name_en: 'Checkerboard (4 faces)', name_zh: '四面棋盘',
    category: 'symmetry', puzzle: '5x5x5',
    alg: "2Rw2 2Bw2 M2 2Fw2 2Lw2 E2 R2 B2 m2 F2 L2 e2" },
  { id: '5x5-checkerboard-6face', name_en: 'Checkerboard (6 faces)', name_zh: '六面棋盘',
    category: 'symmetry', puzzle: '5x5x5',
    alg: "4Rw2 3Rw2' Rw2 R2' 4Fw2 3Fw2' 2Fw2 F2' 4Dw2 3Dw2' Dw2 D2'" },
  { id: '5x5-pons-asinorum', name_en: 'Pons Asinorum (inner)', name_zh: '驴桥（内圈）',
    category: 'symmetry', puzzle: '5x5x5',
    alg: "M2 E2 S2" },
  { id: '5x5-6-spot', name_en: 'Six Spots (inner)', name_zh: '内圈六点',
    category: 'dots', puzzle: '5x5x5',
    alg: "M S M' S'" },
  { id: '5x5-4-spot', name_en: 'Four Spots (inner)', name_zh: '内圈四点',
    category: 'dots', puzzle: '5x5x5',
    alg: "M2 S M2 S'" },
  { id: '5x5-4-dots', name_en: 'Four Dots', name_zh: '四点',
    category: 'dots', puzzle: '5x5x5',
    alg: "Lw Rw' Uw Dw' Lw' Rw Uw' Dw" },
  { id: '5x5-cross', name_en: 'Cross', name_zh: '十字',
    category: 'crosses', puzzle: '5x5x5',
    alg: "U2 Uw2 M2 U2 Uw2 M2 F2 Fw2 E2 F2 Fw2 E2 U2 Uw2 S2 U2 Uw2 S2 R2 Rw2 E2 R2 Rw2 E2 M2 E M2 E'" },
  { id: '5x5-4-cube-in-cube', name_en: 'Quadruple Cube in a Cube', name_zh: '四层立方',
    category: 'cube-in-cube', puzzle: '5x5x5',
    alg: "F U' B L U' F2 U2 F U F' U2 D' B D L2 B2 U Fw Uw' Bw Lw Uw' Fw2 Uw2 Fw Uw Fw' Uw2 Dw' Bw Dw Lw2 Bw2 Uw" },
  { id: '5x5-i-love-u', name_en: 'I Love U', name_zh: '',
    category: 'other', puzzle: '5x5x5',
    alg: "2-4Fw' 2-4Rw2 2F2 2-4Rw2 2-4Dw2 2-3Fw2 2-4Dw S2 2-4Dw 2-3Fw L 2B' 2R2 2B L' 2B' Rw2 S' 2L2 S R2 S' 2L2 S" },
  { id: '5x5-hearts', name_en: 'Hearts', name_zh: '心形',
    category: 'other', puzzle: '5x5x5',
    alg: "M2 2-4Rw2 S2 D 2-4Fw2 D2 2-4Fw2 D S2 2-4Rw M2 2D 2-4Rw 2-4Dw2 2-4Rw' 2D 2-4Rw" },
  { id: '5x5-3x3-peak', name_en: '3×3 Peak', name_zh: '3×3 凸起',
    category: 'other', puzzle: '5x5x5',
    alg: "F' 2L2 F R2 2B U' 2B' Dw' 2B U 2B' Dw R2 F' 2L2 F2 R U' M2 U R' U' M2 U F'" },
  { id: '5x5-clown', name_en: 'Clown', name_zh: '小丑',
    category: 'other', puzzle: '5x5x5',
    alg: "2U 2R' 2L 2U' 2R 2L' 2D' 2-4Rw' 2D 2-4Rw S' M S M'" },

  // ─────────────────────────── 6×6 ───────────────────────────
  // Sources: cubingcheatsheet, speedsolving wiki.
  { id: '6x6-checkerboard-2layer', name_en: 'Checkerboard (2-layer)', name_zh: '双层棋盘',
    category: 'symmetry', puzzle: '6x6x6',
    alg: "2Uw2 2Fw2 2Rw2" },
  { id: '6x6-checkerboard-simple', name_en: 'Checkerboard', name_zh: '棋盘',
    category: 'symmetry', puzzle: '6x6x6',
    alg: "3Uw2 3Fw2 3Rw2" },
  { id: '6x6-checkerboard-4face', name_en: 'Checkerboard (4 faces)', name_zh: '四面棋盘',
    category: 'symmetry', puzzle: '6x6x6',
    alg: "5Rw2 4Rw2' 3Rw2 Rw2' R2 5Fw2 4Fw2' 3Fw2 2Fw2' F2 5Rw2 4Rw2' 3Rw2 Rw2' R2 5Dw2 4Dw2' 3Dw2 Dw2' D2" },
  { id: '6x6-pons-asinorum', name_en: 'Pons Asinorum', name_zh: '驴桥',
    category: 'symmetry', puzzle: '6x6x6',
    alg: "2-3Uw2 2-3Fw2 2-3Rw2" },
  { id: '6x6-bar-charts', name_en: 'Bar Charts', name_zh: '柱状图',
    category: 'stripes', puzzle: '6x6x6',
    alg: "R L B2 U2 3U' 2D 2-5Fw 2D' 2B 3D 3B 3U 3F' 2U' 2F' 3D' 2U U2 B2 L' R'" },
  { id: '6x6-2-cubes-in-cube', name_en: 'Two Cubes in a Cube', name_zh: '双层立方',
    category: 'cube-in-cube', puzzle: '6x6x6',
    alg: "1-2Fw2 1-2Rw2 1-2Uw' 1-2Fw' 1-4Dw 1-2Bw' 1-2Uw2 1-2Bw 1-2Uw' 1-2Rw' 3R2 1-2Bw2 3R2 1-3Fw2 3L2 3B2" },
  { id: '6x6-smilies', name_en: 'Smilies', name_zh: '笑脸',
    category: 'other', puzzle: '6x6x6',
    alg: "2-5Fw2 3-4Rw2 3-4Fw2 2U 2-5Fw2 2U2 2-5Fw2 3U 2R2 2L2 3U2 2R2 2L2 2-3Uw 3-4Fw2 3-4Rw2 2-5Fw2" },
  { id: '6x6-frownie', name_en: 'Frownie', name_zh: '皱眉',
    category: 'other', puzzle: '6x6x6',
    alg: "3-4Fw2 2R2 2L2 2U2 2F2 2B2 2R2 2L2 2U2 3D 3-4Fw2 3D2 3-4Fw2 3D 2-5Fw2" },

  // ─────────────────────────── 7×7 ───────────────────────────
  // Sources: speedsolving wiki + extension of canonical 3×3 / NxN algs.
  { id: '7x7-checkerboard-simple', name_en: 'Checkerboard', name_zh: '棋盘',
    category: 'symmetry', puzzle: '7x7x7',
    alg: "Uw2 Dw2 Fw2 Bw2 Lw2 Rw2" },
  { id: '7x7-checkerboard-2layer', name_en: 'Checkerboard (2-layer)', name_zh: '双层棋盘',
    category: 'symmetry', puzzle: '7x7x7',
    alg: "2Uw2 2Fw2 2Rw2" },
  { id: '7x7-checkerboard-3layer', name_en: 'Checkerboard (3-layer)', name_zh: '三层棋盘',
    category: 'symmetry', puzzle: '7x7x7',
    alg: "3Uw2 3Fw2 3Rw2" },
  { id: '7x7-checkerboard-4face', name_en: 'Checkerboard (4 faces)', name_zh: '四面棋盘',
    category: 'symmetry', puzzle: '7x7x7',
    alg: "3Rw2 3Bw2 M2 3Fw2 3Lw2 E2 2Rw2 2Bw2 5Rw2 2Rw2' 2Fw2 2Lw2 5Dw2 2Dw2' R2 B2 m2 F2 L2 e2 z2" },
  { id: '7x7-pons-asinorum', name_en: 'Pons Asinorum (inner)', name_zh: '驴桥（内圈）',
    category: 'symmetry', puzzle: '7x7x7',
    alg: "M2 E2 S2" },
  { id: '7x7-6-spot', name_en: 'Six Spots (inner)', name_zh: '内圈六点',
    category: 'dots', puzzle: '7x7x7',
    alg: "M S M' S'" },
];
