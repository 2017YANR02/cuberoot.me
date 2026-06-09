// 333 方法 DNA — 每个阶段的算法数 / STM 期望 / 识别时间
// 配合 VisualCube 在页面上展示样本

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
    step_zhHant?: string;
    description_zhHant?: string;
}

export const CFOP_BREAKDOWN: CfopStep[] = [
  {
    step: 'Cross', step_zh: '十字',
    alg_count: 0,
    avg_stm: 7,
    avg_time_s: 0.8,
    recognition_s: 0,
    description_en: 'Build the cross on bottom layer (4 edges). Plan during 15s inspection — elite cubers reach 100% inspection-planned at sub-5 level. Optimal HTM averages 7.42 moves.',
    description_zh: '底层十字 (4 个棱). 15 秒 inspection 内完成规划 — 顶级 cuber sub-5 水平基本 100% inspection 规划. Optimal HTM 平均 7.42 步.',
      description_zhHant: "底層十字 (4 個稜). 15 秒 inspection 內完成規劃 — 頂級 cuber sub-5 水平基本 100% inspection 規劃. Optimal HTM 平均 7.42 步."
},
  {
    step: 'F2L (4 pairs)', step_zh: 'F2L (4 对)',
    alg_count: 41,
    avg_stm: 28,
    avg_time_s: 2.0,
    recognition_s: 0.05,
    description_en: 'First Two Layers — insert 4 corner+edge pairs into bottom layer slots. 41 distinct cases (with mirrors → 119). Intuitive + memorized hybrid. Top cubers use "lookahead" — solving pair N while tracking N+1 in periphery.',
    description_zh: '前两层 — 插入 4 对角+棱到底两层. 41 个独立 case (含镜像 119). 直觉 + 记忆混合. 顶级 cuber 用 "lookahead" — 解第 N 对时眼睛已在追 N+1.',
      step_zhHant: "F2L (4 對)",
      description_zhHant: "前兩層 — 插入 4 對角+稜到底兩層. 41 個獨立 case (含映象 119). 直覺 + 記憶混合. 頂級 cuber 用 \"lookahead\" — 解第 N 對時眼睛已在追 N+1."
},
  {
    step: 'OLL (Orient Last Layer)', step_zh: '顶面色 (OLL)',
    alg_count: 57,
    avg_stm: 9.7,
    avg_time_s: 0.9,
    recognition_s: 0.5,
    description_en: '57 cases orienting the last-layer corners + edges so top face is uniform color. Avg alg length 9.7 STM. Recognition by yellow-sticker pattern. Pure CFOP elites finish this step in ~0.5 s after a ~0.5 s recognition.',
    description_zh: '57 case 把顶层的角 + 棱朝向调到全黄. 算法均长 9.7 步. 看黄面图案识别. 纯 CFOP 顶级 ~0.5 秒识别 + ~0.5 秒执行.',
      step_zhHant: "頂面色 (OLL)",
      description_zhHant: "57 case 把頂層的角 + 稜朝向調到全黃. 演算法均長 9.7 步. 看黃面圖案識別. 純 CFOP 頂級 ~0.5 秒識別 + ~0.5 秒執行."
},
  {
    step: 'PLL (Permute Last Layer)', step_zh: '顶面位 (PLL)',
    alg_count: 21,
    avg_stm: 12.5,
    avg_time_s: 1.0,
    recognition_s: 0.4,
    description_en: '21 cases permuting last-layer pieces to solve cube. Includes AUF (alignment of U face). Avg alg length 12.5 STM. Recognition by side-color blocks ("blocks then bars then headlights").',
    description_zh: '21 case 把顶层位置归位. 含 AUF. 算法均长 12.5 步. 看侧色块识别 ("块→条→头灯").',
      step_zhHant: "頂面位 (PLL)",
      description_zhHant: "21 case 把頂層位置歸位. 含 AUF. 演算法均長 12.5 步. 看側色塊識別 (\"塊→條→頭燈\")."
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
        description_zhHant?: string;
 }> = [
  { coll: 'AS (Anti-Sune corners)',    count: 72, avg_stm: 13.5, description_en: '8 corners oriented anti-sune; 12 edge cases per family × 6 family rotations', description_zh: '角朝向 anti-sune;每 family 12 棱 case × 6 旋转',
      description_zhHant: '角朝向 anti-sune;每 family 12 稜 case × 6 旋轉'
},
  { coll: 'S (Sune corners)',          count: 72, avg_stm: 13.0, description_en: 'mirror of AS', description_zh: 'AS 的镜像',
      description_zhHant: 'AS 的映象'
},
  { coll: 'L (L-shaped corners)',      count: 72, avg_stm: 13.8, description_en: 'L-shape orientation', description_zh: 'L 形朝向',
      description_zhHant: 'L 形朝向'
},
  { coll: 'U (U-shaped corners)',      count: 72, avg_stm: 14.0, description_en: 'U-shape orientation', description_zh: 'U 形朝向',
      description_zhHant: 'U 形朝向'
},
  { coll: 'T (T-shaped corners)',      count: 72, avg_stm: 13.5, description_en: 'T-shape orientation', description_zh: 'T 形朝向',
      description_zhHant: 'T 形朝向'
},
  { coll: 'Pi (Pi-shaped corners)',    count: 72, avg_stm: 13.8, description_en: 'pi-shape', description_zh: 'pi 形',
      description_zhHant: 'pi 形'
},
  { coll: 'H (H-shaped corners)',      count: 40, avg_stm: 11.5, description_en: '4-fold symmetry → fewer cases', description_zh: '4 重对称 → case 较少',
      description_zhHant: '4 重對稱 → case 較少'
},
  { coll: 'O (Oriented corners = PLL)', count: 21, avg_stm: 11.0, description_en: 'all corners pre-oriented (= PLL itself + AUF)', description_zh: '角已朝向 (= PLL 本身 + AUF)',
      description_zhHant: '角已朝向 (= PLL 本身 + AUF)'
},
];

// ──────────────────────────────────────────────────────────
// Skip probabilities
// ──────────────────────────────────────────────────────────

export const SKIP_PROBABILITIES = [
  { event_en: 'X-cross (natural)',              event_zh: '自然 X-cross',           p: 1 / 16,    p_pct: 6.25,    note_en: 'F2L pair pre-solved during cross', note_zh: 'cross 阶段顺手 1 对 F2L',
      event_zhHant: '自然 X-cross',
      note_zhHant: 'cross 階段順手 1 對 F2L'
},
  { event_en: 'XX-cross (lucky)',               event_zh: '幸运 XX-cross',          p: 1 / 600,   p_pct: 0.17,    note_en: 'rare double pair', note_zh: '罕见双 pair',
      event_zhHant: '幸運 XX-cross',
      note_zhHant: '罕見雙 pair'
},
  { event_en: 'XXX-cross (extreme luck)',       event_zh: '极幸运 XXX-cross',       p: 1 / 12000, p_pct: 0.0083,  note_en: 'Zajder 2.76 / theoretical', note_zh: 'Zajder 2.76 即靠此',
      event_zhHant: '極幸運 XXX-cross',
      note_zhHant: 'Zajder 2.76 即靠此'
},
  { event_en: 'OLL skip (3-cycle naturally oriented)', event_zh: 'OLL skip',         p: 1 / 216,   p_pct: 0.463,   note_en: '3^3 corner orientations × 2^4 edge orientations / 4 symmetries', note_zh: '3^3 角朝向 × 2^4 棱朝向 / 4 对称',
      event_zhHant: 'OLL skip',
      note_zhHant: '3^3 角朝向 × 2^4 稜朝向 / 4 對稱'
},
  { event_en: 'PLL skip',                       event_zh: 'PLL skip',                p: 1 / 72,    p_pct: 1.389,   note_en: '1 of 72 perm+AUF states', note_zh: '72 perm+AUF 中的 1',
      event_zhHant: 'PLL skip',
      note_zhHant: '72 perm+AUF 中的 1'
},
  { event_en: 'LL skip (OLL+PLL both)',         event_zh: 'LL skip',                 p: 1 / 15552, p_pct: 0.0064,  note_en: '~1 in 15.6k — career event for top cubers', note_zh: '约 1.5 万分之一 — 顶级 cuber 整个生涯几次',
      event_zhHant: 'LL skip',
      note_zhHant: '約 1.5 萬分之一 — 頂級 cuber 整個生涯幾次'
},
  { event_en: 'Sub-30-STM total (lucky scramble)', event_zh: '总步数 sub-30',        p: 0.02,      p_pct: 2.0,     note_en: 'optimal HTM ≤ 14 → ~1.5% of scrambles', note_zh: 'Optimal HTM ≤ 14 → ~1.5%',
      event_zhHant: '總步數 sub-30',
      note_zhHant: 'Optimal HTM ≤ 14 → ~1.5%'
},
];
