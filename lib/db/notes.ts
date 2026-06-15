import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LessonNote, LessonNoteInsert } from "@/db/schema";

export type { LessonNote };

function newNoteId(): string {
  return "ln_" + randomBytes(9).toString("base64url");
}

export type AddNoteInput = {
  userId: string;
  lessonId: string;
  courseId: string;
  positionSec: number;
  body: string;
};

export async function addNote(input: AddNoteInput): Promise<LessonNote> {
  const now = Math.floor(Date.now() / 1000);
  const values: LessonNoteInsert = {
    id: newNoteId(),
    userId: input.userId,
    lessonId: input.lessonId,
    courseId: input.courseId,
    positionSec: Math.max(0, Math.floor(input.positionSec)),
    body: input.body,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.lessonNotes).values(values);
  const row = db
    .select()
    .from(schema.lessonNotes)
    .where(eq(schema.lessonNotes.id, values.id))
    .all()[0];
  if (!row) throw new Error("note add failed");
  return row;
}

// 某用户在某 lesson 下的全部笔记,按时间戳升序(便于沿播放线排列)。
export async function listByLesson(
  userId: string,
  lessonId: string,
): Promise<LessonNote[]> {
  return db
    .select()
    .from(schema.lessonNotes)
    .where(
      and(
        eq(schema.lessonNotes.userId, userId),
        eq(schema.lessonNotes.lessonId, lessonId),
      ),
    )
    .orderBy(asc(schema.lessonNotes.positionSec), asc(schema.lessonNotes.createdAt))
    .all();
}

export type LessonNoteWithCourse = LessonNote & {
  courseTitle: string | null;
  lessonTitle: string | null;
  lessonIdx: number | null;
};

// 某用户的全部笔记,按创建时间倒序,join 课程/章节标题用于「我的笔记」分组展示。
export async function listByUser(
  userId: string,
): Promise<LessonNoteWithCourse[]> {
  return db
    .select({
      id: schema.lessonNotes.id,
      userId: schema.lessonNotes.userId,
      lessonId: schema.lessonNotes.lessonId,
      courseId: schema.lessonNotes.courseId,
      positionSec: schema.lessonNotes.positionSec,
      body: schema.lessonNotes.body,
      createdAt: schema.lessonNotes.createdAt,
      updatedAt: schema.lessonNotes.updatedAt,
      courseTitle: schema.courses.title,
      lessonTitle: schema.lessons.title,
      lessonIdx: schema.lessons.idx,
    })
    .from(schema.lessonNotes)
    .leftJoin(schema.courses, eq(schema.courses.id, schema.lessonNotes.courseId))
    .leftJoin(schema.lessons, eq(schema.lessons.id, schema.lessonNotes.lessonId))
    .where(eq(schema.lessonNotes.userId, userId))
    .orderBy(desc(schema.lessonNotes.createdAt))
    .all();
}

export async function findById(id: string): Promise<LessonNote | undefined> {
  const rows = db
    .select()
    .from(schema.lessonNotes)
    .where(eq(schema.lessonNotes.id, id))
    .all();
  return rows[0];
}

// 更新仅改 body,归属由 (id,userId) 双键限定,非本人改不到任何行。
export async function updateNote(
  id: string,
  userId: string,
  body: string,
): Promise<LessonNote | undefined> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(schema.lessonNotes)
    .set({ body, updatedAt: now })
    .where(
      and(eq(schema.lessonNotes.id, id), eq(schema.lessonNotes.userId, userId)),
    );
  return findById(id);
}

export async function deleteNote(id: string, userId: string): Promise<void> {
  await db
    .delete(schema.lessonNotes)
    .where(
      and(eq(schema.lessonNotes.id, id), eq(schema.lessonNotes.userId, userId)),
    );
}
