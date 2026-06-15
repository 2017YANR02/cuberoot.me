"use server";

import { requireUser } from "@/lib/auth-user";
import { findById as findLesson } from "@/lib/db/lessons";
import {
  findByUserLesson,
  upsert as upsertProgress,
} from "@/lib/db/progress";
import { checkInToday } from "@/lib/db/checkins";
import { awardPoints } from "@/lib/db/points";

export async function updateProgress(
  lessonId: string,
  positionSec: number,
  completed: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const lesson = await findLesson(lessonId);
  if (!lesson) return { ok: false, error: "lesson_not_found" };

  // 记录变更前是否已完成,用来判断本次是否「刚完成」。
  const prev = await findByUserLesson(user.id, lesson.id);
  const wasCompleted = prev?.completed ?? false;

  await upsertProgress({
    userId: user.id,
    lessonId: lesson.id,
    courseId: lesson.courseId,
    positionSec: Math.max(0, Math.floor(positionSec)),
    completed,
  });

  // 有实质进度更新即算当日学习打卡(幂等)。
  await checkInToday(user.id, "study");

  // 仅在本课时由未完成 → 完成的那一次发分;refId 兜底去重防并发重复。
  if (completed && !wasCompleted) {
    await awardPoints(user.id, 8, "lesson_complete", { refId: lesson.id });
  }

  return { ok: true };
}
