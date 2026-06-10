// 打乱分析「变体」的单一真源:变体 key → 显示名(zh/en)+ 规范展示顺序。
//
// 三处下拉共用它,别再各写一份(首页 RecentScrambles / /scramble/stats / /scramble/gen
// 的 TNoodleMode)。新增变体只在这里加一行。
//
// 注:这些下拉按 `isZh ? 'zh' : 'en'` 取名(zh-Hant 也落简体,与历史一致),故不带 zhHant;
// 阶段/指标标签是各页自有概念(stats 的 cross/eo_cross… 全矩阵、gen 的 b122/bf2b… 指标键),
// 不在此共享。

export type ScrambleVariant =
  | 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair' | 'f2leo' | 'pseudo_f2leo'
  | '123' | '123x2' | '222' | '223' | 'eoline' | 'dr';

export interface VariantLabel { zh: string; en: string }

export const VARIANT_LABEL: Record<ScrambleVariant, VariantLabel> = {
  std: { zh: '标准', en: 'Standard' },
  eo: { zh: 'EO', en: 'EO' },
  pair: { zh: '基态', en: 'Pair' },
  pseudo: { zh: '伪', en: 'Pseudo' },
  pseudo_pair: { zh: '伪基态', en: 'Pseudo Pair' },
  f2leo: { zh: 'F2LEO', en: 'F2LEO' },
  pseudo_f2leo: { zh: '伪 F2LEO', en: 'Pseudo F2LEO' },
  '123': { zh: '1x2x3', en: '1x2x3' },
  '123x2': { zh: '1x2x3 x2', en: '1x2x3 x2' },
  '222': { zh: '2x2x2', en: '2x2x2' },
  '223': { zh: '2x2x3', en: '2x2x3' },
  eoline: { zh: 'EOLine', en: 'EOLine' },
  dr: { zh: 'DR', en: 'DR' },
};

// 规范展示顺序(RecentScrambles / gen 下拉用;stats 按 distribution.json 键枚举序,不用这个)。
export const VARIANT_ORDER: ScrambleVariant[] = [
  'std', 'pseudo', 'pair', 'pseudo_pair', 'eo', 'f2leo', 'pseudo_f2leo',
  '123', '123x2', '222', '223', 'eoline', 'dr',
];

/** 变体显示名;未知 key 回退原样。 */
export const variantLabel = (key: string, isZh: boolean): string => {
  const m = VARIANT_LABEL[key as ScrambleVariant];
  return m ? (isZh ? m.zh : m.en) : key;
};
