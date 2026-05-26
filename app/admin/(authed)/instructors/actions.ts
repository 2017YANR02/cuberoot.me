"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { upsert, remove } from "@/lib/db/instructors";
import type { InstructorInsert } from "@/db/schema";

function parseLines(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function valuesFromForm(f: FormData): InstructorInsert {
  return {
    id: String(f.get("id") ?? "").trim(),
    name: String(f.get("name") ?? "").trim(),
    title: String(f.get("title") ?? "").trim(),
    city: String(f.get("city") ?? "").trim(),
    specialty: parseLines(f.get("specialty")),
    studentsTaught: Number(f.get("studentsTaught") ?? 0),
    yearsTeaching: Number(f.get("yearsTeaching") ?? 0),
    bestRecord: String(f.get("bestRecord") ?? "").trim(),
    bio: String(f.get("bio") ?? "").trim(),
  };
}

export async function saveInstructor(f: FormData) {
  const v = valuesFromForm(f);
  if (!v.id || !v.name) {
    redirect("/admin/instructors?error=missing");
  }
  await upsert(v);
  revalidatePath("/instructors");
  revalidatePath("/admin/instructors");
  redirect("/admin/instructors");
}

export async function deleteInstructor(f: FormData) {
  const id = String(f.get("id") ?? "");
  if (id) {
    await remove(id);
    revalidatePath("/instructors");
    revalidatePath("/admin/instructors");
  }
  redirect("/admin/instructors");
}
