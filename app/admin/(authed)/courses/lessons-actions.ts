"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  create as createLesson,
  update as updateLesson,
  remove as removeLesson,
  nextIdxFor,
} from "@/lib/db/lessons";

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function numberOrNull(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function revalidateCourse(courseId: string) {
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}`);
}

export async function createLessonAction(f: FormData): Promise<void> {
  const courseId = String(f.get("courseId") ?? "").trim();
  const title = String(f.get("title") ?? "").trim();
  if (!courseId || !title) {
    redirect(`/admin/courses/${courseId}?error=missing`);
  }
  const idxRaw = numberOrNull(f.get("idx"));
  const idx = idxRaw && idxRaw > 0 ? idxRaw : await nextIdxFor(courseId);
  await createLesson({
    courseId,
    idx,
    title,
    durationSec: numberOrNull(f.get("durationSec")),
    videoUrl: trimOrNull(f.get("videoUrl")),
    videoKey: trimOrNull(f.get("videoKey")),
    free: String(f.get("free") ?? "") === "on",
  });
  revalidateCourse(courseId);
  redirect(`/admin/courses/${courseId}#lessons`);
}

export async function updateLessonAction(f: FormData): Promise<void> {
  const id = String(f.get("id") ?? "").trim();
  const courseId = String(f.get("courseId") ?? "").trim();
  if (!id || !courseId) {
    redirect(`/admin/courses/${courseId}?error=missing`);
  }
  await updateLesson({
    id,
    idx: numberOrNull(f.get("idx")) ?? undefined,
    title: typeof f.get("title") === "string" ? String(f.get("title")).trim() : undefined,
    durationSec: numberOrNull(f.get("durationSec")),
    videoUrl: trimOrNull(f.get("videoUrl")),
    videoKey: trimOrNull(f.get("videoKey")),
    free: String(f.get("free") ?? "") === "on",
  });
  revalidateCourse(courseId);
  redirect(`/admin/courses/${courseId}#lessons`);
}

export async function deleteLessonAction(f: FormData): Promise<void> {
  const id = String(f.get("id") ?? "").trim();
  const courseId = String(f.get("courseId") ?? "").trim();
  if (!id) {
    redirect(`/admin/courses/${courseId}`);
  }
  await removeLesson(id);
  revalidateCourse(courseId);
  redirect(`/admin/courses/${courseId}#lessons`);
}

export async function moveLessonAction(f: FormData): Promise<void> {
  const id = String(f.get("id") ?? "").trim();
  const courseId = String(f.get("courseId") ?? "").trim();
  const dir = String(f.get("dir") ?? "");
  const currentIdx = numberOrNull(f.get("idx")) ?? 1;
  if (!id || !courseId) {
    redirect(`/admin/courses/${courseId}`);
  }
  const delta = dir === "up" ? -1 : dir === "down" ? 1 : 0;
  if (delta !== 0) {
    await updateLesson({ id, idx: Math.max(1, currentIdx + delta) });
    revalidateCourse(courseId);
  }
  redirect(`/admin/courses/${courseId}#lessons`);
}
