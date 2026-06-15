import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CircleId } from "@/db/schema";

export async function isMember(
  userId: string,
  circleId: CircleId,
): Promise<boolean> {
  const rows = db
    .select({ userId: schema.circleMembers.userId })
    .from(schema.circleMembers)
    .where(
      and(
        eq(schema.circleMembers.userId, userId),
        eq(schema.circleMembers.circleId, circleId),
      ),
    )
    .all();
  return rows.length > 0;
}

// 幂等:已是成员则不重复插入,joinedAt 保持首次加入时间。
export async function joinCircle(
  userId: string,
  circleId: CircleId,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .insert(schema.circleMembers)
    .values({ userId, circleId, joinedAt: now })
    .onConflictDoNothing();
}

export async function leaveCircle(
  userId: string,
  circleId: CircleId,
): Promise<void> {
  await db
    .delete(schema.circleMembers)
    .where(
      and(
        eq(schema.circleMembers.userId, userId),
        eq(schema.circleMembers.circleId, circleId),
      ),
    );
}

export async function countMembers(circleId: CircleId): Promise<number> {
  const rows = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.circleMembers)
    .where(eq(schema.circleMembers.circleId, circleId))
    .all();
  return Number(rows[0]?.n ?? 0);
}

export async function listUserCircles(userId: string): Promise<CircleId[]> {
  const rows = db
    .select({ circleId: schema.circleMembers.circleId })
    .from(schema.circleMembers)
    .where(eq(schema.circleMembers.userId, userId))
    .all();
  return rows.map((r) => r.circleId);
}
