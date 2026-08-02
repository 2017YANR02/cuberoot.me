/**
 * 地区纪录判定(WR / CR / NR)+「日掩」— 直播中、WCA 公示前的成绩标记。
 *
 * 服务端 enrichComp 已按同样规则给 resultsByRound 填好 sr/ar/sk/ak;这里是 client 侧的
 * 同款实现,只给 WS 实时推送的新成绩用(它们还没经过服务端 enrich)。两处必须同步改。
 *
 * 「日掩」(keatoned):成绩够到了某级地区纪录,但同一日历日已有更快的,按 WCA Reg 9i2
 * 「同日只认最好」不予认定。词源是 2015-11-21 River Hill Fall 2015,Keaton Ellis 的 5.09
 * 破了当时 5.25 的 WR,却被同场同日 Lucas Etter 的 4.90 抹掉 —— 官方记录里那条什么标记都没有。
 */

import { formatWcaResult } from './wca-format-result';
import { displayCuberName } from './cuber-name-display';
import { tr } from '@/i18n/tr';

export interface KeatonedInfo {
  level: string;        // 被掩掉的级别:WR / CR / NR
  byValue: number;      // 当日压过它的成绩
  byComp: string;       // 那场比赛的 WCA id
  byCompName: string;
  byPerson: string;
  byPersonIso2: string;
}

export interface DayBestEntry {
  value: number;
  comp: string;
  compName: string;
  person: string;
  personIso2: string;
}

export interface DayBestSnapshot {
  wr?: Record<string, DayBestEntry>;
  cr?: Record<string, DayBestEntry>;
  nr?: Record<string, DayBestEntry>;
}

/** 服务端下发的纪录快照:赛前基线 + 同日已达成的最好成绩。 */
export interface RecordsSnapshot {
  wr?: Record<string, number>;
  cr?: Record<string, number>;
  nr?: Record<string, number>;
  day?: DayBestSnapshot;
}

export interface JudgedRecord {
  tag: 'WR' | 'CR' | 'NR' | '';
  keatoned: KeatonedInfo | null;
  /** 掩掉这条成绩的那几条同日成绩(每个被掩级别一条,按人 + 场去重)。
   *  client 专用附加输出,服务端 judgeByDay 不需要:用来把这些「官方 dump 里还没有」的
   *  更快成绩并进世界/全国名次,见 lib/comp-live-rank 的 applyDayRankDelta。 */
  keatonedBy: DayBestEntry[];
}

const NONE: JudgedRecord = { tag: '', keatoned: null, keatonedBy: [] };

interface JudgeUser {
  continentId?: string;
  countryId?: string;
}

/**
 * 从高到低走 WR → CR → NR:
 *   够不着这一级        → 试下一级
 *   够得着但当日有更快的 → 「日掩」(只记最高的那一级),继续试下一级
 *   够得着且是当日最好   → 定级返回(并列同值也算,Reg 9i1a)
 * 无 day 数据时退化成原行为(只比赛前基线)。
 */
export function judgeRecordTag(
  value: number,
  eventId: string,
  isAvg: boolean,
  user: JudgeUser | undefined,
  snap: RecordsSnapshot | undefined,
): JudgedRecord {
  if (!snap || !value || value <= 0) return NONE;
  const k = `${eventId}|${isAvg ? '1' : '0'}`;
  const scopes: { level: 'WR' | 'CR' | 'NR'; baseline?: number; winner?: DayBestEntry }[] = [
    { level: 'WR', baseline: snap.wr?.[k], winner: snap.day?.wr?.[k] },
  ];
  if (user?.continentId) {
    const ck = `${k}|${user.continentId}`;
    scopes.push({ level: 'CR', baseline: snap.cr?.[ck], winner: snap.day?.cr?.[ck] });
  }
  if (user?.countryId) {
    const nk = `${k}|${user.countryId}`;
    scopes.push({ level: 'NR', baseline: snap.nr?.[nk], winner: snap.day?.nr?.[nk] });
  }

  let keatoned: KeatonedInfo | null = null;
  const by = new Map<string, DayBestEntry>();
  for (const s of scopes) {
    if (s.baseline === undefined) continue;
    if (value > s.baseline) continue;

    if (s.winner && value > s.winner.value) {
      by.set(`${s.winner.comp}|${s.winner.person}`, s.winner);
      if (!keatoned) {
        keatoned = {
          level: s.level,
          byValue: s.winner.value,
          byComp: s.winner.comp,
          byCompName: s.winner.compName,
          byPerson: s.winner.person,
          byPersonIso2: s.winner.personIso2,
        };
      }
      continue;
    }
    return { tag: s.level, keatoned, keatonedBy: [...by.values()] };
  }
  return { tag: '', keatoned, keatonedBy: [...by.values()] };
}

/** 上游(cubing.com / WCA Live)带来的 tag 是否已被快照里的现存纪录证伪。
 *
 *  上游按自己那份可能过期的基线判定 —— 2026-07-25 芜湖把单手平均 WR 刷到 6.99 后,
 *  上游仍给一周后上海的 7.29 标 WR。快照基线只含已公示成绩(都在今天之前),
 *  所以直播中的成绩拿它反证是安全的;服务端 refutesTag 另有比赛日门槛供回看历史比赛用。 */
export function refutesTag(
  tag: string,
  value: number,
  eventId: string,
  isAvg: boolean,
  user: JudgeUser | undefined,
  snap: RecordsSnapshot | undefined,
): boolean {
  if (!tag || !snap || !(value > 0)) return false;
  const k = `${eventId}|${isAvg ? '1' : '0'}`;
  let baseline: number | undefined;
  if (tag === 'WR') baseline = snap.wr?.[k];
  else if (tag === 'NR') baseline = user?.countryId ? snap.nr?.[`${k}|${user.countryId}`] : undefined;
  else if (tag.endsWith('R')) baseline = user?.continentId ? snap.cr?.[`${k}|${user.continentId}`] : undefined;
  if (baseline === undefined) return false;
  return value > baseline;
}

/** 「日掩」的一句话交代,给 badge 当 title / 无障碍文本。 */
export function keatonedTitle(k: KeatonedInfo, eventId: string, isAvg: boolean): string {
  const v = formatWcaResult(k.byValue, eventId, isAvg ? 'average' : 'single');
  const who = displayCuberName(k.byPerson, tr({ zh: true, en: false }));
  return tr({
    zh: `日掩:同一天 ${k.byCompName} 的 ${who} 打出 ${v}。按规则 9i2「同日只认最好」,这条 ${k.level} 不予认定。`,
    en: `Keatoned: ${who} got ${v} at ${k.byCompName} on the same day. Under Regulation 9i2 only the best result of the day counts, so this ${k.level} is not recognized.`,
  });
}
