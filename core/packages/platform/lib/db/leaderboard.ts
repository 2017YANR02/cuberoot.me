import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * 排行榜聚合层。无新表,纯查询既有流水:
 *   study → learning_progress(时间窗内完成的课时数)
 *   points → point_ledger(时间窗内积分净增)
 *
 * 时间窗只过滤"进榜的活动",all 表示不限时间。
 */

export type LeaderboardPeriod = "week" | "month" | "all";

// period → 起始时间戳(秒);all 返 null 表示不加时间过滤。
function periodStart(period: LeaderboardPeriod): number | null {
  if (period === "all") return null;
  const now = Math.floor(Date.now() / 1000);
  const days = period === "week" ? 7 : 30;
  return now - days * 24 * 60 * 60;
}

export type LeaderRow = {
  rank: number;
  userId: string;
  nickname: string;
  avatar: string | null;
  // 该榜的成绩值:study=完成课时数,points=积分净增
  value: number;
};

/**
 * 学习榜:时间窗内完成的课时数(learning_progress.completed = true,用 updatedAt 过滤)降序。
 * value = 完成课时数。
 */
export async function studyBoard(opts: {
  period: LeaderboardPeriod;
  limit?: number;
}): Promise<LeaderRow[]> {
  const { period } = opts;
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 50), 1), 200);
  const since = periodStart(period);

  const lp = schema.learningProgress;
  const conds = [eq(lp.completed, true)];
  if (since !== null) conds.push(gte(lp.updatedAt, since));

  const done = sql<number>`COUNT(*)`;
  const rows = db
    .select({
      userId: lp.userId,
      done,
      nickname: schema.users.nickname,
      avatar: schema.users.avatar,
    })
    .from(lp)
    .innerJoin(schema.users, eq(lp.userId, schema.users.id))
    .where(and(...conds))
    .groupBy(lp.userId)
    .having(sql`COUNT(*) > 0`)
    .orderBy(desc(done))
    .limit(limit)
    .all();

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    nickname: r.nickname ?? "魔友",
    avatar: r.avatar ?? null,
    value: Number(r.done),
  }));
}

/**
 * 积分榜:时间窗内 SUM(point_ledger.delta) 降序。
 * value = 时间窗内积分净增(可能含负 delta,只取净增 > 0 进榜)。
 */
export async function pointsBoard(opts: {
  period: LeaderboardPeriod;
  limit?: number;
}): Promise<LeaderRow[]> {
  const { period } = opts;
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 50), 1), 200);
  const since = periodStart(period);

  const pl = schema.pointLedger;
  const conds = since !== null ? [gte(pl.createdAt, since)] : [];

  const total = sql<number>`SUM(${pl.delta})`;
  const rows = db
    .select({
      userId: pl.userId,
      total,
      nickname: schema.users.nickname,
      avatar: schema.users.avatar,
    })
    .from(pl)
    .innerJoin(schema.users, eq(pl.userId, schema.users.id))
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(pl.userId)
    .having(sql`SUM(${pl.delta}) > 0`)
    .orderBy(desc(total))
    .limit(limit)
    .all();

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    nickname: r.nickname ?? "魔友",
    avatar: r.avatar ?? null,
    value: Number(r.total),
  }));
}
