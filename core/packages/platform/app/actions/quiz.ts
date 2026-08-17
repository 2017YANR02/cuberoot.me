"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import { findById as findLesson } from "@/lib/db/lessons";
import {
  listByLesson,
  recordAttempt,
} from "@/lib/db/quizzes";
import { awardPoints } from "@/lib/db/points";

// 逐题判分结果:对照 answerIdx 在 server 端判定,前端不持有正确答案直到提交后回传。
export type QuizGradeItem = {
  quizId: string;
  question: string;
  options: string[];
  // 用户所选下标;未作答为 null
  selectedIdx: number | null;
  // 正确答案下标(提交后才回传)
  answerIdx: number;
  correct: boolean;
  explain: string | null;
};

export type QuizSubmitResult =
  | {
      ok: true;
      items: QuizGradeItem[];
      total: number;
      correctCount: number;
      allCorrect: boolean;
      // 本次是否首次满分发了分(去重后 false 表示已发过 / 未满分)
      awardedPoints: boolean;
    }
  | { ok: false; error: string };

// 提交章节测验:入参 lessonId + 每题所选下标(quizId -> selectedIdx)。
// server 端取该 lesson 当前题目、对照 answerIdx 判分、逐题 recordAttempt;
// 全对时给 awardPoints(5, "quiz", {refId: lessonId}) —— refId 兜底去重,重做满分不重复发分。
export async function submitQuizAction(input: {
  lessonId: string;
  answers: Record<string, number>;
}): Promise<QuizSubmitResult> {
  const user = await requireUser();

  const lesson = await findLesson(input.lessonId);
  if (!lesson) return { ok: false, error: "lesson_not_found" };

  const quizzes = await listByLesson(lesson.id);
  if (quizzes.length === 0) return { ok: false, error: "no_quiz" };

  const answers = input.answers ?? {};
  const items: QuizGradeItem[] = [];
  let correctCount = 0;

  for (const q of quizzes) {
    const raw = answers[q.id];
    const selectedIdx =
      typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : null;
    const inRange =
      selectedIdx !== null && selectedIdx >= 0 && selectedIdx < q.options.length;
    const correct = inRange && selectedIdx === q.answerIdx;
    if (correct) correctCount += 1;

    // 仅对有效作答记一条 attempt(未答 / 越界不记)。
    if (inRange) {
      await recordAttempt({
        userId: user.id,
        quizId: q.id,
        lessonId: lesson.id,
        selectedIdx: selectedIdx,
        correct,
      });
    }

    items.push({
      quizId: q.id,
      question: q.question,
      options: q.options,
      selectedIdx: inRange ? selectedIdx : null,
      answerIdx: q.answerIdx,
      correct,
      explain: q.explain ?? null,
    });
  }

  const total = quizzes.length;
  const allCorrect = correctCount === total;

  // 全对发 5 分;refId=lessonId 幂等去重,重做满分不重复发。
  let awardedPoints = false;
  if (allCorrect) {
    const row = await awardPoints(user.id, 5, "quiz", { refId: lesson.id });
    awardedPoints = row !== null;
  }

  revalidatePath(`/courses/${lesson.courseId}/learn/${lesson.id}`);

  return {
    ok: true,
    items,
    total,
    correctCount,
    allCorrect,
    awardedPoints,
  };
}
