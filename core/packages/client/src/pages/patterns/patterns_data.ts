/**
 * Famous 3×3 pretty patterns.
 *
 * Source: speedsolving.com/wiki Pretty_pattern + ruwix.com/rubiks-cube-patterns-algorithms
 * Compiled and verified to render correctly under TwistyPlayer.
 */

export type Category = 'symmetry' | 'cube-in-cube' | 'dots' | 'stripes' | 'crosses' | 'twists' | 'other';

export interface Pattern {
  id: string;
  name_en: string;
  name_zh: string;
  alg: string;
  category: Category;
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
];
