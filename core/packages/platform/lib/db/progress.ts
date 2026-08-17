import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LearningProgress, LearningProgressInsert } from "@/db/schema";

export type { LearningProgress };

function newProgressId(): string {
  return "lp_" + randomBytes(6).toString("base64url");
}

export type UpsertProgressInput = {
  userId: string;
  lessonId: string;
  courseId: string;
  positionSec?: number;
  completed?: boolean;
};

export async function upsert(input: UpsertProgressInput): Promise<LearningProgress> {
  const now = Math.floor(Date.now() / 1000);
  const existing = db
    .select()
    .from(schema.learningProgress)
    .where(
      and(
        eq(schema.learningProgress.userId, input.userId),
        eq(schema.learningProgress.lessonId, input.lessonId),
      ),
    )
    .all()[0];

  if (existing) {
    const nextPosition =
      typeof input.positionSec === "number"
        ? Math.max(existing.positionSec, Math.floor(input.positionSec))
        : existing.positionSec;
    const nextCompleted =
      typeof input.completed === "boolean"
        ? existing.completed || input.completed
        : existing.completed;
    await db
      .update(schema.learningProgress)
      .set({
        positionSec: nextPosition,
        completed: nextCompleted,
        courseId: input.courseId,
        updatedAt: now,
      })
      .where(eq(schema.learningProgress.id, existing.id));
    return {
      ...existing,
      positionSec: nextPosition,
      completed: nextCompleted,
      courseId: input.courseId,
      updatedAt: now,
    };
  }

  const values: LearningProgressInsert = {
    id: newProgressId(),
    userId: input.userId,
    lessonId: input.lessonId,
    courseId: input.courseId,
    positionSec: Math.max(0, Math.floor(input.positionSec ?? 0)),
    completed: input.completed ?? false,
    updatedAt: now,
  };
  await db.insert(schema.learningProgress).values(values);
  const row = db
    .select()
    .from(schema.learningProgress)
    .where(eq(schema.learningProgress.id, values.id))
    .all()[0];
  if (!row) throw new Error("progress upsert failed");
  return row;
}

export async function listByUserCourse(
  userId: string,
  courseId: string,
): Promise<LearningProgress[]> {
  return db
    .select()
    .from(schema.learningProgress)
    .where(
      and(
        eq(schema.learningProgress.userId, userId),
        eq(schema.learningProgress.courseId, courseId),
      ),
    )
    .all();
}

export async function findByUserLesson(
  userId: string,
  lessonId: string,
): Promise<LearningProgress | undefined> {
  const rows = db
    .select()
    .from(schema.learningProgress)
    .where(
      and(
        eq(schema.learningProgress.userId, userId),
        eq(schema.learningProgress.lessonId, lessonId),
      ),
    )
    .all();
  return rows[0];
}

export async function courseProgressPercent(
  userId: string,
  courseId: string,
): Promise<{ percent: number; completed: number; total: number }> {
  const totalRows = db
    .select({ id: schema.lessons.id })
    .from(schema.lessons)
    .where(eq(schema.lessons.courseId, courseId))
    .all();
  const total = totalRows.length;
  if (total === 0) return { percent: 0, completed: 0, total: 0 };

  const progressRows = db
    .select()
    .from(schema.learningProgress)
    .where(
      and(
        eq(schema.learningProgress.userId, userId),
        eq(schema.learningProgress.courseId, courseId),
      ),
    )
    .all();
  const completed = progressRows.filter((r) => r.completed).length;
  const percent = Math.round((completed / total) * 100);
  return { percent, completed, total };
}

export async function listByUser(userId: string): Promise<LearningProgress[]> {
  return db
    .select()
    .from(schema.learningProgress)
    .where(eq(schema.learningProgress.userId, userId))
    .all();
}
