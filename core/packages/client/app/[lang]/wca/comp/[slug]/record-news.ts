import { eventDisplayName } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { countryToIso2 } from '@/lib/country-flags';

export interface NewcomerRecord {
  eventId: string;
  roundId: string;
  personNumber: number;
  type: 'single' | 'average';
  source: '1st-solve' | '1st-comp';
  value: number;
}

/** Apply only exact, positive record matches; never change the upstream payload. */
export function withNewcomerRecords<T extends {
  e: string; r: string; n: number; b: number; a: number; sr: string; ar: string | number;
}>(rows: Record<string, T[]>, records: readonly NewcomerRecord[] = []): Record<string, T[]> {
  if (!records.length) return rows;
  return Object.fromEntries(Object.entries(rows).map(([key, results]) => [key, results.map(result => {
    const matches = records.filter(record => record.eventId === result.e && record.roundId === result.r
      && record.personNumber === result.n && Number.isSafeInteger(record.value) && record.value > 0);
    const single = matches.some(record => record.type === 'single' && record.value === result.b);
    const average = matches.some(record => record.type === 'average' && record.value === result.a);
    if (!single && !average) return result;
    return { ...result,
      sr: single && (!result.sr || result.sr === 'PR') ? 'NWR' : result.sr,
      ar: average && (!result.ar || result.ar === 'PR') ? 'NWR' : result.ar,
    };
  })]));
}

/** Curated bilingual reports, preserving the rankings at the time of each report. */
interface RecordNews {
  event: string;
  round?: number;
  newcomerSource?: NewcomerRecord['source'];
  newcomerType?: NewcomerRecord['type'];
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
        zh: `纪录快讯! 1:39.32${eventDisplayName('777', true)}平均亚洲纪录AsR/WR3 吴子钰🇨🇳`,
        en: 'Breaking News! 1:39.32 7x7 AsR/WR3 Mean Ziyu Wu🇨🇳',
      },
      results: [{ text: { zh: `1:39.32 ${eventDisplayName('777', true)}平均亚洲纪录`, en: '1:39.32 7x7 Mean' }, tag: 'AsR', rank: 3 }],
    },
    {
      event: '444', person: 'Xuanyi Geng (耿暄一)', country: 'CN',
      newcomerSource: '1st-comp',
      newcomerType: 'average',
      message: {
        zh: `纪录快讯! 27.63${eventDisplayName('444', true)}平均新人世界纪录（首场比赛）NWR 耿暄一🇨🇳| 25.81单次个人纪录PR`,
        en: 'Breaking News! 27.63 4x4 Newcomer WR (1st competition) NWR Avg Xuanyi Geng🇨🇳| 25.81 PR Single',
      },
      results: [
        { text: { zh: `27.63 ${eventDisplayName('444', true)}平均新人世界纪录（首场比赛）`, en: '27.63 4x4 Newcomer WR Avg (1st competition)' }, tag: 'NWR' },
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
        zh: `纪录快讯! 4.52${eventDisplayName('333', true)}平均女子世界纪录FWR/WR10 连允之🇨🇳| 3.54单次个人纪录PR/WR17`,
        en: 'BREAKING NEWS! 4.52 3x3 FWR/WR10 Avg Yunzhi Lian🇨🇳| 3.54 PR/WR17 Single',
      },
      results: [
        { text: { zh: `4.52 ${eventDisplayName('333', true)}平均女子世界纪录`, en: '4.52 3x3 Avg' }, tag: 'FWR', rank: 10 },
        { text: { zh: '3.54 单次个人纪录', en: '3.54 Single' }, tag: 'PR', rank: 17 },
      ],
    },
    {
      event: '333', person: 'Yi Shen (沈懿)', country: 'CN',
      message: {
        zh: `PR快讯! 4.24${eventDisplayName('333', true)}平均个人纪录PR/WR3 沈懿🇨🇳`,
        en: 'PR News! 4.24 3x3 PR/WR3 Avg Yi Shen🇨🇳',
      },
      results: [{ text: { zh: `4.24 ${eventDisplayName('333', true)}平均个人纪录`, en: '4.24 3x3 Avg' }, tag: 'PR', rank: 3 }],
    },
    {
      event: '333oh', person: 'Xuanyi Geng (耿暄一)', country: 'CN',
      message: {
        zh: `PR快讯! 13.30单次, 17.64平均${eventDisplayName('333oh', true)}双个人纪录PR 耿暄一🇨🇳`,
        en: 'PR News! 13.30 Single, 17.64 Avg OH Double PRs Xuanyi Geng🇨🇳',
      },
      results: [{ text: { zh: `13.30 单次，17.64 平均${eventDisplayName('333oh', true)}双个人纪录`, en: '13.30 Single, 17.64 Avg OH Double' }, tag: 'PR', plural: true }],
    },
    {
      event: '333', round: 2, person: 'Yunzhi Lian (连允之)', country: 'CN',
      message: {
        zh: `PR快讯! 4.89${eventDisplayName('333', true)}平均个人纪录PR/WR16 连允之🇨🇳`,
        en: 'PR News! 4.89 3x3 PR/WR16 Avg Yunzhi Lian🇨🇳',
      },
      results: [{ text: { zh: `4.89 ${eventDisplayName('333', true)}平均个人纪录`, en: '4.89 3x3 Avg' }, tag: 'PR', rank: 16 }],
    },
  ],
};

interface CompetitionRecord {
  ev: { i: string };
  res: { n: number };
  roundId: string;
  type: 'single' | 'average';
  tag: string;
  value: number;
}

/** Preserve report-time copy and fill every competition from its actual records. */
export function competitionRecordNews(slug: string, records: NewcomerRecord[],
  users: Record<string, { name: string; region: string; countryId?: string }>,
  events: { i: string; rs: { i: string }[] }[], competitionRecords: CompetitionRecord[] = []): RecordNews[] {
  const news = [...(COMP_RECORD_NEWS[slug] ?? [])];
  const labels: Record<string, string> = { WR: '世界纪录', FWR: '女子世界纪录', NR: '国家纪录', AsR: '亚洲纪录', ER: '欧洲纪录', NAR: '北美洲纪录', SAR: '南美洲纪录', AfR: '非洲纪录', OcR: '大洋洲纪录', CR: '洲际纪录' };
  for (const record of competitionRecords) {
    const user = users[String(record.res.n)];
    if (!user || !labels[record.tag] || !Number.isSafeInteger(record.value) || record.value <= 0) continue;
    const value = formatWcaResult(record.value, record.ev.i, record.type);
    const roundIndex = events.find(event => event.i === record.ev.i)?.rs.findIndex(round => round.i === record.roundId) ?? -1;
    if (news.some(row => row.event === record.ev.i && row.person === user.name
      && row.results.some(result => result.tag === record.tag && result.text.en.startsWith(`${value} `)))) continue;
    const type = { single: { zh: '单次', en: 'Single' }, average: { zh: '平均', en: 'Avg' } }[record.type];
    const text = {
      zh: `${value} ${eventDisplayName(record.ev.i, true)}${type.zh}${labels[record.tag]}`,
      en: `${value} ${eventDisplayName(record.ev.i, false)} ${type.en}`,
    };
    news.push({
      event: record.ev.i, round: roundIndex >= 0 ? roundIndex + 1 : undefined,
      person: user.name, country: countryToIso2(user.countryId || user.region),
      message: { zh: `纪录快讯! ${text.zh} ${record.tag} ${displayCuberName(user.name, true)}`, en: `Breaking News! ${text.en} ${record.tag} ${displayCuberName(user.name, false)}` },
      results: [{ text, tag: record.tag }],
    });
  }
  for (const record of records) {
    const user = users[String(record.personNumber)];
    if (!user || !Number.isSafeInteger(record.value) || record.value <= 0) continue;
    if (news.some(row => row.event === record.eventId && row.newcomerSource === record.source
      && row.newcomerType === record.type && row.person === user.name)) continue;
    const value = formatWcaResult(record.value, record.eventId, record.type);
    const source = { '1st-solve': { zh: '首次还原', en: '1st solve' }, '1st-comp': { zh: '首场比赛', en: '1st competition' } }[record.source];
    if (!source) continue;
    const type = { single: { zh: '单次', en: 'Single' }, average: { zh: '平均', en: 'Avg' } }[record.type];
    if (!type) continue;
    const text = {
      zh: `${value} ${eventDisplayName(record.eventId, true)}${type.zh}新人世界纪录（${source.zh}）`,
      en: `${value} ${eventDisplayName(record.eventId, false)} Newcomer WR ${type.en} (${source.en})`,
    };
    const roundIndex = events.find(event => event.i === record.eventId)?.rs.findIndex(round => round.i === record.roundId) ?? -1;
    news.push({
      event: record.eventId, round: roundIndex >= 0 ? roundIndex + 1 : undefined,
      person: user.name, country: user.countryId || user.region, newcomerSource: record.source, newcomerType: record.type,
      message: { zh: `纪录快讯! ${text.zh} NWR ${displayCuberName(user.name, true)}`, en: `Breaking News! ${text.en} NWR ${displayCuberName(user.name, false)}` },
      results: [{ text, tag: 'NWR' }],
    });
  }
  return news;
}
