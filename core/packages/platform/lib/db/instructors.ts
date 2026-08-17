import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Instructor, InstructorInsert } from "@/db/schema";

export async function list(): Promise<Instructor[]> {
  return db.select().from(schema.instructors).all();
}

export async function findById(id: string): Promise<Instructor | undefined> {
  const rows = db.select().from(schema.instructors).where(eq(schema.instructors.id, id)).all();
  return rows[0];
}

export async function findByUserId(userId: string): Promise<Instructor | undefined> {
  const rows = db
    .select()
    .from(schema.instructors)
    .where(eq(schema.instructors.userId, userId))
    .all();
  return rows[0];
}

export async function setUserId(id: string, userId: string | null): Promise<void> {
  await db
    .update(schema.instructors)
    .set({ userId })
    .where(eq(schema.instructors.id, id));
}

export async function upsert(values: InstructorInsert): Promise<void> {
  await db
    .insert(schema.instructors)
    .values(values)
    .onConflictDoUpdate({
      target: schema.instructors.id,
      set: {
        name: values.name,
        title: values.title,
        city: values.city,
        specialty: values.specialty,
        studentsTaught: values.studentsTaught,
        yearsTeaching: values.yearsTeaching,
        bestRecord: values.bestRecord,
        bio: values.bio,
        userId: values.userId ?? null,
      },
    });
}

export async function remove(id: string): Promise<void> {
  await db.delete(schema.instructors).where(eq(schema.instructors.id, id));
}

export type { Instructor };
