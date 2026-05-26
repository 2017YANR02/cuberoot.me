"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { findById, setStatus } from "@/lib/db/applications";
import {
  findByPhone,
  setRole,
  setInstructorLink,
  createInstructorPlaceholder,
} from "@/lib/db/users";
import {
  findByUserId as findInstructorByUserId,
  setUserId as setInstructorUserId,
} from "@/lib/db/instructors";
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

  // Resolve / create the linked user.
  let userId = app.userId ?? null;
  if (!userId && app.phone) {
    const u =
      (await findByPhone(app.phone)) ??
      (await createInstructorPlaceholder(app.phone, app.name));
    userId = u.id;
  }

  // Reuse an existing instructor by (name, city), or by userId match, otherwise create.
  let instructor = await findInstructorByNameCity(app.name, app.city);
  if (!instructor && userId) {
    instructor = await findInstructorByUserId(userId);
  }
  if (!instructor) {
    const instructorId = newInstructorId();
    await db.insert(schema.instructors).values({
      id: instructorId,
      name: app.name,
      title: app.formats[0] ?? "魔方讲师",
      city: app.city,
      specialty: app.direction,
      studentsTaught: 0,
      yearsTeaching: 1,
      bestRecord: "—",
      bio: app.bio,
      userId,
    });
    instructor = {
      id: instructorId,
      name: app.name,
      title: app.formats[0] ?? "魔方讲师",
      city: app.city,
      specialty: app.direction,
      studentsTaught: 0,
      yearsTeaching: 1,
      bestRecord: "—",
      bio: app.bio,
      userId,
    };
    revalidatePath("/instructors");
  } else if (userId && instructor.userId !== userId) {
    await setInstructorUserId(instructor.id, userId);
  }

  if (userId) {
    await setRole(userId, "instructor");
    await setInstructorLink(userId, instructor.id);
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
