// 333 方法 DNA — 每个阶段的算法数 / STM 期望 / 识别时间
// 配合 VisualCube 在页面上展示样本

import { atLeastKInRound, entryById, oneOverRelative, probability } from '@/lib/skip-probability';
import { godShare } from '@/lib/god-distance-333';

// ──────────────────────────────────────────────────────────
// CFOP 步骤分解 (Cross → F2L → OLL → PLL)
// ──────────────────────────────────────────────────────────

export interface CfopStep {
  step: string;
  step_zh: string;
  alg_count: number;
  avg_stm: number;
  avg_time_s: number;       // 顶级 cuber 该步骤典型耗时
  recognition_s: number;
  description_en: string;
  description_zh: string;
}

export const CFOP_BREAKDOWN: CfopStep[] = [
  {
    step: 'Cross', step_zh: '十字',
    alg_count: 0,
    avg_stm: 7,
    avg_time_s: 0.8,
    recognition_s: 0,
    description_en: 'Build the cross on bottom layer (4 edges). Plan during 15s inspection — elite cubers reach 100% inspection-planned at sub-5 level. Optimal HTM averages 7.42 moves.',
    description_zh: '底层十字 (4 个棱). 15 秒 inspection 内完成规划 — 顶级 cuber sub-5 水平基本 100% inspection 规划. Optimal HTM 平均 7.42 步.'
},
  {
    step: 'F2L (4 pairs)', step_zh: 'F2L (4 对)',
    alg_count: 41,
    avg_stm: 28,
    avg_time_s: 2.0,
    recognition_s: 0.05,
    description_en: 'First Two Layers — insert 4 corner+edge pairs into bottom layer slots. 41 distinct cases (with mirrors → 119). Intuitive + memorized hybrid. Top cubers use "lookahead" — solving pair N while tracking N+1 in periphery.',
    description_zh: '前两层 — 插入 4 对角+棱到底两层. 41 个独立 case (含镜像 119). 直觉 + 记忆混合. 顶级 cuber 用 "lookahead" — 解第 N 对时眼睛已在追 N+1.'
},
  {
    step: 'OLL (Orient Last Layer)', step_zh: '顶面色 (OLL)',
    alg_count: 57,
    avg_stm: 9.7,
    avg_time_s: 0.9,
    recognition_s: 0.5,
    description_en: '57 cases orienting the last-layer corners + edges so top face is uniform color. Avg alg length 9.7 STM. Recognition by yellow-sticker pattern. Pure CFOP elites finish this step in ~0.5 s after a ~0.5 s recognition.',
    description_zh: '57 case 把顶层的角 + 棱朝向调到全黄. 算法均长 9.7 步. 看黄面图案识别. 纯 CFOP 顶级 ~0.5 秒识别 + ~0.5 秒执行.'
},
  {
    step: 'PLL (Permute Last Layer)', step_zh: '顶面位 (PLL)',
    alg_count: 21,
    avg_stm: 12.5,
    avg_time_s: 1.0,
    recognition_s: 0.4,
    description_en: '21 cases permuting last-layer pieces to solve cube. Includes AUF (alignment of U face). Avg alg length 12.5 STM. Recognition by side-color blocks ("blocks then bars then headlights").',
    description_zh: '21 case 把顶层位置归位. 含 AUF. 算法均长 12.5 步. 看侧色块识别 ("块→条→头灯").'
},
];

// ──────────────────────────────────────────────────────────
// F2L 41 cases — slot 类型 / STM
// ──────────────────────────────────────────────────────────

export const F2L_CASE_GROUPS: Array<{ group_en: string; group_zh: string; case_count: number; avg_stm: number; example_alg?: string; example_setup?: string }> = [
  { group_en: 'Easy (4 cases)', group_zh: '简单 (4 case)', case_count: 4, avg_stm: 4.5, example_alg: "U R U' R'", example_setup: "R U R'" },
  { group_en: 'Standard (12 cases)', group_zh: '标准 (12 case)', case_count: 12, avg_stm: 7.5, example_alg: "U R U' R' U' F' U F", example_setup: "F' U' F R U R'" },
  { group_en: 'F2L 21-24 (4 sledgehammer cases)', group_zh: 'F2L 21-24 (sledgehammer)', case_count: 4, avg_stm: 8, example_alg: "R' F R F' R U R'", example_setup: "R U' R' F R' F' R" },
  { group_en: 'F2L "wrong slot" pairs', group_zh: 'F2L 错槽 pair', case_count: 12, avg_stm: 9.5 },
  { group_en: 'F2L corner-edge separated', group_zh: '角棱分离', case_count: 9, avg_stm: 11, example_alg: "R U' R' U R U R' U2 R U' R'" },
];

// ──────────────────────────────────────────────────────────
// OLL 57 cases distribution by alg length
// ──────────────────────────────────────────────────────────

export const OLL_BY_STM: Array<{ stm: number; case_count: number }> = [
  { stm: 7, case_count: 4 },
  { stm: 8, case_count: 8 },
  { stm: 9, case_count: 14 },
  { stm: 10, case_count: 11 },
  { stm: 11, case_count: 10 },
  { stm: 12, case_count: 6 },
  { stm: 13, case_count: 3 },
  { stm: 14, case_count: 1 },  // OLL alpha #57 (Dot)
];

export const OLL_NOTABLE = [
  { number: 27, name: 'Sune',         alg: "R U R' U R U2 R'",            stm: 7,  freq: '8/57' },
  { number: 26, name: 'Anti-Sune',    alg: "R U2 R' U' R U' R'",           stm: 7,  freq: '8/57' },
  { number: 21, name: 'Double Sune (Cross)', alg: "F R U R' U' R U R' U' R U R' U' F'", stm: 14, freq: 'rare' },
  { number: 57, name: 'H (last)',     alg: "R U R' U' M' U R U' r'",       stm: 9 },
];

// ──────────────────────────────────────────────────────────
// PLL 21 cases (4 are inverse pairs of 4 → 17 alg learnings, 21 cases)
// ──────────────────────────────────────────────────────────

export const PLL_TABLE = [
  { letter: 'H',  name: 'H-perm',     alg: "M2 U M2 U2 M2 U M2",                  stm: 7,  prob: '1/72', recog_s: 0.2 },
  { letter: 'Z',  name: 'Z-perm',     alg: "M2 U M2 U M' U2 M2 U2 M'",            stm: 9,  prob: '2/72', recog_s: 0.3 },
  { letter: 'Ua', name: 'Ua-perm',    alg: "R U' R U R U R U' R' U' R2",          stm: 11, prob: '4/72', recog_s: 0.4 },
  { letter: 'Ub', name: 'Ub-perm',    alg: "R2 U R U R' U' R' U' R' U R'",        stm: 11, prob: '4/72', recog_s: 0.4 },
  { letter: 'Aa', name: 'Aa-perm',    alg: "x R' U R' D2 R U' R' D2 R2 x'",        stm: 10, prob: '4/72', recog_s: 0.5 },
  { letter: 'Ab', name: 'Ab-perm',    alg: "x R2 D2 R U R' D2 R U' R x'",          stm: 10, prob: '4/72', recog_s: 0.5 },
  { letter: 'E',  name: 'E-perm',     alg: "x' R U' R' D R U R' D' R U R' D R U' R' D' x", stm: 17, prob: '2/72', recog_s: 0.7 },
  { letter: 'F',  name: 'F-perm',     alg: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R", stm: 19, prob: '4/72', recog_s: 0.8 },
  { letter: 'Ga', name: 'Ga-perm',    alg: "R2 U R' U R' U' R U' R2 U' D R' U R D'", stm: 15, prob: '4/72', recog_s: 0.9 },
  { letter: 'Gb', name: 'Gb-perm',    alg: "R' U' R U D' R2 U R' U R U' R U' R2 D", stm: 15, prob: '4/72', recog_s: 0.9 },
  { letter: 'Gc', name: 'Gc-perm',    alg: "R2 U' R U' R U R' U R2 U D' R U' R' D",  stm: 15, prob: '4/72', recog_s: 0.9 },
  { letter: 'Gd', name: 'Gd-perm',    alg: "R U R' U' D R2 U' R U' R' U R' U R2 D'", stm: 15, prob: '4/72', recog_s: 0.9 },
  { letter: 'Ja', name: 'Ja-perm',    alg: "x R2 F R F' R U2 r' U r U2 x'",          stm: 11, prob: '4/72', recog_s: 0.4 },
  { letter: 'Jb', name: 'Jb-perm',    alg: "R U R' F' R U R' U' R' F R2 U' R'",      stm: 14, prob: '4/72', recog_s: 0.4 },
  { letter: 'Na', name: 'Na-perm',    alg: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'", stm: 22, prob: '1/72', recog_s: 0.5 },
  { letter: 'Nb', name: 'Nb-perm',    alg: "R' U R U' R' F' U' F R U R' F R' F' R U' R", stm: 18, prob: '1/72', recog_s: 0.5 },
  { letter: 'Ra', name: 'Ra-perm',    alg: "R U R' F' R U2 R' U2 R' F R U R U2 R' U'", stm: 16, prob: '4/72', recog_s: 0.6 },
  { letter: 'Rb', name: 'Rb-perm',    alg: "R' U2 R U2 R' F R U R' U' R' F' R2 U'",   stm: 14, prob: '4/72', recog_s: 0.6 },
  { letter: 'T',  name: 'T-perm',     alg: "R U R' U' R' F R2 U' R' U' R U R' F'",   stm: 14, prob: '4/72', recog_s: 0.4 },
  { letter: 'V',  name: 'V-perm',     alg: "R' U R' U' y R' F' R2 U' R' U R' F R F", stm: 14, prob: '4/72', recog_s: 0.6 },
  { letter: 'Y',  name: 'Y-perm',     alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'", stm: 17, prob: '4/72', recog_s: 0.5 },
];

// ──────────────────────────────────────────────────────────
// ZBLL 493 cases — grouped by COLL state (corner orientation/permutation)
// ──────────────────────────────────────────────────────────

export const ZBLL_GROUPS: Array<{ coll: string; count: number; avg_stm: number; description_en: string; description_zh: string
 }> = [
  { coll: 'AS (Anti-Sune corners)',    count: 72, avg_stm: 13.5, description_en: '8 corners oriented anti-sune; 12 edge cases per family × 6 family rotations', description_zh: '角朝向 anti-sune;每 family 12 棱 case × 6 旋转'
},
  { coll: 'S (Sune corners)',          count: 72, avg_stm: 13.0, description_en: 'mirror of AS', description_zh: 'AS 的镜像'
},
  { coll: 'L (L-shaped corners)',      count: 72, avg_stm: 13.8, description_en: 'L-shape orientation', description_zh: 'L 形朝向'
},
  { coll: 'U (U-shaped corners)',      count: 72, avg_stm: 14.0, description_en: 'U-shape orientation', description_zh: 'U 形朝向'
},
  { coll: 'T (T-shaped corners)',      count: 72, avg_stm: 13.5, description_en: 'T-shape orientation', description_zh: 'T 形朝向'
},
  { coll: 'Pi (Pi-shaped corners)',    count: 72, avg_stm: 13.8, description_en: 'pi-shape', description_zh: 'pi 形'
},
  { coll: 'H (H-shaped corners)',      count: 40, avg_stm: 11.5, description_en: '4-fold symmetry → fewer cases', description_zh: '4 重对称 → case 较少'
},
  { coll: 'O (Oriented corners = PLL)', count: 21, avg_stm: 11.0, description_en: 'all corners pre-oriented (= PLL itself + AUF)', description_zh: '角已朝向 (= PLL 本身 + AUF)'
},
];

// ──────────────────────────────────────────────────────────
// Skip probabilities
// ──────────────────────────────────────────────────────────
//
// 这里**不再写死小数**。整张表由 lib/skip-probability.ts 现算 —— 那边每条都是
// 「合法状态数 / 全集大小」的整数比,并拿 solver 独立算出的十字 / XCross 金标验过。
//
// 换掉的旧值(都不是小数点后的差别,是量级错):
//   自然 X-cross      1/16      → 1/96.49   旧值把「相对十字」的条件概率算小了 6 倍
//   幸运 XX-cross     1/600     → 1/18933
//   极幸运 XXX-cross  1/12000   → 1/6127019
//   OLL 备注「3³ × 2⁴ / 4 对称」→ 3³ × 2³,旧式子算出来是 108,不是 216
//   总步数 sub-30     p = 0.02 且注「最优 HTM ≤ 14 → ~1.5%」→ 真值 0.0175%(差 ~100 倍)

export interface SkipProbability {
  event_en: string;
  event_zh: string;
  p: number;
  p_pct: number;
  note_en: string;
  note_zh: string;
}

const fromEntry = (
  id: string, event_zh: string, event_en: string, note_zh: string, note_en: string,
  relative = false,
): SkipProbability => {
  const e = entryById(id);
  const p = relative ? 1 / oneOverRelative(e)! : probability(e);
  return { event_en, event_zh, p, p_pct: p * 100, note_en, note_zh };
};

/** 最优 HTM ≤ 14 的占比 —— 由 god-distance-333 的分布现算,不写死。 */
const SUB30_P = godShare(0, 14);

export const SKIP_PROBABILITIES: SkipProbability[] = [
  fromEntry('xcross-fixed', '自然 X-cross', 'X-cross (natural)',
    '解出十字时顺手带出一对 F2L —— 这是相对十字的条件概率',
    'a pair falling out along with the cross — conditional on the cross, not absolute', true),
  fromEntry('xcross2-fixed', '幸运 XX-cross', 'XX-cross (lucky)',
    '十字加两对,同样相对十字',
    'cross plus two pairs, also conditional on the cross', true),
  fromEntry('xcross3-fixed', '极幸运 XXX-cross', 'XXX-cross (extreme luck)',
    '十字加三对;Zajder 2.76 靠的是 XX-cross,不是这个',
    'cross plus three pairs; Zajder 2.76 rode an XX-cross, not this', true),
  fromEntry('oll', 'OLL 跳步', 'OLL skip',
    '角朝向 3³ × 棱朝向 2³ = 216,其中 1 种全对',
    'corner orientation 3³ × edge orientation 2³ = 216, one of them all-good'),
  fromEntry('pll', 'PLL 跳步', 'PLL skip',
    '排列同奇偶 4!·4!/2 = 288,其中 4 种是「还原 + 一次 AUF」',
    'permutations share parity: 4!·4!/2 = 288, four of them solved up to AUF'),
  fromEntry('ll', 'LL 连跳', 'LL skip (OLL and PLL)',
    '顶层全集 62,208 分之 4 —— 约 1.5 万分之一',
    'four states out of the 62,208-state last-layer universe — about one in 15.6k'),
  {
    event_en: 'Optimal HTM ≤ 14 (lucky scramble)',
    event_zh: '最优 HTM ≤ 14(幸运打乱)',
    p: SUB30_P,
    p_pct: SUB30_P * 100,
    note_en: 'from the published 3×3 distance distribution — far rarer than the "~1.5%" often quoted',
    note_zh: '由公布的三阶距离分布算出 —— 比常被引用的「~1.5%」稀有得多',
  },
];

/** 一轮 5 把里至少中一次 —— 表格右侧那一列。 */
export const skipInRound = (p: number, rounds = 5): number => atLeastKInRound(p, 1, rounds);

