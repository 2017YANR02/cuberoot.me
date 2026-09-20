export interface AlgComboTypeInfo {
  code: string;
  fullName: { zh: string; en: string };
  documentedBySource: boolean;
}

/**
 * 1LLL 原表的公式叠加类型。
 *
 * 前 13 项来自原表 README 的 `Combo alg type` 图例；最后 5 项虽出现在
 * `Type` 列中，但原表没有定义全称，因此只按对应公式的实际结构描述。
 */
export const ALG_COMBO_TYPES: readonly AlgComboTypeInfo[] = [
  {
    code: 'CC',
    fullName: { zh: '共轭换位子（Conjugate Commutator）', en: 'Conjugate Commutator' },
    documentedBySource: true,
  },
  {
    code: 'OO',
    fullName: {
      zh: '顶层朝向 + 顶层朝向（OLL + OLL）',
      en: 'Orientation of the Last Layer + Orientation of the Last Layer',
    },
    documentedBySource: true,
  },
  {
    code: 'OP',
    fullName: {
      zh: '顶层朝向 + 顶层排列（OLL + PLL）',
      en: 'Orientation of the Last Layer + Permutation of the Last Layer',
    },
    documentedBySource: true,
  },
  {
    code: 'PO',
    fullName: {
      zh: '顶层排列 + 顶层朝向（PLL + OLL）',
      en: 'Permutation of the Last Layer + Orientation of the Last Layer',
    },
    documentedBySource: true,
  },
  {
    code: 'WW',
    fullName: {
      zh: '冬日变奏曲 + 冬日变奏曲（Winter Variation + Winter Variation）',
      en: 'Winter Variation + Winter Variation',
    },
    documentedBySource: true,
  },
  {
    code: 'FW',
    fullName: {
      zh: '前两层 + 冬日变奏曲（F2L + Winter Variation）',
      en: 'First Two Layers + Winter Variation',
    },
    documentedBySource: true,
  },
  {
    code: 'FZ',
    fullName: {
      zh: '前两层 + Zborowski-Bruchem 末槽（F2L + ZBLS）',
      en: 'First Two Layers + Zborowski-Bruchem Last Slot',
    },
    documentedBySource: true,
  },
  {
    code: 'ZZ',
    fullName: {
      zh: '两个 Zborowski-Bruchem 末槽公式叠加（ZBLS + ZBLS）',
      en: 'Zborowski-Bruchem Last Slot + Zborowski-Bruchem Last Slot',
    },
    documentedBySource: true,
  },
  {
    code: 'OI',
    fullName: {
      zh: '带插入的顶层朝向（OLL with Insertion）',
      en: 'Orientation of the Last Layer with Insertion',
    },
    documentedBySource: true,
  },
  {
    code: 'PI',
    fullName: {
      zh: '带插入的顶层排列（PLL with Insertion）',
      en: 'Permutation of the Last Layer with Insertion',
    },
    documentedBySource: true,
  },
  {
    code: 'OS',
    fullName: {
      zh: '转化为顶层朝向（Setup to OLL）',
      en: 'Setup to Orientation of the Last Layer',
    },
    documentedBySource: true,
  },
  {
    code: 'PS',
    fullName: {
      zh: '转化为顶层排列（Setup to PLL）',
      en: 'Setup to Permutation of the Last Layer',
    },
    documentedBySource: true,
  },
  {
    code: 'TR',
    fullName: { zh: '触发器组合（Triggers）', en: 'Triggers' },
    documentedBySource: true,
  },
  {
    code: 'MU',
    fullName: { zh: 'M/U 层转动（M/U Moves）', en: 'M/U Moves' },
    documentedBySource: false,
  },
  {
    code: 'S',
    fullName: { zh: 'S 中层转动（S-Slice Sequence）', en: 'S-Slice Sequence' },
    documentedBySource: false,
  },
  {
    code: 'SM',
    fullName: { zh: 'S 中层 + M/U 层转动（S-Slice + M/U Moves）', en: 'S-Slice + M/U Moves' },
    documentedBySource: false,
  },
  {
    code: 'SO',
    fullName: {
      zh: 'S 中层 + 顶层朝向（S-Slice + OLL）',
      en: 'S-Slice + Orientation of the Last Layer',
    },
    documentedBySource: false,
  },
  {
    code: '?',
    fullName: { zh: '未分类（Unclassified）', en: 'Unclassified' },
    documentedBySource: false,
  },
] as const;

export function algComboTypeInfo(code: string): AlgComboTypeInfo | undefined {
  return ALG_COMBO_TYPES.find(type => type.code === code);
}

export function algComboTypeAnchor(code: string): string {
  return code === '?' ? 'unclassified' : code.toLowerCase();
}

export function algComboTypeHref(code: string): string {
  return `/alg/combo-types#${algComboTypeAnchor(code)}`;
}
