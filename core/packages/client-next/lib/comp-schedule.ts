// WCA competition schedule (赛程) data layer.
// The 10MB public WCIF (95% persons roster) is NEVER downloaded by the browser:
// our cached server proxy returns the SMALL trimmed schedule (tens of KB). The
// trim + shared shapes live in @cuberoot/shared/comp-schedule so the client,
// server proxy and backfill all agree on the exact shape.
// All timezone conversion uses native Intl.DateTimeFormat — no luxon/date-fns.

import { eventDisplayName } from './wca-events';
import { apiUrl } from './api-base';
import {
  parseActivityCode, trimWcif,
  type RawWcif, type ScheduleData, type ScheduleActivity, type RoundInfo,
} from '@cuberoot/shared/comp-schedule';

// Re-export the shared shapes so existing local imports keep working unchanged.
export type {
  ScheduleData, ScheduleActivity, ScheduleRoom, ScheduleVenue, RoundInfo,
} from '@cuberoot/shared/comp-schedule';
export { parseActivityCode } from '@cuberoot/shared/comp-schedule';

// Layout-augmented activity (computed at render, not cached)
export interface LaidOutActivity extends ScheduleActivity {
  dateKey: string;       // venue-local ISO date "2025-07-03"
  startMin: number;      // minutes from local midnight
  endMin: number;
  columnIndex: number;   // within its overlap cluster
  columnCount: number;
}
export interface DayColumn {
  dateKey: string;       // "2025-07-03"
  activities: LaidOutActivity[];
}

// ── Fetch + cache ───────────────────────────────────────────────────
// Primary path: our cached server proxy returns the trimmed schedule (~tens of
// KB). Fallback: if the proxy is unreachable, fetch the WCIF directly from WCA
// and trim client-side — the slow ~10MB path, kept only for resilience.
// localStorage caches the trimmed object for 24h.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = 'wca-comp-schedule-v1-';
const inflight = new Map<string, Promise<ScheduleData | null>>();

function cacheGet(id: string): ScheduleData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as { t: number; v: ScheduleData };
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch { return null; }
}

function cacheSet(id: string, v: ScheduleData): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ t: Date.now(), v })); }
  catch { /* quota / private mode */ }
}

// Direct WCA WCIF + client-side trim — resilience fallback only (slow ~10MB).
async function fetchScheduleDirect(compId: string): Promise<ScheduleData | null> {
  const res = await fetch(
    `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(compId)}/wcif/public`,
  );
  if (!res.ok) return null;
  return trimWcif((await res.json()) as RawWcif);
}

/**
 * Lazily loads the trimmed schedule: localStorage (24h) → server proxy →
 * (on proxy failure) direct WCA. Returns null when the comp has no schedule.
 * Inflight-deduped.
 */
export async function fetchCompSchedule(compId: string): Promise<ScheduleData | null> {
  if (!compId) return null;
  const cached = cacheGet(compId);
  if (cached) return cached;
  const existing = inflight.get(compId);
  if (existing) return existing;
  const p = (async () => {
    try {
      try {
        const res = await fetch(apiUrl(`/v1/wca/comp/${encodeURIComponent(compId)}/schedule`));
        if (res.ok) {
          const data = ((await res.json()) as { schedule: ScheduleData | null }).schedule;
          if (data) cacheSet(compId, data);
          return data;
        }
      } catch { /* proxy unreachable → fall through to direct WCA */ }
      const data = await fetchScheduleDirect(compId);
      if (data) cacheSet(compId, data);
      return data;
    } catch {
      return null;
    } finally {
      inflight.delete(compId);
    }
  })();
  inflight.set(compId, p);
  return p;
}

// ── Pure helpers ─────────────────────────────────────────────────────

// WCA round-type id (verbatim port of reference wcif.js getRoundTypeId)
export function getRoundTypeId(
  roundNumber: number, totalNumberOfRounds: number, hasCutoff: boolean,
): string {
  const isFinal = roundNumber === totalNumberOfRounds;
  if (isFinal) return hasCutoff ? 'c' : 'f';
  if (roundNumber === 1) return hasCutoff ? 'd' : '1';
  if (roundNumber === 2) return hasCutoff ? 'e' : '2';
  return hasCutoff ? 'g' : '3';
}

const ROUND_TYPE_NAME: Record<string, { zh: string; en: string }> = {
  '0': { zh: '资格赛', en: 'Qualification round' },
  '1': { zh: '初赛', en: 'First round' },
  '2': { zh: '复赛', en: 'Second round' },
  '3': { zh: '半决赛', en: 'Semi Final' },
  'b': { zh: 'B组决赛', en: 'B Final' },
  'c': { zh: '组合制决赛', en: 'Final' },
  'd': { zh: '组合制初赛', en: 'First round' },
  'e': { zh: '组合制复赛', en: 'Second round' },
  'f': { zh: '决赛', en: 'Final' },
  'g': { zh: '组合制半决赛', en: 'Semi Final' },
  'h': { zh: '组合制资格赛', en: 'Qualification round' },
};
export function roundTypeName(id: string, isZh: boolean): string {
  return ROUND_TYPE_NAME[id]?.[isZh ? 'zh' : 'en'] ?? id;
}

// 紧凑英文代号（来源行 / 标签用）：R1/R2/R3/Fi/Q/BF；中文保持完整名不变。
const ROUND_TYPE_SHORT_EN: Record<string, string> = {
  '0': 'Q', '1': 'R1', '2': 'R2', '3': 'R3',
  'b': 'BF', 'c': 'Fi', 'd': 'R1', 'e': 'R2', 'f': 'Fi', 'g': 'R3', 'h': 'Q',
};
export function roundTypeShort(id: string, isZh: boolean): string {
  if (isZh) return ROUND_TYPE_NAME[id]?.zh ?? id;
  return ROUND_TYPE_SHORT_EN[id] ?? ROUND_TYPE_NAME[id]?.en ?? id;
}

const FORMAT_NAME: Record<string, { zh: string; enShort: string }> = {
  '1': { zh: '单次计最好', enShort: 'Bo1' },
  '2': { zh: '两次计最好', enShort: 'Bo2' },
  '3': { zh: '三次计最好', enShort: 'Bo3' },
  '5': { zh: '五次计最好', enShort: 'Bo5' },
  'a': { zh: '五次计平均', enShort: 'Ao5' },
  'm': { zh: '三次计平均', enShort: 'Mo3' },
  'h': { zh: '1对1', enShort: 'H2H' },
};
export function formatName(fmt: string, isZh: boolean): string {
  return isZh ? (FORMAT_NAME[fmt]?.zh ?? fmt) : (FORMAT_NAME[fmt]?.enShort ?? fmt);
}

const ACTIVITY_NAMES: Record<string, { zh: string; en: string }> = {
  registration: { zh: '现场报名', en: 'On-site registration' },
  checkin: { zh: '签到', en: 'Check-in' },
  tutorial: { zh: '新手教学', en: 'Tutorial for new competitors' },
  multi: { zh: '多盲魔方提交', en: 'Cube submission for 3x3x3 Multi-Blind' },
  breakfast: { zh: '早餐', en: 'Breakfast' },
  lunch: { zh: '午餐', en: 'Lunch' },
  dinner: { zh: '晚餐', en: 'Dinner' },
  awards: { zh: '颁奖', en: 'Awards' },
  setup: { zh: '布置', en: 'Setup' },
  teardown: { zh: '收尾', en: 'Teardown' },
  misc: { zh: '其他', en: 'Other' },
};

// eventId of an activity (or '' for other-*)
export function eventOfActivity(a: { activityCode: string }): string {
  const { eventId } = parseActivityCode(a.activityCode);
  return eventId === 'other' ? '' : eventId;
}

// Round id for an activity code: strip group/attempt suffix.
// "333fm-r1-a1" -> "333fm-r1", "333-r1" -> "333-r1".
export function roundIdOf(activityCode: string): string {
  return activityCode.split('-').slice(0, 2).join('-');
}

/**
 * Localized human name for a schedule activity.
 * - other-*: ACTIVITY_NAMES[key]?.[lang]; unknown key -> raw activity.name.
 * - round: "<event display name>, <round type name>".
 * - orphan round (not in `rounds`): raw activity.name.
 * eventNameFn defaults to eventDisplayName (pure lib); injectable for tests.
 */
export function localizeActivityName(
  activity: ScheduleActivity,
  rounds: Record<string, RoundInfo>,
  isZh: boolean,
  eventNameFn: (eventId: string, isZh: boolean) => string = eventDisplayName,
): string {
  const { eventId, roundNumber, attempt } = parseActivityCode(activity.activityCode);
  if (eventId === 'other') {
    const key = activity.activityCode.split('-')[1] ?? '';
    const dict = ACTIVITY_NAMES[key];
    return dict ? dict[isZh ? 'zh' : 'en'] : activity.name;
  }
  // Attempt-scheduled activities (FM/MBLD) carry an -a suffix; the round is keyed by round id.
  const round = rounds[roundIdOf(activity.activityCode)];
  if (!round || roundNumber === undefined) return activity.name;
  const rtId = getRoundTypeId(round.roundNumber, round.totalRounds, !!round.cutoff);
  const ev = eventNameFn(round.eventId, isZh);
  const rt = roundTypeName(rtId, isZh);
  const base = `${ev} ${rt}`;
  if (attempt !== undefined) {
    return isZh ? `${base} (第${attempt}次还原)` : `${base} (Attempt ${attempt})`;
  }
  return base;
}

// ── Result-value formatting ─────────────────────────────────────────

// centiseconds -> WCA clock. Port of centisecondsToClockFormat.
export function centisecondsToClock(cs: number): string {
  const totalCs = Math.round(cs);
  const cc = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  const cc2 = String(cc).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${cc2}`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}.${cc2}`;
  return `${s}.${cc2}`;
}

// MBLD points decode stub — no MBLD cutoff/advancement observed in practice.
function mbPoints(v: number): number { return v; }

// Time limit text. Returns '' if no meaningful limit.
export function timeLimitText(
  round: RoundInfo, allRounds: Record<string, RoundInfo>, isZh: boolean,
): string {
  if (round.timeLimit === null) {
    if (round.eventId === '333fm') return isZh ? '一小时' : '1 hour';
    if (round.eventId === '333mbf') {
      return isZh ? '每魔方十分钟' : '10:00.00 per cube, up to 60:00.00';
    }
    return '';
  }
  const timeStr = centisecondsToClock(round.timeLimit.centiseconds);
  const ids = round.timeLimit.cumulativeRoundIds;
  if (ids.length === 0) return timeStr;
  if (ids.length === 1) return isZh ? `累计${timeStr}` : `${timeStr} cumulative`;
  const roundLabel = (id: string): string => {
    const r = allRounds[id];
    if (!r) return id;
    const rtId = getRoundTypeId(r.roundNumber, r.totalRounds, !!r.cutoff);
    return `${eventDisplayName(r.eventId, isZh)} ${roundTypeName(rtId, isZh)}`;
  };
  const roundStr = ids.map(roundLabel).join(', ');
  return isZh ? `${roundStr}轮总计${timeStr}` : `${timeStr} total for ${roundStr}`;
}

// Cutoff text. '' if no cutoff.
export function cutoffText(round: RoundInfo, isZh: boolean): string {
  if (!round.cutoff) return '';
  const n = round.cutoff.numberOfAttempts;
  const attemptResult = round.cutoff.attemptResult;
  if (round.eventId === '333fm') {
    const moves = attemptResult;
    return isZh
      ? `${n}次尝试 < ${moves}步`
      : `${n} attempt${n > 1 ? 's' : ''} to get < ${moves} moves`;
  }
  if (round.eventId === '333mbf') {
    const points = mbPoints(attemptResult);
    return isZh
      ? `${n}次尝试 > ${points}分`
      : `${n} attempt${n > 1 ? 's' : ''} to get > ${points} points`;
  }
  const time = centisecondsToClock(attemptResult);
  return isZh
    ? `${n}次尝试 < ${time}`
    : `${n} attempt${n > 1 ? 's' : ''} to get < ${time}`;
}

// Advancement text. '' if none.
export function advancementText(round: RoundInfo, isZh: boolean): string {
  const ac = round.advancementCondition;
  if (!ac) return '';
  if (ac.type === 'ranking') {
    return isZh ? `排名前${ac.level}晋级下一轮` : `Top ${ac.level} advance to next round`;
  }
  if (ac.type === 'percent') {
    return isZh ? `前${ac.level}%晋级下一轮` : `Top ${ac.level}% advance to next round`;
  }
  // attemptResult
  const rf = formatName(round.format, isZh);
  if (round.eventId === '333fm') {
    return isZh
      ? `${rf} < ${ac.level}步晋级下一轮`
      : `${rf} < ${ac.level} moves advances to next round`;
  }
  if (round.eventId === '333mbf') {
    const pts = mbPoints(ac.level);
    return isZh
      ? `${rf} > ${pts}点晋级下一轮`
      : `${rf} > ${pts} points advances to next round`;
  }
  const time = centisecondsToClock(ac.level);
  return isZh
    ? `${rf} < ${time}晋级下一轮`
    : `${rf} < ${time} advances to next round`;
}

// ── Timezone + timegrid math ─────────────────────────────────────────

/**
 * Convert a UTC ISO string to venue-local fields using native Intl ONLY.
 */
export function localParts(utcIso: string, timeZone: string): {
  dateKey: string;     // "2025-07-03"
  minutesOfDay: number;// 0..1439
  hhmm: string;        // "16:30"
} {
  const dt = new Date(utcIso);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(dt);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  let hour = get('hour'); if (hour === '24') hour = '00'; // Intl quirk: midnight may be "24"
  const dateKey = `${get('year')}-${get('month')}-${get('day')}`;
  const minutesOfDay = parseInt(hour, 10) * 60 + parseInt(get('minute'), 10);
  const hhmm = `${hour}:${get('minute')}`;
  return { dateKey, minutesOfDay, hhmm };
}

// Build per-day columns with overlap clustering.
export function computeDayColumns(data: ScheduleData, timeZone: string): {
  days: DayColumn[];
  slotMinHour: number;
  slotMaxHour: number;
} {
  if (data.activities.length === 0) return { days: [], slotMinHour: 8, slotMaxHour: 20 };

  // 1. localize each activity
  type Pre = ScheduleActivity & { dateKey: string; startMin: number; endMin: number };
  const pre: Pre[] = data.activities.map(a => {
    const start = localParts(a.startTime, timeZone);
    const end = localParts(a.endTime, timeZone);
    let endMin = end.minutesOfDay;
    if (endMin <= start.minutesOfDay) endMin = 24 * 60; // cross-midnight clamp
    return { ...a, dateKey: start.dateKey, startMin: start.minutesOfDay, endMin };
  });

  // 2. group by dateKey
  const byDay = new Map<string, Pre[]>();
  for (const p of pre) {
    const arr = byDay.get(p.dateKey);
    if (arr) arr.push(p); else byDay.set(p.dateKey, [p]);
  }

  let globalMin = Infinity;
  let globalMaxEnd = -Infinity;
  const days: DayColumn[] = [];

  for (const dateKey of Array.from(byDay.keys()).sort()) {
    const list = byDay.get(dateKey)!;
    list.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

    // overlap clustering: maximal chains of transitive overlap -> equal-width split
    const laid: LaidOutActivity[] = [];
    let cluster: Pre[] = [];
    let clusterEnd = -Infinity;
    const flush = () => {
      const count = cluster.length;
      cluster.forEach((p, i) => {
        laid.push({ ...p, columnIndex: i, columnCount: count });
      });
      cluster = [];
      clusterEnd = -Infinity;
    };
    for (const p of list) {
      if (cluster.length > 0 && p.startMin >= clusterEnd) flush();
      cluster.push(p);
      clusterEnd = Math.max(clusterEnd, p.endMin);
    }
    if (cluster.length > 0) flush();

    for (const p of laid) {
      if (p.startMin < globalMin) globalMin = p.startMin;
      if (p.endMin > globalMaxEnd) globalMaxEnd = p.endMin;
    }
    days.push({ dateKey, activities: laid });
  }

  const slotMinHour = Math.max(0, Math.floor(globalMin / 60));
  const slotMaxHour = Math.min(24, Math.ceil((globalMaxEnd + 10) / 60));
  return { days, slotMinHour, slotMaxHour };
}

// ── Calendar (FullCalendar) layout ───────────────────────────────────
// FullCalendar shares ONE slotMinTime/slotMaxTime across every day column, so
// the bounds must be a time-of-day window — not a global minute clamped to 0,
// which would make a comp whose only "early" activity is the small hours of a
// later day show a dead 00:00→evening gap on the first day.

export interface CalendarLayout {
  slotMinTime: string;   // "HH:MM:SS"
  slotMaxTime: string;   // "HH:MM:SS" — may exceed 24:00 for overnight comps
  dayKeys: string[];     // venue-local column anchors, sorted
  overnight: boolean;    // single continuous column running past midnight
}

const hms = (totalMin: number): string => {
  const m = Math.round(totalMin);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
};

/** Add N calendar days to a "YYYY-MM-DD" key, timezone-independently. */
export function addDaysToKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Slot bounds + columns for the FullCalendar view.
 * - Normal comp: floor-to-hour of the earliest start to (latest end + buffer),
 *   clamped to [0, 24], every local day a column.
 * - Overnight comp (a single night straddling midnight — e.g. a New-Year
 *   countdown): one continuous column anchored on the first day, slot times
 *   running past 24:00 so the small hours sit below midnight with no dead gap.
 */
export function computeCalendarLayout(data: ScheduleData, timeZone: string): CalendarLayout {
  const acts = data.activities.map(a => {
    const s = localParts(a.startTime, timeZone);
    const e = localParts(a.endTime, timeZone);
    return { sKey: s.dateKey, sMin: s.minutesOfDay, eKey: e.dateKey, eMin: e.minutesOfDay };
  });
  if (acts.length === 0) {
    return { slotMinTime: '08:00:00', slotMaxTime: '20:00:00', dayKeys: [], overnight: false };
  }
  const dayKeys = Array.from(new Set(acts.map(a => a.sKey))).sort();

  if (dayKeys.length === 2) {
    const [d1, d2] = dayKeys;
    const day1 = acts.filter(a => a.sKey === d1);
    const day2 = acts.filter(a => a.sKey === d2);
    const day1LatestEnd = Math.max(...day1.map(a => (a.eKey === d1 ? a.eMin : 24 * 60)));
    const day2EarliestStart = Math.min(...day2.map(a => a.sMin));
    const day2LatestEnd = Math.max(...day2.map(a => (a.eKey === d2 ? a.eMin : 24 * 60)));
    const crossesMidnight = acts.some(a => a.eKey !== a.sKey);
    // A continuous night: day 1 runs into the late evening (or an activity
    // crosses midnight) and day 2 both starts and ends before dawn.
    if (day2EarliestStart < 6 * 60 && day2LatestEnd <= 8 * 60 && (day1LatestEnd >= 22 * 60 || crossesMidnight)) {
      const earliest = Math.min(...day1.map(a => a.sMin));
      const minMin = Math.floor(earliest / 60) * 60;
      const maxMin = Math.min(30 * 60, Math.ceil((day2LatestEnd + 24 * 60 + 10) / 60) * 60);
      return { slotMinTime: hms(minMin), slotMaxTime: hms(maxMin), dayKeys: [d1], overnight: true };
    }
  }

  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const a of acts) {
    if (a.sMin < minStart) minStart = a.sMin;
    const end = a.eKey !== a.sKey || a.eMin <= a.sMin ? 24 * 60 : a.eMin;
    if (end > maxEnd) maxEnd = end;
  }
  const minMin = Math.max(0, Math.floor(minStart / 60) * 60);
  const maxMin = Math.min(24 * 60, Math.max(minMin + 60, Math.ceil((maxEnd + 10) / 60) * 60));
  return { slotMinTime: hms(minMin), slotMaxTime: hms(maxMin), dayKeys, overnight: false };
}

// Readable text color over a room hex. WCAG luminance.
export function readableTextColor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return '#f5f5f5';
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.5 ? '#1a1a1a' : '#f5f5f5';
}

// Localized weekday + date header, e.g. "7月3日周四" / "Thu, Jul 3".
// dateKey is already the venue-local Y-M-D (from localParts); format it tz-independently
// at UTC midnight so a viewer in any timezone sees the venue's actual calendar day.
export function dayHeaderLabel(dateKey: string, _timeZone: string, isZh: boolean): string {
  const dt = new Date(`${dateKey}T00:00:00Z`);
  return new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
  }).format(dt);
}

// Full localized date for the WCA-style table heading "Schedule for <date>".
// Mirrors luxon DATE_HUGE: en -> "Wednesday, June 3, 2026", zh -> "2026年6月3日星期三".
export function fullDateLabel(dateKey: string, isZh: boolean): string {
  const dt = new Date(`${dateKey}T00:00:00Z`);
  return new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(dt);
}

// Locale-aware clock label like the WCA table (luxon TIME_SIMPLE):
// en -> "6:30 PM", zh -> "18:30".
export function simpleTimeLabel(utcIso: string, timeZone: string, isZh: boolean): string {
  return new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', {
    timeZone, hour: 'numeric', minute: '2-digit',
  }).format(new Date(utcIso));
}

// Short format code (Ao5 / Bo2 / Mo3) — untranslated, exactly as the WCA table shows.
export function formatShort(fmt: string): string {
  return FORMAT_NAME[fmt]?.enShort ?? fmt;
}

// Format cell for the table: cutoff rounds show "<cutoff format> / <round format>"
// (e.g. "Bo2 / Ao5"), matching the WCA schedule table.
export function formatCell(round: RoundInfo): string {
  const main = formatShort(round.format);
  if (round.cutoff) return `${formatShort(String(round.cutoff.numberOfAttempts))} / ${main}`;
  return main;
}
