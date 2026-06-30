'use client';

/**
 * /wca/comp/[slug] — full port of packages/client-vite/src/pages/comp/CompDetailPage.tsx.
 * Live WS (cubing.com + WCA Live) + Psych Sheet + record badges + round/cuber modals.
 */
import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from 'react';
import Link from '@/components/AppLink';
import { useParams, useRouter } from 'next/navigation';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, X as XIcon, RefreshCw, Info, Shuffle, Copy, Check, Radio, ArrowUp, ArrowDown } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { RecordBadge } from '@/components/RecordBadge';
import { eventDisplayName, isWcaEvent } from '@/lib/wca-events';
import { displayCuberName } from '@/lib/cuber-name-display';
import { countryToIso2, loadFlagData, compFlagIso2 } from '@/lib/country-flags';
import { countryName } from '@/lib/country-name';
import { localizeCompName, resolveCompName } from '@/lib/comp-localize';
import { fetchRankForWca, getCachedRankForWca, prefetchRanksForWca, type RankResult } from '@/lib/rank-client';
import { adjustRankWithLiveComp, type LiveCompEntry } from '@/lib/comp-live-rank';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiUrl } from '@/lib/api-base';
import { statsUrl } from '@/lib/stats-base';
import { isAo5Bracketed } from '@/lib/wca-ao5-brackets';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import { fetchPb, prefetchPbs, type PbByEvent } from '@/lib/wca-pb';
import { fetchCompInfo, fetchCubingZh, type CompInfo, type CubingZhMeta } from '@/lib/comp-wcif';
import { loadNoScrambleIds } from '@/lib/comp-no-scrambles';
import { fetchWcaScrambles } from '@/lib/wca-results-api';
import { formatDateRangeIso, toIsoDate } from '@/lib/wca-date';
import { localizeCity } from '@/lib/city-localize';
import WcaEventSelector from '@/components/WcaEventSelector';
import PillToggle from '@/components/PillToggle/PillToggle';
import type { CompPersonalRecordSlot } from '@cuberoot/shared';
import { EventIcon } from '@/components/EventIcon';
import { formatWcaResult } from '@/lib/wca-format-result';
import { isMbldEvent, computeMbfMo3 } from '@/lib/mbf-average';
import { UnofficialMark } from '@/components/UnofficialMark';
import { rememberRecent } from '../page';
import { useLiveStream, applyResultPatch, type LivePatch, type WsStatus } from '@/hooks/useLiveStream';
import { useWcaLiveStream, type WcaLiveRoundUpdate } from '@/hooks/useWcaLiveStream';
import ScheduleView, { ScheduleControls } from './ScheduleView';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import LangToggle from '@/components/LangToggle';
import { useCompFollows, FollowStar } from '@/components/CompFollow';
import { personRoundChangeKey, changeChainOldValues, effectiveFieldValue, effectiveAttempts, attemptOldValues, effectiveAttemptPenalties, effectiveAttemptPenaltyNote, effectiveAttemptVideos, pendingAttemptVideos, recordAttemptEdit, recordAttemptOriginal, recordAttemptPenalty, recordAttemptVideos, splitChainByStatus } from '@/lib/result-watch-api';
import { AttemptPopover } from '@/components/persons/sections/results/AttemptPopover';
import { listReconsByComp } from '@/lib/recon-api';
import { buildReconPersonAttemptMap, findReconForPersonAttempt, buildReconSubmitHref } from '@/lib/recon-attempt-lookup';
import { useCompRowChangeMap } from '@/components/persons/logic/use-row-change-map';
import { ResultChangeChain } from '@/components/persons/sections/results/ChangedResultValue';
import { ResultChangeEditor, type ResultChangeTarget } from '@/components/persons/sections/results/ResultChangeEditor';
import type { ResultChange } from '@/lib/result-watch-api';
import '../comp.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface User {
  number: number;
  name: string;
  wcaid: string;
  region: string;
  countryId?: string;
  continentId?: string;
  eventIds?: string[];
}

interface CompRecordsSnapshot {
  wr: Record<string, number>;
  cr: Record<string, number>;
  nr: Record<string, number>;
}

interface RoundMeta {
  i: string;
  e: string;
  f: string;
  co: number;
  tl: number;
  n: number;
  s: number;
  rn: number;
  tt: number;
  name: string;
  liveId?: string;
}

interface EventMeta {
  i: string;
  name: string;
  rs: RoundMeta[];
  dual?: boolean; // 双轮赛制 (WCA Reg 9v):前两轮合并排名。cubing.com 源直接给;其它源客户端兜底推断
}

interface LiveResult {
  i: number; c: number; n: number; e: string; r: string; f: string;
  b: number; a: number; v: number[]; sr: string; ar: string | number;
  pS?: number; pA?: number;
}

interface MembersByFilter {
  females: number[];
  children: number[];
  newcomers: number[];
}

type SourceId = 'cubing' | 'wca' | 'wca_live' | 'wca_db';
interface CompData {
  slug: string;
  cubingSlug?: string;
  wcaLiveId?: string;
  source?: SourceId;
  availableSources?: SourceId[];
  compId: number;
  name: string;
  type: string;
  events: EventMeta[];
  users: Record<string, User>;
  resultsByRound: Record<string, LiveResult[]>;
  membersByFilter?: MembersByFilter;
  fetchedAt: number;
  personalRecords?: Record<string, Record<string, CompPersonalRecordSlot>>;
  currentRecords?: CompRecordsSnapshot;
}

function regionToIso2(region: string): string {
  if (!region) return '';
  if (region.length === 2) return region.toLowerCase();
  return countryToIso2(region) || '';
}

function inferLiveRecordTag(
  value: number,
  eventId: string,
  isAvg: boolean,
  user: User | undefined,
  snapshot: CompRecordsSnapshot | undefined,
): string {
  if (!snapshot || !value || value <= 0) return '';
  const k = `${eventId}|${isAvg ? '1' : '0'}`;
  const wrMin = snapshot.wr[k];
  if (wrMin !== undefined && value <= wrMin) return 'WR';
  if (!user) return '';
  if (user.continentId) {
    const crMin = snapshot.cr[`${k}|${user.continentId}`];
    if (crMin !== undefined && value <= crMin) return 'CR';
  }
  if (user.countryId) {
    const nrMin = snapshot.nr[`${k}|${user.countryId}`];
    if (nrMin !== undefined && value <= nrMin) return 'NR';
  }
  return '';
}

function classifyPr(result: LiveResult, pb: PbByEvent | null): { singleRank: number | null; averageRank: number | null } {
  if (result.pS !== undefined || result.pA !== undefined) {
    return {
      singleRank: result.pS ?? null,
      averageRank: result.pA ?? null,
    };
  }
  if (!pb) return { singleRank: null, averageRank: null };
  const entry = pb[result.e];
  if (!entry) {
    return {
      singleRank: result.b > 0 ? 1 : null,
      averageRank: result.a > 0 ? 1 : null,
    };
  }
  const sBest = entry.single?.best ?? Infinity;
  const aBest = entry.average?.best ?? Infinity;
  return {
    singleRank: (result.b > 0 && result.b <= sBest) ? 1 : null,
    averageRank: (result.a > 0 && result.a <= aBest) ? 1 : null,
  };
}

function prBadgeFor(rank: number | null | undefined): string | null {
  if (!rank) return null;
  return rank === 1 ? 'PR' : `PR${rank}`;
}

function formatLive(value: number, eventId: string, isAverage: boolean): string {
  return formatWcaResult(value, eventId, isAverage ? 'average' : 'single', { zero: 'empty' });
}

// 盲拧项目:上游不计算平均,需从 attempts 现算并展示 (3BLD 今年起 bo5 → 展示 ao5;4/5BLD 仍 bo3 → 展示 mo3).
// 三者都按单次排名,平均只作附加列.
const BLIND_AVG_EVENTS = new Set(['333bf', '444bf', '555bf']);
function isBlindAvgEvent(eventId: string): boolean { return BLIND_AVG_EVENTS.has(eventId); }

// 按平均排名的赛制:ao5 ('a')、mo3 ('m')、未知 ('').盲拧 bo5/bo3 ('5'/'3') 仍按单次排名.
function isAvgRankedFormat(f: string): boolean {
  return f === 'a' || f === 'm' || f === '';
}

// WCA 平均/均值取整:≥10 分钟取到整秒,否则取到百分秒.
function roundWcaAvg(cs: number): number {
  if (cs >= 60000) return Math.round(cs / 100) * 100;
  return Math.round(cs);
}

// 从一轮 attempts 算 WCA 平均:5 次有效 → ao5 (去掉最好+最差);3 次 → mo3 (直接均值).
// 失败次数过多 → DNF (-1);非 3/5 次 → 0.
function computeWcaAverage(attempts: number[]): number {
  const counted = attempts.filter(v => v !== 0);
  const n = counted.length;
  if (n !== 3 && n !== 5) return 0;
  const fails = counted.filter(v => v < 0).length;
  if (n === 5) {
    if (fails >= 2) return -1;
    const sorted = [...counted].sort((a, b) => (a < 0 ? Infinity : a) - (b < 0 ? Infinity : b));
    const mid = sorted.slice(1, 4);
    return roundWcaAvg(mid.reduce((s, v) => s + v, 0) / mid.length);
  }
  if (fails >= 1) return -1;
  return roundWcaAvg(counted.reduce((s, v) => s + v, 0) / n);
}

// 展示/排名用的平均值:上游有值用上游,否则现算.
// 盲拧项目上游本就不给平均,全程现算(百分秒同尺度).
// 其他平均赛制(如 FMC mo3)若某次 DNF,上游平均给 0 而非 -1 → 漏判,
// 此时现算只用来补 DNF(-1);正值不回填(避免 FMC 等异尺度误差),仍以上游为准.
function effectiveAvg(r: LiveResult): number {
  if (r.a && r.a !== 0) return r.a;
  if (isMbldEvent(r.e)) return computeMbfMo3(r.v); // 多盲非官方 Mo3
  if (isBlindAvgEvent(r.e)) return computeWcaAverage(r.v);
  const computed = computeWcaAverage(r.v);
  return computed < 0 ? computed : r.a;
}

// WCA ID (PleaseBeQuietXian2025) → cubing.com dash slug (Please-Be-Quiet-Xian-2025)。
// 镜像 server cubing_live.ts 的 wcaIdToCubingSlug;data.name 带撇号/标点会 404,必须从无标点的 slug 推导。
function wcaIdToCubingSlug(wcaId: string): string {
  return wcaId
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/(\d)([A-Z])/g, '$1-$2')
    .replace(/([A-Z])(\d)/g, '$1-$2')
    .replace(/(?<!\d)([a-z])(\d)/g, '$1-$2');
}

function roundKey(e: string, r: string): string { return `${e}:${r}`; }

// 收集本场某项目某口径(single/average)下每位选手的最快有效成绩 + 国别 + 赛前官方 PB,
// 喂给 adjustRankWithLiveComp 把实时成绩并进官方名次(修掉官方 dump 滞后造成的假名次)。
function buildLiveCompEntries(
  data: CompData,
  pbMap: Record<string, PbByEvent | null>,
  eventId: string,
  type: 'single' | 'average',
): LiveCompEntry[] {
  const ev = data.events.find(e => e.i === eventId);
  if (!ev) return [];
  const best = new Map<number, number>();
  for (const rd of ev.rs) {
    for (const r of data.resultsByRound[roundKey(eventId, rd.i)] || []) {
      const v = type === 'single' ? r.b : effectiveAvg(r);
      if (!(v > 0)) continue;
      const prev = best.get(r.n);
      if (prev === undefined || v < prev) best.set(r.n, v);
    }
  }
  const out: LiveCompEntry[] = [];
  for (const [num, compBest] of best) {
    const u = data.users[String(num)];
    if (!u) continue;
    out.push({
      number: num,
      iso2: regionToIso2(u.region).toUpperCase(),
      compBest,
      officialBest: u.wcaid ? pbMap[u.wcaid]?.[eventId]?.[type]?.best : undefined,
    });
  }
  return out;
}

interface PodiumGroup { ev: EventMeta; rd: RoundMeta; rows: LiveResult[]; }

// 排名/名次用的「有效值」:把已批准的成绩变更覆盖层 (best/average) 叠加到 live 值上,
// 使名次按订正后的成绩排序。否则订正后变慢的成绩仍挂旧名次 (显示 4.87 却排在 4.78 前)。
// 按「订正后的值」重排,而非套用变更里的 pos 字段 —— pos 仅对被关注选手存在,按值排才全局自洽。
type EffRank = (r: LiveResult) => { b: number; a: number };
function makeEffRank(
  users: Record<string, User>,
  changeMap?: Map<string, ResultChange[]>,
): EffRank {
  return (r) => {
    const wcaid = users[String(r.n)]?.wcaid;
    const { approved } = splitChainByStatus(
      wcaid ? changeMap?.get(personRoundChangeKey(wcaid, r.e, r.r)) : undefined,
    );
    return {
      b: effectiveFieldValue(approved, 'best', r.b),
      a: effectiveFieldValue(approved, 'average', effectiveAvg(r)),
    };
  };
}

// WCA 名次比较 (Reg 9f13/9f14):先比排名成绩 (平均赛制按平均、否则按单次),平均并列再比
// 更好的单次;两者全等才返回 0 (= 并列同名次,Reg 9f15)。live 表 / 领奖台 / 名次计算共用同一口径。
// eff 给定时按「成绩变更覆盖层」订正后的值排名 (best/average),否则用 live 原值。
function rankComparator(byAvg: boolean, eff?: EffRank): (x: LiveResult, y: LiveResult) => number {
  const rankKey = (v: number) => (v > 0 ? v : Infinity);
  const cmp = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);
  const bOf = (r: LiveResult) => (eff ? eff(r).b : r.b);
  const aOf = (r: LiveResult) => (eff ? eff(r).a : effectiveAvg(r));
  return (x, y) => {
    const primary = byAvg
      ? cmp(rankKey(aOf(x)), rankKey(aOf(y)))
      : cmp(rankKey(bOf(x)), rankKey(bOf(y)));
    return primary !== 0 ? primary : cmp(rankKey(bOf(x)), rankKey(bOf(y)));
  };
}

// 已排序结果 → 每行竞赛名次 (并列同名次、跳号,Reg 9f15);无成绩 (b===0) → null (显示 '-')。
function computePlaces(results: LiveResult[], byAvg: boolean, eff?: EffRank): (number | null)[] {
  const cmpRank = rankComparator(byAvg, eff);
  const places: (number | null)[] = [];
  let prevPlace = 0;
  results.forEach((r, idx) => {
    if (r.b === 0) { places.push(null); return; }
    if (idx > 0 && results[idx - 1].b !== 0 && cmpRank(results[idx - 1], r) === 0) {
      places.push(prevPlace);
    } else {
      prevPlace = idx + 1;
      places.push(prevPlace);
    }
  });
  return places;
}

// 各项目决赛前三名 — 仅当该项目「决赛已结束」时才出领奖台。
// 决赛 = 结构上的最后一轮 (ev.rs 末项);只有它 s===1(已结束)才算数,避免:
//   ① 比赛进行中只有初赛有成绩时拿初赛当"决赛"误出领奖台;
//   ② 决赛只跑了一半(s===2 进行中)就拿部分成绩当最终领奖台。
// s 口径 0=未开始/1=已结束/2=进行中:wca_live 由 round.finished 灌(见 server cubing_live.ts),
//   cubing.com(data-events 原生)/wca_db/wca(有成绩轮恒 1)各源已正确。按项目独立判,
//   所以一场比赛里已结束的项目可先出领奖台,未结束的项目不出。
// 排名口径镜像 live 视图的 filteredResults;并列第三名一并带上 (Reg 9f15,并列铜牌)。
function computePodiumGroups(data: CompData, changeMap?: Map<string, ResultChange[]>): PodiumGroup[] {
  const out: PodiumGroup[] = [];
  const eff = makeEffRank(data.users, changeMap);
  for (const ev of data.events) {
    const finalRd = ev.rs[ev.rs.length - 1];
    if (!finalRd || finalRd.s !== 1) continue;
    const cmpRank = rankComparator(isAvgRankedFormat(finalRd.f), eff);
    const ranked = (data.resultsByRound[roundKey(ev.i, finalRd.i)] || []).slice()
      .filter(r => r.b !== 0)
      .sort(cmpRank);
    let cut = Math.min(3, ranked.length);
    while (cut < ranked.length && cmpRank(ranked[cut], ranked[cut - 1]) === 0) cut++;
    const top = ranked.slice(0, cut);
    if (top.length === 0) continue;
    out.push({ ev, rd: finalRd, rows: top });
  }
  return out;
}

// ── 比赛纪录 (WR / 大洲 / NR) ──────────────────────────────────────────────
// 记录标志已由上游 (sr / ar) 给定且为最终码 (WR、AsR/NAR/ER/…、NR),无需再推断。
interface CompRecordEntry {
  ev: EventMeta;
  res: LiveResult;
  roundId: string; // 纪录所在轮次 (点击行打开该轮成绩详情)
  type: 'single' | 'average';
  tag: string;   // WR / AsR / NR / ...
  value: number; // single→best, average→effectiveAvg
}
interface CompRecordGroup { ev: EventMeta; rows: CompRecordEntry[]; }

// 纪录等级排序:世界 → 大洲 → 国家。
function recordTagRank(tag: string): number {
  if (tag === 'WR') return 0;
  if (tag === 'NR') return 2;
  return 1; // 大洲纪录 (AsR / NAR / ER / OcR / SAR / AfR)
}

// 扫所有轮次,收集本场产生的所有官方纪录 (单次 sr / 平均 ar)。同一 (项目, 选手, 单次|平均)
// 只留最好一条 (跨轮多次破纪录时);按 comp.events 顺序分组,组内 WR→大洲→NR、单次先于平均。
function computeCompRecords(data: CompData): CompRecordGroup[] {
  const best = new Map<string, CompRecordEntry>();
  for (const ev of data.events) {
    for (const rd of ev.rs) {
      for (const res of data.resultsByRound[roundKey(ev.i, rd.i)] || []) {
        const push = (type: 'single' | 'average', tag: string, value: number) => {
          if (!tag || value <= 0) return;
          const key = `${ev.i}|${res.n}|${type}`;
          const prev = best.get(key);
          if (!prev || value < prev.value) best.set(key, { ev, res, roundId: rd.i, type, tag, value });
        };
        push('single', res.sr, res.b);
        push('average', String(res.ar || ''), effectiveAvg(res));
      }
    }
  }
  const byEvent = new Map<string, CompRecordEntry[]>();
  for (const e of best.values()) {
    const arr = byEvent.get(e.ev.i) || [];
    arr.push(e);
    byEvent.set(e.ev.i, arr);
  }
  const out: CompRecordGroup[] = [];
  for (const ev of data.events) {
    const rows = byEvent.get(ev.i);
    if (!rows || rows.length === 0) continue;
    rows.sort((a, b) =>
      (recordTagRank(a.tag) - recordTagRank(b.tag))
      || (a.type === b.type ? 0 : a.type === 'single' ? -1 : 1)
      || (a.value - b.value),
    );
    out.push({ ev, rows });
  }
  return out;
}

// URL 的轮次统一用数字 1,2,3,4(第几轮),不再用 WCA round_type_id 字母('d'/'f'/...)。
// 数字 = 该事件 rounds 列表(ev.rs,首轮→决赛有序)中的 1-based 位置;内部仍用 round_type_id 当 key。
function roundNumToTypeId(data: CompData | null, eventId: string, num: number): string {
  const ev = data?.events.find(e => e.i === eventId);
  return ev?.rs[num - 1]?.i ?? '';
}
function roundTypeIdToNum(data: CompData | null, eventId: string, rtid: string): number {
  const ev = data?.events.find(e => e.i === eventId);
  const idx = ev ? ev.rs.findIndex(r => r.i === rtid) : -1;
  return idx >= 0 ? idx + 1 : 1;
}

const ROUND_NAME_ZH: Record<string, string> = {
  'First round': '初赛',
  'Second round': '复赛',
  'Third round': '第三轮',
  'Quarter Final': '1/4 决赛',
  'Semi Final': '半决赛',
  'Final': '决赛',
};
function roundDisplayName(rdName: string, isZh: boolean): string {
  if (!isZh) return rdName;
  return ROUND_NAME_ZH[rdName] || rdName;
}

// ── 双轮赛制 (WCA Reg 9v, 2026) ──────────────────────────────────────────────
// 一个项目的前两轮作为「双轮」:选手两轮都打,取两轮更好的成绩排名 (9v4);两轮成绩
// 都计入世界排名/纪录 (9v4a);轮间不淘汰 (9v5)。avg 赛制比更好的平均 (并列看单次),
// best 赛制比更好的单次 (9f6/9f8)。
// 双轮赛制 (WCA Reg 9v) 是 2026 年新规,此前的比赛绝无双轮。WCA ID 末尾恒为 4 位年份。
const DUAL_ROUND_FIRST_YEAR = 2026;
function compYearFromSlug(slug: string): number {
  const m = slug.match(/(\d{4})$/);
  return m ? parseInt(m[1], 10) : 0;
}

// 权威双轮标记:WCA 开发者 dump 的 rounds.linked_round_id 经 gen_all_comps 落到 stats/comp_dual.json
// ({compId: [完整 WCA event id]})。cubing.com 源(ev.dual)只覆盖部分比赛,且计数兜底对进行中/即将
// 开始的双轮赛失效(第二轮还没成绩,n2=0)。这里按 compId 查权威标记补上。文件极小(几十场),整取 + memoize。
let compDualPromise: Promise<Record<string, string[]>> | null = null;
function loadCompDual(): Promise<Record<string, string[]>> {
  if (!compDualPromise) {
    compDualPromise = fetch(statsUrl('/stats/comp_dual.json'))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return compDualPromise;
}

function dualPairFor(
  ev: EventMeta | undefined,
  resultsByRound: Record<string, LiveResult[]>,
  compYear: number,
  authoritativeDual?: Set<string>,
): { r1: RoundMeta; r2: RoundMeta } | null {
  if (!ev || ev.rs.length < 2) return null;
  const r1 = ev.rs[0];
  const r2 = ev.rs[1];
  // 权威:cubing.com data-events 显式标记,或 dump linked_round_id (comp_dual.json)。两者都直接信任,
  // 不再走同赛制/计数兜底(对刚开赛、第二轮无成绩的双轮赛尤其关键)。
  if (ev.dual === true || authoritativeDual?.has(ev.i)) return { r1, r2 };
  // 兜底推断仅对 2026 起的比赛生效:双轮是 2026 新规,老比赛即便高晋级率也绝非双轮
  // (如某 2023 多盲第二轮 10/12=83% 只是宽松晋级,不是合并双轮)。
  if (compYear < DUAL_ROUND_FIRST_YEAR) return null;
  if (r1.f !== r2.f) return null; // 兜底推断要求两轮同赛制 (9v3)
  // 兜底 (WCA / WCA Live / WCA DB 源无标记):常规轮按 9p1 最多晋级 75%,
  // 第二轮人数 ≥ 第一轮 80% ⇒ 实为 100% 晋级 ⇒ 双轮 (排除并列略超 75% 的常规轮)。
  const n1 = (resultsByRound[roundKey(ev.i, r1.i)] || []).length;
  const n2 = (resultsByRound[roundKey(ev.i, r2.i)] || []).length;
  if (n1 >= 4 && n2 >= n1 * 0.8) return { r1, r2 };
  return null;
}

// 两个成绩按赛制比较:返回 <0 表示 a 更好。avg 赛制比平均 (并列比单次),否则比单次。
function compareDualResults(a: LiveResult, b: LiveResult, byAvg: boolean): number {
  const k = (v: number) => (v > 0 ? v : Infinity);
  const pa = byAvg ? k(effectiveAvg(a)) : k(a.b);
  const pb = byAvg ? k(effectiveAvg(b)) : k(b.b);
  if (pa !== pb) return pa - pb;
  const sa = k(a.b); const sb = k(b.b);
  if (sa === sb) return 0; // 单次相同 / 两边都无效 (避免 Infinity-Infinity=NaN 破坏排序)
  return sa - sb; // 平均并列 → 看更好那轮的单次
}

interface DualRow {
  n: number;
  r1: LiveResult | null;
  r2: LiveResult | null;
  better: LiveResult;
  betterRound: 1 | 2;
  place: number;      // 竞赛名次 (并列同名次)
  hasResult: boolean; // 至少一轮有有效成绩
}

// 两轮成绩按选手合并 → 取更好的排名,算竞赛名次 (并列同名次,跳号)。
function buildDualRows(r1res: LiveResult[], r2res: LiveResult[], byAvg: boolean): DualRow[] {
  const byNum = new Map<number, { r1: LiveResult | null; r2: LiveResult | null }>();
  for (const r of r1res) {
    const e = byNum.get(r.n) || { r1: null, r2: null };
    e.r1 = r; byNum.set(r.n, e);
  }
  for (const r of r2res) {
    const e = byNum.get(r.n) || { r1: null, r2: null };
    e.r2 = r; byNum.set(r.n, e);
  }
  const ranked: Omit<DualRow, 'place'>[] = [];
  for (const [n, pair] of byNum) {
    const { r1, r2 } = pair;
    let better: LiveResult; let betterRound: 1 | 2;
    if (r1 && r2) {
      if (compareDualResults(r1, r2, byAvg) <= 0) { better = r1; betterRound = 1; }
      else { better = r2; betterRound = 2; }
    } else if (r1) { better = r1; betterRound = 1; }
    else { better = r2 as LiveResult; betterRound = 2; }
    const hasResult = better.b > 0 || effectiveAvg(better) > 0;
    ranked.push({ n, r1, r2, better, betterRound, hasResult });
  }
  ranked.sort((a, b) => {
    const c = compareDualResults(a.better, b.better, byAvg);
    return c !== 0 ? c : a.n - b.n;
  });
  const out: DualRow[] = [];
  let prev: LiveResult | null = null;
  let prevPlace = 0;
  ranked.forEach((row, i) => {
    let place: number;
    if (prev && compareDualResults(prev, row.better, byAvg) === 0) place = prevPlace;
    else { place = i + 1; prevPlace = place; prev = row.better; }
    out.push({ ...row, place });
  });
  return out;
}

// 双轮后晋级集合:下一轮 (rs[2]) 已出成绩 → 用其选手;否则取合并榜 top-N
// (并列带入);无下一轮 (双轮即末轮) → 颁奖前 3。
function dualAdvancers(
  ev: EventMeta,
  rows: DualRow[],
  resultsByRound: Record<string, LiveResult[]>,
  byAvg: boolean,
): Set<number> {
  const valid = rows.filter(r => r.hasResult);
  const topN = (n: number): Set<number> => {
    const out = new Set<number>();
    if (valid.length === 0 || n <= 0) return out;
    const limit = Math.min(n, valid.length);
    const cutoff = valid[limit - 1].better;
    for (let i = 0; i < valid.length; i++) {
      if (i < limit) out.add(valid[i].n);
      else if (compareDualResults(valid[i].better, cutoff, byAvg) === 0) out.add(valid[i].n);
      else break;
    }
    return out;
  };
  const next = ev.rs[2];
  if (next) {
    const nextRes = resultsByRound[roundKey(ev.i, next.i)] || [];
    if (nextRes.length > 0) return new Set(nextRes.map(r => r.n));
    return topN(next.n);
  }
  return topN(3);
}

function regionDisplay(region: string, isZh: boolean): string {
  if (!region) return '';
  const iso2 = regionToIso2(region);
  if (iso2) return countryName(iso2.toUpperCase(), isZh);
  return region;
}

function decodeEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export default function CompDetailPage() {
  const params = useParams<{ slug: string }>();
  const rawSlug = (Array.isArray(params?.slug) ? params.slug[0] : params?.slug) ?? '';
  const slug = rawSlug.replace(/-/g, '');
  const router = useRouter();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const user = useAuthStore(s => s.user);
  const isAdmin = user !== null && ADMIN_WCA_IDS.includes(user.wcaId);
  const loggedIn = user !== null;          // 任何登录用户都能在成绩弹窗里展开「提议修改」。
  const meWcaId = user?.wcaId ?? null;      // 本人页面:罚时即时生效(其余仍待审核)。
  const login = useAuthStore(s => s.login);
  // 成绩变更(取消 / 修正,可多次):整场比赛一次拉取,按 (wcaId|event|轮) 索引;
  // 行内在当前值前划掉历次旧值,编辑/提议全在点成绩弹窗内做。compId 即 WCA 比赛 id(规整后 slug)。
  const { map: changeMap, refresh: refreshChanges } = useCompRowChangeMap(slug);
  const [editTarget, setEditTarget] = useState<ResultChangeTarget | null>(null);
  // 本场逐把成绩 → 复盘 id 映射((compWcaId|event|round|solveNum) → reconId),成绩/领奖台单元据此变可点链接。
  const [reconMap, setReconMap] = useState<Map<string, number> | null>(null);
  useEffect(() => {
    let alive = true;
    setReconMap(null);
    if (!slug) return;
    listReconsByComp(slug)
      .then(rs => { if (alive) setReconMap(buildReconPersonAttemptMap(rs)); })
      .catch(() => { if (alive) setReconMap(null); });
    return () => { alive = false; };
  }, [slug]);
  // 比赛关注「盯一下」— 与首页 / 比赛列表共用同一份 server 关注集合
  const { loggedIn: followLoggedIn, follows, toggle: toggleFollow } = useCompFollows();

  // URL 状态走 nuqs。导航型(项目 / 轮次 / 视图 / 预排名多选)默认 push,后退可逐步返回;
  // 筛选 / 赛程布局 / 数据源覆盖是过滤/子开关,走 replace 不堆历史。多键联动(项目+轮次)
  // 用各自 setter 同 tick 调用,nuqs 自动合并;需要 replace 写入时传 per-call { history: 'replace' }。
  const [eventParam, setEventParam] = useQueryState(
    'event',
    parseAsString.withDefault('').withOptions({ history: 'push', scroll: false }),
  );
  const [roundUrlParam, setRoundUrlParam] = useQueryState(
    'round',
    parseAsString.withDefault('').withOptions({ history: 'push', scroll: false }),
  );
  const [explicitView, setExplicitView] = useQueryState(
    'view',
    parseAsStringEnum<'result' | 'psych' | 'schedule' | 'podium'>(['result', 'psych', 'schedule', 'podium']).withOptions({ history: 'push', scroll: false }),
  );
  const [psychEventParam, setPsychEventParam] = useQueryState(
    'psychEvent',
    parseAsString.withDefault('').withOptions({ history: 'push', scroll: false }),
  );
  const [filterParam, setFilterParam] = useQueryState(
    'filter',
    parseAsString.withDefault('all').withOptions({ history: 'replace', scroll: false }),
  );
  const [layoutParam, setLayoutParam] = useQueryState(
    'layout',
    parseAsStringEnum<'calendar' | 'table'>(['calendar', 'table']).withOptions({ history: 'replace', scroll: false }),
  );
  const [sourceParam, setSourceParam] = useQueryState(
    'source',
    parseAsString.withOptions({ history: 'replace', scroll: false }),
  );

  useEffect(() => {
    if (rawSlug && rawSlug !== slug) {
      const qs = typeof window !== 'undefined' ? window.location.search : '';
      router.replace(`/wca/comp/${slug}${qs}`);
    }
  }, [rawSlug, slug, router]);

  const [data, setData] = useState<CompData | null>(null);
  // cubingZh 实时给当天公示的 CN 比赛提供中文名(绕开 comp_names_zh.json 日更延迟);
  // 提前声明以便标题 / 复制都能取 nameZh。fetch 在下方 effect(依赖 compInfo)。
  const [cubingZh, setCubingZh] = useState<CubingZhMeta | null>(null);
  const compNameTitle = data ? localizeCompName(slug, data.name, isZh, { explicitNameZh: cubingZh?.nameZh }) : slug;
  useDocumentTitle(compNameTitle, compNameTitle);
  const [nameCopied, setNameCopied] = useState(false);
  const copyCompName = useCallback(() => {
    if (!data) return;
    // 复制原始全名(中文不剥 WCA 前缀):2026WCA黄冈魔方公开赛
    const full = resolveCompName(slug, decodeEntities(data.name), isZh, { explicitNameZh: cubingZh?.nameZh });
    navigator.clipboard.writeText(full).then(
      () => { setNameCopied(true); setTimeout(() => setNameCopied(false), 1500); },
      e => console.error('[comp copy name] failed:', e),
    );
  }, [data, slug, isZh, cubingZh]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: string; filter?: string; done: number; total: number } | null>(null);
  const [, setFlagDataVer] = useState(0);
  useEffect(() => { loadFlagData().then(setFlagDataVer); }, []);

  const [pbVer, setPbVer] = useState(0);
  type ModalState =
    | { kind: 'round'; number: number; eventId: string; roundId: string }
    | { kind: 'all'; number: number };
  const [modal, setModal] = useState<ModalState | null>(null);
  const [compInfo, setCompInfo] = useState<CompInfo | null>(null);
  const [compInfoSettled, setCompInfoSettled] = useState(false);
  useEffect(() => {
    if (!slug) return;
    let cancel = false;
    setCompInfoSettled(false);
    fetchCompInfo(slug)
      .then(info => { if (!cancel) setCompInfo(info); })
      .catch(() => {})
      .finally(() => { if (!cancel) setCompInfoSettled(true); });
    return () => { cancel = true; };
  }, [slug]);
  useEffect(() => {
    if (!slug || !isZh || compInfo?.country_iso2?.toLowerCase() !== 'cn') {
      setCubingZh(null);
      return;
    }
    let cancel = false;
    fetchCubingZh(slug).then(meta => { if (!cancel) setCubingZh(meta); }).catch(() => {});
    return () => { cancel = true; };
  }, [slug, isZh, compInfo]);

  // 记入"最近浏览":带上实时解析的中文名(cubingZh.nameZh)和国家 iso2(compInfo),这样比赛页的
  // 最近浏览不依赖日更的 comp_names_zh.json / comp_countries.json 也能显示新比赛中文名 + 国旗。
  // cubingZh / compInfo 异步到达时再补写(rememberRecent 缺省值会保留旧记录)。
  useEffect(() => {
    if (!data) return;
    rememberRecent(data.slug, data.name, cubingZh?.nameZh ?? undefined, compInfo?.country_iso2 ?? undefined);
  }, [data, cubingZh, compInfo]);

  // URL 用数字轮号(1,2,3,4),内部仍以 round_type_id 当 key。读时数字→round_type_id,
  // 并兼容老的字母 round_type_id 直链(?round=d 等)。
  const roundParam = useMemo(() => {
    if (!roundUrlParam || !data || !eventParam) return '';
    const n = Number(roundUrlParam);
    if (Number.isInteger(n) && n >= 1) {
      const rtid = roundNumToTypeId(data, eventParam, n);
      if (rtid) return rtid;
    }
    // 老字母 round_type_id 直链(?round=d)兼容
    const ev = data.events.find(e => e.i === eventParam);
    if (ev?.rs.some(r => r.i === roundUrlParam)) return roundUrlParam;
    return '';
  }, [roundUrlParam, data, eventParam]);
  // 未来/未开始比赛无任何成绩 → 默认显示预排名;报名开始前(连预排名都还没人报名)默认显示赛程;
  // 有成绩或用户显式选择则按选择.
  const hasResults = useMemo(
    () => !!data && Object.values(data.resultsByRound).some(arr => arr.length > 0),
    [data],
  );
  // 「打乱」入口跳到打乱生成器,只有 WCA 已公布打乱时才有内容。两层判断:
  //  1) 便宜短路:无成绩(未来赛)→ 必无打乱;命中「办过但 dump 无 scrambles」黑名单
  //     (2003-2014 那 1675 场)→ 跳过实测。
  //  2) 其余比赛实测 fetchWcaScrambles(slug)(镜像表 + WCA API 兜底,与 /scramble/gen 同源,
  //     结果走 HTTP 缓存)真有打乱才显示入口。光靠「有成绩」会误判:刚结束的新赛成绩已出但
  //     打乱常滞后公示(如本场 FMC World 2026),点进去只会看到「暂无已公布的打乱」。
  const [scramblesPublished, setScramblesPublished] = useState(false);
  useEffect(() => {
    setScramblesPublished(false);
    if (!hasResults) return;
    let cancel = false;
    (async () => {
      const noScramble = await loadNoScrambleIds().catch(() => new Set<string>());
      if (cancel || noScramble.has(slug)) return;
      const rows = await fetchWcaScrambles(slug).catch(() => null);
      if (!cancel) setScramblesPublished(!!rows && rows.length > 0);
    })();
    return () => { cancel = true; };
  }, [hasResults, slug]);
  const showScramblesTab = scramblesPublished;
  // 领奖台:各项目决赛前三。比赛结束(所有项目末轮都有成绩)且有领奖台时默认展示。
  const podiumGroups = useMemo(() => (data ? computePodiumGroups(data, changeMap) : []), [data, changeMap]);
  const compRecords = useMemo(() => (data ? computeCompRecords(data) : []), [data]);
  const hasPodiumTab = podiumGroups.length > 0 || compRecords.length > 0;
  // 全场结束 = 每个项目的决赛(末轮)都 s===1。比「末轮有成绩」严格:决赛进行中(s===2)不算结束。
  const compFinished = useMemo(() => {
    if (!data || data.events.length === 0) return false;
    return data.events.every(ev => {
      const last = ev.rs[ev.rs.length - 1];
      return !!last && last.s === 1;
    });
  }, [data]);
  const beforeRegOpen = useMemo(() => {
    const t = compInfo?.registration_open ? Date.parse(compInfo.registration_open) : NaN;
    return Number.isFinite(t) && Date.now() < t;
  }, [compInfo]);
  const viewParam: 'result' | 'psych' | 'schedule' | 'podium' =
    explicitView === 'psych' ? 'psych'
      : explicitView === 'schedule' ? 'schedule'
        : (explicitView === 'podium' && hasPodiumTab) ? 'podium'
          : explicitView === 'result' ? 'result'
            : (data && !hasResults) ? (beforeRegOpen ? 'schedule' : 'psych')
              : (compFinished && podiumGroups.length > 0) ? 'podium'
                : 'result';
  const isPsych = viewParam === 'psych';
  const isSchedule = viewParam === 'schedule';
  const isPodium = viewParam === 'podium';
  // 把当前生效的视图固化进 URL(强制带上 ?view=…),分享/收藏直接命中 active tab。
  // 仅在用户未显式选 tab 且默认视图依赖的数据已就位时写一次:有成绩=纯 data 驱动,无成绩需
  // 等 compInfo settle 才能定 schedule/psych。history:replace 不污染后退栈,避免回退到裸 URL。
  useEffect(() => {
    if (explicitView != null || !data) return;
    if (!hasResults && !compInfoSettled) return;
    setExplicitView(viewParam, { history: 'replace' });
  }, [explicitView, data, hasResults, compInfoSettled, viewParam, setExplicitView]);
  const schedView: 'calendar' | 'table' = layoutParam === 'table' ? 'table' : 'calendar';
  // "Show round details" lives up in the view-tab row (next to the calendar/table
  // toggle); default on so Format / Time limit / Cutoff / Proceed show like WCA.
  const [schedDetailsExpanded, setSchedDetailsExpanded] = useState(true);

  const load = useCallback((opts?: { fresh?: boolean }): { promise: Promise<void>; cancel: () => void } => {
    const fresh = opts?.fresh ?? false;
    setError(null);
    setProgress(null);
    let done = false;
    let resolved = false;
    let es: EventSource | null = null;
    const apiAbort = new AbortController();
    let resolveOuter: () => void = () => {};
    const promise = new Promise<void>((resolve) => { resolveOuter = resolve; });
    const resolveOnce = () => { if (!resolved) { resolved = true; resolveOuter(); } };
    const cancel = () => {
      if (done) return;
      done = true;
      if (es) { try { es.close(); } catch { /* ignore */ } }
      try { apiAbort.abort(); } catch { /* ignore */ }
      resolveOnce();
    };
    const finishWith = (j: CompData, partial = false) => {
      if (done) return;
      setData(j);
      setProgress(null);
      resolveOnce();
      if (partial) return;
      done = true;
      if (es) { try { es.close(); } catch { /* ignore */ } }
      try { apiAbort.abort(); } catch { /* ignore */ }
    };
    const failWith = (msg: string) => {
      if (done) return;
      done = true;
      setError(msg);
      setProgress(null);
      if (es) { try { es.close(); } catch { /* ignore */ } }
      resolveOnce();
    };

    const startSse = () => {
      const q = sourceParam ? `?source=${encodeURIComponent(sourceParam)}` : '';
      const url = apiUrl(`/v1/cubing-live-stream/${encodeURIComponent(slug)}${q}`);
      es = new EventSource(url);
      const fallback = () => {
        if (done) return;
        es?.close();
        fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(slug)}${q}`), { signal: apiAbort.signal })
          .then(async r => {
            if (!r.ok) {
              const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
              throw new Error(j.error || `HTTP ${r.status}`);
            }
            return r.json();
          })
          .then(j => finishWith(j))
          .catch(e => { if ((e as Error).name !== 'AbortError') failWith((e as Error).message); });
      };
      es.addEventListener('progress', (ev) => {
        if (done) return;
        try { setProgress(JSON.parse((ev as MessageEvent).data)); } catch { /* ignore */ }
      });
      es.addEventListener('done', (ev) => {
        try {
          const j = JSON.parse((ev as MessageEvent).data) as CompData;
          finishWith(j);
        } catch (e) {
          failWith((e as Error).message);
        }
      });
      es.addEventListener('error', (ev) => {
        if (done) return;
        try {
          const dataStr = (ev as MessageEvent).data;
          if (dataStr) {
            const j = JSON.parse(dataStr);
            if (j.error) setError(j.error);
          }
        } catch { /* ignore */ }
        fallback();
      });
    };

    // 默认走 Vercel 边缘缓存代理 (/api/comp/:slug):离用户近,命中即秒返,s-maxage=30 + SWR
    // 让跨洋 RTT / 上游现拉成本全落后台.初始数据只是引导,WS 实时层 (useLiveStream / useWcaLiveStream)
    // 随后几秒内补丁到最新,所以最多 30s 旧的缓存完全安全.
    // source 覆盖 / 手动刷新 (fresh) / 边缘代理失败 → 直连 SSE 兜底 (带进度).
    if (sourceParam || fresh) {
      startSse();
    } else {
      fetch(`/api/comp/${encodeURIComponent(slug)}`, { signal: apiAbort.signal })
        .then(async r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(j => finishWith(j))
        .catch((e) => {
          if ((e as Error).name === 'AbortError' || done) return;
          startSse();
        });
    }
    return { promise, cancel };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, sourceParam]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const handle = load();
    handle.promise.finally(() => { if (!cancel) setLoading(false); });
    return () => {
      cancel = true;
      handle.cancel();
    };
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load({ fresh: true }).promise;
    setRefreshing(false);
  };

  const applyPatch = useCallback((patch: LivePatch) => {
    setData(prev => {
      if (!prev) return prev;
      if (patch.kind === 'result.new' || patch.kind === 'result.update') {
        const r = patch.result as LiveResult;
        if (r.c !== prev.compId) return prev;
        const u = prev.users[String(r.n)];
        if (r.b > 0 && !r.sr) {
          const tag = inferLiveRecordTag(r.b, r.e, false, u, prev.currentRecords);
          if (tag) r.sr = tag;
        }
        if (r.a > 0 && !r.ar) {
          const tag = inferLiveRecordTag(r.a, r.e, true, u, prev.currentRecords);
          if (tag) r.ar = tag;
        }
        const key = `${r.e}:${r.r}`;
        const arr = prev.resultsByRound[key] || [];
        const nextArr = applyResultPatch(arr, patch) as LiveResult[];
        return {
          ...prev,
          resultsByRound: { ...prev.resultsByRound, [key]: nextArr },
          fetchedAt: Date.now(),
        };
      }
      if (patch.kind === 'round.update') {
        const ru = patch.round;
        const events = prev.events.map(ev => {
          if (ev.i !== ru.e) return ev;
          return {
            ...ev,
            rs: ev.rs.map(rd => rd.i === ru.i ? { ...rd, ...ru } : rd),
          };
        });
        return { ...prev, events, fetchedAt: Date.now() };
      }
      if (patch.kind === 'users') {
        const mergedUsers: typeof prev.users = { ...prev.users };
        for (const [k, wsUser] of Object.entries(patch.users)) {
          mergedUsers[k] = { ...prev.users[k], ...wsUser };
        }
        return { ...prev, users: mergedUsers, fetchedAt: Date.now() };
      }
      return prev;
    });
  }, []);

  const isWca = data?.source === 'wca' || data?.source === 'wca_db';
  const isWcaLive = data?.source === 'wca_live';
  const isCubing = data?.source === 'cubing';

  const cubingWsStatus = useLiveStream({ compId: isCubing ? (data?.compId ?? null) : null, applyPatch });

  const wcaLiveRounds = useMemo(() => {
    if (!isWcaLive || !data) return [];
    const out: { liveId: string; eventId: string; roundTypeId: string; format: string }[] = [];
    for (const ev of data.events) {
      for (const rd of ev.rs) {
        if (rd.liveId) out.push({ liveId: rd.liveId, eventId: ev.i, roundTypeId: rd.i, format: rd.f });
      }
    }
    return out;
  }, [isWcaLive, data]);
  const wcaLiveNumMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!data) return map;
    for (const u of Object.values(data.users)) {
      if (u.wcaid) map.set(u.wcaid, u.number);
    }
    return map;
  }, [data]);
  const onWcaLiveUpdate = useCallback((update: WcaLiveRoundUpdate) => {
    setData(prev => {
      if (!prev) return prev;
      const key = `${update.eventId}:${update.roundTypeId}`;
      const rows = update.rows as LiveResult[];
      for (const r of rows) {
        const u = prev.users[String(r.n)];
        if (r.b > 0 && !r.sr) {
          const tag = inferLiveRecordTag(r.b, r.e, false, u, prev.currentRecords);
          if (tag) r.sr = tag;
        }
        if (r.a > 0 && !r.ar) {
          const tag = inferLiveRecordTag(r.a, r.e, true, u, prev.currentRecords);
          if (tag) r.ar = tag;
        }
      }
      return {
        ...prev,
        resultsByRound: { ...prev.resultsByRound, [key]: rows },
        fetchedAt: Date.now(),
      };
    });
  }, []);
  const wcaLiveStatus = useWcaLiveStream({
    rounds: wcaLiveRounds,
    numByWcaId: wcaLiveNumMap,
    onRoundUpdate: onWcaLiveUpdate,
  });

  const wsStatus = isWcaLive ? wcaLiveStatus : cubingWsStatus;

  const defaultRoundKey = useMemo(() => {
    if (!data) return null;
    const has = (k: string) => (data.resultsByRound[k] || []).length > 0;
    for (const ev of data.events) {
      if (ev.i !== '333') continue;
      for (let i = ev.rs.length - 1; i >= 0; i--) {
        const k = roundKey(ev.i, ev.rs[i].i);
        if (has(k)) return k;
      }
    }
    for (const ev of data.events) {
      for (let i = ev.rs.length - 1; i >= 0; i--) {
        const k = roundKey(ev.i, ev.rs[i].i);
        if (has(k)) return k;
      }
    }
    return null;
  }, [data]);

  useEffect(() => {
    if (!data || !defaultRoundKey) return;
    // 深链带了项目但没带轮次(如 Bark 推送 ?event=444):只补该项目的默认轮次
    // (最后一个有成绩的轮次,否则末轮),保留指定项目,不要回退到 333 默认轮。
    if (eventParam && !roundParam) {
      const ev = data.events.find(e => e.i === eventParam);
      if (ev && ev.rs.length) {
        const has = (k: string) => (data.resultsByRound[k] || []).length > 0;
        let target = ev.rs[ev.rs.length - 1];
        for (let i = ev.rs.length - 1; i >= 0; i--) {
          if (has(roundKey(ev.i, ev.rs[i].i))) { target = ev.rs[i]; break; }
        }
        setRoundUrlParam(String(roundTypeIdToNum(data, ev.i, target.i)), { history: 'replace' });
        return;
      }
    }
    if (!eventParam || !roundParam) {
      const [e, r] = defaultRoundKey.split(':');
      // 默认填充走 replace,不在历史里留一条空→默认的中间态。
      setEventParam(e, { history: 'replace' });
      setRoundUrlParam(String(roundTypeIdToNum(data, e, r)), { history: 'replace' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, defaultRoundKey]);

  // 规范化:老的字母 round_type_id 直链(?round=d)→ 数字轮号,保证 URL 统一显示 1,2,3,4。
  useEffect(() => {
    if (!data || !eventParam || !roundUrlParam || !roundParam) return;
    const canonical = String(roundTypeIdToNum(data, eventParam, roundParam));
    if (roundUrlParam !== canonical) {
      setRoundUrlParam(canonical, { history: 'replace' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, eventParam, roundParam, roundUrlParam]);

  // Schedule defaults to the calendar layout; force it into the URL so the choice is
  // always explicit (only an explicit layout=table opts out).
  useEffect(() => {
    if (!isSchedule || layoutParam) return;
    setLayoutParam('calendar', { history: 'replace' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSchedule, explicitView]);

  const currentRound = useMemo(() => {
    if (!data || !eventParam || !roundParam) return null;
    const ev = data.events.find(e => e.i === eventParam);
    if (!ev) return null;
    const rd = ev.rs.find(r => r.i === roundParam);
    return rd ? { ev, rd } : null;
  }, [data, eventParam, roundParam]);

  const filteredResults = useMemo(() => {
    if (!data || !currentRound) return [];
    const key = roundKey(currentRound.ev.i, currentRound.rd.i);
    const all = data.resultsByRound[key] || [];
    let arr = all;
    if (filterParam !== 'all') {
      const members = data.membersByFilter?.[filterParam as keyof MembersByFilter];
      if (members) {
        const set = new Set(members);
        arr = all.filter(r => set.has(r.n));
      }
    }
    return arr.slice().sort(rankComparator(isAvgRankedFormat(currentRound.rd.f), makeEffRank(data.users, changeMap)));
  }, [data, currentRound, filterParam, changeMap]);

  const advancers = useMemo(() => {
    if (!data || !currentRound) return new Set<number>();
    const rs = currentRound.ev.rs;
    const idx = rs.findIndex(r => r.i === currentRound.rd.i);
    if (idx < 0) return new Set<number>();
    const f = currentRound.rd.f;
    const byAvg = isAvgRankedFormat(f);
    const keyOf = (r: LiveResult) => byAvg ? `${effectiveAvg(r)}|${r.b}` : `${r.b}`;
    const topN = (n: number): Set<number> => {
      const out = new Set<number>();
      const valid = filteredResults.filter(r => r.b > 0);
      if (valid.length === 0) return out;
      const limit = Math.min(n, valid.length);
      const cutoffKey = keyOf(valid[limit - 1]);
      for (let i = 0; i < valid.length; i++) {
        if (i < limit) out.add(valid[i].n);
        else if (keyOf(valid[i]) === cutoffKey) out.add(valid[i].n);
        else break;
      }
      return out;
    };
    if (idx >= rs.length - 1) return topN(3);
    const set = new Set<number>();
    for (let i = idx + 1; i < rs.length; i++) {
      const key = roundKey(currentRound.ev.i, rs[i].i);
      for (const r of data.resultsByRound[key] || []) set.add(r.n);
    }
    if (set.size > 0) return set;
    const nextN = rs[idx + 1]?.n ?? 0;
    if (nextN > 0) return topN(nextN);
    return set;
  }, [data, currentRound, filteredResults]);

  // 双轮赛制:当前项目的双轮对 (前两轮) + 当前轮是否属于双轮 + 合并开关 (默认开)。
  const compYear = useMemo(() => compYearFromSlug(slug), [slug]);
  // 权威双轮标记(dump linked_round_id):按本场 compId(=slug)取出含双轮的 event id 集合。
  const [authoritativeDual, setAuthoritativeDual] = useState<Set<string> | null>(null);
  useEffect(() => {
    let alive = true;
    loadCompDual().then((m) => { if (alive) setAuthoritativeDual(new Set(m[slug] ?? [])); });
    return () => { alive = false; };
  }, [slug]);
  const dualPair = useMemo(
    () => (data && currentRound
      ? dualPairFor(currentRound.ev, data.resultsByRound, compYear, authoritativeDual ?? undefined)
      : null),
    [data, currentRound, compYear, authoritativeDual],
  );
  const currentIsDual = !!(dualPair && currentRound
    && (currentRound.rd.i === dualPair.r1.i || currentRound.rd.i === dualPair.r2.i));
  const [combinedPref, setCombinedPref] = useState<boolean | null>(null);
  const showCombined = currentIsDual && (combinedPref ?? true);
  // 切换项目时重置为默认 (默认开):避免在某项目关掉合并后,切到另一双轮项目仍是关的。
  // 同一项目内换轮次保留用户选择。
  useEffect(() => { setCombinedPref(null); }, [eventParam]);
  const filterMemberSet = useMemo(() => {
    if (filterParam === 'all' || !data) return null;
    const members = data.membersByFilter?.[filterParam as keyof MembersByFilter];
    return members ? new Set(members) : null;
  }, [data, filterParam]);

  useEffect(() => {
    if (!data || !currentRound) return;
    if (data.source === 'wca_db') return;
    if (data.personalRecords) return;
    const key = roundKey(currentRound.ev.i, currentRound.rd.i);
    const results = data.resultsByRound[key] || [];
    const wcaIds = results
      .map(r => data.users[String(r.n)]?.wcaid)
      .filter((id): id is string => !!id);
    if (wcaIds.length === 0) return;
    let cancelled = false;
    prefetchPbs(wcaIds).then(() => { if (!cancelled) setPbVer(v => v + 1); }).catch(() => {});
    return () => { cancelled = true; };
  }, [data, currentRound]);

  const [pbMap, setPbMap] = useState<Record<string, PbByEvent | null>>({});

  // 预热当前轮所有破 PR 成绩的 NR/WR 名次进缓存,使成绩弹窗打开时「秒出」(命中缓存即同步渲染)。
  // 一次 batch 请求;pbMap 到位后重跑以补全需 pb 才能判定的 PR。已缓存项自动跳过。
  useEffect(() => {
    if (!data || !currentRound) return;
    const results = data.resultsByRound[roundKey(currentRound.ev.i, currentRound.rd.i)] || [];
    if (results.length === 0) return;
    const isAvgFmt = isAvgRankedFormat(currentRound.rd.f) || isBlindAvgEvent(currentRound.ev.i);
    const items: { event: string; type: 'single' | 'average'; value: number; country?: string }[] = [];
    for (const r of results) {
      const u = data.users[String(r.n)];
      if (!u) continue;
      const pb = u.wcaid ? pbMap[u.wcaid] : null;
      const { singleRank, averageRank } = classifyPr(r, pb ?? null);
      const country = regionToIso2(u.region).toUpperCase();
      if (singleRank === 1 && !r.sr && r.b > 0) items.push({ event: r.e, type: 'single', value: r.b, country });
      const avgVal = effectiveAvg(r);
      if (averageRank === 1 && !r.ar && isAvgFmt && avgVal > 0) items.push({ event: r.e, type: 'average', value: avgVal, country });
    }
    if (items.length > 0) void prefetchRanksForWca(items);
  }, [data, currentRound, pbMap]);

  useEffect(() => {
    if (!data) return;
    if (data.personalRecords) {
      const obj: Record<string, PbByEvent | null> = {};
      for (const [wcaId, byEvent] of Object.entries(data.personalRecords)) {
        const pb: PbByEvent = {};
        for (const [ev, slot] of Object.entries(byEvent)) {
          pb[ev] = {
            single: slot.single ? { best: slot.single, world_rank: 0, continental_rank: 0, national_rank: 0, recordTag: slot.singleTag } : undefined,
            average: slot.average ? { best: slot.average, world_rank: 0, continental_rank: 0, national_rank: 0, recordTag: slot.averageTag } : undefined,
          };
        }
        obj[wcaId] = pb;
      }
      setPbMap(obj);
      return;
    }
    const ids = Object.values(data.users).map(u => u.wcaid).filter(Boolean);
    Promise.all(ids.map(async id => [id, await fetchPb(id)] as const))
      .then(pairs => {
        const obj: Record<string, PbByEvent | null> = {};
        for (const [id, pb] of pairs) obj[id] = pb;
        setPbMap(obj);
      });
  }, [data, pbVer]);

  const onChangeRound = (value: string) => {
    const [e, r] = value.split(':');
    if (!e || !r) return;
    setEventParam(e);
    setRoundUrlParam(String(roundTypeIdToNum(data, e, r)));
  };

  const onChangeFilter = (value: string) => {
    setFilterParam(value || null);
  };

  const onChangeView = (value: 'result' | 'psych' | 'schedule' | 'podium') => {
    setExplicitView(value); // 显式记录:空成绩比赛点「成绩」不会被默认弹回预排名
  };

  const onChangeSchedView = (value: 'calendar' | 'table') => {
    setLayoutParam(value);
  };

  // 预排名项目多选:切换某项目;按 comp.events 顺序序列化进 psychEvent (逗号分隔).
  const onTogglePsychEvent = (eventId: string) => {
    const cur = new Set(psychEventIds);
    if (cur.has(eventId)) cur.delete(eventId); else cur.add(eventId);
    const ordered = data ? data.events.filter(e => cur.has(e.i)).map(e => e.i) : [...cur];
    setPsychEventParam(ordered.length ? ordered.join(',') : null);
  };

  useEffect(() => {
    if (viewParam !== 'psych' || !data) return;
    if (data.personalRecords) return;
    const wcaIds = Object.values(data.users).map(u => u.wcaid).filter(Boolean);
    if (wcaIds.length === 0) return;
    let cancelled = false;
    prefetchPbs(wcaIds).then(() => { if (!cancelled) setPbVer(v => v + 1); }).catch(() => {});
    return () => { cancelled = true; };
  }, [viewParam, data]);

  // 预排名选中的项目集合 (支持多选). 解析逗号分隔的 psychEvent 参数, 过滤到本场存在的项目,
  // 并按 comp.events 顺序去重排列. 空 = 显示报名名单 (原"全部"); 1 项 = 单项预排名; 2+ 项 = 名次和.
  const psychEventIds = useMemo(() => {
    if (!data) return [] as string[];
    const valid = new Set(data.events.map(e => e.i));
    const want = new Set(psychEventParam.split(',').map(s => s.trim()).filter(s => valid.has(s)));
    return data.events.filter(e => want.has(e.i)).map(e => e.i);
  }, [data, psychEventParam]);
  const psychSelectedSet = useMemo(() => new Set(psychEventIds), [psychEventIds]);

  if (loading) {
    const pct = progress && progress.total > 0 ? Math.round(100 * progress.done / progress.total) : 0;
    const stepLabel = (() => {
      if (!progress) return tr({ zh: '加载中…', en: 'Loading…'
    });
      const f = progress.filter ? ` · ${progress.filter}` : '';
      const map: Record<string, string> = (isZh
              ? { 'meta': '读取比赛元数据', 'cubing.results': '加载成绩', 'cubing.filter': '加载分组成员', 'wca.fetch': '从 WCA 拉取', 'wca.transform': '解析 WCA 数据', 'wca_live.results': '从 WCA Live 拉取', 'wca_db.query': '从 WCA 数据库读取', 'wca_db.transform': '解析 WCA 数据' }
              : { 'meta': 'Reading metadata', 'cubing.results': 'Loading results', 'cubing.filter': 'Loading filters', 'wca.fetch': 'Fetching WCA data', 'wca.transform': 'Parsing WCA data', 'wca_live.results': 'Loading from WCA Live', 'wca_db.query': 'Querying WCA database', 'wca_db.transform': 'Parsing WCA data' });
      return (map[progress.step] || progress.step) + f;
    })();
    return (
      <div className="comp-detail-page">
        <div className="comp-loading">
          <div className="comp-loading-label">{stepLabel} {progress ? `(${progress.done}/${progress.total})` : ''}</div>
          <div className="comp-loading-bar"><div className="comp-loading-bar-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="comp-detail-page">
        <Link href="/wca/comp" className="comp-back-link"><ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}</Link>
        <div className="comp-err comp-err-block">
          <div className="comp-err-title">{tr({ zh: '加载失败', en: 'Failed to load'
        })}</div>
          <div className="comp-err-detail">{error || 'No data'}</div>
          <button type="button" className="comp-go-btn" onClick={refresh}>{tr({ zh: '重试', en: 'Retry'
        })}</button>
        </div>
      </div>
    );
  }

  const availableEventIds = new Set(data.events.filter(e => isWcaEvent(e.i)).map(e => e.i));
  const nonWcaEvents = data.events
    .filter(e => !isWcaEvent(e.i))
    .map(e => ({ id: e.i, iconClass: '', textLabel: eventDisplayName(e.i, isZh) }));
  const validRoundsFor = (eventId: string) => {
    const ev = data.events.find(e => e.i === eventId);
    if (!ev) return [];
    return ev.rs.filter(rd =>
      (data.resultsByRound[roundKey(ev.i, rd.i)] || []).length > 0 || rd.s === 2
    );
  };
  const eventBadges: Record<string, string> = {};
  const eventTopBadges: Record<string, string> = {};
  for (const ev of data.events) {
    // 右上角徽标 = 该项目总轮次,用 WCIF 定义的全部轮数(ev.rs),含尚未举办的轮次(如还没打的决赛);
    // 别用 validRoundsFor —— 它只数「有成绩 / 进行中」的轮,会把 status=open 的决赛漏掉(少算一轮)。
    const total = ev.rs.length;
    if (total > 0) eventTopBadges[ev.i] = `${total}`;
  }
  if (eventParam && roundParam) {
    const rounds = validRoundsFor(eventParam);
    const idx = rounds.findIndex(rd => rd.i === roundParam);
    if (idx >= 0) eventBadges[eventParam] = `${idx + 1}`;
  }
  const onSelectEvent = (newEventId: string) => {
    const ev = data.events.find(e => e.i === newEventId);
    if (!ev) return;
    // 赛程视图下点项目 = 钻进该项目成绩(切到「成绩」),否则点击只改 URL 不变内容(死点);
    // 其余视图维持原行为(同项目循环轮次 / 切项目)。
    if (isSchedule) onChangeView('result');
    // 双轮 + 合并视图:第一轮和第二轮渲染同一张合并表 → 合为一个循环档(用第一轮代表),
    // 且整个事件的轮次都进循环(含尚无成绩的决赛),让点图标能从合并视图直达决赛,
    // 而不是在两张相同的合并表之间空转。非双轮 / 未合并时维持原行为(只循环有成绩的轮)。
    const dp = showCombined ? dualPairFor(ev, data.resultsByRound, compYear) : null;
    let cycleRounds: RoundMeta[];
    if (dp) {
      cycleRounds = ev.rs.filter(rd => rd.i !== dp.r2.i);
    } else {
      const valid = validRoundsFor(newEventId);
      cycleRounds = valid.length > 0 ? valid : ev.rs;
    }
    if (cycleRounds.length === 0) return;
    if (newEventId === eventParam) {
      const curId = dp && roundParam === dp.r2.i ? dp.r1.i : roundParam;
      const curIdx = cycleRounds.findIndex(rd => rd.i === curId);
      const nextIdx = (curIdx + 1) % cycleRounds.length;
      onChangeRound(roundKey(newEventId, cycleRounds[nextIdx].i));
    } else {
      onChangeRound(roundKey(newEventId, cycleRounds[0].i));
    }
  };

  const filterOptions = [
    { value: 'all', labelZh: '全部', labelEn: 'All' },
    { value: 'females', labelZh: '女选手', labelEn: 'Females'
    },
    { value: 'children', labelZh: '儿童组', labelEn: 'Children'
    },
    { value: 'newcomers', labelZh: '新人组', labelEn: 'New Comers'
    },
  ];

  return (
    <div className="comp-detail-page">
      <div className="comp-table-section">
        <header className="comp-detail-header">
          <Link href="/wca/comp" className="comp-back-link"><ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}</Link>
          <h1 className="comp-detail-title">
            {(() => {
              // 国家旗:compInfo(权威,来自比赛详情)优先,回退 slug 推断 —— 当天刚公示的比赛
              // compFlagIso2 还没数据,会丢旗 + 丢 cubing.com 图标,故用 compInfo 兜底。
              const iso2 = compInfo?.country_iso2?.toLowerCase() || compFlagIso2(slug);
              const cubingSlug = data.cubingSlug || wcaIdToCubingSlug(data.slug);
              const cubingUrl = `https://cubing.com/competition/${cubingSlug}`;
              const wcaUrl = `https://www.worldcubeassociation.org/competitions/${data.slug}`;
              // WCA Live 链接用内部数字 id(不含比赛名):有比赛 id 时深链到当前选中的轮次
              // (/competitions/<compLiveId>/rounds/<roundLiveId>),否则回退首页。
              const wcaLiveUrl = data.wcaLiveId
                ? `https://live.worldcubeassociation.org/competitions/${data.wcaLiveId}${currentRound?.rd.liveId ? `/rounds/${currentRound.rd.liveId}` : ''}`
                : 'https://live.worldcubeassociation.org/';
              return (
                <>
                  {iso2 && <Flag iso2={iso2} className="comp-flag comp-title-flag" />}
                  <button
                    type="button"
                    onClick={copyCompName}
                    className="comp-detail-title-name"
                    title={tr({ zh: '点击复制比赛名', en: 'Click to copy name'
                    })}
                  >
                    {localizeCompName(slug, decodeEntities(data.name), isZh, { explicitNameZh: cubingZh?.nameZh })}
                  </button>
                  <a href={wcaUrl} target="_blank" rel="noopener noreferrer" className="comp-title-icon" title="WCA">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/upstream/wca.svg" alt="WCA" />
                  </a>
                  {/* WCA Live 没有独立 logo(与 WCA 主站几乎一致),用 lucide Radio 表「实时成绩」。
                      中国比赛走 cubing.com 直播,没有 WCA Live 页面,故 CN 不显示此图标。 */}
                  {iso2 !== 'cn' && (
                    <a href={wcaLiveUrl} target="_blank" rel="noopener noreferrer" className="comp-title-icon comp-title-icon-lucide" title="WCA Live">
                      <Radio size={18} />
                    </a>
                  )}
                  {iso2 === 'cn' && (
                    <a href={cubingUrl} target="_blank" rel="noopener noreferrer" className="comp-title-icon" title="cubing.com">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icons/upstream/cubingcom.ico" alt="cubing.com" />
                    </a>
                  )}
                  {/* 复制按钮放到 WCA / cubing.com 图标右侧(原在比赛名内,改到图标行尾) */}
                  <button
                    type="button"
                    onClick={copyCompName}
                    className={`comp-title-icon comp-title-icon-lucide comp-title-copy-btn${nameCopied ? ' is-copied' : ''}`}
                    title={tr({ zh: '复制比赛名', en: 'Copy name'
                    })}
                    aria-label={tr({ zh: '复制比赛名', en: 'Copy name'
                    })}
                  >
                    {nameCopied ? <Check size={16} /> : <Copy size={15} />}
                  </button>
                  <FollowStar
                    variant="inline"
                    compId={slug}
                    followed={follows.has(slug)}
                    onToggle={toggleFollow}
                    loggedIn={followLoggedIn}
                    onRequireLogin={login}
                  />
                </>
              );
            })()}
          </h1>
          <div className="comp-detail-meta">
            {isAdmin && data.availableSources && data.availableSources.length > 1 && (
              <div className="comp-source-toggle" role="group" aria-label={tr({ zh: '数据源', en: 'Data source'
            })}>
                {data.availableSources.map(s => {
                  const label = s === 'wca' || s === 'wca_db' ? 'WCA' : s === 'wca_live' ? 'WCA Live' : 'cubing.com';
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`comp-source-btn${data.source === s ? ' is-active' : ''}`}
                      onClick={() => { setSourceParam(s); }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {!isWca && (
              <span className="comp-detail-fetched">
                {tr({ zh: '更新于', en: 'Updated'
                })} {new Date(data.fetchedAt).toLocaleTimeString()}
              </span>
            )}
            {!isWca && <LiveIndicator status={wsStatus} isZh={isZh} />}
            {!isWca && wsStatus !== 'open' && (
              <button type="button" className="comp-refresh-btn" onClick={refresh} disabled={refreshing} title={tr({ zh: '刷新', en: 'Refresh'
            })}>
                <RefreshCw size={14} className={refreshing ? 'is-spinning' : ''} />
              </button>
            )}
          </div>
        </header>

        {compInfo && <CompInfoPanel info={compInfo} isZh={isZh} cubingZh={cubingZh} />}

        <div className="comp-view-tabs">
          {hasPodiumTab && (
            <button
              type="button"
              className={`comp-view-tab${isPodium ? ' is-active' : ''}`}
              onClick={() => onChangeView('podium')}
            >
              {compRecords.length > 0
                ? tr({ zh: '纪录和领奖台', en: 'Records & Podiums'
                })
                : tr({ zh: '领奖台', en: 'Podiums'
                })}
            </button>
          )}
          <button
            type="button"
            className={`comp-view-tab${(!isPsych && !isSchedule && !isPodium) ? ' is-active' : ''}`}
            onClick={() => onChangeView('result')}
          >
            {(isZh ? '成绩' : (isWca ? 'Results' : 'Live'))}
          </button>
          <button
            type="button"
            className={`comp-view-tab${isPsych ? ' is-active' : ''}`}
            onClick={() => onChangeView('psych')}
          >
            {tr({ zh: '预排名', en: 'Psych Sheet'
            })}
          </button>
          <button
            type="button"
            className={`comp-view-tab${isSchedule ? ' is-active' : ''}`}
            onClick={() => onChangeView('schedule')}
          >
            {tr({ zh: '赛程', en: 'Schedule'
            })}
          </button>
          {/* 打乱:不是页内视图,而是带当前项目/轮次跳到打乱生成器的比赛模式(AppLink 真 <a>,
              支持中键新开)。故无 is-active,用 ⇄ 图标暗示「会离开本页」。WCA 未公布打乱的比赛
              (未来赛 / 老赛无 scrambles)隐藏入口,点进去也只会是空。 */}
          {showScramblesTab && (
          <Link
            href={(() => {
              const q = new URLSearchParams({ comp: slug });
              if (eventParam && eventParam !== 'all') {
                q.set('event', eventParam);
                if (roundParam) q.set('round', String(roundTypeIdToNum(data, eventParam, roundParam)));
              }
              return `/scramble/gen?${q.toString()}`;
            })()}
            // Reactive href (changes on every event/round switch) + leaves this
            // page → Next would re-prefetch a new /scramble/gen RSC payload on each
            // switch. That prefetch storm was ~85% of all /scramble/gen edge hits
            // (13.5k _rsc requests from 791 real users) with near-zero click-through.
            // Disable prefetch: clicking still navigates normally, page load unaffected.
            prefetch={false}
            className="comp-view-tab comp-view-tab--link"
            title={tr({ zh: '查看本场打乱', en: 'View scrambles'
            })}
          >
            <Shuffle size={14} strokeWidth={1.75} />
            {tr({ zh: '打乱', en: 'Scrambles'
            })}
          </Link>
          )}
          {isSchedule && (
            <ScheduleControls
              view={schedView}
              onViewChange={onChangeSchedView}
              detailsExpanded={schedDetailsExpanded}
              onToggleDetails={() => setSchedDetailsExpanded(v => !v)}
              isZh={isZh}
            />
          )}
          {/* 编辑模式铅笔已移除:编辑 / 提议 / 复盘 / 视频全收进点成绩弹窗(AttemptPopover),与选手页一致。 */}
        </div>

        {!isPodium && (
          <div className="comp-event-bar">
            <WcaEventSelector
              availableEvents={availableEventIds}
              {...(isPsych
                ? { selectedEvents: psychSelectedSet, onToggle: onTogglePsychEvent }
                : { selectedEvent: eventParam, onSelect: onSelectEvent })}
              isZh={isZh}
              onlyAvailable
              badges={isPsych ? {} : eventBadges}
              topBadges={isPsych ? {} : eventTopBadges}
              appendEvents={nonWcaEvents}
            />
          </div>
        )}

        {isSchedule ? (
          <ScheduleView
            slug={slug}
            isZh={isZh}
            compName={compNameTitle}
            view={schedView}
            detailsExpanded={schedDetailsExpanded}
          />
        ) : isPodium ? (
          <>
            {compRecords.length > 0 && (
              <>
                <h2 className="comp-pod-section-h">{tr({ zh: '纪录', en: 'Records'
                })}</h2>
                <CompRecordsView
                  groups={compRecords}
                  users={data.users}
                  isZh={isZh}
                  onClickCuber={(n, eventId, roundId) => setModal({ kind: 'round', number: n, eventId, roundId })}
                />
                {podiumGroups.length > 0 && (
                  <h2 className="comp-pod-section-h">{tr({ zh: '领奖台', en: 'Podiums'
                })}</h2>
                )}
              </>
            )}
            <PodiumView
              groups={podiumGroups}
              users={data.users}
              isZh={isZh}
              pbMap={pbMap}
              compIso2={compFlagIso2(slug)}
              changeMap={changeMap}
              compId={slug}
              compName={compNameTitle}
              admin={isAdmin}
              loggedIn={loggedIn}
              meWcaId={meWcaId}
              reconMap={reconMap}
              onEdit={setEditTarget}
              onRefresh={refreshChanges}
              onClickCuber={(n, eventId, roundId) => setModal({ kind: 'round', number: n, eventId, roundId })}
            />
          </>
        ) : !isPsych ? (
          <>
            <div className="comp-selectors">
              {!isWca && (
                <select
                  className="comp-select comp-filter-select"
                  value={filterParam}
                  onChange={e => onChangeFilter(e.target.value)}
                >
                  {filterOptions.map(f => (
                    <option key={f.value} value={f.value}>{(isZh ? f.labelZh : f.labelEn)}</option>
                  ))}
                </select>
              )}
              {currentIsDual && (
                <PillToggle
                  value={showCombined}
                  onChange={setCombinedPref}
                  onLabel={tr({ zh: '合并双轮', en: 'Combined'
                })}
                  offLabel={tr({ zh: '合并双轮', en: 'Combined'
                })}
                  ariaLabel={tr({ zh: '合并双轮成绩', en: 'Combine dual rounds'
                })}
                />
              )}
            </div>

            {showCombined && dualPair && currentRound ? (
              <CombinedDualRoundsTable
                data={data}
                ev={currentRound.ev}
                r1={dualPair.r1}
                r2={dualPair.r2}
                isZh={isZh}
                pbMap={pbMap}
                compIso2={compFlagIso2(slug)}
                memberSet={filterMemberSet}
                onClickCuber={n => setModal({ kind: 'all', number: n })}
              />
            ) : (
              <ResultsTable
                results={filteredResults}
                users={data.users}
                round={currentRound?.rd}
                isZh={isZh}
                pbMap={pbMap}
                advancers={advancers}
                sortable
                compIso2={compFlagIso2(slug)}
                changeMap={changeMap}
                compId={slug}
                compName={compNameTitle}
                admin={isAdmin}
                loggedIn={loggedIn}
                meWcaId={meWcaId}
                reconMap={reconMap}
                onEdit={setEditTarget}
                onRefresh={refreshChanges}
                onClickCuber={n => {
                  if (currentRound) {
                    setModal({ kind: 'round', number: n, eventId: currentRound.ev.i, roundId: currentRound.rd.i });
                  } else {
                    setModal({ kind: 'all', number: n });
                  }
                }}
              />
            )}
          </>
        ) : (
          <PsychSheet
            data={data}
            isZh={isZh}
            eventIds={psychEventIds}
            pbMap={pbMap}
            onClickCuber={n => setModal({ kind: 'all', number: n })}
          />
        )}
      </div>

      {modal?.kind === 'round' && (
        <RoundResultModal
          number={modal.number}
          eventId={modal.eventId}
          roundId={modal.roundId}
          data={data}
          compName={compNameTitle}
          isZh={isZh}
          pbMap={pbMap}
          changeMap={changeMap}
          onShowAll={() => setModal({ kind: 'all', number: modal.number })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'all' && (
        <CuberModal
          number={modal.number}
          data={data}
          isZh={isZh}
          pbMap={pbMap}
          changeMap={changeMap}
          onSelectRound={(eventId, roundId) => {
            onChangeRound(roundKey(eventId, roundId)); // 同步 event/round 进 URL → 页面背景也切到该轮
            setModal({ kind: 'round', number: modal.number, eventId, roundId });
          }}
          onClose={() => setModal(null)}
        />
      )}
      {editTarget && (
        <ResultChangeEditor
          target={editTarget}
          existingChanges={changeMap.get(personRoundChangeKey(editTarget.wcaId, editTarget.eventId, editTarget.roundTypeId)) ?? []}
          onClose={() => setEditTarget(null)}
          onSaved={() => refreshChanges()}
        />
      )}
    </div>
  );
}

// WCA 的 venue / venue_details 等字段是 markdown，最常见是 [文本](url) 外链 ——
// 解析成真链接渲染，其余文本原样；否则前端会把 [文本](url) 当纯文本直出。
function renderWcaText(text: string): React.ReactNode {
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const out: React.ReactNode[] = [];
  let last = 0, key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <a key={key++} className="comp-info-link" href={m[2]} target="_blank" rel="noopener noreferrer">{m[1]}</a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

function CompInfoPanel({
  info, isZh, cubingZh,
}: { info: CompInfo; isZh: boolean; cubingZh: CubingZhMeta | null }) {
  const dateStr = info.start_date ? formatDateRangeIso(info.start_date, info.end_date) : '';
  const country = info.country_iso2 ? countryName(info.country_iso2.toUpperCase(), isZh) : '';
  const cityStr = [info.city ? localizeCity(info.city, isZh, info.country_iso2) : '', country].filter(Boolean).join((i18n.language.startsWith('zh') ? ',' : ', '));
  const todayIso = toIsoDate(new Date());
  const isPast = (iso: string) => !!iso && iso.slice(0, 10) < todayIso;
  const rows: { label: string; value: React.ReactNode; past?: boolean }[] = [];
  if (dateStr) rows.push({ label: tr({ zh: '日期', en: 'Date' }), value: dateStr });
  const regOpenIso = info.registration_open ? toIsoDate(new Date(info.registration_open)) : '';
  const regCloseIso = info.registration_close ? toIsoDate(new Date(info.registration_close)) : '';
  if (regOpenIso && regCloseIso) {
    rows.push({
      label: tr({ zh: '报名时间', en: 'Registration'
    }),
      value: formatDateRangeIso(regOpenIso, regCloseIso),
      past: isPast(regCloseIso),
    });
  }
  if (cubingZh?.withdrawDeadline) {
    rows.push({ label: '退赛截止', value: cubingZh.withdrawDeadline, past: isPast(cubingZh.withdrawDeadline) });
  }
  if (cubingZh?.reopenAt) {
    rows.push({ label: '重开报名', value: cubingZh.reopenAt, past: isPast(cubingZh.reopenAt) });
  }
  if (info.event_change_deadline_date) {
    const d = toIsoDate(new Date(info.event_change_deadline_date));
    rows.push({ label: tr({ zh: '修改截止', en: 'Event change deadline' }), value: d, past: isPast(d) });
  }
  if (info.waiting_list_deadline_date) {
    const d = toIsoDate(new Date(info.waiting_list_deadline_date));
    rows.push({ label: tr({ zh: '候补截止', en: 'Waiting list deadline'
    }), value: d, past: isPast(d) });
  }
  if (cityStr && !(isZh && cubingZh?.location)) {
    rows.push({ label: tr({ zh: '城市', en: 'City' }), value: cityStr });
  }
  if (cubingZh?.location) {
    rows.push({ label: '地点', value: cubingZh.location });
  } else {
    if (info.venue_address) rows.push({ label: tr({ zh: '地址', en: 'Address' }), value: renderWcaText(info.venue_address) });
    if (info.venue_details) rows.push({ label: tr({ zh: '详情', en: 'Details'
    }), value: renderWcaText(info.venue_details) });
  }
  if (rows.length === 0) return null;
  const activeRows = rows.filter(r => !r.past);
  const pastRows = rows.filter(r => r.past);
  return (
    <CompInfoRows activeRows={activeRows} pastRows={pastRows} isZh={isZh} />
  );
}

function CompInfoRows({
  activeRows, pastRows, isZh,
}: {
  activeRows: { label: string; value: React.ReactNode }[];
  pastRows: { label: string; value: React.ReactNode }[];
  isZh: boolean;
}) {
  return (
    <dl className={`comp-info-panel${isZh ? ' comp-info-panel--zh' : ''}`}>
      {activeRows.map((r, i) => (
        <div key={r.label} className="comp-info-row">
          <dt className="comp-info-label">{r.label}</dt>
          <dd className="comp-info-value">
            {r.value}
            {i === 0 && pastRows.length > 0 && (
              <PastRowsPopover rows={pastRows} isZh={isZh} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PastRowsPopover({
  rows, isZh,
}: { rows: { label: string; value: React.ReactNode }[]; isZh: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span
      ref={ref}
      className="comp-info-past-popover"
      data-open={open ? 'true' : 'false'}
    >
      <button
        type="button"
        className="comp-info-past-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label={(isZh ? `已过期 ${rows.length} 项` : `${rows.length} past`)}
      >
        <Info size={14} />
      </button>
      <div className="comp-info-past-panel" role="dialog">
        <dl className="comp-info-past-list">
          {rows.map(r => (
            <div key={r.label} className="comp-info-past-item">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </span>
  );
}

// 详情列表头:每把一个数字列头 (1..count),与 /wca/persons 成绩表一致(取代单个「详情」合并表头)。
// 右对齐对齐其下右对齐的成绩值。
function attemptNumHeaders(count: number) {
  return Array.from({ length: count }, (_, i) => (
    <th key={`att-${i}`} className="th-detail th-attempt-n">{i + 1}</th>
  ));
}

// 可排序列头按钮(成绩表 / 预排名共用):无方框纯文字 + 方向箭头。
function CompSortBtn({ active, dir, onClick, children }: { active: boolean; dir: 'asc' | 'desc'; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`comp-sort-btn${active ? ' is-active' : ''}`} onClick={onClick}>
      {children}{active ? (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null}
    </button>
  );
}

interface ResultsTableProps {
  results: LiveResult[];
  users: Record<string, User>;
  round: RoundMeta | undefined;
  isZh: boolean;
  pbMap: Record<string, PbByEvent | null>;
  advancers?: Set<number>;
  onClickCuber: (number: number) => void;
  compIso2?: string;
  // 成绩变更:整场比赛变更链(按 personRoundChangeKey 索引)+ 比赛 id / 名 + 管理员门控 + 编辑回调。
  changeMap?: Map<string, ResultChange[]>;
  compId?: string;
  compName?: string;
  admin?: boolean;
  loggedIn?: boolean;            // 任何登录用户:可在成绩弹窗里展开「提议修改」。
  meWcaId?: string | null;       // 当前登录用户的 wcaId:本人页面罚时即时。
  // 逐把成绩 → 复盘 id 映射:命中则该把成绩弹窗显示「查看复盘」,否则「去复盘」(预填 submit)。
  reconMap?: Map<string, number> | null;
  onEdit?: (t: ResultChangeTarget) => void;
  onRefresh?: () => void;
  // 列头可点排序(平均 / 单次 / 第 N 把)。默认关:领奖台等复用场景保持名次序。
  sortable?: boolean;
}

function ResultsTable({ results, users, round, isZh, pbMap, advancers, onClickCuber, compIso2, changeMap, compId, compName, admin, loggedIn, meWcaId, reconMap, onEdit, onRefresh, sortable }: ResultsTableProps) {
  // 排序:点列头(平均/单次/第 N 把)升→降→取消;无效成绩(DNF/DNS/空)恒垫底,默认 null=按名次序。
  const [sort, setSort] = useState<{ key: string | null; dir: 'asc' | 'desc' }>({ key: null, dir: 'asc' });
  const toggleSort = useCallback((key: string) => {
    setSort(prev => prev.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' });
  }, []);
  // 切项目 / 轮次重置排序(把数 / 量纲不同)。
  useEffect(() => { setSort({ key: null, dir: 'asc' }); }, [round?.e, round?.i]);
  // 成绩变更覆盖层感知的有效值(订正后的 best/average),供名次 + 列头排序按订正值排。
  const eff = useMemo(() => makeEffRank(users, changeMap), [users, changeMap]);
  const displayResults = useMemo(() => {
    if (!sort.key) return results;
    const k = sort.key, dir = sort.dir;
    const valOf = (r: LiveResult): number =>
      k === 'average' ? eff(r).a : k === 'single' ? eff(r).b : (r.v[Number(k.slice(3))] ?? 0);
    return results.slice().sort((a, b) => {
      const va = valOf(a), vb = valOf(b);
      const ia = !(va > 0), ib = !(vb > 0);   // DNF/DNS/空 = 无效
      if (ia && ib) return 0;
      if (ia) return 1;
      if (ib) return -1;
      return dir === 'asc' ? va - vb : vb - va;
    });
  }, [results, sort, eff]);

  if (!round) return null;
  const isAverageFormat = isAvgRankedFormat(round.f);
  // 多盲 Bo3 显示非官方 Mo3 平均(WCA 不追踪);Bo1/Bo2 无平均不显示
  const isMbldMo3 = isMbldEvent(round.e) && round.f === '3';
  const showAvg = isAverageFormat || isBlindAvgEvent(round.e) || isMbldMo3;
  const singleFirst = !isAverageFormat; // 按单次排名的项目 (含 3 盲 bo5 / 4/5 盲 bo3):单次列在平均列前
  const formatAttempts = round.f === 'a' || round.f === '' ? 5 : round.f === 'm' ? 3 : parseInt(round.f, 10) || 1;
  const maxRowAttempts = results.reduce((m, r) => Math.max(m, r.v.length), 0);
  const attemptCount = Math.max(formatAttempts, maxRowAttempts);
  // 竞赛名次 (并列同名次,Reg 9f15);领奖台奖牌色按名次而非行序染 (并列第一 → 两金,无银)。
  const places = computePlaces(results, isAverageFormat, eff);
  // 名次按选手号索引:排序打散行序后,名次列仍显示竞赛名次(而非当前行号)。
  const placeByN = new Map<number, number | null>();
  results.forEach((r, i) => placeByN.set(r.n, places[i] ?? null));
  // 列头排序按钮(仅 sortable 时)。
  const sortBtn = (key: string, label: ReactNode): ReactNode => !sortable ? label : (
    <CompSortBtn active={sort.key === key} dir={sort.dir} onClick={() => toggleSort(key)}>{label}</CompSortBtn>
  );

  return (
    <div className="comp-table-wrap">
      <table className={`comp-table${compIso2 === 'cn' && isZh ? ' comp-table-cn' : ''}`}>
        <thead>
          <tr>
            <th className="th-place">{tr({ zh: '名次', en: 'Place' })}</th>
            <th className="th-person">{tr({ zh: '选手', en: 'Person'
            })}</th>
            {(() => {
              const avgTh = showAvg ? (
                <th key="avg" className={`th-avg${!singleFirst ? ' is-rank-col' : ''}`}>
                  {sortBtn('average', <>{tr({ zh: '平均', en: 'Average' })}{isMbldMo3 && <UnofficialMark />}</>)}
                </th>
              ) : null;
              const bestTh = <th key="best" className={`th-best${singleFirst ? ' is-rank-col' : ''}`}>{sortBtn('single', tr({ zh: '单次', en: 'Best' }))}</th>;
              return singleFirst ? [bestTh, avgTh] : [avgTh, bestTh];
            })()}
            {sortable
              ? Array.from({ length: attemptCount }, (_, i) => (
                  <th key={`att-${i}`} className="th-detail th-attempt-n">{sortBtn(`att${i}`, i + 1)}</th>
                ))
              : attemptNumHeaders(attemptCount)}
          </tr>
        </thead>
        <tbody>
          {displayResults.map((r, idx) => {
            const u = users[String(r.n)];
            if (!u) return null;
            const place = placeByN.get(r.n) ?? null;
            const pb = pbMap[u.wcaid];
            const { singleRank, averageRank } = classifyPr(r, pb);
            const singleBadge = prBadgeFor(singleRank);
            const averageBadge = prBadgeFor(averageRank);
            const wcaid = u.wcaid;
            // 只取 approved:pending 提议绝不进官方值,也不让其 note 漏到官方单元(见 splitChainByStatus)。
            const { approved: chain } = splitChainByStatus(wcaid ? changeMap?.get(personRoundChangeKey(wcaid, r.e, r.r)) : undefined);
            // 当前有效值 = live 值叠加变更链最新(行内改某次后即时反映)。
            const effBest = effectiveFieldValue(chain, 'best', r.b);
            const effAvg = effectiveFieldValue(chain, 'average', effectiveAvg(r));
            const effAttempts = effectiveAttempts(chain, r.v);
            const isOdd = idx % 2 === 1;
            const advanced = advancers?.has(r.n);
            const cls = [advanced ? 'row-advanced' : '', isOdd ? 'row-odd' : ''].filter(Boolean).join(' ');
            return (
              <tr
                key={r.i || `${r.n}:${idx}`}
                className={`${cls} comp-row-clickable`}
                onClick={() => onClickCuber(r.n)}
              >
                <td className={`td-place${place === 1 ? ' is-gold' : place === 2 ? ' is-silver' : place === 3 ? ' is-bronze' : ''}`}>{place ?? '-'}</td>
                <td className="td-person">
                  <Flag iso2={regionToIso2(u.region)} className="comp-flag" />
                  <span
                    className="cuber-name"
                    title={regionDisplay(u.region, isZh)}
                  >
                    {displayCuberName(u.name, isZh)}
                  </span>
                  {/* 行级编辑铅笔已移除:管理员经点成绩弹窗里的「编辑变更记录…」打开整条变更编辑器。 */}
                </td>
                {(() => {
                  const avgCell = showAvg ? (
                    <td key="avg" className={`td-avg${!singleFirst ? ' is-rank-col' : ''}`}>
                      <span className="record-num-cell">
                        <ResultChangeChain oldValues={changeChainOldValues(chain, 'average')} eventId={r.e} kind="average" note={chain?.[chain.length - 1]?.note} />
                        {formatLive(effAvg, r.e, true)}
                        {r.ar
                          ? <RecordBadge record={String(r.ar)} variant="inline" iso2={regionToIso2(u.region)} />
                          : averageBadge ? <RecordBadge record={averageBadge} variant="inline" /> : null}
                      </span>
                    </td>
                  ) : null;
                  const bestCell = (
                    <td key="best" className={`td-best${singleFirst ? ' is-rank-col' : ''}`}>
                      <span className="record-num-cell">
                        <ResultChangeChain oldValues={changeChainOldValues(chain, 'best')} eventId={r.e} kind="single" note={chain?.[chain.length - 1]?.note} />
                        {formatLive(effBest, r.e, false)}
                        {r.sr
                          ? <RecordBadge record={r.sr} variant="inline" iso2={regionToIso2(u.region)} />
                          : singleBadge ? <RecordBadge record={singleBadge} variant="inline" /> : null}
                      </span>
                    </td>
                  );
                  return singleFirst ? [bestCell, avgCell] : [avgCell, bestCell];
                })()}
                {Array.from({ length: attemptCount }).map((_, i) => {
                  const hasSlot = i < effAttempts.length;            // 该轮赛制下这把存在(空位/DNF 也算);超出=空格不可点
                  const av = effAttempts[i] ?? 0;
                  const pen = effectiveAttemptPenalties(chain)[i] ?? 0;
                  const reconId = hasSlot
                    ? findReconForPersonAttempt(reconMap, compId ?? '', wcaid ?? '', r.e, r.r, i + 1)
                    : undefined;
                  // 复盘目标:有复盘→详情(所有人可看);没复盘→/recon/submit 预填身份字段。
                  const reconHref = reconId
                    ? `/recon/${reconId}${isZh ? '?lang=zh' : ''}`
                    : buildReconSubmitHref({
                        wcaEventId: r.e, roundTypeId: r.r, solveNum: i + 1,
                        personId: wcaid ?? '', personName: u.name ?? '', personCountry: regionToIso2(u.region),
                        compId: compId ?? '', compName: compName ?? '', compCountry: compIso2,
                        rawTimeSec: pen > 0 && av > 0 ? (av - pen) / 100 : undefined,
                      });
                  const isOwner = !!meWcaId && meWcaId === wcaid;
                  return (
                  <td key={i} className={`td-attempt ${isAo5Bracketed(effAttempts, i) ? 'td-attempt-trimmed' : ''} ${reconId ? 'td-attempt-has-recon' : ''}`}>
                    {hasSlot && (
                      // 选手页同款统一弹窗:复盘 / 判罚原因 / 编辑提议 / 管理员变更记录(全站一致)。
                      <AttemptPopover
                        value={av}
                        eventId={r.e}
                        penalty={pen}
                        penaltyNote={effectiveAttemptPenaltyNote(chain)}
                        format={(v) => formatLive(v, r.e, false)}
                        oldValues={attemptOldValues(chain, i)}
                        showOldBelow={false}
                        reconHref={reconHref}
                        hasRecon={!!reconId}
                        reconId={reconId}
                        reconClassName="att-trig-recon"
                        plainClassName="att-trig-plain"
                        canEdit={loggedIn}
                        isAdmin={admin}
                        isOwner={isOwner}
                        video={{
                          approved: effectiveAttemptVideos(chain)[i],
                          pending: pendingAttemptVideos(chain)[i],
                          onAdd: loggedIn ? (url) =>
                            recordAttemptVideos({
                              target: { wcaId: wcaid, competitionId: compId ?? '', eventId: r.e, roundTypeId: r.r, resultId: r.i },
                              currentAttempts: effAttempts,
                              index: i, videoUrl: url, existingChain: chain, propose: !admin,
                            }).then(() => onRefresh?.()) : undefined,
                        }}
                        onEdit={(newValue, note) =>
                          recordAttemptEdit({
                            target: { wcaId: wcaid, competitionId: compId ?? '', eventId: r.e, roundTypeId: r.r, resultId: r.i },
                            currentAttempts: effAttempts, currentBest: effBest, currentAverage: effAvg,
                            index: i, newValue, note,
                          }).then(() => onRefresh?.())
                        }
                        onSetOriginal={(originalValue, note) =>
                          recordAttemptOriginal({
                            target: { wcaId: wcaid, competitionId: compId ?? '', eventId: r.e, roundTypeId: r.r, resultId: r.i },
                            currentAttempts: effAttempts, currentBest: effBest, currentAverage: effAvg,
                            index: i, originalValue, note, existingChain: chain, propose: !admin,
                          }).then(() => onRefresh?.())
                        }
                        onSetPenalty={(penaltyCs, note) =>
                          recordAttemptPenalty({
                            target: { wcaId: wcaid, competitionId: compId ?? '', eventId: r.e, roundTypeId: r.r, resultId: r.i },
                            currentAttempts: effAttempts,
                            index: i, penaltyCs, note, existingChain: chain, propose: !admin && !isOwner,
                          }).then(() => onRefresh?.())
                        }
                        onEditRecord={admin && wcaid ? () => onEdit?.({
                          wcaId: wcaid,
                          competitionId: compId ?? '',
                          eventId: r.e,
                          roundTypeId: r.r,
                          resultId: r.i,
                          currentAttempts: effAttempts,
                          currentBest: effBest,
                          currentAverage: effAvg,
                          currentSingleRecord: typeof r.sr === 'string' ? r.sr : null,
                          currentAverageRecord: typeof r.ar === 'string' ? r.ar : null,
                          personName: u.name ?? null,
                          compName: compName ?? null,
                        }) : undefined}
                      />
                    )}
                  </td>
                  );
                })}
              </tr>
            );
          })}
          {results.length === 0 && (
            <tr><td colSpan={(showAvg ? 4 : 3) + attemptCount} className="comp-empty">{tr({ zh: '此轮暂无成绩', en: 'No results yet'
            })}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PodiumViewProps {
  groups: PodiumGroup[];
  users: Record<string, User>;
  isZh: boolean;
  pbMap: Record<string, PbByEvent | null>;
  compIso2?: string;
  onClickCuber: (number: number, eventId: string, roundId: string) => void;
  changeMap?: Map<string, ResultChange[]>;
  compId?: string;
  compName?: string;
  admin?: boolean;
  loggedIn?: boolean;
  meWcaId?: string | null;
  reconMap?: Map<string, number> | null;
  onEdit?: (t: ResultChangeTarget) => void;
  onRefresh?: () => void;
}

// 领奖台:逐项目列出决赛前三,复用 ResultsTable 的列结构/记录标志/成绩格式化。
function PodiumView({ groups, users, isZh, pbMap, compIso2, onClickCuber, changeMap, compId, compName, admin, loggedIn, meWcaId, reconMap, onEdit, onRefresh }: PodiumViewProps) {
  if (groups.length === 0) {
    return <div className="comp-empty">{tr({ zh: '暂无领奖台', en: 'No podiums yet'
    })}</div>;
  }
  return (
    <div className="comp-podiums">
      {groups.map(g => (
        <section key={g.ev.i} className="comp-podium-group">
          <h3 className="comp-podium-event">
            <EventIcon event={g.ev.i} className="comp-podium-icon" />
            <span>{eventDisplayName(g.ev.i, isZh)}</span>
          </h3>
          <ResultsTable
            results={g.rows}
            users={users}
            round={g.rd}
            isZh={isZh}
            pbMap={pbMap}
            compIso2={compIso2}
            changeMap={changeMap}
            compId={compId}
            compName={compName}
            admin={admin}
            loggedIn={loggedIn}
            meWcaId={meWcaId}
            reconMap={reconMap}
            onEdit={onEdit}
            onRefresh={onRefresh}
            onClickCuber={n => onClickCuber(n, g.ev.i, g.rd.i)}
          />
        </section>
      ))}
    </div>
  );
}

interface CompRecordsViewProps {
  groups: CompRecordGroup[];
  users: Record<string, User>;
  isZh: boolean;
  onClickCuber: (number: number, eventId: string, roundId: string) => void;
}

// 比赛纪录:逐项目列出本场产生的官方纪录 (单次 / 平均),复用成绩表的列结构与记录标志。
function CompRecordsView({ groups, users, isZh, onClickCuber }: CompRecordsViewProps) {
  if (groups.length === 0) return null;
  return (
    <div className="comp-records">
      {groups.map(g => {
        const attemptCount = g.rows.reduce((m, e) => Math.max(m, e.res.v.length), 0);
        // 合并同一 (选手, 轮次) 的单次 + 平均纪录到一行:同轮的 res/详情完全相同,只是
        // 分别破了单次纪录和平均纪录,原本拆成两行重复。按 g.rows 既有顺序(已 WR→大洲→NR
        // 排好)首次出现建行,后续同 (选手, 轮次) 并入对应单次/平均槽;不同轮次仍各自成行。
        const mergedRows: { n: number; roundId: string; res: LiveResult; single?: CompRecordEntry; average?: CompRecordEntry }[] = [];
        const mergedIdx = new Map<string, number>();
        for (const e of g.rows) {
          const key = `${e.res.n}:${e.roundId}`;
          let i = mergedIdx.get(key);
          if (i === undefined) { i = mergedRows.length; mergedIdx.set(key, i); mergedRows.push({ n: e.res.n, roundId: e.roundId, res: e.res }); }
          if (e.type === 'single') mergedRows[i].single = e; else mergedRows[i].average = e;
        }
        return (
          <section key={g.ev.i} className="comp-record-group">
            <h3 className="comp-podium-event">
              <EventIcon event={g.ev.i} className="comp-podium-icon" />
              <span>{eventDisplayName(g.ev.i, isZh)}</span>
            </h3>
            <div className="comp-table-wrap">
              <table className="comp-table">
                <thead>
                  <tr>
                    <th className="th-person">{tr({ zh: '选手', en: 'Person'
                    })}</th>
                    <th className="th-best">{tr({ zh: '单次', en: 'Best'
                    })}</th>
                    <th className="th-avg">{tr({ zh: '平均', en: 'Average' })}</th>
                    {attemptNumHeaders(attemptCount)}
                  </tr>
                </thead>
                <tbody>
                  {mergedRows.map((row, idx) => {
                    const u = users[String(row.n)];
                    if (!u) return null;
                    const iso2 = regionToIso2(u.region);
                    return (
                      // allow-static-onclick: 数据表整行点击(<tr> 不能是 <button>),与本页其它成绩表同款,点开成绩详情
                      <tr
                        key={`${row.n}:${row.roundId}`}
                        className={`${idx % 2 === 1 ? 'row-odd' : ''} comp-row-clickable`}
                        onClick={() => onClickCuber(row.n, g.ev.i, row.roundId)}
                      >
                        <td className="td-person">
                          <Flag iso2={iso2} className="comp-flag" />
                          <span className="cuber-name" title={regionDisplay(u.region, isZh)}>
                            {displayCuberName(u.name, isZh)}
                          </span>
                        </td>
                        <td className="td-best">
                          {row.single && (
                            <span className="record-num-cell">
                              {formatLive(row.single.value, g.ev.i, false)}
                              <RecordBadge record={row.single.tag} variant="inline" iso2={iso2} />
                            </span>
                          )}
                        </td>
                        <td className="td-avg">
                          {row.average && (
                            <span className="record-num-cell">
                              {formatLive(row.average.value, g.ev.i, true)}
                              <RecordBadge record={row.average.tag} variant="inline" iso2={iso2} />
                            </span>
                          )}
                        </td>
                        {Array.from({ length: attemptCount }).map((_, i) => (
                          <td key={i} className={`td-attempt ${isAo5Bracketed(row.res.v, i) ? 'td-attempt-trimmed' : ''}`}>
                            {formatLive(row.res.v[i] ?? 0, g.ev.i, false)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface CombinedDualRoundsTableProps {
  data: CompData;
  ev: EventMeta;
  r1: RoundMeta;
  r2: RoundMeta;
  isZh: boolean;
  pbMap: Record<string, PbByEvent | null>;
  compIso2?: string;
  memberSet: Set<number> | null;
  onClickCuber: (number: number) => void;
}

// 双轮合并榜:每位选手两行 (按轮次顺序),名次按两轮更好的成绩 (Reg 9v4),更好那轮高亮、
// 另一轮淡灰。复用 ResultsTable 的列结构/记录标志/成绩格式化。
function CombinedDualRoundsTable({ data, ev, r1, r2, isZh, pbMap, compIso2, memberSet, onClickCuber }: CombinedDualRoundsTableProps) {
  const byAvg = isAvgRankedFormat(r1.f);
  const showAvg = byAvg || isBlindAvgEvent(ev.i);
  const singleFirst = !byAvg;
  const r1res = data.resultsByRound[roundKey(ev.i, r1.i)] || [];
  const r2res = data.resultsByRound[roundKey(ev.i, r2.i)] || [];
  const rows = useMemo(() => {
    const filt = (arr: LiveResult[]) => (memberSet ? arr.filter(r => memberSet.has(r.n)) : arr);
    return buildDualRows(filt(r1res), filt(r2res), byAvg);
  }, [r1res, r2res, byAvg, memberSet]);
  const advancers = useMemo(
    () => dualAdvancers(ev, rows, data.resultsByRound, byAvg),
    [ev, rows, data.resultsByRound, byAvg],
  );

  const formatAttempts = r1.f === 'a' || r1.f === '' ? 5 : r1.f === 'm' ? 3 : parseInt(r1.f, 10) || 1;
  const maxRowAttempts = [...r1res, ...r2res].reduce((m, r) => Math.max(m, r.v.length), 0);
  const attemptCount = Math.max(formatAttempts, maxRowAttempts);
  const fixedCols = 3 + (showAvg ? 2 : 1); // place + person + round + best (+ avg)

  return (
    <div className="comp-table-wrap">
      <table className={`comp-table comp-table-dual${compIso2 === 'cn' && isZh ? ' comp-table-cn' : ''}`}>
        <thead>
          <tr>
            <th className="th-place">{tr({ zh: '名次', en: 'Place' })}</th>
            <th className="th-person">{tr({ zh: '选手', en: 'Person'
            })}</th>
            <th className="th-dual-round">{tr({ zh: '轮次', en: 'Round'
            })}</th>
            {(() => {
              const avgTh = showAvg ? <th key="avg" className={`th-avg${!singleFirst ? ' is-rank-col' : ''}`}>{tr({ zh: '平均', en: 'Average' })}</th> : null;
              const bestTh = <th key="best" className={`th-best${singleFirst ? ' is-rank-col' : ''}`}>{tr({ zh: '单次', en: 'Best'
            })}</th>;
              return singleFirst ? [bestTh, avgTh] : [avgTh, bestTh];
            })()}
            {attemptNumHeaders(attemptCount)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const u = data.users[String(row.n)];
            if (!u) return null;
            const advanced = advancers.has(row.n);
            const subRows: { rd: RoundMeta; res: LiveResult; roundNo: 1 | 2 }[] = [];
            if (row.r1) subRows.push({ rd: r1, res: row.r1, roundNo: 1 });
            if (row.r2) subRows.push({ rd: r2, res: row.r2, roundNo: 2 });
            const span = subRows.length;
            const pb = pbMap[u.wcaid];
            return subRows.map((sr, si) => {
              const isBetter = sr.roundNo === row.betterRound;
              const { singleRank, averageRank } = classifyPr(sr.res, pb);
              const singleBadge = prBadgeFor(singleRank);
              const averageBadge = prBadgeFor(averageRank);
              const trCls = [
                advanced ? 'row-advanced' : '',
                idx % 2 === 1 ? 'row-odd' : '',
                isBetter ? 'dual-row-better' : 'dual-row-worse',
                si === span - 1 ? 'dual-row-last' : '',
              ].filter(Boolean).join(' ');
              const avgCell = showAvg ? (
                <td key="avg" className={`td-avg${!singleFirst ? ' is-rank-col' : ''}`}>
                  <span className="record-num-cell">
                    {formatLive(effectiveAvg(sr.res), ev.i, true)}
                    {sr.res.ar
                      ? <RecordBadge record={String(sr.res.ar)} variant="inline" iso2={regionToIso2(u.region)} />
                      : averageBadge ? <RecordBadge record={averageBadge} variant="inline" /> : null}
                  </span>
                </td>
              ) : null;
              const bestCell = (
                <td key="best" className={`td-best${singleFirst ? ' is-rank-col' : ''}`}>
                  <span className="record-num-cell">
                    {formatLive(sr.res.b, ev.i, false)}
                    {sr.res.sr
                      ? <RecordBadge record={sr.res.sr} variant="inline" iso2={regionToIso2(u.region)} />
                      : singleBadge ? <RecordBadge record={singleBadge} variant="inline" /> : null}
                  </span>
                </td>
              );
              return (
                <tr
                  key={`${row.n}:${sr.roundNo}`}
                  className={`${trCls} comp-row-clickable`}
                  onClick={() => onClickCuber(row.n)}
                >
                  {si === 0 && (
                    <td className="td-place dual-td-span" rowSpan={span}>{row.hasResult ? row.place : '-'}</td>
                  )}
                  {si === 0 && (
                    <td className="dual-td-span dual-td-person" rowSpan={span}>
                      <span className="dual-person-inner">
                        <Flag iso2={regionToIso2(u.region)} className="comp-flag" />
                        <span className="cuber-name" title={regionDisplay(u.region, isZh)}>
                          {displayCuberName(u.name, isZh)}
                        </span>
                      </span>
                    </td>
                  )}
                  <td className="td-dual-round">{roundDisplayName(sr.rd.name, isZh)}</td>
                  {singleFirst ? [bestCell, avgCell] : [avgCell, bestCell]}
                  {Array.from({ length: attemptCount }).map((_, i) => (
                    <td key={i} className={`td-attempt ${isAo5Bracketed(sr.res.v, i) ? 'td-attempt-trimmed' : ''}`}>
                      {formatLive(sr.res.v[i] ?? 0, ev.i, false)}
                    </td>
                  ))}
                </tr>
              );
            });
          })}
          {rows.length === 0 && (
            <tr><td colSpan={fixedCols + attemptCount} className="comp-empty">{tr({ zh: '此轮暂无成绩', en: 'No results yet'
            })}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// 选手名:有 WCA ID 时链到选手主页 (stopPropagation 避免同时触发整行的弹窗 onClick).
function CuberNameLink({ u, isZh }: { u: User; isZh: boolean }) {
  const name = displayCuberName(u.name, isZh);
  const title = regionDisplay(u.region, isZh);
  if (u.wcaid) {
    return (
      <Link
        prefetch={false}
        href={`/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${u.wcaid}`}
        className="cuber-name cuber-link"
        title={title}
        onClick={e => e.stopPropagation()}
      >
        {name}
      </Link>
    );
  }
  return <span className="cuber-name" title={title}>{name}</span>;
}

// 单项目预排名顺序 → 每个选手在该项目里的名次 (1-based) + 参赛人数. 名次和复用此函数:
// 排序口径与单项预排名一致 (盲拧/bo 看单次, 否则看平均), 无成绩的报名选手仍按 Infinity 落到末尾.
function rankEventPsych(
  data: CompData,
  eventId: string,
  pbMap: Record<string, PbByEvent | null>,
): { rankOf: Map<number, number>; participants: number } {
  const numbers = new Set<number>();
  for (const rd of data.events.find(e => e.i === eventId)?.rs ?? []) {
    for (const r of data.resultsByRound[`${eventId}:${rd.i}`] ?? []) numbers.add(r.n);
  }
  if (numbers.size === 0) {
    for (const u of Object.values(data.users)) {
      if (u.eventIds?.includes(eventId)) numbers.add(u.number);
    }
  }
  const ev = data.events.find(e => e.i === eventId);
  const fmt = ev?.rs[ev.rs.length - 1]?.f ?? '';
  const singleRanked = isBlindAvgEvent(eventId) || !isAvgRankedFormat(fmt);
  const rankKey = (v: number | undefined) => (v && v > 0 ? v : Infinity);
  const cmp = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);
  const arr = [...numbers].map(n => {
    const u = data.users[String(n)];
    const pb = u?.wcaid ? pbMap[u.wcaid] : null;
    return { n, single: pb?.[eventId]?.single?.best, average: pb?.[eventId]?.average?.best };
  });
  arr.sort((x, y) => {
    if (singleRanked) {
      const s = cmp(rankKey(x.single), rankKey(y.single));
      return s !== 0 ? s : cmp(rankKey(x.average), rankKey(y.average));
    }
    const a = cmp(rankKey(x.average), rankKey(y.average));
    return a !== 0 ? a : cmp(rankKey(x.single), rankKey(y.single));
  });
  const rankOf = new Map<number, number>();
  arr.forEach((x, i) => rankOf.set(x.n, i + 1));
  return { rankOf, participants: arr.length };
}

interface PsychSheetProps {
  data: CompData;
  isZh: boolean;
  eventIds: string[];
  pbMap: Record<string, PbByEvent | null>;
  onClickCuber: (number: number) => void;
}

function PsychSheet({ data, isZh, eventIds, pbMap, onClickCuber }: PsychSheetProps) {
  // 0 项 = 报名名单; 1 项 = 单项预排名; 2+ 项 = 名次和 (下方 sorRows 分支).
  const eventId = eventIds.length === 1 ? eventIds[0]! : '';
  const router = useRouter();
  // 预排名整行点击:有 WCA ID 直接去选手主页;无 ID 的新人退回弹窗.
  const onRowClick = (u: User) => {
    if (u.wcaid) router.push(`/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${u.wcaid}`);
    else onClickCuber(u.number);
  };
  const userEvents = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const ev of data.events) {
      const inEvent = new Set<number>();
      for (const rd of ev.rs) {
        for (const r of data.resultsByRound[`${ev.i}:${rd.i}`] ?? []) inEvent.add(r.n);
      }
      for (const n of inEvent) {
        if (!map.has(n)) map.set(n, []);
        map.get(n)!.push(ev.i);
      }
    }
    if (map.size === 0) {
      for (const u of Object.values(data.users)) {
        if (u.eventIds?.length) map.set(u.number, [...u.eventIds]);
      }
    }
    return map;
  }, [data]);

  // 按单次排名的项目 (盲拧 + bo1/bo2/bo3 等非平均赛制):预排名也按单次排序、单次列在前.
  const singleRanked = useMemo(() => {
    if (!eventId) return false;
    if (isBlindAvgEvent(eventId)) return true;
    const ev = data.events.find(e => e.i === eventId);
    const fmt = ev?.rs[ev.rs.length - 1]?.f ?? '';
    return !isAvgRankedFormat(fmt);
  }, [data, eventId]);

  const psychRows = useMemo(() => {
    if (!eventId) return [];
    const numbers = new Set<number>();
    for (const rd of data.events.find(e => e.i === eventId)?.rs ?? []) {
      for (const r of data.resultsByRound[`${eventId}:${rd.i}`] ?? []) {
        numbers.add(r.n);
      }
    }
    if (numbers.size === 0) {
      for (const u of Object.values(data.users)) {
        if (u.eventIds?.includes(eventId)) numbers.add(u.number);
      }
    }
    const rankKey = (v: number | undefined) => (v && v > 0 ? v : Infinity);
    const cmp = (a: number, b: number) => a < b ? -1 : a > b ? 1 : 0;
    const arr = [...numbers]
      .map(n => {
        const u = data.users[String(n)];
        if (!u) return null;
        const pb = u.wcaid ? pbMap[u.wcaid] : null;
        const single = pb?.[eventId]?.single?.best;
        const average = pb?.[eventId]?.average?.best;
        const singleTag = pb?.[eventId]?.single?.recordTag;
        const averageTag = pb?.[eventId]?.average?.recordTag;
        return { n, u, single, average, singleTag, averageTag };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    arr.sort((x, y) => {
      if (singleRanked) {
        const bySingle = cmp(rankKey(x.single), rankKey(y.single));
        if (bySingle !== 0) return bySingle;
        return cmp(rankKey(x.average), rankKey(y.average));
      }
      const byAvg = cmp(rankKey(x.average), rankKey(y.average));
      if (byAvg !== 0) return byAvg;
      return cmp(rankKey(x.single), rankKey(y.single));
    });
    return arr;
  }, [data, eventId, pbMap, singleRanked]);

  const rosterRows = useMemo(() => {
    if (eventId) return [];
    const all = Object.values(data.users);
    all.sort((a, b) => a.number - b.number);
    return all;
  }, [data, eventId]);

  // 名次和 (2+ 项): 每位选手在每个所选项目的预排名相加. 报名了但缺该项 → 计 "参赛人数+1"
  // (比该项倒数第一再差一名), 与 /wca/sum-of-ranks 口径一致. 全程用已加载的 pbMap, 不发请求.
  const sorRows = useMemo(() => {
    if (eventIds.length < 2) return [];
    const perEvent = eventIds.map(e => ({ e, ...rankEventPsych(data, e, pbMap) }));
    const numbers = new Set<number>();
    for (const pe of perEvent) for (const n of pe.rankOf.keys()) numbers.add(n);
    const rows = [...numbers].map(n => {
      const u = data.users[String(n)];
      if (!u) return null;
      let total = 0;
      let done = 0;
      const ranks = perEvent.map(pe => {
        const rk = pe.rankOf.get(n);
        if (rk != null) { total += rk; done += 1; return { rank: rk, missing: false }; }
        const penalty = pe.participants + 1;
        total += penalty;
        return { rank: penalty, missing: true };
      });
      return { n, u, ranks, total, done };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    rows.sort((a, b) => a.total - b.total || b.done - a.done || a.n - b.n);
    return rows;
  }, [data, eventIds, pbMap]);

  // 单项预排名:点「平均 / 单次」列头排序(升→降→取消);无成绩(无 PB)恒垫底,默认 null=按预排名序。
  const [sort, setSort] = useState<{ key: 'average' | 'single' | null; dir: 'asc' | 'desc' }>({ key: null, dir: 'asc' });
  const toggleSort = useCallback((key: 'average' | 'single') => {
    setSort(prev => prev.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' });
  }, []);
  useEffect(() => { setSort({ key: null, dir: 'asc' }); }, [eventId]);
  const displayRows = useMemo(() => {
    if (!sort.key) return psychRows;
    const k = sort.key, dir = sort.dir;
    return psychRows.slice().sort((a, b) => {
      const va = (k === 'average' ? a.average : a.single) ?? 0;
      const vb = (k === 'average' ? b.average : b.single) ?? 0;
      const ia = !(va > 0), ib = !(vb > 0);
      if (ia && ib) return 0;
      if (ia) return 1;
      if (ib) return -1;
      return dir === 'asc' ? va - vb : vb - va;
    });
  }, [psychRows, sort]);

  if (eventIds.length >= 2) {
    return (
      <div className="comp-table-wrap">
        <table className="comp-table comp-sor-table">
          <thead>
            <tr>
              <th className="th-place">{tr({ zh: '名次', en: 'Rank' })}</th>
              <th className="th-person">{tr({ zh: '选手', en: 'Person'
            })}</th>
              {eventIds.map(e => (
                <th key={e} className="comp-sor-evcol"><EventIcon event={e} className="comp-sor-evicon" /></th>
              ))}
              <th className="comp-sor-total-col">
                {tr({ zh: '名次和', en: 'Total' })}
                <InfoTooltip
                  content={tr({ zh: '把所选项目的预排名名次相加(数字越小越靠前)。\n灰色斜体的「(数字)」表示该选手没报这项,按该项「参赛人数+1」(比最后一名再差一名)计入。', en: 'Psych-sheet positions across the selected events added up (lower is better).\nA grey italic "(n)" means the cuber isn’t registered for that event, counted as that event’s "participants + 1" (one worse than last).'
                })}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorRows.map((row, idx) => (
              <tr
                key={row.n}
                className={`${idx % 2 === 1 ? 'row-odd' : ''} comp-row-clickable`}
                onClick={() => onRowClick(row.u)}
              >
                <td className="td-place">{idx + 1}</td>
                <td className="td-person">
                  <Flag iso2={regionToIso2(row.u.region)} className="comp-flag" />
                  <CuberNameLink u={row.u} isZh={isZh} />
                </td>
                {row.ranks.map((r, j) => (
                  <td
                    key={eventIds[j]}
                    className={`comp-sor-evcell${r.missing ? ' is-missing' : r.rank <= 3 ? ` podium-${r.rank}` : ''}`}
                    title={r.missing
                      ? ((isZh ? `未报名 ${eventDisplayName(eventIds[j]!, true)},按「参赛人数+1」= ${r.rank} 计入` : `Not registered for ${eventDisplayName(eventIds[j]!, false)} — counted as participants+1 = ${r.rank}`))
                      : undefined}
                  >{r.missing ? `(${r.rank})` : r.rank}</td>
                ))}
                <td className="comp-sor-total-col">{row.total}</td>
              </tr>
            ))}
            {sorRows.length === 0 && (
              <tr><td colSpan={eventIds.length + 3} className="comp-empty">{tr({ zh: '暂无数据', en: 'No data'
            })}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // 预排名名次按选手号索引:点列头排序打散后,名次列仍显示预排名位次(而非当前行号)。
  const rankByN = new Map<number, number>(psychRows.map((r, i) => [r.n, i + 1]));

  return (
    <div className="comp-table-wrap">
      <table className="comp-table">
        {eventId ? (
          <>
            <thead>
              <tr>
                <th className="th-place">{tr({ zh: '名次', en: 'Rank' })}</th>
                <th className="th-person">{tr({ zh: '选手', en: 'Person'
                })}</th>
                {(() => {
                  const avgTh = (
                    <th key="avg" className={`th-avg${!singleRanked ? ' is-rank-col' : ''}`}>
                      <CompSortBtn active={sort.key === 'average'} dir={sort.dir} onClick={() => toggleSort('average')}>{tr({ zh: '平均', en: 'Average' })}</CompSortBtn>
                    </th>
                  );
                  const singleTh = (
                    <th key="single" className={`th-best${singleRanked ? ' is-rank-col' : ''}`}>
                      <CompSortBtn active={sort.key === 'single'} dir={sort.dir} onClick={() => toggleSort('single')}>{tr({ zh: '单次', en: 'Single' })}</CompSortBtn>
                    </th>
                  );
                  return singleRanked ? [singleTh, avgTh] : [avgTh, singleTh];
                })()}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => {
                const isOdd = idx % 2 === 1;
                return (
                  <tr
                    key={row.n}
                    className={`${isOdd ? 'row-odd' : ''} comp-row-clickable`}
                    onClick={() => onRowClick(row.u)}
                  >
                    <td className="td-place">{rankByN.get(row.n) ?? idx + 1}</td>
                    <td className="td-person">
                      <Flag iso2={regionToIso2(row.u.region)} className="comp-flag" />
                      <CuberNameLink u={row.u} isZh={isZh} />
                    </td>
                    {(() => {
                      const avgCell = (
                        <td key="avg" className={`td-avg${!singleRanked ? ' is-rank-col' : ''}`}>
                          {row.average ? (
                            <span className="record-num-cell">
                              {formatWcaResult(row.average, eventId, 'average')}
                              <RecordBadge record={row.averageTag || 'PR'} variant="inline" iso2={regionToIso2(row.u.region)} />
                            </span>
                          ) : '—'}
                        </td>
                      );
                      const singleCell = (
                        <td key="single" className={`td-best${singleRanked ? ' is-rank-col' : ''}`}>
                          {row.single ? (
                            <span className="record-num-cell">
                              {formatWcaResult(row.single, eventId, 'single')}
                              <RecordBadge record={row.singleTag || 'PR'} variant="inline" iso2={regionToIso2(row.u.region)} />
                            </span>
                          ) : '—'}
                        </td>
                      );
                      return singleRanked ? [singleCell, avgCell] : [avgCell, singleCell];
                    })()}
                  </tr>
                );
              })}
              {psychRows.length === 0 && (
                <tr><td colSpan={4} className="comp-empty">{tr({ zh: '暂无数据', en: 'No data'
                })}</td></tr>
              )}
            </tbody>
          </>
        ) : (
          <>
            <thead>
              <tr>
                <th className="th-place">#</th>
                <th className="th-person">{tr({ zh: '选手', en: 'Person'
                })}</th>
                <th>{tr({ zh: '项目', en: 'Events'
                })}</th>
              </tr>
            </thead>
            <tbody>
              {rosterRows.map((u, idx) => {
                const isOdd = idx % 2 === 1;
                const evs = userEvents.get(u.number) ?? [];
                return (
                  <tr
                    key={u.number}
                    className={`${isOdd ? 'row-odd' : ''} comp-row-clickable`}
                    onClick={() => onRowClick(u)}
                  >
                    <td className="td-place">{idx + 1}</td>
                    <td className="td-person">
                      <Flag iso2={regionToIso2(u.region)} className="comp-flag" />
                      <CuberNameLink u={u} isZh={isZh} />
                    </td>
                    <td className="comp-roster-events">
                      {evs.map(e => (
                        <EventIcon key={e} event={e} className="comp-roster-event" title={e} />
                      ))}
                    </td>
                  </tr>
                );
              })}
              {rosterRows.length === 0 && (
                <tr><td colSpan={3} className="comp-empty">{tr({ zh: '暂无数据', en: 'No data'
                })}</td></tr>
              )}
            </tbody>
          </>
        )}
      </table>
    </div>
  );
}

interface CuberModalProps {
  number: number;
  data: CompData;
  isZh: boolean;
  pbMap: Record<string, PbByEvent | null>;
  changeMap?: Map<string, ResultChange[]>;
  onSelectRound: (eventId: string, roundId: string) => void;
  onClose: () => void;
}

function CuberModal({ number, data, isZh, pbMap, changeMap, onSelectRound, onClose }: CuberModalProps) {
  const u = data.users[String(number)];
  const rows = useMemo(() => {
    if (!u) return [];
    const out: { ev: EventMeta; rd: RoundMeta; result: LiveResult }[] = [];
    for (const ev of data.events) {
      const evRows: { ev: EventMeta; rd: RoundMeta; result: LiveResult }[] = [];
      for (const rd of ev.rs) {
        const arr = data.resultsByRound[roundKey(ev.i, rd.i)] || [];
        const hit = arr.find(r => r.n === number);
        if (hit) evRows.push({ ev, rd, result: hit });
      }
      evRows.reverse();
      out.push(...evRows);
    }
    return out;
  }, [u, data, number]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!u) return null;
  const pb = pbMap[u.wcaid];

  const groups: { ev: EventMeta; entries: typeof rows }[] = [];
  let cur: { ev: EventMeta; entries: typeof rows } | null = null;
  for (const row of rows) {
    if (!cur || cur.ev.i !== row.ev.i) {
      cur = { ev: row.ev, entries: [] };
      groups.push(cur);
    }
    cur.entries.push(row);
  }

  return (
    <div className="comp-modal-backdrop" onClick={onClose}>
      <div className="comp-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="comp-modal-header">
          <div className="comp-modal-title">
            <Flag iso2={regionToIso2(u.region)} className="comp-flag" />
            {u.wcaid ? (
              <Link
                prefetch={false}
                href={`/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${u.wcaid}`}
                className="cuber-link-modal"
                onClick={onClose}
              >
                {displayCuberName(u.name, isZh)}
              </Link>
            ) : (
              <span className="cuber-link-static">{displayCuberName(u.name, isZh)}</span>
            )}
          </div>
          <button type="button" className="comp-modal-close" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </header>
        <div className="comp-modal-body">
          {groups.length === 0 ? (
            <div className="comp-empty">{tr({ zh: '暂无成绩', en: 'No results'
            })}</div>
          ) : (
            groups.map(g => (
              <div key={g.ev.i} className="comp-modal-group">
                <h3 className="comp-modal-group-title">{eventDisplayName(g.ev.i, isZh)}</h3>
                <table className="comp-modal-table">
                  <thead>
                    <tr>
                      <th>{tr({ zh: '轮次', en: 'Round'
                    })}</th>
                      <th>{tr({ zh: '名次', en: 'Place' })}</th>
                      <th>{tr({ zh: '单次', en: 'Best'
                    })}</th>
                      <th>{tr({ zh: '平均', en: 'Average' })}</th>
                      {attemptNumHeaders(5)}
                    </tr>
                  </thead>
                  <tbody>
                    {g.entries.map(en => {
                      const { result } = en;
                      const isAverageFormat = isAvgRankedFormat(en.rd.f) || isBlindAvgEvent(en.ev.i);
                      const showAvg = isAverageFormat || (isMbldEvent(en.ev.i) && en.rd.f === '3'); // 多盲 Bo3 非官方 Mo3
                      const { singleRank, averageRank } = classifyPr(result, pb);
                      const singleBadge = prBadgeFor(singleRank);
                      const averageBadge = prBadgeFor(averageRank);
                      const arr = data.resultsByRound[roundKey(en.ev.i, en.rd.i)] || [];
                      // 名次与成绩表同口径:按成绩变更覆盖层订正后的值重排再取竞赛名次。
                      const rankEff = makeEffRank(data.users, changeMap);
                      const rankedArr = arr.slice().sort(rankComparator(isAverageFormat, rankEff));
                      const rIdx = rankedArr.findIndex(rr => rr.n === number);
                      const place = rIdx >= 0 && result.b !== 0
                        ? (computePlaces(rankedArr, isAverageFormat, rankEff)[rIdx] ?? '-')
                        : '-';
                      return (
                        <tr
                          key={`${en.ev.i}:${en.rd.i}`}
                          className="comp-modal-row-clickable"
                          onClick={() => onSelectRound(en.ev.i, en.rd.i)}
                        >
                          <td>{roundDisplayName(en.rd.name, isZh)}</td>
                          <td>{place}</td>
                          <td>
                            {formatLive(result.b, result.e, false)}
                            {result.sr
                              ? <RecordBadge record={result.sr} variant="inline" iso2={regionToIso2(u.region)} />
                              : singleBadge ? <RecordBadge record={singleBadge} variant="inline" /> : null}
                          </td>
                          <td>
                            {showAvg ? formatLive(effectiveAvg(result), result.e, true) : ''}
                            {showAvg && (result.ar
                              ? <RecordBadge record={String(result.ar)} variant="inline" iso2={regionToIso2(u.region)} />
                              : averageBadge ? <RecordBadge record={averageBadge} variant="inline" /> : null)}
                          </td>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <td key={i} className={`td-attempt ${isAo5Bracketed(result.v, i) ? 'td-attempt-trimmed' : ''}`}>
                              {formatLive(result.v[i] ?? 0, result.e, false)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface RoundResultModalProps {
  number: number;
  eventId: string;
  roundId: string;
  data: CompData;
  compName: string;
  isZh: boolean;
  pbMap: Record<string, PbByEvent | null>;
  changeMap?: Map<string, ResultChange[]>;
  onShowAll: () => void;
  onClose: () => void;
}

function RoundResultModal({ number, eventId, roundId, data, compName, isZh, pbMap, changeMap, onShowAll, onClose }: RoundResultModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'done' | 'nothing' | 'error'>('idle');
  // 破 PR 时显示「这成绩在 WCA 历史能排第几」(NR/WR)。渲染期同步读 rank-client 模块缓存 →
  // 比赛页已预热则秒出;未命中才在 effect 里单查,回来 bump tick 重渲染。
  const [, setRankTick] = useState(0);

  const prefetchRef = useRef<Promise<{ cn: string; en: string; url: string } | null> | null>(null);
  const prefetchKeyRef = useRef<string>('');
  const hasEventsRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const u = data.users[String(number)];
    const ev = data.events.find(e => e.i === eventId);
    const rd = ev?.rs.find(r => r.i === roundId);
    const arr = data.resultsByRound[roundKey(eventId, roundId)] || [];
    const result = arr.find(rr => rr.n === number);
    if (!u || !ev || !rd || !result) return;

    const pb = pbMap[u.wcaid];
    const { singleRank, averageRank } = classifyPr(result, pb);
    const singleTagForCopy = result.sr ? String(result.sr) : (singleRank ? 'PR' : '');
    const avgTagForCopy = result.ar ? String(result.ar) : (averageRank ? 'PR' : '');

    const personIso2 = regionToIso2(u.region).toUpperCase();
    const compNameZh = localizeCompName(data.slug, decodeEntities(data.name), true);
    const compNameEn = localizeCompName(data.slug, decodeEntities(data.name), false);
    const compIso2 = compFlagIso2(data.slug);
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const events: Array<Record<string, unknown>> = [];
    if (singleTagForCopy && result.b > 0) {
      events.push({
        tag: singleTagForCopy, rec_type: 'single', attempt_result: result.b,
        event_id: result.e, person_name: u.name, person_iso2: personIso2,
        comp_name: compNameZh, comp_name_en: compNameEn, comp_iso2: compIso2,
        url, previous_pr: pb?.[result.e]?.single?.best ?? null, pr_rank: singleRank,
      });
    }
    if (avgTagForCopy && result.a > 0) {
      events.push({
        tag: avgTagForCopy, rec_type: 'average', attempt_result: result.a,
        event_id: result.e, person_name: u.name, person_iso2: personIso2,
        comp_name: compNameZh, comp_name_en: compNameEn, comp_iso2: compIso2,
        url, previous_pr: pb?.[result.e]?.average?.best ?? null, pr_rank: averageRank,
      });
    }
    hasEventsRef.current = events.length > 0;
    if (events.length === 0) return;

    const key = JSON.stringify(events);
    if (key === prefetchKeyRef.current) return;
    prefetchKeyRef.current = key;

    prefetchRef.current = fetch(apiUrl('/v1/wca/format-record'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    })
      .then(async r => {
        if (!r.ok) return null;
        const json = await r.json() as { cn: string; en: string; url: string; error?: string };
        return json.error ? null : json;
      })
      .catch(() => null);
  }, [data, number, eventId, roundId, pbMap]);

  useEffect(() => {
    const u = data.users[String(number)];
    const ev = data.events.find(e => e.i === eventId);
    const rd = ev?.rs.find(r => r.i === roundId);
    const arr = data.resultsByRound[roundKey(eventId, roundId)] || [];
    const result = arr.find(rr => rr.n === number);
    if (!u || !ev || !rd || !result) return;
    const pb = pbMap[u.wcaid];
    const { singleRank, averageRank } = classifyPr(result, pb);
    const country = regionToIso2(u.region).toUpperCase();
    const isAvgFmt = isAvgRankedFormat(rd.f) || isBlindAvgEvent(eventId);
    const avgVal = effectiveAvg(result);
    const wantSingle = singleRank === 1 && !result.sr && result.b > 0;
    const wantAvg = averageRank === 1 && !result.ar && isAvgFmt && avgVal > 0;
    // 只在缓存未命中(undefined)时才单查;命中(含确定无名次的 null)直接跳过。
    const tasks: Promise<unknown>[] = [];
    if (wantSingle && getCachedRankForWca(result.e, result.b, 'single', country) === undefined) {
      tasks.push(fetchRankForWca(result.e, result.b, 'single', country));
    }
    if (wantAvg && getCachedRankForWca(result.e, avgVal, 'average', country) === undefined) {
      tasks.push(fetchRankForWca(result.e, avgVal, 'average', country));
    }
    if (tasks.length === 0) return;
    let cancelled = false;
    Promise.all(tasks).then(() => { if (!cancelled) setRankTick(t => t + 1); });
    return () => { cancelled = true; };
  }, [data, number, eventId, roundId, pbMap]);

  const u = data.users[String(number)];
  const ev = data.events.find(e => e.i === eventId);
  const rd = ev?.rs.find(r => r.i === roundId);
  const arr = data.resultsByRound[roundKey(eventId, roundId)] || [];
  const result = arr.find(rr => rr.n === number);

  if (!u || !ev || !rd || !result) return null;

  const pb = pbMap[u.wcaid];
  const { singleRank, averageRank } = classifyPr(result, pb);
  const singleBadge = prBadgeFor(singleRank);
  const averageBadge = prBadgeFor(averageRank);
  const isAverageFormat = isAvgRankedFormat(rd.f) || isBlindAvgEvent(eventId);
  // 多盲 Bo3 也展示非官方 Mo3(不参与排名,仅附加显示)
  const showAvgSection = isAverageFormat || (isMbldEvent(eventId) && rd.f === '3');
  // 名次与成绩表同口径:按成绩变更覆盖层订正后的值重排再取竞赛名次(并列同名次)。
  const rankEff = makeEffRank(data.users, changeMap);
  const rankedArr = arr.slice().sort(rankComparator(isAverageFormat, rankEff));
  const rankedPlaces = computePlaces(rankedArr, isAverageFormat, rankEff);
  const rIdx = rankedArr.findIndex(rr => rr.n === number);
  const place = rIdx >= 0 && result.b !== 0 ? rankedPlaces[rIdx] : null;
  const iso2 = regionToIso2(u.region);
  const attempts = result.v.filter(v => v !== 0);

  const singleTagForCopy = result.sr ? String(result.sr) : (singleRank ? 'PR' : '');
  const avgTagForCopy = result.ar ? String(result.ar) : (averageRank ? 'PR' : '');
  const canCopy = (singleTagForCopy && result.b > 0) || (avgTagForCopy && result.a > 0);

  // 渲染期同步读名次缓存(命中则秒出;未命中=undefined,上面的 effect 会单查后 bump 重渲染)。
  const country = iso2.toUpperCase();
  const singleRankBase = getCachedRankForWca(result.e, result.b, 'single', country);
  const avgRankBase = getCachedRankForWca(result.e, effectiveAvg(result), 'average', country);
  // 把本场实时成绩并进官方名次,修掉「官方 dump 滞后 → 假全国/世界第几」(同场更快成绩官方未计入)。
  const singleRankInfo = singleRankBase
    ? adjustRankWithLiveComp(singleRankBase, buildLiveCompEntries(data, pbMap, result.e, 'single'), result.b, number, country)
    : singleRankBase;
  const avgRankInfo = avgRankBase
    ? adjustRankWithLiveComp(avgRankBase, buildLiveCompEntries(data, pbMap, result.e, 'average'), effectiveAvg(result), number, country)
    : avgRankBase;

  // 破 PR:把 PR 框 + NR/WR 名次拼成一个右上角标组「PR/NR3/WR3」(只 PR 带框,名次纯文本,/ 分割).
  const renderPrMark = (info: RankResult | null | undefined) => (
    <span className="comp-pr-mark">
      <RecordBadge record="PR" variant="standalone" />
      {info?.national && <span className="comp-pr-mark-rank">/NR{info.national.rank}</span>}
      {info?.world && <span className="comp-pr-mark-rank">/WR{info.world.rank}</span>}
    </span>
  );

  async function handleCopy() {
    if (!hasEventsRef.current || !prefetchRef.current) {
      setCopyState('nothing');
      setTimeout(() => setCopyState('idle'), 1500);
      return;
    }
    setCopyState('copying');
    try {
      const json = await prefetchRef.current;
      if (!json) throw new Error('prefetch failed');
      const text = `${isZh ? json.cn : json.en}\n${json.url}`;
      await navigator.clipboard.writeText(text);
      setCopyState('done');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (e) {
      console.error('[comp copy] failed:', e);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  }

  return (
    <div className="comp-modal-backdrop comp-modal-backdrop-2" onClick={onClose}>
      <div className="comp-round-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="comp-modal-header">
          <div className="comp-modal-title">
            <Flag iso2={iso2} className="comp-flag" />
            {u.wcaid ? (
              <Link
                prefetch={false}
                href={`/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${u.wcaid}`}
                className="cuber-link-modal"
                onClick={onClose}
              >
                {displayCuberName(u.name, isZh)}
              </Link>
            ) : (
              <span>{displayCuberName(u.name, isZh)}</span>
            )}
            {place !== null && <span className="comp-round-modal-place">#{place}</span>}
          </div>
          <button type="button" className="comp-modal-close" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </header>
        <div className="comp-round-modal-body">
          <div className="comp-round-modal-subtitle">
            {compName}, {eventDisplayName(ev.i, isZh)}{(i18n.language.startsWith('zh') ? '' : ' ')}{roundDisplayName(rd.name, isZh)}
          </div>
          <section className="comp-round-modal-section">
            <div className="comp-round-modal-label">{tr({ zh: '详情', en: 'Attempts'
            })}</div>
            <div className="comp-round-modal-value">
              {attempts.length === 0
                ? '—'
                : (() => {
                    const isAo5 = (rd.f === 'a' || rd.f === '5') && attempts.length === 5;
                    if (!isAo5) return attempts.map(v => formatLive(v, result.e, false)).join(', ');
                    let bestIdx = -1, worstIdx = -1;
                    let bestVal = Infinity, worstVal = -Infinity;
                    let dnfIdx = -1;
                    attempts.forEach((v, i) => {
                      if (v === -1 || v === -2) { if (dnfIdx < 0) dnfIdx = i; return; }
                      if (v > 0 && v < bestVal) { bestVal = v; bestIdx = i; }
                      if (v > 0 && v > worstVal) { worstVal = v; worstIdx = i; }
                    });
                    if (dnfIdx >= 0) worstIdx = dnfIdx;
                    return attempts.map((v, i) => {
                      const s = formatLive(v, result.e, false);
                      return (i === bestIdx || i === worstIdx) ? `(${s})` : s;
                    }).join(', ');
                  })()}
            </div>
          </section>
          <section className="comp-round-modal-section">
            <div className="comp-round-modal-label">
              {tr({ zh: '平均', en: 'Average' })}
              {isMbldEvent(eventId) && rd.f === '3' && <UnofficialMark />}
            </div>
            <div className="comp-round-modal-value">
              {showAvgSection && effectiveAvg(result) !== 0 ? (
                (!result.ar && averageBadge === 'PR') ? (
                  <span className="comp-pr-value">
                    {formatLive(effectiveAvg(result), result.e, true)}
                    {renderPrMark(avgRankInfo)}
                  </span>
                ) : (
                  <span className="record-num-cell">
                    {formatLive(effectiveAvg(result), result.e, true)}
                    {result.ar
                      ? <RecordBadge record={String(result.ar)} variant="inline" iso2={iso2} />
                      : averageBadge ? <RecordBadge record={averageBadge} variant="inline" /> : null}
                  </span>
                )
              ) : '—'}
            </div>
          </section>
          <section className="comp-round-modal-section">
            <div className="comp-round-modal-label">{tr({ zh: '单次', en: 'Best'
            })}</div>
            <div className="comp-round-modal-value">
              {result.b !== 0 ? (
                (!result.sr && singleBadge === 'PR') ? (
                  <span className="comp-pr-value">
                    {formatLive(result.b, result.e, false)}
                    {renderPrMark(singleRankInfo)}
                  </span>
                ) : (
                  <span className="record-num-cell">
                    {formatLive(result.b, result.e, false)}
                    {result.sr
                      ? <RecordBadge record={result.sr} variant="inline" iso2={iso2} />
                      : singleBadge ? <RecordBadge record={singleBadge} variant="inline" /> : null}
                  </span>
                )
              ) : '—'}
            </div>
          </section>
        </div>
        <footer className="comp-modal-footer comp-round-modal-footer">
          {canCopy && (
            <button
              type="button"
              className="comp-modal-copy-btn"
              onClick={handleCopy}
              disabled={copyState === 'copying'}
              title={tr({ zh: '复制为推送文案', en: 'Copy as push text'
            })}
            >
              {copyState === 'done' ? <Check size={14} /> : <Copy size={14} />}
            </button>
          )}
          <LangToggle soft variant="inline" />
          <button type="button" className="comp-modal-close-btn" onClick={onShowAll}>
            {tr({ zh: '所有', en: 'All' })}
          </button>
        </footer>
      </div>
    </div>
  );
}

function LiveIndicator({ status }: { status: WsStatus; isZh: boolean }) {
  const label = (() => {
    switch (status) {
      case 'open':       return tr({ zh: '实时', en: 'Live'
    });
      case 'connecting': return tr({ zh: '连接中', en: 'Connecting'
    });
      case 'closed':     return tr({ zh: '已断开', en: 'Disconnected'
    });
      case 'error':      return tr({ zh: '连接失败', en: 'Error'
    });
      default:           return '';
    }
  })();
  if (!label) return null;
  return (
    <span className={`comp-live-indicator status-${status}`} title={tr({ zh: 'wss://cubing.com/ws 实时推送', en: 'wss://cubing.com/ws live stream'
    })}>
      <span className="comp-live-dot" />
      {label}
    </span>
  );
}
