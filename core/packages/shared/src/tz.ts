// 时区数学 —— 纯函数,不碰 DOM / React / i18n,前后端共用。
//
// 原本只服务 /timezone(app/[lang]/timezone/_lib/tz.ts);/calendar 落地后服务端也要同一套
// 墙上时间 ↔ 绝对时刻换算(重复事件展开、提醒扫描),所以整体搬到 shared,一份实现两端用。
//
// 只用平台自带的 Intl 时区库,不引 luxon / date-fns(站内 lib/comp-schedule.ts 已是同一路数):
// 浏览器和 Node 都带完整 IANA tzdata,自己抄一份偏移表必然过期,夏令时规则每年都在改。
//
// 两个基本操作,其余全由它们推出来:
//   wallPartsIn(tz, at)  绝对时刻 → 某时区的墙上时间
//   wallToUtc(tz, parts)  某时区的墙上时间 → 绝对时刻
// 回归测试见 tests/timezone_tz.test.ts。

export interface WallParts {
  y: number;
  /** 1..12,不是 Date 的 0..11 */
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

const partsFmtCache = new Map<string, Intl.DateTimeFormat>();
const abbrevFmtCache = new Map<string, Intl.DateTimeFormat>();

function partsFmt(tz: string): Intl.DateTimeFormat {
  const hit = partsFmtCache.get(tz);
  if (hit) return hit;
  // hourCycle h23 是关键:默认 h12 下午夜会格式化成 24,Date.UTC 再把它滚到次日。
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  partsFmtCache.set(tz, f);
  return f;
}

/** 平台是否认识这个 IANA 时区 id。非法 id 会让 Intl 构造函数抛 RangeError。 */
export function isValidZone(tz: string): boolean {
  try {
    partsFmt(tz);
    return true;
  } catch {
    return false;
  }
}

/** 本机时区;拿不到就退 UTC(旧浏览器 / 某些无头环境)。 */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** 绝对时刻 at 在时区 tz 的墙上时间。 */
export function wallPartsIn(tz: string, at: Date): WallParts {
  const parts = partsFmt(tz).formatToParts(at);
  const num = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    return p ? Number(p.value) : 0;
  };
  return { y: num('year'), mo: num('month'), d: num('day'), h: num('hour'), mi: num('minute'), s: num('second') };
}

/** 该时刻下 tz 相对 UTC 的偏移,分钟,东正西负(上海 +480,洛杉矶夏令时 -420)。 */
export function zoneOffsetMinutes(tz: string, at: Date): number {
  const w = wallPartsIn(tz, at);
  const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
  // formatToParts 只到秒,所以 at 也截到整秒再比,否则偏移里会掺进毫秒零头。
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / MINUTE);
}

/**
 * 把某时区的墙上时间还原成绝对时刻。
 *
 * 先把墙上时间当 UTC 估一次偏移,再用估出来的时刻复算。两次偏移不一致只发生在换时前后,
 * 此时拿第二个候选回代验证:能还原出原墙上时间就用它(秋季回拨后的那几小时属于这类),
 * 验不过说明这个墙上时间根本不存在(春季前拨跳掉的那一小时),此时保留第一个候选 ——
 * 效果是往后推到切换后的等价时刻,和 JS Date / Temporal 的 compatible 消歧一致。
 * 重复出现的那一小时(秋季回拨)取靠前那次,同样和各家日历软件一致。
 */
export function wallToUtc(tz: string, p: WallParts): Date {
  const naive = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  const off1 = zoneOffsetMinutes(tz, new Date(naive));
  const t1 = naive - off1 * MINUTE;
  const off2 = zoneOffsetMinutes(tz, new Date(t1));
  if (off1 === off2) return new Date(t1);
  const t2 = new Date(naive - off2 * MINUTE);
  const w = wallPartsIn(tz, t2);
  const hit = w.y === p.y && w.mo === p.mo && w.d === p.d && w.h === p.h && w.mi === p.mi;
  return hit ? t2 : new Date(t1);
}

/** "UTC+8" / "UTC+5:45" / "UTC-3:30" / "UTC" */
export function formatOffset(min: number): string {
  if (min === 0) return 'UTC';
  const sign = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/**
 * 时区缩写(EDT / JST / IST)。很多时区没有真缩写,Intl 会回 "GMT+8" —— 那串和偏移列
 * 完全重复,返回空串让调用方别显示。
 */
export function zoneAbbrev(tz: string, at: Date): string {
  try {
    let f = abbrevFmtCache.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' });
      abbrevFmtCache.set(tz, f);
    }
    const v = f.formatToParts(at).find((x) => x.type === 'timeZoneName')?.value ?? '';
    return /^[A-Z]{2,5}$/.test(v) ? v : '';
  } catch {
    return '';
  }
}

export interface DstInfo {
  /** 该时区一年内偏移会变(观察夏令时或当年有法定改时) */
  observes: boolean;
  /** 此刻处在偏移较大的那一档(= 夏令时) */
  active: boolean;
}

/** 拿 1 月 15 日和 7 月 15 日的偏移对比;不等即有夏令时,偏移大的那档是夏令时(南半球同样成立)。 */
export function dstInfo(tz: string, at: Date): DstInfo {
  const y = wallPartsIn(tz, at).y;
  const jan = zoneOffsetMinutes(tz, new Date(Date.UTC(y, 0, 15)));
  const jul = zoneOffsetMinutes(tz, new Date(Date.UTC(y, 6, 15)));
  if (jan === jul) return { observes: false, active: false };
  return { observes: true, active: zoneOffsetMinutes(tz, at) === Math.max(jan, jul) };
}

export interface Transition {
  at: Date;
  /** 切换前偏移(分钟) */
  before: number;
  /** 切换后偏移(分钟) */
  after: number;
}

/**
 * 下一次偏移变化(夏令时切换 / 法定改时区)。逐日扫到第一个不同的偏移,再二分到分钟。
 * 约定长期视频通话的人最容易踩这个坑:两地换时的日期不同,中间几周时差会变。
 */
export function nextTransition(tz: string, from: Date, horizonDays = 400): Transition | null {
  const base = from.getTime();
  const off = zoneOffsetMinutes(tz, from);
  for (let i = 1; i <= horizonDays; i++) {
    const hi = base + i * DAY;
    const offHi = zoneOffsetMinutes(tz, new Date(hi));
    if (offHi === off) continue;
    let a = base + (i - 1) * DAY;
    let b = hi;
    while (b - a > MINUTE) {
      const mid = a + Math.floor((b - a) / 2);
      if (zoneOffsetMinutes(tz, new Date(mid)) === off) a = mid;
      else b = mid;
    }
    return { at: new Date(Math.round(b / MINUTE) * MINUTE), before: off, after: offHi };
  }
  return null;
}

/** 把年月日折成「距 1970-01-01 的天数」,好做纯日期减法(和时区无关)。 */
export function dayNumber(p: { y: number; mo: number; d: number }): number {
  return Math.round(Date.UTC(p.y, p.mo - 1, p.d) / DAY);
}

/** b 比 a 晚几个日历日(跨零点用,返回 -1 / 0 / +1 这类)。 */
export function dayDelta(a: { y: number; mo: number; d: number }, b: { y: number; mo: number; d: number }): number {
  return dayNumber(b) - dayNumber(a);
}

/** "2026-08-02" */
export function dateKey(p: { y: number; mo: number; d: number }): string {
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** "20:30" */
export function timeKey(p: { h: number; mi: number }): string {
  return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
}

/** 解析 "YYYY-MM-DD" + "HH:mm";任一非法返回 null(URL 是用户能手改的)。 */
export function parseDateTime(date: string, time: string): WallParts | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const p: WallParts = {
    y: Number(d[1]), mo: Number(d[2]), d: Number(d[3]),
    h: Number(t[1]), mi: Number(t[2]), s: 0,
  };
  if (p.mo < 1 || p.mo > 12 || p.d < 1 || p.d > 31 || p.h > 23 || p.mi > 59) return null;
  return p;
}

// ── 时段分档 ────────────────────────────────────────────────────────────────
// 24 小时对照条和推荐时段共用同一套分档,颜色在 timezone.css 里按 band 上色。

export type Band = 'night' | 'early' | 'day' | 'evening';

export function hourBand(h: number): Band {
  if (h >= 23 || h < 7) return 'night';
  if (h < 9) return 'early';
  if (h < 18) return 'day';
  return 'evening';
}

// ── 24 小时对照网格 ──────────────────────────────────────────────────────────

export interface GridCell {
  hour: number;
  minute: number;
  /** 相对基准时区那一天的日差 */
  dayDelta: number;
  band: Band;
}

export interface HourColumn {
  /** 基准时区的整点 0..23 */
  baseHour: number;
  at: Date;
  /** 与传入 zones 一一对应 */
  cells: GridCell[];
}

/**
 * 以基准时区某个日历日的 24 个整点为列,算出每个时区对应的本地时间。
 * 夏令时切换那天基准时区会少 / 多一小时,这里不做特判 —— wallToUtc 已给出确定结果,
 * 表里照实显示(那天本来就有一小时不存在)。
 */
export function hourGrid(baseTz: string, day: { y: number; mo: number; d: number }, zones: string[]): HourColumn[] {
  const cols: HourColumn[] = [];
  for (let h = 0; h < 24; h++) {
    const at = wallToUtc(baseTz, { y: day.y, mo: day.mo, d: day.d, h, mi: 0, s: 0 });
    const cells = zones.map((tz) => {
      const w = wallPartsIn(tz, at);
      return { hour: w.h, minute: w.mi, dayDelta: dayDelta(day, w), band: hourBand(w.h) };
    });
    cols.push({ baseHour: h, at, cells });
  }
  return cols;
}

/** 小时是否落在 [start, end) 里;start > end 视为跨零点(如 22 → 6)。 */
export function inWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export interface ComfortWindow {
  /** 基准时区的整点区间 [startHour, endHour),endHour 最大 24 */
  startHour: number;
  endHour: number;
  start: Date;
  end: Date;
}

/**
 * 所有时区都落在 [start, end) 里的连续基准整点区间。带整点 30/45 分偏移的时区
 * (印度 / 尼泊尔)按其本地整点所在的小时判定,够用。
 */
export function comfortWindows(grid: HourColumn[], start: number, end: number): ComfortWindow[] {
  const out: ComfortWindow[] = [];
  let run: HourColumn[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const first = run[0];
    const last = run[run.length - 1];
    out.push({
      startHour: first.baseHour,
      endHour: last.baseHour + 1,
      start: first.at,
      end: new Date(last.at.getTime() + 60 * MINUTE),
    });
    run = [];
  };
  for (const col of grid) {
    if (col.cells.length > 0 && col.cells.every((c) => inWindow(c.hour, start, end))) run.push(col);
    else flush();
  }
  flush();
  return out;
}
