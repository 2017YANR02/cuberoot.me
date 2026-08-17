"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { findById as findLesson } from "@/lib/db/lessons";
import {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  findById as findQuiz,
} from "@/lib/db/quizzes";

async function requireAdmin(): Promise<void> {
  const c = await cookies();
  if (!verifySession(c.get(SESSION_COOKIE)?.value)) {
    redirect("/admin/login");
  }
}

// textarea 一行一个选项 → 数组(去空行,trim)。
function parseOptions(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function numberOr(v: FormDataEntryValue | null, fallback: number): number {
  if (typeof v !== "string" || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function revalidateLesson(courseId: string, lessonId: string) {
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/learn/${lessonId}`);
}

export async function createQuizAction(f: FormData): Promise<void> {
  await requireAdmin();
  const lessonId = String(f.get("lessonId") ?? "").trim();
  const courseId = String(f.get("courseId") ?? "").trim();
  const question = String(f.get("question") ?? "").trim();
  const options = parseOptions(f.get("options"));

  // 边界:无 lesson / 空题 / 选项不足两条 直接退回(不写库)。
  if (!lessonId || !courseId || !question || options.length < 2) {
    redirect(`/admin/courses/${courseId}?error=quiz_missing#quiz-${lessonId}`);
  }

  // answerIdx 钳到选项范围内(下标从 0 起)。
  const answerIdx = Math.min(
    Math.max(numberOr(f.get("answerIdx"), 0), 0),
    options.length - 1,
  );

  // 校验 lesson 归属课程,防越权写到别的课。
  const lesson = await findLesson(lessonId);
  if (!lesson || lesson.courseId !== courseId) {
    redirect(`/admin/courses/${courseId}?error=quiz_lesson#lessons`);
  }

  await createQuiz({
    lessonId,
    courseId,
    question,
    options,
    answerIdx,
    explain: trimOrNull(f.get("explain")),
  });
  revalidateLesson(courseId, lessonId);
  redirect(`/admin/courses/${courseId}#quiz-${lessonId}`);
}

export async function updateQuizAction(f: FormData): Promise<void> {
  await requireAdmin();
  const id = String(f.get("id") ?? "").trim();
  const courseId = String(f.get("courseId") ?? "").trim();
  const lessonId = String(f.get("lessonId") ?? "").trim();
  const question = String(f.get("question") ?? "").trim();
  const options = parseOptions(f.get("options"));
  if (!id || !courseId || !question || options.length < 2) {
    redirect(`/admin/courses/${courseId}?error=quiz_missing#quiz-${lessonId}`);
  }
  const answerIdx = Math.min(
    Math.max(numberOr(f.get("answerIdx"), 0), 0),
    options.length - 1,
  );
  await updateQuiz({
    id,
    question,
    options,
    answerIdx,
    explain: trimOrNull(f.get("explain")),
    sortOrder: numberOr(f.get("sortOrder"), 0),
  });
  revalidateLesson(courseId, lessonId);
  redirect(`/admin/courses/${courseId}#quiz-${lessonId}`);
}

export async function deleteQuizAction(f: FormData): Promise<void> {
  await requireAdmin();
  const id = String(f.get("id") ?? "").trim();
  const courseId = String(f.get("courseId") ?? "").trim();
  const lessonId = String(f.get("lessonId") ?? "").trim();
  if (!id) {
    redirect(`/admin/courses/${courseId}#lessons`);
  }
  const quiz = await findQuiz(id);
  if (quiz) await deleteQuiz(id);
  revalidateLesson(courseId, lessonId);
  redirect(`/admin/courses/${courseId}#quiz-${lessonId}`);
}
