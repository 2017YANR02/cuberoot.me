import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db, schema } from "@/db";

// 后台数据概览的聚合层:全部走 SQLite COUNT / SUM,单查询出结果,杜绝 N+1。
// 时间字段统一 unix 秒(created_at / paid_at),按本地时区分日。

export type AdminKpis = {
  users: number;
  orders: number;
  paidOrders: number;
  gmv: number; // 已支付订单实收(SUM amount - discount where status = paid),单位:元
  courses: number;
  products: number;
  events: number;
  posts: number;
  members: number; // 当前有效会员数(status=active 且未过期)
};

export type TrendPoint = { day: string; users: number; orders: number };

export type RecentOrder = {
  id: string;
  refTitle: string;
  type: string;
  amount: number;
  discount: number;
  status: string;
  createdAt: number;
  userNickname: string;
};

export type RecentUser = {
  id: string;
  nickname: string;
  phone: string;
  role: string;
  createdAt: number;
};

export type RecentPost = {
  id: string;
  title: string;
  circleId: string;
  createdAt: number;
  authorNickname: string;
};

export type AdminOverview = {
  kpis: AdminKpis;
  trend: TrendPoint[]; // 近 7 天(含今天),按日升序,缺口补 0
  recentOrders: RecentOrder[];
  recentUsers: RecentUser[];
  recentPosts: RecentPost[];
};

function dayKey(unixSec: number): string {
  // 与 SQLite date(..., 'unixepoch', 'localtime') 对齐:取本地年月日
  const d = new Date(unixSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 近 days 天(含今天)的本地日期 key 列表,升序。
function recentDayKeys(days: number): string[] {
  const keys: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    keys.push(dayKey(Math.floor((now - i * 86400_000) / 1000)));
  }
  return keys;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const PAID = "paid";
  const now = Math.floor(Date.now() / 1000);
  const COUNT = sql<number>`COUNT(*)`;
  const countOf = (
    table:
      | typeof schema.users
      | typeof schema.orders
      | typeof schema.courses
      | typeof schema.products
      | typeof schema.events
      | typeof schema.posts
      | typeof schema.memberships,
    where?: ReturnType<typeof and>,
  ): number => {
    const base = db.select({ n: COUNT }).from(table);
    const rows = where ? base.where(where).all() : base.all();
    return rows[0]?.n ?? 0;
  };

  // ---- KPI 计数:逐表 COUNT(*),单查询无 N+1 ----
  const users = countOf(schema.users);
  const orders = countOf(schema.orders);
  const paidOrders = countOf(schema.orders, eq(schema.orders.status, PAID));
  const courses = countOf(schema.courses);
  const products = countOf(schema.products);
  const events = countOf(schema.events);
  const posts = countOf(schema.posts);
  // 有效会员:active 且未过期
  const members = countOf(
    schema.memberships,
    and(eq(schema.memberships.status, "active"), sql`${schema.memberships.expiresAt} > ${now}`),
  );

  // GMV:已支付订单实收(amount - discount)求和
  const gmvRow = db
    .select({
      gmv: sql<number>`COALESCE(SUM(${schema.orders.amount} - ${schema.orders.discount}), 0)`,
    })
    .from(schema.orders)
    .where(eq(schema.orders.status, PAID))
    .all();

  const kpis: AdminKpis = {
    users,
    orders,
    paidOrders,
    gmv: gmvRow[0]?.gmv ?? 0,
    courses,
    products,
    events,
    posts,
    members,
  };

  // ---- 近 7 天趋势:新增用户 / 新增订单,各一条 GROUP BY 查询 ----
  const since = now - 7 * 86400;
  const day = (col: SQLiteColumn) =>
    sql<string>`date(${col}, 'unixepoch', 'localtime')`;

  const userTrend = db
    .select({ d: day(schema.users.createdAt), n: sql<number>`COUNT(*)` })
    .from(schema.users)
    .where(gte(schema.users.createdAt, since))
    .groupBy(day(schema.users.createdAt))
    .all();

  const orderTrend = db
    .select({ d: day(schema.orders.createdAt), n: sql<number>`COUNT(*)` })
    .from(schema.orders)
    .where(gte(schema.orders.createdAt, since))
    .groupBy(day(schema.orders.createdAt))
    .all();

  const uMap = new Map(userTrend.map((r) => [r.d, r.n ?? 0]));
  const oMap = new Map(orderTrend.map((r) => [r.d, r.n ?? 0]));
  const trend: TrendPoint[] = recentDayKeys(7).map((d) => ({
    day: d,
    users: uMap.get(d) ?? 0,
    orders: oMap.get(d) ?? 0,
  }));

  // ---- 最近活动:各取 5 条,join 出展示名 ----
  const recentOrders: RecentOrder[] = db
    .select({
      id: schema.orders.id,
      refTitle: schema.orders.refTitle,
      type: schema.orders.type,
      amount: schema.orders.amount,
      discount: schema.orders.discount,
      status: schema.orders.status,
      createdAt: schema.orders.createdAt,
      userNickname: schema.users.nickname,
    })
    .from(schema.orders)
    .leftJoin(schema.users, eq(schema.orders.userId, schema.users.id))
    .orderBy(desc(schema.orders.createdAt))
    .limit(5)
    .all()
    .map((r) => ({ ...r, userNickname: r.userNickname ?? "—" }));

  const recentUsers: RecentUser[] = db
    .select({
      id: schema.users.id,
      nickname: schema.users.nickname,
      phone: schema.users.phone,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .limit(5)
    .all();

  const recentPosts: RecentPost[] = db
    .select({
      id: schema.posts.id,
      title: schema.posts.title,
      circleId: schema.posts.circleId,
      createdAt: schema.posts.createdAt,
      authorNickname: schema.users.nickname,
    })
    .from(schema.posts)
    .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
    .orderBy(desc(schema.posts.createdAt))
    .limit(5)
    .all()
    .map((r) => ({ ...r, authorNickname: r.authorNickname ?? "—" }));

  return { kpis, trend, recentOrders, recentUsers, recentPosts };
}
