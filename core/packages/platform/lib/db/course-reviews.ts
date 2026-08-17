import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CourseReview, CourseReviewInsert } from "@/db/schema";

export type { CourseReview };

function newReviewId(): string {
  return "cr_" + randomBytes(9).toString("base64url");
}

function clampRating(rating: number): number {
  const n = Math.round(rating);
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, n));
}

export type ReviewWithAuthor = CourseReview & {
  authorNickname: string;
  authorAvatar: string | null;
};

export type RatingSummary = {
  avg: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

// 单门课的评分汇总:平均分(保留一位小数)、总数、1..5 各星计数
export async function ratingSummary(courseId: string): Promise<RatingSummary> {
  const rows = db
    .select({ rating: schema.courseReviews.rating })
    .from(schema.courseReviews)
    .where(eq(schema.courseReviews.courseId, courseId))
    .all();

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  let sum = 0;
  for (const r of rows) {
    const k = clampRating(r.rating) as 1 | 2 | 3 | 4 | 5;
    distribution[k] += 1;
    sum += r.rating;
  }
  const count = rows.length;
  const avg = count === 0 ? 0 : Math.round((sum / count) * 10) / 10;
  return { avg, count, distribution };
}

// 把当前课程的平均分写回 courses.rating(评价增改后调用)。无评价时不动原值。
async function syncCourseRating(courseId: string): Promise<void> {
  const summary = await ratingSummary(courseId);
  if (summary.count === 0) return;
  await db
    .update(schema.courses)
    .set({ rating: summary.avg })
    .where(eq(schema.courses.id, courseId));
}

export async function userReview(
  userId: string,
  courseId: string,
): Promise<CourseReview | undefined> {
  const rows = db
    .select()
    .from(schema.courseReviews)
    .where(
      and(
        eq(schema.courseReviews.userId, userId),
        eq(schema.courseReviews.courseId, courseId),
      ),
    )
    .all();
  return rows[0];
}

export type ListByCourseOpts = { limit?: number; page?: number };

export async function listByCourse(
  courseId: string,
  opts?: ListByCourseOpts,
): Promise<ReviewWithAuthor[]> {
  const limit = Math.max(1, Math.floor(opts?.limit ?? 20));
  const page = Math.max(1, Math.floor(opts?.page ?? 1));
  const offset = (page - 1) * limit;
  const rows = db
    .select({
      review: schema.courseReviews,
      authorNickname: schema.users.nickname,
      authorAvatar: schema.users.avatar,
    })
    .from(schema.courseReviews)
    .leftJoin(schema.users, eq(schema.courseReviews.userId, schema.users.id))
    .where(eq(schema.courseReviews.courseId, courseId))
    .orderBy(desc(schema.courseReviews.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
  return rows.map((r) => ({
    ...r.review,
    authorNickname: r.authorNickname ?? "魔友",
    authorAvatar: r.authorAvatar ?? null,
  }));
}

// 写评价:同 (userId, courseId) 存在则更新,否则插入;写后回写课程平均分
export async function upsertReview(
  userId: string,
  courseId: string,
  rating: number,
  body: string,
): Promise<CourseReview> {
  const now = Math.floor(Date.now() / 1000);
  const safeRating = clampRating(rating);
  const safeBody = (body ?? "").trim();
  const existing = await userReview(userId, courseId);

  if (existing) {
    await db
      .update(schema.courseReviews)
      .set({ rating: safeRating, body: safeBody, updatedAt: now })
      .where(eq(schema.courseReviews.id, existing.id));
    await syncCourseRating(courseId);
    return { ...existing, rating: safeRating, body: safeBody, updatedAt: now };
  }

  const values: CourseReviewInsert = {
    id: newReviewId(),
    courseId,
    userId,
    rating: safeRating,
    body: safeBody,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.courseReviews).values(values);
  await syncCourseRating(courseId);
  const row = db
    .select()
    .from(schema.courseReviews)
    .where(eq(schema.courseReviews.id, values.id))
    .all()[0];
  if (!row) throw new Error("course review upsert failed");
  return row;
}

// 评价总数(列表分页用)
export async function countByCourse(courseId: string): Promise<number> {
  const rows = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.courseReviews)
    .where(eq(schema.courseReviews.courseId, courseId))
    .all();
  return rows[0]?.n ?? 0;
}
