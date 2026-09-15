/** Curated bilingual reports, preserving the rankings at the time of each report. */
interface RecordNews {
  event: string;
  round?: number;
  person: string;
  country: string;
  /** Bark copy snapshot with the competition suffix removed; keep report-time ranks. */
  message: { zh: string; en: string };
  results: {
    text: { zh: string; en: string };
    tag: string;
    rank?: number;
    plural?: boolean;
  }[];
}

export const COMP_RECORD_NEWS: Partial<Record<string, RecordNews[]>> = {
  WuhanGoldenAutumn2026: [
    {
      event: '777', person: 'Ziyu Wu (吴子钰)', country: 'CN',
      message: {
        zh: '纪录快讯! 1:39.32七阶魔方平均亚洲纪录AsR/WR3 吴子钰🇨🇳',
        en: 'Breaking News! 1:39.32 7x7 AsR/WR3 Mean Ziyu Wu🇨🇳',
      },
      results: [{ text: { zh: '1:39.32 七阶魔方平均亚洲纪录', en: '1:39.32 7x7 Mean' }, tag: 'AsR', rank: 3 }],
    },
    {
      event: '444', person: 'Xuanyi Geng (耿暄一)', country: 'CN',
      message: {
        zh: '纪录快讯! 27.63四阶魔方平均新人世界纪录NWR 耿暄一🇨🇳| 25.81单次个人纪录PR',
        en: 'Breaking News! 27.63 4x4 Newcomer WR Avg Xuanyi Geng🇨🇳| 25.81 PR Single',
      },
      results: [
        { text: { zh: '27.63 四阶魔方平均新人世界纪录', en: '27.63 4x4 Newcomer WR Avg' }, tag: 'NWR' },
        { text: { zh: '25.81 单次个人纪录', en: '25.81 Single' }, tag: 'PR' },
      ],
    },
  ],
  WuhanCrimsonAutumn2026: [
    {
      event: '333bf', person: 'Yifan Wang (王逸帆)', country: 'CN',
      message: {
        zh: '纪录快讯! 15.80三盲平均亚洲纪录AsR/WR6 王逸帆🇨🇳',
        en: 'Breaking News! 15.80 3BLD AsR/WR6 Avg Yifan Wang🇨🇳',
      },
      results: [{ text: { zh: '15.80 三盲平均亚洲纪录', en: '15.80 3BLD Avg' }, tag: 'AsR', rank: 6 }],
    },
    {
      event: '333', round: 3, person: 'Yunzhi Lian (连允之)', country: 'CN',
      message: {
        zh: '纪录快讯! 4.52三阶魔方平均女子世界纪录FWR/WR10 连允之🇨🇳| 3.54单次个人纪录PR/WR17',
        en: 'BREAKING NEWS! 4.52 3x3 FWR/WR10 Avg Yunzhi Lian🇨🇳| 3.54 PR/WR17 Single',
      },
      results: [
        { text: { zh: '4.52 三阶魔方平均女子世界纪录', en: '4.52 3x3 Avg' }, tag: 'FWR', rank: 10 },
        { text: { zh: '3.54 单次个人纪录', en: '3.54 Single' }, tag: 'PR', rank: 17 },
      ],
    },
    {
      event: '333', person: 'Yi Shen (沈懿)', country: 'CN',
      message: {
        zh: 'PR快讯! 4.24三阶魔方平均个人纪录PR/WR3 沈懿🇨🇳',
        en: 'PR News! 4.24 3x3 PR/WR3 Avg Yi Shen🇨🇳',
      },
      results: [{ text: { zh: '4.24 三阶魔方平均个人纪录', en: '4.24 3x3 Avg' }, tag: 'PR', rank: 3 }],
    },
    {
      event: '333oh', person: 'Xuanyi Geng (耿暄一)', country: 'CN',
      message: {
        zh: 'PR快讯! 13.30单次, 17.64平均三阶魔方单手双个人纪录PR 耿暄一🇨🇳',
        en: 'PR News! 13.30 Single, 17.64 Avg OH Double PRs Xuanyi Geng🇨🇳',
      },
      results: [{ text: { zh: '13.30 单次，17.64 平均三阶魔方单手双个人纪录', en: '13.30 Single, 17.64 Avg OH Double' }, tag: 'PR', plural: true }],
    },
    {
      event: '333', round: 2, person: 'Yunzhi Lian (连允之)', country: 'CN',
      message: {
        zh: 'PR快讯! 4.89三阶魔方平均个人纪录PR/WR16 连允之🇨🇳',
        en: 'PR News! 4.89 3x3 PR/WR16 Avg Yunzhi Lian🇨🇳',
      },
      results: [{ text: { zh: '4.89 三阶魔方平均个人纪录', en: '4.89 3x3 Avg' }, tag: 'PR', rank: 16 }],
    },
  ],
};
