import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Lesson, LessonInsert } from "@/db/schema";

export type { Lesson, LessonInsert };

function newLessonId(): string {
  return "l_" + randomBytes(6).toString("base64url");
}

export async function listByCourse(courseId: string): Promise<Lesson[]> {
  return db
    .select()
    .from(schema.lessons)
    .where(eq(schema.lessons.courseId, courseId))
    .orderBy(asc(schema.lessons.idx))
    .all();
}

export async function findById(id: string): Promise<Lesson | undefined> {
  const rows = db
    .select()
    .from(schema.lessons)
    .where(eq(schema.lessons.id, id))
    .all();
  return rows[0];
}

export type CreateLessonInput = {
  courseId: string;
  idx: number;
  title: string;
  durationSec?: number | null;
  videoKey?: string | null;
  videoUrl?: string | null;
  free?: boolean;
};

export async function create(input: CreateLessonInput): Promise<Lesson> {
  const now = Math.floor(Date.now() / 1000);
  const id = newLessonId();
  const values: LessonInsert = {
    id,
    courseId: input.courseId,
    idx: input.idx,
    title: input.title,
    durationSec: input.durationSec ?? null,
    videoKey: input.videoKey ?? null,
    videoUrl: input.videoUrl ?? null,
    free: input.free ?? false,
    createdAt: now,
  };
  await db.insert(schema.lessons).values(values);
  const row = await findById(id);
  if (!row) throw new Error("lesson create failed");
  return row;
}

export type UpdateLessonInput = {
  id: string;
  idx?: number;
  title?: string;
  durationSec?: number | null;
  videoKey?: string | null;
  videoUrl?: string | null;
  free?: boolean;
};

export async function update(input: UpdateLessonInput): Promise<void> {
  const patch: Partial<LessonInsert> = {};
  if (typeof input.idx === "number") patch.idx = input.idx;
  if (typeof input.title === "string") patch.title = input.title;
  if (input.durationSec !== undefined) patch.durationSec = input.durationSec;
  if (input.videoKey !== undefined) patch.videoKey = input.videoKey;
  if (input.videoUrl !== undefined) patch.videoUrl = input.videoUrl;
  if (typeof input.free === "boolean") patch.free = input.free;
  if (Object.keys(patch).length === 0) return;
  await db.update(schema.lessons).set(patch).where(eq(schema.lessons.id, input.id));
}

export async function remove(id: string): Promise<void> {
  await db.delete(schema.lessons).where(eq(schema.lessons.id, id));
}

export async function findByCourseAndIdx(
  courseId: string,
  idx: number,
): Promise<Lesson | undefined> {
  const rows = db
    .select()
    .from(schema.lessons)
    .where(and(eq(schema.lessons.courseId, courseId), eq(schema.lessons.idx, idx)))
    .all();
  return rows[0];
}

export async function nextIdxFor(courseId: string): Promise<number> {
  const rows = db
    .select({ idx: schema.lessons.idx })
    .from(schema.lessons)
    .where(eq(schema.lessons.courseId, courseId))
    .all();
  if (rows.length === 0) return 1;
  return Math.max(...rows.map((r) => r.idx)) + 1;
}
