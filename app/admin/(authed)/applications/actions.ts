"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { findById, setStatus } from "@/lib/db/applications";
import { setRole } from "@/lib/db/users";
import { newInstructorId } from "@/lib/auth-user";

async function findInstructorByNameCity(name: string, city: string) {
  const rows = db
    .select()
    .from(schema.instructors)
    .where(eq(schema.instructors.name, name))
    .all();
  return rows.find((r) => r.city === city);
}

export async function approveApplication(f: FormData) {
  const id = String(f.get("id") ?? "");
  const note = String(f.get("note") ?? "").trim();
  if (!id) redirect("/admin/applications");

  const app = await findById(id);
  if (!app) redirect("/admin/applications");

  await setStatus(id, "approved", note || null);

  if (app.userId) {
    await setRole(app.userId, "instructor");
  }

  // Dedupe by (name, city) to avoid double-insert on re-approve.
  const existing = await findInstructorByNameCity(app.name, app.city);
  if (!existing) {
    await db.insert(schema.instructors).values({
      id: newInstructorId(),
      name: app.name,
      title: app.formats[0] ?? "魔方讲师",
      city: app.city,
      specialty: app.direction,
      studentsTaught: 0,
      yearsTeaching: 1,
      bestRecord: "—",
      bio: app.bio,
    });
    revalidatePath("/instructors");
  }

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);
  redirect(`/admin/applications/${id}`);
}

export async function rejectApplication(f: FormData) {
  const id = String(f.get("id") ?? "");
  const note = String(f.get("note") ?? "").trim();
  if (!id) redirect("/admin/applications");
  await setStatus(id, "rejected", note || null);
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);
  redirect(`/admin/applications/${id}`);
}
