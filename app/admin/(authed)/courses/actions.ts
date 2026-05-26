"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { upsert, remove } from "@/lib/db/courses";
import type { CourseInsert } from "@/db/schema";

function parseLines(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseOutline(v: FormDataEntryValue | null): { week: string; topic: string }[] {
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

function parseDatetimeLocal(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function valuesFromForm(f: FormData): CourseInsert {
  return {
    id: String(f.get("id") ?? "").trim(),
    title: String(f.get("title") ?? "").trim(),
    subtitle: String(f.get("subtitle") ?? "").trim(),
    level: String(f.get("level") ?? "入门") as CourseInsert["level"],
    format: String(f.get("format") ?? "录播系统课") as CourseInsert["format"],
    instructor: String(f.get("instructor") ?? "").trim(),
    durationHours: Number(f.get("durationHours") ?? 0),
    lessons: Number(f.get("lessons") ?? 0),
    price: Number(f.get("price") ?? 0),
    studentsEnrolled: Number(f.get("studentsEnrolled") ?? 0),
    rating: Number(f.get("rating") ?? 0),
    highlights: parseLines(f.get("highlights")),
    outline: parseOutline(f.get("outline")),
    tags: parseLines(f.get("tags")),
    videoUrl: trimOrNull(f.get("videoUrl")),
    coverUrl: trimOrNull(f.get("coverUrl")),
    nextLiveAt: parseDatetimeLocal(f.get("nextLiveAt")),
  };
}

export async function saveCourse(f: FormData) {
  const v = valuesFromForm(f);
  if (!v.id || !v.title) {
    redirect("/admin/courses?error=missing");
  }
  await upsert(v);
  revalidatePath("/courses");
  revalidatePath(`/courses/${v.id}`);
  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

export async function deleteCourse(f: FormData) {
  const id = String(f.get("id") ?? "");
  if (id) {
    await remove(id);
    revalidatePath("/courses");
    revalidatePath("/admin/courses");
  }
  redirect("/admin/courses");
}
