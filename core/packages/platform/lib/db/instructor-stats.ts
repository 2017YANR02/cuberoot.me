import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Order } from "@/db/schema";

export const INSTRUCTOR_REVENUE_SHARE = 0.7;

export type InstructorKpi = {
  courseCount: number;
  studentCount: number;
  totalRevenue: number;
  pendingPayout: number;
};

function courseIdsByInstructor(instructorId: string): string[] {
  const rows = db
    .select({ id: schema.courses.id })
    .from(schema.courses)
    .where(eq(schema.courses.instructorId, instructorId))
    .all();
  return rows.map((r) => r.id);
}

export async function kpi(instructorId: string): Promise<InstructorKpi> {
  const courseIds = courseIdsByInstructor(instructorId);
  if (courseIds.length === 0) {
    return {
      courseCount: 0,
      studentCount: 0,
      totalRevenue: 0,
      pendingPayout: 0,
    };
  }
  const studentRow = db
    .select({ n: sql<number>`COUNT(DISTINCT ${schema.orders.userId})` })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.type, "course"),
        eq(schema.orders.status, "paid"),
        inArray(schema.orders.refId, courseIds),
      ),
    )
    .all();
  const revRow = db
    .select({ n: sql<number>`COALESCE(SUM(${schema.orders.amount}), 0)` })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.type, "course"),
        eq(schema.orders.status, "paid"),
        inArray(schema.orders.refId, courseIds),
      ),
    )
    .all();
  const totalRevenue = revRow[0]?.n ?? 0;
  return {
    courseCount: courseIds.length,
    studentCount: studentRow[0]?.n ?? 0,
    totalRevenue,
    pendingPayout: Math.round(totalRevenue * INSTRUCTOR_REVENUE_SHARE),
  };
}

export type RecentOrder = Order & {
  userPhone: string;
  userNickname: string;
};

export async function recentOrdersByInstructor(
  instructorId: string,
  limit = 10,
): Promise<RecentOrder[]> {
  const courseIds = courseIdsByInstructor(instructorId);
  if (courseIds.length === 0) return [];
  const rows = db
    .select({
      order: schema.orders,
      userPhone: schema.users.phone,
      userNickname: schema.users.nickname,
    })
    .from(schema.orders)
    .leftJoin(schema.users, eq(schema.orders.userId, schema.users.id))
    .where(
      and(
        eq(schema.orders.type, "course"),
        inArray(schema.orders.refId, courseIds),
      ),
    )
    .orderBy(desc(schema.orders.createdAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({
    ...r.order,
    userPhone: r.userPhone ?? "—",
    userNickname: r.userNickname ?? "—",
  }));
}

export type StudentRow = {
  userId: string;
  phone: string;
  nickname: string;
  courseTitle: string;
  courseId: string;
  amount: number;
  paidAt: number | null;
  createdAt: number;
};

export async function studentsByInstructor(
  instructorId: string,
  opts?: { page?: number; pageSize?: number },
): Promise<{
  items: StudentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = Math.max(1, Math.floor(opts?.page ?? 1));
  const pageSize = opts?.pageSize ?? 30;
  const offset = (page - 1) * pageSize;
  const courseIds = courseIdsByInstructor(instructorId);
  if (courseIds.length === 0) {
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }
  const totalRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.type, "course"),
        eq(schema.orders.status, "paid"),
        inArray(schema.orders.refId, courseIds),
      ),
    )
    .all();
  const total = totalRow[0]?.n ?? 0;
  const rows = db
    .select({
      order: schema.orders,
      userPhone: schema.users.phone,
      userNickname: schema.users.nickname,
    })
    .from(schema.orders)
    .leftJoin(schema.users, eq(schema.orders.userId, schema.users.id))
    .where(
      and(
        eq(schema.orders.type, "course"),
        eq(schema.orders.status, "paid"),
        inArray(schema.orders.refId, courseIds),
      ),
    )
    .orderBy(desc(schema.orders.paidAt))
    .limit(pageSize)
    .offset(offset)
    .all();
  return {
    items: rows.map((r) => ({
      userId: r.order.userId,
      phone: r.userPhone ?? "—",
      nickname: r.userNickname ?? "—",
      courseTitle: r.order.refTitle,
      courseId: r.order.refId,
      amount: r.order.amount,
      paidAt: r.order.paidAt,
      createdAt: r.order.createdAt,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type MonthEarning = {
  month: string;
  orders: number;
  gross: number;
  discount: number;
  net: number;
  share: number;
};

export async function earningsByMonth(
  instructorId: string,
): Promise<MonthEarning[]> {
  const courseIds = courseIdsByInstructor(instructorId);
  if (courseIds.length === 0) return [];
  // Group by YYYY-MM derived from paid_at (unix seconds → ISO month, local TZ).
  // We do grouping in JS to avoid sqlite tz pitfalls.
  const rows = db
    .select({
      amount: schema.orders.amount,
      discount: schema.orders.discount,
      paidAt: schema.orders.paidAt,
    })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.type, "course"),
        eq(schema.orders.status, "paid"),
        inArray(schema.orders.refId, courseIds),
      ),
    )
    .all();
  const map = new Map<string, MonthEarning>();
  for (const r of rows) {
    if (!r.paidAt) continue;
    const d = new Date(r.paidAt * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;
    const cur = map.get(key) ?? {
      month: key,
      orders: 0,
      gross: 0,
      discount: 0,
      net: 0,
      share: 0,
    };
    cur.orders += 1;
    cur.gross += r.amount + r.discount;
    cur.discount += r.discount;
    cur.net += r.amount;
    map.set(key, cur);
  }
  const out = Array.from(map.values()).map((e) => ({
    ...e,
    share: Math.round(e.net * INSTRUCTOR_REVENUE_SHARE),
  }));
  out.sort((a, b) => (a.month < b.month ? 1 : -1));
  return out;
}
