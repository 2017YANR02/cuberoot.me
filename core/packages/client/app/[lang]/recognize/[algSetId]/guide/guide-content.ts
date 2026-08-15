export type GuideSetId = 'pll' | 'oll';

export type BilingualText = { zh: string; en: string };

export interface RecognitionGuideSpec {
  id: GuideSetId;
  caseCount: number;
  title: BilingualText;
  seoDescription: BilingualText;
  kicker: BilingualText;
  intro: BilingualText;
  steps: Array<{ title: BilingualText; body: BilingualText }>;
  simplifiedNote: BilingualText;
  groupOrder: string[];
  reference: {
    title: BilingualText;
    intro: BilingualText;
    items: Array<{ term: string; label: BilingualText }>;
  };
}

export const SQ1_SHAPE_GUIDE = {
  caseCount: 29,
  title: { zh: 'Square-1 形状名称', en: 'Square-1 Shape Names' },
  seoDescription: {
    zh: '认识 Square-1 的 29 种单层形状，并通过单层图形练习形状命名。',
    en: 'Learn the 29 single-layer Square-1 shapes, then practise naming them from their silhouettes.',
  },
  kicker: { zh: '单层形状速查', en: 'Single-layer shape guide' },
  intro: {
    zh: 'CS 情况由“顶层 / 底层”两个形状组成。先单独记住这 29 种单层形状，再进入训练练习命名。',
    en: 'Each CS case combines a top and bottom shape. Learn these 29 single-layer shapes first, then practise naming them in the drill.',
  },
  libraryTitle: { zh: '29 种单层形状', en: '29 single-layer shapes' },
  libraryNote: {
    zh: '名称与 CS 公式库保持一致；同一形状只展示一次。',
    en: 'Names match the CS algorithm library, with each shape shown once.',
  },
} satisfies Record<string, number | BilingualText>;

export const RECOGNITION_GUIDES: Record<GuideSetId, RecognitionGuideSpec> = {
  pll: {
    id: 'pll',
    caseCount: 21,
    title: { zh: 'PLL 识别指南', en: 'PLL Recognition Guide' },
    seoDescription: {
      zh: '用简化特征图学习 21 个 PLL 情况：先找连色条和灯眼，再用任意两个相邻面的颜色关系确认。',
      en: 'Learn all 21 PLL cases with simplified feature diagrams: find bars and headlights, then confirm from any two adjacent faces.',
    },
    kicker: { zh: '任意两面即可确定', en: 'Two faces are enough' },
    intro: {
      zh: '先找连色条、灯眼和对色关系，再用相邻两面的颜色顺序确认。原文档中的大图在这里变成“简化图”，只留下真正参与判断的贴纸。',
      en: 'Find bars, headlights, and opposite-colour relationships first, then confirm the colour order across two adjacent faces. The large diagrams from the original guide become simplified views here, retaining only the stickers that carry recognition information.',
    },
    steps: [
      {
        title: { zh: '找主特征', en: 'Find the anchor' },
        body: {
          zh: '先扫连色条和灯眼，它们能把 21 个情况快速缩小到少数候选。',
          en: 'Scan for bars and headlights first; they reduce the 21 cases to a short candidate list.',
        },
      },
      {
        title: { zh: '锁定观察面', en: 'Fix your viewing faces' },
        body: {
          zh: 'OLL 结束时优先读正面与左侧或右侧相邻面，不必转完四面。',
          en: 'As OLL ends, read the front plus its left or right neighbour instead of rotating through all four faces.',
        },
      },
      {
        title: { zh: '用颜色关系确认', en: 'Confirm colour relations' },
        body: {
          zh: '比较贴纸是同色、对色还是邻色，用来区分外形相近的 G、R、N 等情况。',
          en: 'Compare whether stickers match, oppose, or sit next to one another to separate similar G, R, and N cases.',
        },
      },
    ],
    simplifiedNote: {
      zh: '简化图保留顶层颜色和最强的连色、成对与对色特征。关闭后可核对完整贴纸。',
      en: 'Simplified view keeps the last-layer colour plus the strongest bars, pairs, and opposite-colour cues. Turn it off to check every sticker.',
    },
    reference: {
      title: { zh: '两面识别特征词', en: 'Two-side feature vocabulary' },
      intro: {
        zh: '原文档用这些短词标注 70 种不重复的相邻两面观察。Na、Nb、E、Y、V 属于较难的一组；不确定时补看第三面即可。',
        en: 'The original guide uses these terms for its 70 unique adjacent two-face views. Na, Nb, E, Y, and V are the harder group; use a third face when needed.',
      },
      items: [
        { term: 'line', label: { zh: '一字', en: 'line' } },
        { term: 'inner bar', label: { zh: '内侧连色', en: 'inner bar' } },
        { term: 'outer bar', label: { zh: '外侧连色', en: 'outer bar' } },
        { term: 'glow stick', label: { zh: '荧光棒', en: 'glow stick' } },
        { term: 'opp line', label: { zh: '对色一字', en: 'opposite line' } },
        { term: 'adj line', label: { zh: '邻色一字', en: 'adjacent line' } },
        { term: 'light', label: { zh: '灯眼', en: 'headlights' } },
        { term: '6X / 4X', label: { zh: '六叉 / 四叉', en: 'six-cross / four-cross' } },
        { term: 'bookend', label: { zh: '书挡', en: 'bookend' } },
        { term: 'inner opp bar', label: { zh: '内侧对色条', en: 'inner opposite bar' } },
        { term: 'outer opp bar', label: { zh: '外侧对色条', en: 'outer opposite bar' } },
      ],
    },
    groupOrder: ['EPLL', 'Adj Swap', 'Opp Swap'],
  },
  oll: {
    id: 'oll',
    caseCount: 57,
    title: { zh: 'OLL 识别指南', en: 'OLL Recognition Guide' },
    seoDescription: {
      zh: '用简化特征图学习 57 个 OLL 情况：先认顶面形状，再用至多两个相邻侧面的黄色贴纸确认。',
      en: 'Learn all 57 OLL cases with simplified feature diagrams: read the top shape, then confirm with yellow stickers on at most two adjacent sides.',
    },
    kicker: { zh: '顶面加至多两个相邻侧面', en: 'Top plus at most two adjacent sides' },
    intro: {
      zh: 'OLL 不需要绕魔方看一圈。先用顶面黄色图形确定形状家族，再读取至多两个相邻侧面的黄色贴纸位置，就能唯一确定情况。',
      en: 'You do not need to look around the entire cube for OLL. Identify the top yellow shape first, then read yellow-sticker positions on at most two adjacent sides to determine the case uniquely.',
    },
    steps: [
      {
        title: { zh: '先认顶面形状', en: 'Read the top shape' },
        body: {
          zh: '先分点、线、L、闪电、方形等家族，不急着数每一块侧面贴纸。',
          en: 'Classify the dot, line, L, lightning, square, or other top shape before counting side stickers.',
        },
      },
      {
        title: { zh: '再看相邻两面', en: 'Check two adjacent sides' },
        body: {
          zh: '只读取顶层黄色贴纸在相邻侧面的落点，忽略与判断无关的颜色。',
          en: 'Read where last-layer yellow stickers land on two neighbouring sides and ignore colours that do not affect the decision.',
        },
      },
      {
        title: { zh: '固定起手方向', en: 'Fix the starting angle' },
        body: {
          zh: '用突出块或空缺块确定公式朝向，减少识别正确但起手方向错误。',
          en: 'Use the protruding or missing feature to fix the algorithm angle and avoid correct recognition from the wrong start.',
        },
      },
    ],
    simplifiedNote: {
      zh: '简化图保留顶面黄色和侧面最有区分度的黄色落点。关闭后可核对完整图案。',
      en: 'Simplified view keeps the yellow top and the most distinctive yellow side placements. Turn it off to inspect the full pattern.',
    },
    reference: {
      title: { zh: '原文档的形状路线', en: 'Shape path from the original guide' },
      intro: {
        zh: '文档先分大形状，再看相邻侧面的黄贴落点。网页仍用公式库的常见分类列出 57 个情况，但观察顺序保持一致。',
        en: 'The document starts from the broad top shape, then reads yellow placements on adjacent sides. The page lists all 57 cases using the library’s familiar groups while preserving that recognition order.',
      },
      items: [
        { term: 'C4 / C2', label: { zh: '四重或二重对称', en: 'fourfold or twofold symmetry' } },
        { term: 'OELL', label: { zh: '只翻棱', en: 'edges only' } },
        { term: 'OCLL', label: { zh: '只翻角', en: 'corners only' } },
        { term: 'Dot', label: { zh: '点形', en: 'dot family' } },
        { term: 'H / Pi / U / T / L / S', label: { zh: '按顶面轮廓继续细分', en: 'refine by the top silhouette' } },
      ],
    },
    groupOrder: [
      'OCLL',
      'T Shapes',
      'Square Shapes',
      'C Shapes',
      'W Shapes',
      'P Shapes',
      'Fish Shapes',
      'Knight Move Shapes',
      'Lightning Shapes',
      'Line Shapes',
      'L Shapes',
      'Awkward Shapes',
      'Dot Case',
      'All Corners Oriented',
    ],
  },
};

const GROUP_LABELS: Record<string, BilingualText> = {
  EPLL: { zh: '只换棱 EPLL', en: 'Edges only: EPLL' },
  'Adj Swap': { zh: '邻位交换', en: 'Adjacent swaps' },
  'Opp Swap': { zh: '对位交换', en: 'Opposite swaps' },
  OCLL: { zh: 'OCLL 只看角块', en: 'OCLL: corners only' },
  'All Corners Oriented': { zh: '角块均已朝向', en: 'All corners oriented' },
  'Awkward Shapes': { zh: '不规则形', en: 'Awkward shapes' },
  'C Shapes': { zh: 'C 形', en: 'C shapes' },
  'Dot Case': { zh: '点形', en: 'Dot cases' },
  'Fish Shapes': { zh: '鱼形', en: 'Fish shapes' },
  'Knight Move Shapes': { zh: '马步形', en: 'Knight-move shapes' },
  'L Shapes': { zh: 'L 形', en: 'L shapes' },
  'Lightning Shapes': { zh: '闪电形', en: 'Lightning shapes' },
  'Line Shapes': { zh: '一字形', en: 'Line shapes' },
  'P Shapes': { zh: 'P 形', en: 'P shapes' },
  'Square Shapes': { zh: '方形', en: 'Square shapes' },
  'T Shapes': { zh: 'T 形', en: 'T shapes' },
  'W Shapes': { zh: 'W 形', en: 'W shapes' },
};

export function guideGroupLabel(group: string): BilingualText {
  return GROUP_LABELS[group] ?? { zh: group, en: group };
}

export function isGuideSetId(value: string): value is GuideSetId {
  return value === 'pll' || value === 'oll';
}
