"use server";

import { requireUser } from "@/lib/auth-user";
import { findById as findLesson } from "@/lib/db/lessons";
import { upsert as upsertProgress } from "@/lib/db/progress";

export async function updateProgress(
  lessonId: string,
  positionSec: number,
  completed: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const lesson = await findLesson(lessonId);
  if (!lesson) return { ok: false, error: "lesson_not_found" };
  await upsertProgress({
    userId: user.id,
    lessonId: lesson.id,
    courseId: lesson.courseId,
    positionSec: Math.max(0, Math.floor(positionSec)),
    completed,
  });
  return { ok: true };
}
