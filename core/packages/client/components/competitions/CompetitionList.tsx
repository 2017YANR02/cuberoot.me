'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type HTMLAttributes, type RefObject } from 'react';
import { Star } from '@app-foundation/icons/lucide';
import type { CompRoundMetaMap, RoundMeta } from '@cuberoot/shared/wca-competition-data';
import { WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import Link from '@/components/AppLink';
import { Tooltip } from '@/components/Tooltip';
import { Flag as SharedFlag } from '@/components/Flag';
import { tr } from '@/i18n/tr';
import { localizeCity } from '@/lib/city-localize';
import { compLinkProps } from '@/lib/comp-link';
import { localizeCompName } from '@/lib/comp-localize';
import { isCancelledComp } from '@/lib/comp-search';
import { fetchCompRounds, fetchCompWcif, fetchCubingZh } from '@/lib/comp-wcif';
import { countryName } from '@/lib/country-name';
import { formatDateRangeIso, toIsoDate } from '@/lib/wca-date';
import { formatWcaResult } from '@/lib/wca-format-result';
import './competition-list.css';

interface EventTag {
  id: string;
  wr: 'current' | 'former' | null;
}

export interface TopCuber {
  id: string;
  name: string;
  events: EventTag[];
}

export interface Competition {
  id: string;
  name: string;
  name_zh?: string;
  city: string;
  city_zh?: string;
  country: string;
  start_date: string;
  end_date: string;
  events: string[];
  /** event 短码 → 该项目轮次数；过去比赛由 all_past_comps.json 静态字段提供，未来比赛打开 modal 时走 WCIF runtime 拉 */
  rounds?: Record<string, number>;
  /** 含双轮赛制（WCA Reg 9v，2026+）的 event 短码列表：首轮全员晋级（advancement=percent/100）。无双轮项目时缺省 */
  dual_events?: string[];
  /** 含 H2H（Head to Head，WCA round format = h）的 event 短码列表。无 H2H 项目时缺省 */
  h2h_events?: string[];
  /** event 短码 → 该项目报名/参赛人数（upcoming=WCIF 报名聚合，past=results 实际参赛）；缺省时格子留空 */
  event_regs?: Record<string, number>;
  /** event 短码 → round-1 WCIF 紧凑配置（限时/及格/晋级/资格）。未来比赛内联自 JSON；过去比赛由懒加载 meta 文件补；缺时运行时 WCIF 兜底 */
  roundMeta?: Record<string, RoundMeta>;
  competitor_limit: number;
  /** 实际参赛人数（过去比赛 all_past_comps.json 提供；未来比赛无此数据） */
  competitors?: number;
  /** 已接受报名人数（未来比赛 WCIF accepted persons 总数）；满员 = registered >= competitor_limit */
  registered?: number;
  /** 经纬度（来自比赛 JSON，Globe 视图同源）；多地代码无真实坐标为 null/缺省 */
  latitude_degrees?: number | null;
  longitude_degrees?: number | null;
  /** 场馆海拔(整数米,管道由经纬度反查 DEM,可为负如死海沿岸);无有效坐标 / 尚未查到时缺省 */
  elevation?: number;
  registration_open?: string | null;   // ISO 8601 UTC
  registration_close?: string | null;
  /** 项目修改截止时刻（ISO，单场端点专属，列表数据由管道逐场回填）；缺为 null */
  event_change_deadline?: string | null;
  cubing_china_url?: string;
  top_cubers: TopCuber[];
}

// NOTE: 后端短名 → WCA eventId（用于 cubing-icon CSS class）
export const SHORT_TO_EVENT_ID: Record<string, string> = {
  '3': '333', '2': '222', '4': '444', '5': '555', '6': '666', '7': '777',
  '3bf': '333bf', 'fm': '333fm', 'oh': '333oh',
  'minx': 'minx', 'py': 'pyram', 'clock': 'clock',
  'sk': 'skewb', 'sq1': 'sq1',
  '4bf': '444bf', '5bf': '555bf', 'mbf': '333mbf',
  'ft': '333ft', 'mbo': '333mbo', 'mag': 'magic', 'mmag': 'mmagic',
};
// 反向映射：WCA eventId → 后端短名（WCIF 用 WCA eventId,我们的 comp.events 用短名）
export const WCA_EVENT_ID_TO_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(SHORT_TO_EVENT_ID).map(([s, w]) => [w, s])
);

export const EVENT_ORDER = [...WCA_EVENT_ORDER, 'fto'];

export function competitionEventColumns(comps: readonly Pick<Competition, 'events' | 'rounds'>[]): string[] {
  const offered = new Set<string>();
  for (const { events, rounds } of comps) {
    for (const event of events) offered.add(SHORT_TO_EVENT_ID[event] ?? event);
    for (const [event, count] of Object.entries(rounds ?? {})) {
      if (count > 0) offered.add(SHORT_TO_EVENT_ID[event] ?? event);
    }
  }
  return EVENT_ORDER.filter(event => offered.has(event));
}

/** 把 YYYY-MM-DD 字符串解析为本地 Date（00:00 本地时间，避免 UTC 偏移） */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

function competitionDays(c: Competition): number {
  return daysBetween(parseLocalDate(c.start_date), parseLocalDate(c.end_date || c.start_date)) + 1;
}

// ── 国旗 ──────────────────────────────────────────────────────────────────

// 中文模式下比赛名本地化:upcoming JSON 的 name_zh(追踪选手近期赛)→ comp_names_zh.json 的英→中映射 → 兜底英文。
// 走单一入口 localizeCompName,c.name_zh 通过 explicitNameZh 传进去。
// date:该视图旁边已经显示的比赛日期/年份(日历自带年月、列表有日期列)—— 传了就剥掉名字里
// 重复的年号(全站规则 issue #65,单一实现 stripCompYear);纯名字场合(排序键 / 名长指标)不传。
export function localizeName(c: { id?: string; name: string; name_zh?: string }, isZh: boolean, date?: string | null): string {
  return localizeCompName(c.id ?? '', c.name, isZh, { explicitNameZh: c.name_zh, date });
}

export function Flag({ iso2 }: { iso2: string }) {
  return <SharedFlag iso2={iso2} spanClassName="flag-span" imgClassName="flag-img" />;
}

// 已关注比赛的视觉标记(日历条 / 列表行 / day-list)。这些都是整行/整条 <button>,不能再嵌
// 可点按钮,故只作状态指示;切换关注在 CompModal / 详情页里完成。仅在 follows 命中时渲染。
export function FollowMark() {
  return (
    <span className="comp-follow-mark" aria-hidden="true">
      <Star size={12} fill="currentColor" />
    </span>
  );
}

// 列表视图每个项目格子显示什么。rounds/regs 走静态字段；其余 4 个走 round-1 WCIF meta（仅 upcoming）。
export type EventMetric = 'rounds' | 'regs' | 'timeLimit' | 'cutoff' | 'advancement' | 'qualification';
export const EVENT_METRICS: EventMetric[] = ['rounds', 'regs', 'timeLimit', 'cutoff', 'advancement', 'qualification'];
// 需要运行时 WCIF round-1 meta 的 metric（rounds/regs 不需要）
export const WCIF_META_METRICS = new Set<EventMetric>(['timeLimit', 'cutoff', 'advancement', 'qualification']);

function pad2n(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
/** 厘秒 → 紧凑时长 "M:SS" / "H:MM:SS"（时间上限用，始终真实时间，不走事件语义） */
function fmtDurationCs(cs: number): string {
  const t = Math.round(cs / 100);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h > 0 ? `${h}:${pad2n(m)}:${pad2n(s)}` : `${m}:${pad2n(s)}`;
}

/** 结果串去掉无意义的 ".00" 尾巴，让格子更紧凑（"1:15.00"→"1:15"、"30.00"→"30"；非零厘秒保留） */
function compactResult(s: string): string { return s.replace(/\.00$/, ''); }

/** 一个项目格子在给定 metric 下的显示文本 + tooltip。wcaEid 用于事件语义结果格式化，shortEid 用于读静态字段。
 *  meta 为解析后的 round-1 紧凑配置（来自静态 JSON / 懒加载 / 运行时兜底），缺则留空。 */
function eventCellContent(
  metric: EventMetric,
  wcaEid: string,
  shortEid: string,
  c: Competition,
  meta: RoundMeta | undefined,
  isZh: boolean,
): { text: string; title?: string } {
  if (metric === 'rounds' || metric === 'regs') {
    const src = metric === 'regs' ? c.event_regs : c.rounds;
    const v = src?.[shortEid];
    return { text: v != null ? String(v) : '' };
  }
  if (!meta) return { text: '' };
  if (metric === 'timeLimit') {
    if (meta.tl == null) return { text: '' };
    const d = fmtDurationCs(meta.tl);
    return {
      text: meta.cum ? `∑${d}` : d,
      title: meta.cum
        ? (isZh ? `累计时间上限 ${d}` : `Cumulative time limit ${d}`)
        : (isZh ? `时间上限 ${d}` : `Time limit ${d}`),
    };
  }
  if (metric === 'cutoff') {
    if (!meta.co) return { text: '' };
    const [n, res] = meta.co;
    const r = compactResult(formatWcaResult(res, wcaEid, 'single'));
    const bo = n ? (isZh ? `（取${n}把）` : ` (best of ${n})`) : '';
    return { text: r, title: (isZh ? `及格线 ${r}` : `Cutoff ${r}`) + bo };
  }
  if (metric === 'advancement') {
    if (!meta.adv) return { text: '' };
    const kind = meta.adv[0];
    const level = Number(meta.adv.slice(1));
    if (kind === 'r') return { text: `T${level}`, title: isZh ? `前 ${level} 名晋级` : `Top ${level} advance` };
    if (kind === 'p') return { text: `${level}%`, title: isZh ? `前 ${level}% 晋级` : `Top ${level}% advance` };
    const r = compactResult(formatWcaResult(level, wcaEid, 'single'));
    return { text: `≤${r}`, title: isZh ? `成绩 ≤ ${r} 晋级` : `Advance if ≤ ${r}` };
  }
  // qualification: q = "type:resultType:level"
  //   ranking       → level 是排名位次(前 N 名),不是成绩值;禁过 formatWcaResult(会把"前 14 名"读成 0.14s)
  //   attemptResult → level 是成绩值(按 single/average 格式化),报名需 ≤ 该值
  //   anyResult     → 无有效 level,该项目完成过任一有效成绩即可
  if (!meta.q) return { text: '' };
  const [qType, qRes, qLevel] = meta.q.split(':');
  const isAvg = qRes === 'average';
  const rk = isAvg ? 'average' : 'single';
  let detail: string;
  if (qType === 'ranking') {
    const n = Number(qLevel);
    detail = isZh ? `${isAvg ? '平均' : '单次'}排名前 ${n}` : `top ${n} by ${rk}`;
  } else if (qType === 'attemptResult' && qLevel) {
    const r = compactResult(formatWcaResult(Number(qLevel), wcaEid, rk));
    detail = isZh ? `${isAvg ? '平均' : '单次'} ≤ ${r}` : `${rk} ≤ ${r}`;
  } else {
    detail = isZh ? `需有${isAvg ? '平均' : '单次'}成绩` : `any ${rk} result`;
  }
  return { text: 'Q', title: tr({ zh: '参赛资格：', en: 'Qualification: ' }) + detail };
}

// 列表视图整场列 metric：实际人数 / 上限(competitorLimit) / 满员率(实际÷上限) / 不显示。
// 三列合并成一列，由左下拉选当前显示哪个；点列头按它升/降排序。
// latlng = 经纬度,下拉里是一个选项,但表头/行渲染成「纬度 + 经度」两列(各自可排序)
// 'peopleLimit' = 人数 + 上限合并成一个 metric,表头展开成两个子列（人数 | 上限），同 latlng 的双列模式
// 'elevation' = 场馆海拔(米,管道由经纬度反查 DEM 烘进比赛 JSON,WCA 本身无此数据)
export type CompMetric = 'peopleLimit' | 'ratio' | 'nameLength' | 'cityLength' | 'latlng' | 'elevation';
export const COMP_METRICS: CompMetric[] = ['peopleLimit', 'ratio', 'nameLength', 'cityLength', 'latlng', 'elevation'];
// 经纬度可正可负、可为 0（赤道/本初子午线），海拔可负（死海沿岸）可为 0（海平面），
// 不能套用 "<=0 视为缺失" 的计数列规则
const SIGNED_METRICS = new Set<CompMetric>(['latlng', 'elevation']);
// 经纬度子列排序键：latlng 模式下点哪一列就按哪个坐标排
export type CoordKey = 'lat' | 'lng';
// 双列 metric 的子列排序键：latlng → lat/lng；peopleLimit → people/limit
export type SubKey = CoordKey | 'people' | 'limit';
// 列表统一排序状态：null = 默认按日期倒序。
// col='comp' 按整场列数值（latlng/peopleLimit 看 coord 子列）；col='name'/'city'/'country' 按比赛名/城市名/国家名首字母（locale 排序）。
export type SortCol = 'comp' | 'name' | 'city' | 'country' | 'date' | 'reg' | 'days' | 'event';
export type ListSort = { col: SortCol; coord?: SubKey; event?: string; dir: 'asc' | 'desc' } | null;

/** peopleLimit 双列各自的标题（人数 / 上限） */
export function subColTitle(kind: 'people' | 'limit'): string {
  return kind === 'people'
    ? tr({ zh: '人数(过去=实际参赛,未来=已报名)', en: 'People (past: competitors, upcoming: registrations)' })
    : tr({ zh: '人数上限', en: 'Competitor limit' });
}

export function compColTitle(m: CompMetric): string {
  if (m === 'ratio') return tr({ zh: '满员率(人数/上限)', en: 'Fill rate (people/limit)'
});
  if (m === 'nameLength') return tr({ zh: '比赛名称长度(字符数)', en: 'Name length (characters)'
});
  if (m === 'cityLength') return tr({ zh: '比赛城市名长度(字符数)', en: 'City name length (characters)'
});
  if (m === 'elevation') return tr({ zh: '场馆海拔(米,按坐标查 DEM,负值真实如死海沿岸)', en: 'Venue elevation (m, DEM lookup by coordinates; negative is real, e.g. Dead Sea)' });
  return '';
}

/** 经纬度子列标题（latlng 模式下两列各自的 title / aria） */
export function coordColTitle(kind: CoordKey): string {
  return kind === 'lat'
    ? tr({ zh: '纬度(北纬正 / 南纬负)', en: 'Latitude (N+ / S-)'
    })
    : tr({ zh: '经度(东经正 / 西经负)', en: 'Longitude (E+ / W-)'
    });
}

/** 当前语言下比赛城市的显示串（中文走 city_zh / 本地化，英文走原 city） */
function displayCityOf(c: Competition, isZh: boolean): string {
  return isZh ? (c.city_zh || localizeCity(c.city, true, c.country)) : c.city;
}

/** 比赛经纬度，缺坐标 / 多地代码 / (0,0) 哨兵均按缺失返回 null（与 Globe 端口径一致） */
function compCoord(c: Competition, kind: 'lat' | 'lng'): number | null {
  const lat = c.latitude_degrees, lng = c.longitude_degrees;
  if (lat == null || lng == null) return null;
  if (lat === 0 && lng === 0) return null;
  return kind === 'lat' ? lat : lng;
}

/** 整场「人数」取值:过去比赛 = 实际参赛人数(competitors);未来比赛 = 已接受报名人数(registered,开放后才有)。
 *  让列表「实际人数」列对已开放报名的未来比赛也显示报名人数,而不只是已结束的比赛。
 *  registered=0 多为 WCIF 数据缺口(cubing.com 域内赛 / 尚未处理),按缺失留空,不显示误导性的「0」。 */
function compPeople(c: { competitors?: number; registered?: number }): number | undefined {
  if (c.competitors != null) return c.competitors;
  return c.registered ? c.registered : undefined;
}

/** 满员率 = min(人数 / 人数上限, 100%)；缺人数 / 无上限(0) → null。人数 = 实际(过去) 或 报名(未来)。
 *  人数>上限(上限填错 / 多阶段 / 多地点等)视为已满员，封顶 100%，不出现 >100% 的脏值 */
function fillRate(c: { competitors?: number; registered?: number; competitor_limit: number }): number | null {
  const p = compPeople(c);
  return p != null && c.competitor_limit > 0
    ? Math.min(1, p / c.competitor_limit) : null;
}

function regPad(n: number): string { return String(n).padStart(2, '0'); }
/** 本地时区「日期 时刻」(MM-DD HH:MM)。 */
function fmtWhen(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  return `${regPad(d.getMonth() + 1)}-${regPad(d.getDate())} ${regPad(d.getHours())}:${regPad(d.getMinutes())}`;
}
/** 本地时区完整「YYYY-MM-DD HH:MM」(hover 标题用,带年份消歧)。 */
function fmtWhenFull(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${regPad(d.getMonth() + 1)}-${regPad(d.getDate())} ${regPad(d.getHours())}:${regPad(d.getMinutes())}`;
}
/** cubing.com 退赛/重开是北京时间(UTC+8)墙钟串(如 "2026-07-24 21:00:00") → epoch ms。 */
function parseBeijingMs(s: string): number {
  const m = s.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/);
  if (m) return Date.parse(`${m[1]}T${m[2]}+08:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return Date.parse(`${s.trim()}T00:00:00+08:00`);
  return NaN;
}

type CnReg = { withdrawDeadline: string | null; reopenAt: string | null } | null | undefined;

/** 比赛全部报名相关时间点(epoch ms + 标签 + 是否「开放类」,统一本地时区比较/展示)。
 *  开放/截止/修改截止来自 baked ISO(UTC);退赛/重开来自 cubing.com 北京时间串(CN 行懒拉)。 */
function regMilestones(
  open: string | null | undefined,
  close: string | null | undefined,
  change: string | null | undefined,
  cn: CnReg,
): { t: number; word: string; opening: boolean }[] {
  const out: { t: number; word: string; opening: boolean }[] = [];
  const pushIso = (iso: string | null | undefined, word: string, opening: boolean) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t)) out.push({ t, word, opening });
  };
  const pushBeijing = (s: string | null | undefined, word: string, opening: boolean) => {
    if (!s) return;
    const t = parseBeijingMs(s);
    if (Number.isFinite(t)) out.push({ t, word, opening });
  };
  pushIso(open, tr({ zh: '开放', en: 'Opens' }), true);
  pushIso(close, tr({ zh: '截止', en: 'Closes' }), false);
  pushBeijing(cn?.withdrawDeadline, tr({ zh: '退赛截止', en: 'Withdraw' }), false);
  pushBeijing(cn?.reopenAt, tr({ zh: '重开报名', en: 'Reopens' }), true);
  pushIso(change, tr({ zh: '修改截止', en: 'Edit by' }), false);
  return out;
}

/** 列表「报名」列:全部时间点里「离现在最近的将来那个」自动选中(开放类绿 / 截止类黄,24h 内红);
 *  全部已过 → 报名已截止;无报名字段(过去比赛)→ null。 */
function regMilestone(
  open: string | null | undefined,
  close: string | null | undefined,
  change: string | null | undefined,
  cn: CnReg,
): { when: string; word: string; tone: 'open' | 'close' | 'urgent' | 'closed' } | null {
  const cands = regMilestones(open, close, change, cn);
  if (!cands.length) return null;
  const now = Date.now();
  const future = cands.filter((c) => c.t > now).sort((a, b) => a.t - b.t);
  if (!future.length) return { when: '', word: tr({ zh: '报名已截止', en: 'Closed' }), tone: 'closed' };
  const n = future[0]!;
  const tone = n.opening ? 'open' : (n.t - now <= 86_400_000 ? 'urgent' : 'close');
  return { when: fmtWhen(new Date(n.t)), word: n.word, tone };
}

/** 卡片/弹窗报名胶囊(与列表视图同口径):
 *  比赛已结束(最后一天在今天之前)→「比赛已结束」,盖过报名状态;
 *  否则取下一个报名里程碑;已开赛但无报名字段 →「报名已截止」;未来比赛无字段 → null(不显胶囊)。 */
export function regCardPill(
  c: { start_date: string; end_date?: string; registration_open?: string | null; registration_close?: string | null; event_change_deadline?: string | null },
  todayStart: Date,
): { when: string; word: string; tone: 'open' | 'close' | 'urgent' | 'closed' } | null {
  if (parseLocalDate(c.end_date || c.start_date) < todayStart) {
    return { when: '', word: tr({ zh: '比赛已结束', en: 'Ended' }), tone: 'closed' };
  }
  const startPast = parseLocalDate(c.start_date) < todayStart;
  return regMilestone(c.registration_open, c.registration_close, c.event_change_deadline, undefined)
    ?? (startPast ? { when: '', word: tr({ zh: '报名已截止', en: 'Closed' }), tone: 'closed' } : null);
}

/** 日历胶囊填充色用的「当前报名状态」(本地此刻):未开放 / 报名中 / 满员 / 即将截止(<24h) / 已截止·无字段。
 *  纯色块无文字,故编码「此刻状态」而非列表用的「下一个里程碑」。只用已 bake 的 open/close + registered/limit
 *  (CN 退赛/重开是懒拉,不进上千个胶囊的填充色);过去比赛无报名字段 → closed。
 *  满员 = 报名窗口内且已接受报名 ≥ 上限(超额者进候补);截止后即便满员也只算 closed(反正报不了)。 */
export function regState(
  open: string | null | undefined,
  close: string | null | undefined,
  registered: number | null | undefined,
  limit: number | null | undefined,
): 'upcoming' | 'open' | 'urgent' | 'full' | 'closed' {
  const now = Date.now();
  const o = open ? new Date(open).getTime() : NaN;
  const c = close ? new Date(close).getTime() : NaN;
  if (Number.isFinite(o) && now < o) return 'upcoming';   // 还没开放
  if (Number.isFinite(c) && now >= c) return 'closed';    // 已过截止(满不满都报不了)
  // 此刻在报名窗口内(或无 close 字段)
  if (registered != null && limit != null && limit > 0 && registered >= limit) return 'full';  // 满员·仅候补
  if (Number.isFinite(c)) return c - now <= 86_400_000 ? 'urgent' : 'open';  // 报名中(含 24h 内紧急)
  return Number.isFinite(o) ? 'open' : 'closed';          // 无 close:open 已过→报名中;全无字段→已截止
}

/** 列表「报名」列排序键:离现在最近的「将来」报名节点 epoch ms。已全过 / 无字段 → null(沉底)。
 *  退赛/重开是 CN-only 懒拉(排序时未必加载),故排序只用 baked 的 开放/截止/修改截止。 */
function regSortMs(c: { registration_open?: string | null; registration_close?: string | null; event_change_deadline?: string | null }): number | null {
  const now = Date.now();
  const ts = [c.registration_open, c.registration_close, c.event_change_deadline]
    .map((x) => (x ? new Date(x).getTime() : NaN))
    .filter((t) => Number.isFinite(t) && t > now);
  return ts.length ? Math.min(...ts) : null;
}

/** 列表「报名」列 hover:全部报名节点完整时刻(本地时区,按时间升序,每个一行)。
 *  标签补到等宽(CJK 标签用全角空格 U+3000,原生 tooltip 里与汉字同宽)→ 各行日期列对齐。 */
function regFullTitle(
  open: string | null | undefined,
  close: string | null | undefined,
  cn: CnReg,
  change: string | null | undefined,
): string | undefined {
  const items = regMilestones(open, close, change, cn).sort((a, b) => a.t - b.t);
  if (!items.length) return undefined;
  // CJK 标签(码点 > 0xff)按全角空格补齐;拉丁标签按普通空格(原生 tooltip 比例字体无法精确对齐,尽力而为)。
  const padCh = items[0]!.word.charCodeAt(0) > 0xff ? String.fromCharCode(0x3000) : ' ';
  const maxLen = Math.max(...items.map((m) => m.word.length));
  return items
    .map((m) => `${m.word}${padCh.repeat(maxLen - m.word.length)} ${fmtWhenFull(new Date(m.t))}`)
    .join('\n');
}

// ── 列表视图 ──────────────────────────────────────────────────────────────
// 不分月，按 start_date 倒序排列、按年分组；点行同样打开 CompModal。
// 数据量可达 ~17k —— 用 fixed-height 虚拟滚动只渲染视口内 ~30 行，无上限。
// 行高统一 44px（年标题与比赛行同高）以便 O(1) 计算可见区间。

const LIST_ROW_H = 44;
const LIST_BUFFER = 8; // 视口外多渲染几行做缓冲，避免快速滚动时露白

// 列表 name / city / country 各列宽度 cap (px)：上限防极端长名撑爆行；下限保证短名筛选时不至于挤成一团
const LIST_NAME_MIN_PX = 10 * 16;
const LIST_NAME_MAX_PX = 34 * 16;
const LIST_CITY_MIN_PX = 5 * 16;
const LIST_CITY_MAX_PX = 16 * 16;
const LIST_COUNTRY_MIN_PX = 3.5 * 16;
const LIST_COUNTRY_MAX_PX = 12 * 16;
const LIST_CELL_PAD_PX = 8; // 测得最长后再加一点缓冲，防 ellipsis 误切

/** 用 canvas.measureText 分别测当前可视行 country / name / city 最长那行的实际像素宽,
 *  让三列各自贴最长一行、短名筛选场景下空白几乎消失,且各列起点对齐成独立列。
 *  不再压到视口宽:列各取自然宽(带上下限),整张表超出视口时由 .comp-list 横向滚动
 *  (桌面也滚),保证比赛名 / 国家名永远完整,长名走弹窗的旧妥协移除。O(n)，~30 行可视 ≈ 1ms。 */
function measureNameCityCols(comps: Competition[], isZh: boolean): { namePx: number; cityPx: number; countryPx: number } {
  const fallback = { namePx: 18 * 16, cityPx: 11 * 16, countryPx: 6 * 16 };
  if (typeof document === 'undefined' || comps.length === 0) return fallback;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return fallback;
  const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const bodyFont = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const nameFontPx = 0.85 * rootFontPx;
  const cityFontPx = 0.78 * rootFontPx;
  ctx.font = `500 ${nameFontPx}px ${bodyFont}`;
  let maxName = 0;
  for (let i = 0; i < comps.length; i++) {
    const w = ctx.measureText(localizeName(comps[i], isZh, comps[i].start_date)).width;
    if (w > maxName) maxName = w;
  }
  ctx.font = `400 ${cityFontPx}px ${bodyFont}`;
  let maxCity = 0;
  let maxCountry = 0;
  for (let i = 0; i < comps.length; i++) {
    const w = ctx.measureText(displayCityOf(comps[i], isZh)).width;
    if (w > maxCity) maxCity = w;
    const cw = ctx.measureText(countryName(comps[i].country, isZh)).width;
    if (cw > maxCountry) maxCountry = cw;
  }
  const nameW = Math.max(LIST_NAME_MIN_PX, Math.min(LIST_NAME_MAX_PX, maxName + LIST_CELL_PAD_PX));
  const cityW = Math.max(LIST_CITY_MIN_PX, Math.min(LIST_CITY_MAX_PX, maxCity + LIST_CELL_PAD_PX));
  const countryW = Math.max(LIST_COUNTRY_MIN_PX, Math.min(LIST_COUNTRY_MAX_PX, maxCountry + LIST_CELL_PAD_PX));
  return { namePx: nameW, cityPx: cityW, countryPx: countryW };
}

interface RowItem { comp: Competition; key: string }

export function CompetitionList({ comps, isZh, onSelect, onYearChange, outerRef, cancelledCutoffIso, pageRef, compMetric, listSort, eventMetric, eventColumns = EVENT_ORDER, pastMeta, followedIds, debutEventsByComp, hideCountry, hideCity, ratioAsPie, registrationCountNotes, viewportRef, todayForComp }: {
  comps: Competition[];
  isZh: boolean;
  onSelect?: (c: Competition) => void;
  hideCountry?: boolean;
  hideCity?: boolean;
  ratioAsPie?: boolean;
  registrationCountNotes?: ReadonlyMap<string, string>;
  viewportRef?: RefObject<HTMLDivElement | null>;
  todayForComp?: (comp: Competition) => string;
  /** 已关注比赛 id 集合 — 命中则在行内比赛名前显示关注标记(切换关注在 CompModal 里) */
  followedIds: ReadonlySet<string>;
  /** 每个项目格子显示：'rounds'=轮次数 / 'regs'=报名人数 / WCIF round-1 配置 */
  eventMetric: EventMetric;
  eventColumns?: readonly string[];
  /** 过去比赛 round-1 meta 懒加载表（comp id → short → RoundMeta）；未加载 / 未来比赛为 null */
  pastMeta: CompRoundMetaMap | null;
  /** 「项目首秀」筛选下：比赛 id → 在该场首次出现的项目短名列表；非该模式为 null,行内不标记 */
  debutEventsByComp?: Map<string, string[]> | null;
  /** 整场列显示哪个 metric：实际人数 / 上限 / 满员率 / 不显示 */
  compMetric: CompMetric;
  /** 列表统一排序状态；null = 按日期倒序 */
  listSort: ListSort;
  /** 当前可见区域所在年份（用于在 chip 行 sticky 显示）；可见为空时传 null */
  onYearChange?: (info: { year: string; count: number } | null) => void;
  /** 横向滚动容器 — 父组件用它和 chip 表头同步 scrollLeft */
  outerRef?: React.Ref<HTMLDivElement>;
  /** 已取消比赛的 end_date 阈值（ISO 字符串） */
  cancelledCutoffIso: string;
  /** 列表布局根节点，用于按可视行测量列宽 */
  pageRef: RefObject<HTMLDivElement | null>;
}) {
  // 整场列单值取值（比例/长度类，用于 col='comp' 数值排序）：经纬度 / peopleLimit 走子列(valOf)、none 返回 null
  const compVal = useCallback((c: Competition): number | null | undefined =>
    compMetric === 'ratio' ? fillRate(c)
      : compMetric === 'nameLength' ? localizeName(c, isZh).length
        : compMetric === 'cityLength' ? displayCityOf(c, isZh).length
          : compMetric === 'elevation' ? (c.elevation ?? null)
            : null, [compMetric, isZh]);
  const [wcifVersion, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const roundSortVersion = listSort?.col === 'event' ? wcifVersion : 0;
  // 缺值恒沉底，同值再按比赛日期倒序。占比与有符号指标的 0 是有效数值。
  const items = useMemo<RowItem[]>(() => {
    const sorted = [...comps];
    const byDateDesc = (a: Competition, b: Competition) => b.start_date.localeCompare(a.start_date);
    if (listSort && listSort.col === 'date') {
      const mul = listSort.dir === 'asc' ? 1 : -1;
      sorted.sort((a, b) => a.start_date.localeCompare(b.start_date) * mul || a.id.localeCompare(b.id));
    } else if (listSort && (listSort.col === 'name' || listSort.col === 'city' || listSort.col === 'country')) {
      const mul = listSort.dir === 'asc' ? 1 : -1;
      const keyOf = listSort.col === 'name'
        ? (c: Competition) => localizeName(c, isZh).trim()
        : listSort.col === 'city'
          ? (c: Competition) => displayCityOf(c, isZh).trim()
          : (c: Competition) => countryName(c.country, isZh).trim();
      const collator = new Intl.Collator(isZh ? 'zh' : 'en', { sensitivity: 'base', numeric: true });
      sorted.sort((a, b) => {
        const cmp = collator.compare(keyOf(a), keyOf(b));
        return cmp !== 0 ? cmp * mul : byDateDesc(a, b);
      });
    } else if (listSort) {
      const { col, coord, event, dir } = listSort;
      const eventKey = event ? WCA_EVENT_ID_TO_SHORT[event] ?? event : undefined;
      const canBeZero = col === 'comp' && (compMetric === 'ratio' || SIGNED_METRICS.has(compMetric));
      const direction = dir === 'asc' ? 1 : -1;
      const numericValue = (c: Competition): number | null | undefined => {
        if (col === 'reg') return regSortMs(c);
        if (col === 'days') return competitionDays(c);
        if (col === 'event') return eventKey ? c.rounds?.[eventKey] : undefined;
        if (compMetric === 'latlng') return coord === 'lat' || coord === 'lng' ? compCoord(c, coord) : null;
        if (compMetric === 'peopleLimit') return coord === 'limit' ? c.competitor_limit : compPeople(c);
        return compVal(c);
      };
      sorted.sort((a, b) => {
        const left = numericValue(a), right = numericValue(b);
        const aMissing = left == null || (!canBeZero && left <= 0);
        const bMissing = right == null || (!canBeZero && right <= 0);
        if (aMissing && bMissing) return byDateDesc(a, b);
        if (aMissing) return 1;
        if (bMissing) return -1;
        return (left - right) * direction || byDateDesc(a, b);
      });
    } else {
      sorted.sort(byDateDesc);
    }
    return sorted.map((c) => ({ comp: c, key: c.id }));
  }, [comps, listSort, compMetric, isZh, compVal, roundSortVersion]);
  const yearCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comps) {
      const y = c.start_date.slice(0, 4);
      m.set(y, (m.get(y) ?? 0) + 1);
    }
    return m;
  }, [comps]);

  const totalH = items.length * LIST_ROW_H;
  const containerRef = useRef<HTMLDivElement>(null);
  // start/end = 渲染窗口（含 LIST_BUFFER 上下缓冲）；top = 真实最顶可见行（不含 buffer），sticky 年份用它
  const [range, setRange] = useState({ start: 0, end: viewportRef ? 0 : 60, top: 0 });
  const rafRef = useRef<number | null>(null);
  // 中国大陆比赛:懒拉 cubing.com 退赛截止 / 重开报名(server PG 已日更预热,命中即毫秒),
  // 仅对当前可见 CN 行拉(全程 ≤23 场),localStorage 7 天缓存,补进「报名」列 hover。
  const [cnZh, setCnZh] = useState<Record<string, { withdrawDeadline: string | null; reopenAt: string | null }>>({});

  useEffect(() => {
    const viewport = viewportRef?.current;
    const scrollTarget = viewport ?? window;
    const compute = () => {
      rafRef.current = null;
      const el = containerRef.current;
      if (!el) return;
      const offset = el.getBoundingClientRect().top - (viewport?.getBoundingClientRect().top ?? 0);
      const height = viewport?.clientHeight ?? window.innerHeight;
      const yTop = Math.max(0, -offset) - LIST_BUFFER * LIST_ROW_H;
      const yBot = -offset + height + LIST_BUFFER * LIST_ROW_H;
      const start = Math.max(0, Math.floor(yTop / LIST_ROW_H));
      const end = Math.min(items.length, Math.ceil(yBot / LIST_ROW_H));
      const top = Math.max(0, Math.floor(Math.max(0, -offset) / LIST_ROW_H));
      setRange((prev) =>
        prev.start === start && prev.end === end && prev.top === top
          ? prev
          : { start, end, top },
      );
    };
    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(compute);
    };
    compute();
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      scrollTarget.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [items.length, viewportRef]);

  // 通知父组件当前 sticky 年份（真正可见的最顶行的年份 — 用 range.top 而不是 range.start，
  // 后者带 LIST_BUFFER 上缓冲会指向视口外往上 8 行的位置，导致跨年时年份显示滞后）
  // 非日期序（任何列排序）时列表不再按年分组，sticky 年份无意义
  // date 排序仍是按时间分组（年份升/降而已），保留 sticky 年份；其余列排序打散年份分组
  const sorted = !!listSort && listSort.col !== 'date';
  useEffect(() => {
    if (!onYearChange) return;
    if (items.length === 0 || sorted) { onYearChange(null); return; }
    const idx = Math.min(range.top, items.length - 1);
    const year = items[idx].comp.start_date.slice(0, 4);
    onYearChange({ year, count: yearCounts.get(year) ?? 0 });
  }, [range.top, items, yearCounts, onYearChange, sorted]);

  // 视口内 upcoming 比赛(无静态 rounds)自动 WCIF 预取 — 让用户不用 hover 也能看到轮次数。
  // fetchCompRounds 内部有 inflight + cache 去重,浏览器同 host 并发上限 6,自然节流。
  // 拉到后直接 mutate c.rounds(WCA eventId → short eid 映射),bump 一次状态触发 re-render。
  useEffect(() => {
    let cancelled = false;
    // round-1 WCIF meta（限时/及格/晋级/资格）只对 upcoming 比赛运行时拉取 —— 过去比赛
    // WCA dump 本就没有这些字段，且 list 含 ~17k 过去赛，逐行拉 WCIF 会狂打 WCA。
    const wantMeta = WCIF_META_METRICS.has(eventMetric);
    const todayIso = toIsoDate(new Date());
    const window = items.slice(range.start, range.end);
    for (const it of window) {
      const c = it.comp;
      const isUpcoming = (c.end_date || c.start_date) >= (todayForComp?.(c) ?? todayIso);
      if (!isUpcoming) continue;
      const needRounds = !(c.rounds && Object.keys(c.rounds).length > 0);
      const needMeta = wantMeta && !c.roundMeta;
      if (!needRounds && !needMeta) continue;
      fetchCompWcif(c.id).then((w) => {
        if (cancelled) return;
        const hasRounds = needRounds && Object.keys(w.rounds).length > 0;
        if (needRounds) {
          const mapped: Record<string, number> = {};
          for (const [eid, formats] of Object.entries(w.rounds)) {
            mapped[WCA_EVENT_ID_TO_SHORT[eid] ?? eid] = formats.length;
          }
          c.rounds = mapped;
        }
        const meta: Record<string, RoundMeta> = {};
        for (const [eid, mm] of Object.entries(w.meta)) {
          meta[WCA_EVENT_ID_TO_SHORT[eid] ?? eid] = mm;
        }
        c.roundMeta = meta;
        if (hasRounds || needMeta) forceUpdate();
      });
    }
    return () => { cancelled = true; };
  }, [range.start, range.end, items, eventMetric, todayForComp]);

  // 自适应 country / name / city 三列宽：测当前渲染窗口（含 LIST_BUFFER 缓冲）各自 max，写到
  // 布局根节点的 --cl-name-width / --cl-city-width / --cl-country-width。滚动到长名行时 cell 扩、滚出再收。
  // 列各取自然宽（不再压到视口）→ 整张表可能比视口宽，由 .comp-list 横向滚动撑开（桌面也滚），
  // 比赛名 / 国家名永远完整。设好列宽后量一次表头 grid 的真实内容宽，写进 --cl-list-min 驱动虚拟列表
  // 的最小宽（≥ 内容宽才能横向滚、≤ 视口时退回 100% 不留滚动条）。LIST_BUFFER=8 让长名提前测到，平滑抖动。
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const apply = () => {
      const visibleComps = items.slice(range.start, range.end).map((it) => it.comp);
      const { namePx, cityPx, countryPx } = measureNameCityCols(visibleComps, isZh);
      el.style.setProperty('--cl-name-width', `${namePx}px`);
      el.style.setProperty('--cl-city-width', `${cityPx}px`);
      el.style.setProperty('--cl-country-width', `${countryPx}px`);
      // 读表头 grid 的实际渲染宽（width:max-content，含新列宽）→ 列表最小宽，桌面/移动端统一横向滚
      const grid = el.querySelector('.event-chips-grid');
      if (grid) el.style.setProperty('--cl-list-min', `${Math.ceil(grid.getBoundingClientRect().width)}px`);
    };
    apply();
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [range.start, range.end, items, isZh, compMetric, eventMetric, eventColumns, pageRef]);

  // 可见 CN 行 → 懒拉 cubing.com 退赛/重开(补进报名 hover)。命中 cnZh 即跳过,只增不重拉,自然收敛。
  useEffect(() => {
    for (const it of items.slice(range.start, range.end)) {
      const c = it.comp;
      if (c.country !== 'CN' || cnZh[c.id]) continue;
      fetchCubingZh(c.id)
        .then((m) => setCnZh((prev) => (prev[c.id] ? prev : { ...prev, [c.id]: { withdrawDeadline: m.withdrawDeadline, reopenAt: m.reopenAt } })))
        .catch(() => {});
    }
  }, [items, range.start, range.end, cnZh]);

  // 卸载时清理 — 切回日历模式不留 stale 列宽变量
  useEffect(() => () => {
    pageRef.current?.style.removeProperty('--cl-name-width');
    pageRef.current?.style.removeProperty('--cl-city-width');
    pageRef.current?.style.removeProperty('--cl-country-width');
    pageRef.current?.style.removeProperty('--cl-list-min');
  }, [pageRef]);

  if (items.length === 0) {
    return <div className="comp-list-empty">{tr({ zh: '没有匹配的比赛', en: 'No competitions match'
    })}</div>;
  }

  const visible = items.slice(range.start, range.end);
  const todayIso = toIsoDate(new Date()); // 列表行判定「比赛已结束」用(本地日)

  return (
    <div className="comp-list" ref={outerRef}>
      <div ref={containerRef} className="comp-list-virtual" style={{ height: totalH }}>
        {visible.map((it, i) => {
          const idx = range.start + i;
          const top = idx * LIST_ROW_H;
          const c = it.comp;
          const endDate = c.end_date || c.start_date;
          const dateStr = formatDateRangeIso(c.start_date, endDate);
          const crossYear = c.start_date.slice(0, 4) !== endDate.slice(0, 4);
          // 左边就是日期列(带年,跨年时两半都写全)—— 名字里的年号是重复信息,剥掉。
          const displayName = localizeName(c, isZh, c.start_date);
          const displayCity = hideCity ? null : displayCityOf(c, isZh);
          const prefetch = c.rounds ? undefined : () => { void fetchCompRounds(c.id); };
          const events = c.events ?? [];
          const cancelled = isCancelledComp(c, cancelledCutoffIso);
          // 该场 round-1 meta：未来比赛内联 / 运行时兜底走 c.roundMeta；过去比赛走懒加载的 pastMeta 表
          const cMeta = c.roundMeta ?? pastMeta?.[c.id];
          const rowProps = {
            className: `comp-list-row${cancelled ? ' is-cancelled' : ''}`,
            style: { top, height: LIST_ROW_H },
            onMouseEnter: prefetch,
          };
          const showPie = compMetric === 'ratio' && ratioAsPie;
          const pieRatio = showPie ? fillRate(c) : null;
          const cells = (tip?: HTMLAttributes<HTMLElement>) => (
            <>
              {(() => {
                // 比赛已结束(今天在比赛最后一天之后)→ 一律「比赛已结束」,盖过报名状态。
                if (endDate < (todayForComp?.(c) ?? todayIso)) {
                  return (
                    <span className="cl-reg-cell cl-reg-cell--closed">
                      <span className="cl-reg-word">{tr({ zh: '比赛已结束', en: 'Ended' })}</span>
                    </span>
                  );
                }
                // 报名列 = 全部时间点(开放/截止/退赛/重开/修改截止)里离现在最近的「将来」那个,按时间自动选。
                const cn = cnZh[c.id];
                const r = regMilestone(c.registration_open, c.registration_close, c.event_change_deadline, cn);
                const title = regFullTitle(c.registration_open, c.registration_close, cn, c.event_change_deadline);
                if (!r) return <span className="cl-reg-cell" title={title} aria-hidden={!title} />;
                return (
                  <span className={`cl-reg-cell cl-reg-cell--${r.tone}`} title={title}>
                    {r.when && <span className="cl-reg-when mono">{r.when}</span>}
                    <span className="cl-reg-word">{r.word}</span>
                  </span>
                );
              })()}
              <span className="comp-list-date mono">
                {crossYear ? (
                  <>
                    <span className="cl-date-half">{c.start_date}~</span>
                    <span className="cl-date-half">{endDate}</span>
                  </>
                ) : dateStr}
              </span>
              <Flag iso2={c.country} />
              <span className="comp-list-name-cell">
                {followedIds.has(c.id) && <FollowMark />}
                <span className="comp-list-name">{displayName}</span>
              </span>
              {!hideCountry && <span className="comp-list-country" title={countryName(c.country, isZh)}>{countryName(c.country, isZh)}</span>}
              {!hideCity && <span className="comp-list-city">{displayCity}</span>}
              <span className="cl-days-cell" title={tr({ zh: '天数', en: 'Days'
            })}>
                {competitionDays(c)}
              </span>
              {showPie ? (
                <span
                  className={`cl-fill-pie${pieRatio == null ? ' is-unknown' : ''}`}
                  style={{ '--cl-fill-percent': `${(pieRatio ?? 0) * 100}%` } as CSSProperties}
                  onPointerEnter={tip?.onPointerEnter}
                  onPointerLeave={tip?.onPointerLeave}
                  aria-hidden="true"
                />
              ) : compMetric === 'latlng' ? (
                (['lat', 'lng'] as CoordKey[]).map((k) => {
                  const v = compCoord(c, k);
                  return (
                    <span key={k} className="cl-people-cell" title={coordColTitle(k)}>
                      {v == null ? '' : v.toFixed(2)}
                    </span>
                  );
                })
              ) : compMetric === 'peopleLimit' ? (
                (['people', 'limit'] as const).map((k) => {
                  const v = k === 'people' ? compPeople(c) : (c.competitor_limit > 0 ? c.competitor_limit : undefined);
                  return (
                    <span key={k} className={`cl-people-cell${k === 'limit' ? ' cl-limit-cell' : ''}`} title={subColTitle(k)}>
                      {v != null ? v : ''}
                    </span>
                  );
                })
              ) : (
                <span
                  className={`cl-people-cell${compMetric === 'ratio' ? ' cl-limit-cell' : ''}`}
                  title={compColTitle(compMetric)}
                >
                  {(() => {
                    if (compMetric === 'ratio') { const r = fillRate(c); return r == null ? '' : `${Math.round(r * 100)}%`; }
                    if (compMetric === 'nameLength') return localizeName(c, isZh).length;
                    if (compMetric === 'cityLength') return displayCityOf(c, isZh).length;
                    if (compMetric === 'elevation') return c.elevation ?? '';
                    return '';
                  })()}
                </span>
              )}
              {eventColumns.map((eid) => {
                const shortEid = WCA_EVENT_ID_TO_SHORT[eid] ?? eid;
                const has = events.includes(shortEid) || events.includes(eid);
                const isDual = c.dual_events?.includes(shortEid) ?? false;
                const isDebutEvent = debutEventsByComp?.get(c.id)?.includes(shortEid) ?? false;
                const { text, title } = eventCellContent(eventMetric, eid, shortEid, c, cMeta?.[shortEid], isZh);
                const content = text !== '' ? text : (has ? '·' : '');
                const markClass = isDebutEvent ? 'cl-event-debut' : isDual ? 'cl-event-dual' : '';
                const markTitle = isDebutEvent
                  ? tr({ zh: '该项目首秀 · 在此场首次出现于 WCA 比赛', en: "Event debut · this event's first-ever WCA appearance" })
                  : isDual
                    ? tr({ zh: '双轮赛制 · 前两轮合并排名', en: 'Dual rounds · first two rounds combined' })
                    : title;
                return (
                  <span
                    key={eid}
                    className="cl-event-cell"
                    title={markTitle}
                  >
                    {markClass ? <span className={markClass}>{content}</span> : content}
                  </span>
                );
              })}
            </>
          );
          const renderRow = (tip?: HTMLAttributes<HTMLElement>) => {
            const props = {
              ...rowProps,
              'aria-describedby': tip?.['aria-describedby'],
              onFocus: (event: React.FocusEvent<HTMLElement>) => {
                prefetch?.();
                tip?.onFocus?.(event);
              },
              onBlur: tip?.onBlur,
            };
            return onSelect ? (
              <button key={it.key} type="button" {...props} onClick={() => onSelect(c)}>{cells(tip)}</button>
            ) : (
              <Link key={it.key} {...compLinkProps(c.id)} {...props}>{cells(tip)}</Link>
            );
          };
          if (!showPie) return renderRow();

          const people = compPeople(c);
          const limit = c.competitor_limit > 0 ? c.competitor_limit : undefined;
          const peopleLabel = tr({ zh: '报名人数', en: 'Registrations' });
          const limitLabel = tr({ zh: '人数上限', en: 'Competitor limit' });
          const counts = `${peopleLabel} ${people?.toLocaleString() ?? '—'} / ${limitLabel} ${limit?.toLocaleString() ?? '—'}`;
          const note = registrationCountNotes?.get(c.id);
          return (
            <Tooltip key={it.key} content={note ? `${counts}\n${note}` : counts}>
              {renderRow}
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
