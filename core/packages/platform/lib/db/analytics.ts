import "server-only";
import { and, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * 埋点 / 订单数据看板的聚合层(server-only)。
 *
 * 基于 events_track(客户端埋点)+ orders(交易)+ users(注册)三表,
 * 在内存里按本地自然日(YYYY-MM-DD)分桶,避免 sqlite 时区坑(同 instructor-stats)。
 * 所有时间戳均为 unix 秒。
 */

// 支持的统计窗口(天)。页面用真链接切换,非法值钳到 30。
export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export function clampRange(raw: unknown): AnalyticsRange {
  const n = Number(raw);
  return (ANALYTICS_RANGES as readonly number[]).includes(n)
    ? (n as AnalyticsRange)
    : 30;
}

/** 本地日 key YYYY-MM-DD(由 unix 秒)。禁用 new Date("YYYY-MM-DD") 反推。 */
function dayKey(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 窗口起点:今天本地 0 点往前推 (days-1) 天的 0 点(unix 秒)。 */
function windowStartSec(days: number): number {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  todayStart.setDate(todayStart.getDate() - (days - 1));
  return Math.floor(todayStart.getTime() / 1000);
}

/** 生成窗口内每一天的 key(升序),即使当天无数据也占位补 0。 */
function dayKeysInWindow(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** 短标签 M/D(图表 x 轴用,YYYY-MM-DD → M/D)。 */
export function shortDayLabel(key: string): string {
  const parts = key.split("-");
  if (parts.length !== 3) return key;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

// ───────────────────────── 每日趋势 ─────────────────────────

export type DailyTrend = {
  labels: string[]; // 短标签 M/D
  dayKeys: string[]; // YYYY-MM-DD
  pageView: number[];
  signup: number[];
  orderPlaced: number[];
};

/**
 * 近 N 天每日 page_view / signup / order_placed 计数。
 * page_view / order_placed 取 events_track;signup 用 users 表的真实注册更准
 *（埋点 signup 可能漏,且匿名→登录态不影响 users.createdAt)。
 */
export async function dailyTrend(days: number): Promise<DailyTrend> {
  const start = windowStartSec(days);
  const keys = dayKeysInWindow(days);

  const pv = new Map<string, number>();
  const op = new Map<string, number>();
  const su = new Map<string, number>();

  const evRows = db
    .select({
      name: schema.eventsTrack.name,
      createdAt: schema.eventsTrack.createdAt,
    })
    .from(schema.eventsTrack)
    .where(gte(schema.eventsTrack.createdAt, start))
    .all();
  for (const r of evRows) {
    if (r.name === "page_view") {
      const k = dayKey(r.createdAt);
      pv.set(k, (pv.get(k) ?? 0) + 1);
    } else if (r.name === "order_placed") {
      const k = dayKey(r.createdAt);
      op.set(k, (op.get(k) ?? 0) + 1);
    }
  }

  const userRows = db
    .select({ createdAt: schema.users.createdAt })
    .from(schema.users)
    .where(gte(schema.users.createdAt, start))
    .all();
  for (const r of userRows) {
    const k = dayKey(r.createdAt);
    su.set(k, (su.get(k) ?? 0) + 1);
  }

  return {
    labels: keys.map(shortDayLabel),
    dayKeys: keys,
    pageView: keys.map((k) => pv.get(k) ?? 0),
    signup: keys.map((k) => su.get(k) ?? 0),
    orderPlaced: keys.map((k) => op.get(k) ?? 0),
  };
}

// ───────────────────────── GMV 趋势 ─────────────────────────

export type GmvTrend = {
  labels: string[];
  dayKeys: string[];
  amount: number[]; // 每日已支付金额(元)
  orders: number[]; // 每日已支付订单数
  total: number; // 窗口内 GMV 合计
  totalOrders: number;
};

/** 近 N 天每日已支付订单金额(按 paidAt 分桶)。 */
export async function gmvTrend(days: number): Promise<GmvTrend> {
  const start = windowStartSec(days);
  const keys = dayKeysInWindow(days);
  const amt = new Map<string, number>();
  const cnt = new Map<string, number>();

  const rows = db
    .select({
      amount: schema.orders.amount,
      paidAt: schema.orders.paidAt,
    })
    .from(schema.orders)
    .where(
      and(
        sql`${schema.orders.status} = 'paid'`,
        sql`${schema.orders.paidAt} IS NOT NULL`,
        gte(schema.orders.paidAt, start),
      ),
    )
    .all();

  let total = 0;
  let totalOrders = 0;
  for (const r of rows) {
    if (!r.paidAt) continue;
    const k = dayKey(r.paidAt);
    amt.set(k, (amt.get(k) ?? 0) + r.amount);
    cnt.set(k, (cnt.get(k) ?? 0) + 1);
    total += r.amount;
    totalOrders += 1;
  }

  return {
    labels: keys.map(shortDayLabel),
    dayKeys: keys,
    amount: keys.map((k) => amt.get(k) ?? 0),
    orders: keys.map((k) => cnt.get(k) ?? 0),
    total,
    totalOrders,
  };
}

// ───────────────────────── 转化漏斗 ─────────────────────────

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  // 相对上一层的转化率(0..1);首层为 1
  stepRate: number;
  // 相对顶层(page_view)的整体转化率(0..1)
  overallRate: number;
};

/**
 * 转化漏斗:页面浏览 → 注册 → 下单意向(order_placed)→ 实际支付。
 * - 浏览 / 注册 / 下单意向取窗口内事件计数(注册用 users.createdAt 更准)
 * - 实际支付取 orders(status=paid, paidAt 在窗口内)
 */
export async function conversionFunnel(days: number): Promise<FunnelStage[]> {
  const start = windowStartSec(days);

  const pvRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.eventsTrack)
    .where(
      and(
        sql`${schema.eventsTrack.name} = 'page_view'`,
        gte(schema.eventsTrack.createdAt, start),
      ),
    )
    .all();

  const opRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.eventsTrack)
    .where(
      and(
        sql`${schema.eventsTrack.name} = 'order_placed'`,
        gte(schema.eventsTrack.createdAt, start),
      ),
    )
    .all();

  const suRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.users)
    .where(gte(schema.users.createdAt, start))
    .all();

  const paidRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.orders)
    .where(
      and(
        sql`${schema.orders.status} = 'paid'`,
        sql`${schema.orders.paidAt} IS NOT NULL`,
        gte(schema.orders.paidAt, start),
      ),
    )
    .all();

  const pageView = pvRow[0]?.n ?? 0;
  const signup = suRow[0]?.n ?? 0;
  const orderPlaced = opRow[0]?.n ?? 0;
  const paid = paidRow[0]?.n ?? 0;

  const raw: { key: string; label: string; count: number }[] = [
    { key: "page_view", label: "页面浏览", count: pageView },
    { key: "signup", label: "注册", count: signup },
    { key: "order_placed", label: "下单意向", count: orderPlaced },
    { key: "paid", label: "支付成功", count: paid },
  ];

  const top = raw[0].count;
  let prev = top;
  return raw.map((s, i) => {
    const stepRate = i === 0 ? 1 : prev > 0 ? s.count / prev : 0;
    const overallRate = top > 0 ? s.count / top : 0;
    prev = s.count;
    return { ...s, stepRate, overallRate };
  });
}

// ───────────────────────── Top 事件名 ─────────────────────────

export type TopEvent = { name: string; count: number };

/** 窗口内出现最多的事件名(降序)。 */
export async function topEvents(days: number, limit = 10): Promise<TopEvent[]> {
  const start = windowStartSec(days);
  const rows = db
    .select({
      name: schema.eventsTrack.name,
      n: sql<number>`COUNT(*)`,
    })
    .from(schema.eventsTrack)
    .where(gte(schema.eventsTrack.createdAt, start))
    .groupBy(schema.eventsTrack.name)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit)
    .all();
  return rows.map((r) => ({ name: r.name, count: r.n }));
}

// ───────────────────────── 概览卡 ─────────────────────────

export type AnalyticsOverview = {
  events: number; // 窗口内总事件数
  pageView: number;
  signup: number;
  paidOrders: number;
  gmv: number;
};

export async function overview(days: number): Promise<AnalyticsOverview> {
  const start = windowStartSec(days);

  const evRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.eventsTrack)
    .where(gte(schema.eventsTrack.createdAt, start))
    .all();

  const pvRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.eventsTrack)
    .where(
      and(
        sql`${schema.eventsTrack.name} = 'page_view'`,
        gte(schema.eventsTrack.createdAt, start),
      ),
    )
    .all();

  const suRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.users)
    .where(gte(schema.users.createdAt, start))
    .all();

  const paidRow = db
    .select({
      n: sql<number>`COUNT(*)`,
      gmv: sql<number>`COALESCE(SUM(${schema.orders.amount}), 0)`,
    })
    .from(schema.orders)
    .where(
      and(
        sql`${schema.orders.status} = 'paid'`,
        sql`${schema.orders.paidAt} IS NOT NULL`,
        gte(schema.orders.paidAt, start),
      ),
    )
    .all();

  return {
    events: evRow[0]?.n ?? 0,
    pageView: pvRow[0]?.n ?? 0,
    signup: suRow[0]?.n ?? 0,
    paidOrders: paidRow[0]?.n ?? 0,
    gmv: paidRow[0]?.gmv ?? 0,
  };
}
