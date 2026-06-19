// 首页「报名」标签的取数 + 分组逻辑（纯函数，便于回归测试）。
// 数据源：all_upcoming_comps.json 的 registration_open / registration_close（全世界比赛，ISO 8601 UTC）。
// 思路：每场比赛取「下一个需要行动的报名里程碑」——
//   还没开放 → open（即将开放，热门赛抢位）；报名中 → close（即将截止，最后机会）；已截止 → 不显示。
// 再按里程碑发生的「用户本地日历日」分组：今天 / 明天 / 后天 / 本周内 / 更晚。一场比赛只出现一次。
import type { Comp } from './comp-search';

export type RegKind = 'open' | 'close';

export interface RegItem {
  comp: Comp;
  /** 'open'=报名将开放；'close'=报名将截止；'closed'=报名已截止（仅「已关注」里仍想盯的比赛）。 */
  kind: RegKind | 'closed';
  /** 里程碑时刻 epoch ms（kind='closed' 时为 registration_close）。 */
  at: number;
}

export type RegBucketKey = 'today' | 'tomorrow' | 'dayAfter' | 'soon' | 'later';

export interface RegBucket {
  key: RegBucketKey;
  items: RegItem[];
}

export interface RegView {
  /** 关注的、仍在 upcoming 集合里的比赛（有里程碑→open/close；报名已截止→closed）。 */
  followed: RegItem[];
  /** 其余比赛按下一个里程碑本地日分组。 */
  buckets: RegBucket[];
  /** 可行动条目数（用于标签可见性，不含 closed）。 */
  total: number;
}

const MS_DAY = 86_400_000;
/** 展示视野上界（天）：更晚才开放/截止的比赛不进列表，避免被几个月后的大赛刷屏。 */
export const REG_HORIZON_DAYS = 60;

const BUCKET_ORDER: RegBucketKey[] = ['today', 'tomorrow', 'dayAfter', 'soon', 'later'];

/** 比赛的下一个「需要行动」的报名里程碑：还没开放→open；报名中→close；已截止/无数据→null。 */
export function nextRegMilestone(c: Comp, now: number): RegItem | null {
  const open = c.registration_open ? Date.parse(c.registration_open) : NaN;
  const close = c.registration_close ? Date.parse(c.registration_close) : NaN;
  if (Number.isFinite(open) && now < open) return { comp: c, kind: 'open', at: open };
  if (Number.isFinite(close) && now < close) return { comp: c, kind: 'close', at: close };
  return null;
}

/** 本地日历日差：里程碑当天 00:00 与今天 00:00 相隔几天（用户本地时区）。 */
export function localDayDiff(atMs: number, now: number): number {
  const a = new Date(atMs); a.setHours(0, 0, 0, 0);
  const n = new Date(now); n.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - n.getTime()) / MS_DAY);
}

function bucketOf(diff: number): RegBucketKey {
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === 2) return 'dayAfter';
  if (diff <= 6) return 'soon';
  return 'later';
}

/**
 * 构建「报名」标签视图。关注的比赛只进 followed，不在日分组里重复。
 * @param followed 用户关注的 comp id 集合（未登录传空集）。
 */
export function buildRegView(comps: Comp[], now: number, followed: ReadonlySet<string>): RegView {
  const horizon = now + REG_HORIZON_DAYS * MS_DAY;
  const dayItems: RegItem[] = [];
  const followedItems: RegItem[] = [];

  for (const c of comps) {
    if (followed.has(c.id)) {
      const m = nextRegMilestone(c, now);
      if (m) followedItems.push(m);
      else {
        const close = c.registration_close ? Date.parse(c.registration_close) : NaN;
        if (Number.isFinite(close)) followedItems.push({ comp: c, kind: 'closed', at: close });
      }
      continue;
    }
    const m = nextRegMilestone(c, now);
    if (m && m.at <= horizon) dayItems.push(m);
  }

  // followed：有里程碑的按时间升序在前，closed 沉底
  followedItems.sort((a, b) => {
    const ac = a.kind === 'closed' ? 1 : 0;
    const bc = b.kind === 'closed' ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return a.at - b.at;
  });

  // 日分组：组内按里程碑时刻升序（纯时间序，open/close 混排）
  const byBucket = new Map<RegBucketKey, RegItem[]>();
  for (const it of dayItems) {
    const k = bucketOf(localDayDiff(it.at, now));
    const arr = byBucket.get(k) ?? [];
    arr.push(it);
    byBucket.set(k, arr);
  }
  const buckets: RegBucket[] = [];
  for (const k of BUCKET_ORDER) {
    const arr = byBucket.get(k);
    if (!arr || arr.length === 0) continue;
    arr.sort((a, b) => a.at - b.at);
    buckets.push({ key: k, items: arr });
  }

  return {
    followed: followedItems,
    buckets,
    total: dayItems.length + followedItems.filter((i) => i.kind !== 'closed').length,
  };
}

/** 标签徽标用：视野内可行动的报名比赛数（不含已截止）。 */
export function countActionableReg(comps: Comp[], now: number): number {
  const horizon = now + REG_HORIZON_DAYS * MS_DAY;
  let n = 0;
  for (const c of comps) {
    const m = nextRegMilestone(c, now);
    if (m && m.at <= horizon) n++;
  }
  return n;
}
