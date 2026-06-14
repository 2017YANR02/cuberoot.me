// 打乱分析「变体 + 阶段」的单一真源:变体 key → 显示名(zh/en)+ 规范展示顺序 +
// 每变体的规范阶段键序 + 阶段显示名。
//
// 共用方:首页 RecentScrambles / /scramble/stats / /scramble/gen / /scramble/analyzer
// (StageSolver + CFOP 枚举器)。新增变体/阶段只在这里加,别再各页写一份。
//
// 注:这些下拉按 `isZh ? 'zh' : 'en'` 取名(简体 / 英文双语)。

// 'block'(砖)是 UI 聚合方法:把数据层 4 个块变体(123/123x2/222/223)收进一个
// 方法下拉项,块的具体形状落到阶段下拉(122/123/222/223/F2B)。数据键不变。
export type ScrambleVariant =
  | 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair' | 'f2leo' | 'pseudo_f2leo'
  | 'block' | '123' | '123x2' | '222' | '223' | 'eoline' | 'dr' | 'htr' | 'htr2' | 'fr'
  | '333';

export interface VariantLabel { zh: string; en: string }

export const VARIANT_LABEL: Record<ScrambleVariant, VariantLabel> = {
  // 整解:整个 3x3 最优解(stats 难度 tab 的一个方法,阶段只有 '333' 自身)。
  '333': { zh: '333', en: '333' },
  std: { zh: '标准', en: 'Standard' },
  eo: { zh: 'EO', en: 'EO' },
  pair: { zh: '基态', en: 'Pair' },
  pseudo: { zh: '伪', en: 'Pseudo' },
  pseudo_pair: { zh: '伪基态', en: 'Pseudo Pair' },
  f2leo: { zh: 'F2LEO', en: 'F2LEO' },
  pseudo_f2leo: { zh: '伪 F2LEO', en: 'Pseudo F2LEO' },
  block: { zh: '砖', en: 'Block' },
  // 数据层块变体(不进方法下拉,留作 key 兜底显示)
  '123': { zh: '123', en: '123' },
  '123x2': { zh: 'F2B', en: 'F2B' },
  '222': { zh: '222', en: '222' },
  '223': { zh: '223', en: '223' },
  eoline: { zh: 'EOLine', en: 'EOLine' },
  dr: { zh: 'DR', en: 'DR' },
  // 条件式阶段(输入须已处于该视角 DR,否则 '-'):只进 StageSolver,不进 VARIANT_ORDER。
  htr: { zh: 'HTR', en: 'HTR' },
  // 条件式阶段(输入须已处于该视角 HTR,否则 '-',G3→solved):同样只进 StageSolver,不进 VARIANT_ORDER。
  htr2: { zh: 'HTR 收尾', en: 'HTR-finish' },
  // 条件式阶段(输入须已处于该视角 HTR,否则 '-',HTR→FR):同样只进 StageSolver,不进 VARIANT_ORDER。
  fr: { zh: 'Floppy 还原', en: 'Floppy Reduction' },
};

// 规范展示顺序(RecentScrambles / gen 下拉用;stats 按 distribution.json 键枚举序,不用这个)。
// 块族只出 'block' 一项。
export const VARIANT_ORDER: ScrambleVariant[] = [
  '333',
  'std', 'pseudo', 'pair', 'pseudo_pair', 'eo', 'f2leo', 'pseudo_f2leo',
  'block', 'eoline', 'dr',
];

// 数据层块变体集合 + 「block 方法的阶段/指标 → 底层数据变体」映射
// (键同时覆盖 distribution/recent_scrambles 的全名键与 gen comp_steps 的 b 前缀指标键)。
export const BLOCK_DATA_VARIANTS = ['123', '123x2', '222', '223'] as const;
export const isBlockVariant = (v: string): boolean =>
  (BLOCK_DATA_VARIANTS as readonly string[]).includes(v);
export const BLOCK_STAGE_VARIANT: Record<string, ScrambleVariant> = {
  fbsquare: '123', rouxs1: '123', block222: '222', block223: '223', f2b: '123x2',
  b122: '123', b123: '123', b222: '222', b223: '223', bf2b: '123x2',
};

/** 变体显示名;未知 key 回退原样。 */
export const variantLabel = (key: string, isZh: boolean): string => {
  const m = VARIANT_LABEL[key as ScrambleVariant];
  return m ? (isZh ? m.zh : m.en) : key;
};

// ── 阶段 ──────────────────────────────────────────────────────────────────
// 阶段键空间 = distribution.json 的 stage 键(cross/eo_xcross/block222…)
// ∪ recent_scrambles.json 的指标键(xc/xxc…)。变体前缀/后缀(eo_ / pseudo_ /
// f2leo_ / _pair / _pseudo_pair)一律去掉再显示 —— 变体名由方法下拉承担,
// 阶段下拉两页统一只显示 Cross / XCross / … / 块名。

const STAGE_BASE: Record<string, VariantLabel> = {
  // 整解:整个 3x3 的最优解步数(stats 页专属阶段,数据驱动;StageSolver/gen 不含)。
  '333': { zh: '333', en: '333' },
  cross: { zh: '十字', en: 'Cross' },
  xcross: { zh: 'XCross', en: 'XCross' },
  xxcross: { zh: 'XXCross', en: 'XXCross' },
  xxxcross: { zh: 'XXXCross', en: 'XXXCross' },
  xxxxcross: { zh: 'XXXXCross', en: 'XXXXCross' },
  // recent_scrambles.json 指标键别名
  xc: { zh: 'XCross', en: 'XCross' },
  xxc: { zh: 'XXCross', en: 'XXCross' },
  xxxc: { zh: 'XXXCross', en: 'XXXCross' },
  xxxxc: { zh: 'XXXXCross', en: 'XXXXCross' },
  // 旧 distribution 键别名
  f2l: { zh: 'XXXXCross', en: 'XXXXCross' },
  // 块族 / EO 族(中英同形;块名去乘号纯数字,f2b = first 2 blocks)
  block222: { zh: '222', en: '222' },
  fbsquare: { zh: '122', en: '122' },
  rouxs1: { zh: '123', en: '123' },
  block223: { zh: '223', en: '223' },
  f2b: { zh: 'F2B', en: 'F2B' },
  // gen comp_steps 的 b 前缀指标键别名
  b122: { zh: '122', en: '122' },
  b123: { zh: '123', en: '123' },
  b222: { zh: '222', en: '222' },
  b223: { zh: '223', en: '223' },
  bf2b: { zh: 'F2B', en: 'F2B' },
  beo: { zh: 'EO', en: 'EO' },
  beoline: { zh: 'EOLine', en: 'EOLine' },
  bdr: { zh: 'DR', en: 'DR' },
  eo: { zh: 'EO', en: 'EO' },
  eoline: { zh: 'EOLine', en: 'EOLine' },
  dr: { zh: 'DR', en: 'DR' },
  htr: { zh: 'HTR', en: 'HTR' },
  htr2: { zh: 'HTR 收尾', en: 'HTR-finish' },
  fr: { zh: 'Floppy 还原', en: 'Floppy Reduction' },
};

/** 阶段显示名:剥变体前缀/后缀后查表;未知 key 回退原样。 */
export const stageLabel = (key: string, isZh: boolean): string => {
  const base = key
    .replace(/^(pseudo_f2leo|f2leo|pseudo|eo)_/, '')
    .replace(/_(pseudo_pair|pair)$/, '');
  const m = STAGE_BASE[base];
  return m ? (isZh ? m.zh : m.en) : key;
};

// 每个变体的规范阶段键序。StageSolver 的 WASM 阶段索引 i ↔ VARIANT_STAGES[v][i];
// stats 页数据驱动(JSON 自带 stages 数组,是这里的子集),只共享 stageLabel。
export const VARIANT_STAGES: Record<ScrambleVariant, string[]> = {
  // 整解只有一个「阶段」= 整解本身;在 VARIANT_ORDER(首页+stats 方法下拉),但 gen 手动排除(无求解引擎)。
  '333': ['333'],
  std: ['cross', 'xcross', 'xxcross', 'xxxcross', 'xxxxcross'],
  eo: ['eo_cross', 'eo_xcross', 'eo_xxcross', 'eo_xxxcross', 'eo_xxxxcross'],
  pair: ['cross_pair', 'xcross_pair', 'xxcross_pair', 'xxxcross_pair'],
  pseudo: ['pseudo_cross', 'pseudo_xcross', 'pseudo_xxcross', 'pseudo_xxxcross'],
  pseudo_pair: ['pseudo_cross_pseudo_pair', 'pseudo_xcross_pseudo_pair', 'pseudo_xxcross_pseudo_pair', 'pseudo_xxxcross_pseudo_pair'],
  f2leo: ['f2leo_cross', 'f2leo_xcross', 'f2leo_xxcross', 'f2leo_xxxcross'],
  pseudo_f2leo: ['pseudo_f2leo_cross', 'pseudo_f2leo_xcross', 'pseudo_f2leo_xxcross', 'pseudo_f2leo_xxxcross'],
  // 聚合方法「砖」:阶段序恰好与 Roux223SolverWasm 的阶段 id 0..4 一一对应。
  block: ['fbsquare', 'rouxs1', 'block222', 'block223', 'f2b'],
  '123': ['fbsquare', 'rouxs1', 'f2b'],
  '123x2': ['f2b'],
  '222': ['block222'],
  '223': ['block222', 'block223'],
  eoline: ['eo', 'eoline'],
  dr: ['dr'],
  htr: ['htr'],
  htr2: ['htr2'],
  fr: ['fr'],
};
