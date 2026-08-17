"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireInstructor } from "@/lib/auth/instructor";
import { updateByOwner } from "@/lib/db/courses";
import type { CourseLevel, CourseFormat } from "@/db/schema";

const LEVELS: CourseLevel[] = ["入门", "进阶", "高阶", "竞速"];
const FORMATS: CourseFormat[] = ["录播系统课", "线上直播", "一对一私教", "线下家教"];

function parseLines(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseOutline(
  v: FormDataEntryValue | null,
): { week: string; topic: string }[] {
  if (typeof v !== "string") return [];
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf("|");
      if (idx === -1) return { week: "", topic: line };
      return { week: line.slice(0, idx).trim(), topic: line.slice(idx + 1).trim() };
    });
}

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function parseDatetimeLocal(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

function pickLevel(v: FormDataEntryValue | null): CourseLevel | undefined {
  const s = String(v ?? "");
  return (LEVELS as readonly string[]).includes(s) ? (s as CourseLevel) : undefined;
}

function pickFormat(v: FormDataEntryValue | null): CourseFormat | undefined {
  const s = String(v ?? "");
  return (FORMATS as readonly string[]).includes(s) ? (s as CourseFormat) : undefined;
}

export async function saveOwnedCourse(f: FormData) {
  const { instructor } = await requireInstructor();
  const id = String(f.get("id") ?? "").trim();
  if (!id) redirect("/instructor/courses");

  const level = pickLevel(f.get("level"));
  const format = pickFormat(f.get("format"));

  const ok = await updateByOwner(id, instructor.id, {
    title: String(f.get("title") ?? "").trim(),
    subtitle: String(f.get("subtitle") ?? "").trim(),
    level,
    format,
    durationHours: Number(f.get("durationHours") ?? 0),
    lessons: Number(f.get("lessons") ?? 0),
    price: Number(f.get("price") ?? 0),
    highlights: parseLines(f.get("highlights")),
    outline: parseOutline(f.get("outline")),
    tags: parseLines(f.get("tags")),
    videoUrl: trimOrNull(f.get("videoUrl")),
    coverUrl: trimOrNull(f.get("coverUrl")),
    nextLiveAt: parseDatetimeLocal(f.get("nextLiveAt")),
  });

  if (!ok) {
    redirect("/instructor/courses?error=forbidden");
  }

  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);
  revalidatePath("/instructor/courses");
  revalidatePath(`/instructor/courses/${id}`);
  redirect(`/instructor/courses/${id}?saved=1`);
}
