"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import { findById as findLesson } from "@/lib/db/lessons";
import {
  addNote,
  deleteNote,
  findById as findNote,
  listByLesson,
  updateNote,
  type LessonNote,
} from "@/lib/db/notes";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const MAX_BODY = 4000;

function revalidateLearn(courseId: string, lessonId: string) {
  revalidatePath(`/courses/${courseId}/learn/${lessonId}`);
  revalidatePath("/me/notes");
}

export async function addNoteAction(input: {
  lessonId: string;
  positionSec: number;
  body: string;
}): Promise<ActionResult<LessonNote[]>> {
  const user = await requireUser();
  const body = input.body.trim();
  if (!body) return { ok: false, error: "empty" };
  if (body.length > MAX_BODY) return { ok: false, error: "too_long" };

  const lesson = await findLesson(input.lessonId);
  if (!lesson) return { ok: false, error: "lesson_not_found" };

  const pos = Number.isFinite(input.positionSec)
    ? Math.max(0, Math.floor(input.positionSec))
    : 0;

  await addNote({
    userId: user.id,
    lessonId: lesson.id,
    courseId: lesson.courseId,
    positionSec: pos,
    body,
  });

  revalidateLearn(lesson.courseId, lesson.id);
  const notes = await listByLesson(user.id, lesson.id);
  return { ok: true, data: notes };
}

export async function updateNoteAction(input: {
  id: string;
  body: string;
}): Promise<ActionResult<LessonNote[]>> {
  const user = await requireUser();
  const body = input.body.trim();
  if (!body) return { ok: false, error: "empty" };
  if (body.length > MAX_BODY) return { ok: false, error: "too_long" };

  const note = await findNote(input.id);
  if (!note || note.userId !== user.id) return { ok: false, error: "not_found" };

  await updateNote(note.id, user.id, body);

  revalidateLearn(note.courseId, note.lessonId);
  const notes = await listByLesson(user.id, note.lessonId);
  return { ok: true, data: notes };
}

export async function deleteNoteAction(input: {
  id: string;
}): Promise<ActionResult<LessonNote[]>> {
  const user = await requireUser();

  const note = await findNote(input.id);
  if (!note || note.userId !== user.id) return { ok: false, error: "not_found" };

  await deleteNote(note.id, user.id);

  revalidateLearn(note.courseId, note.lessonId);
  const notes = await listByLesson(user.id, note.lessonId);
  return { ok: true, data: notes };
}
