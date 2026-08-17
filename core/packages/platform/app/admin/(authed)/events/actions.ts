"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { upsert, remove } from "@/lib/db/events";
import type { CubeEventInsert } from "@/db/schema";

function parseLines(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function valuesFromForm(f: FormData): CubeEventInsert {
  const endRaw = f.get("endDate");
  const endStr = typeof endRaw === "string" ? endRaw.trim() : "";
  return {
    id: String(f.get("id") ?? "").trim(),
    title: String(f.get("title") ?? "").trim(),
    type: String(f.get("type") ?? "城市开放赛") as CubeEventInsert["type"],
    status: String(f.get("status") ?? "报名中") as CubeEventInsert["status"],
    startDate: String(f.get("startDate") ?? "").trim(),
    endDate: endStr === "" ? null : endStr,
    city: String(f.get("city") ?? "").trim(),
    venue: String(f.get("venue") ?? "").trim(),
    capacity: Number(f.get("capacity") ?? 0),
    registered: Number(f.get("registered") ?? 0),
    fee: Number(f.get("fee") ?? 0),
    events: parseLines(f.get("events")),
    description: String(f.get("description") ?? "").trim(),
  };
}

export async function saveEvent(f: FormData) {
  const v = valuesFromForm(f);
  if (!v.id || !v.title) {
    redirect("/admin/events?error=missing");
  }
  await upsert(v);
  revalidatePath("/events");
  revalidatePath(`/events/${v.id}`);
  revalidatePath("/admin/events");
  redirect("/admin/events");
}

export async function deleteEvent(f: FormData) {
  const id = String(f.get("id") ?? "");
  if (id) {
    await remove(id);
    revalidatePath("/events");
    revalidatePath("/admin/events");
  }
  redirect("/admin/events");
}
