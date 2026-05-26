import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Course, CourseInsert, CourseLevel, CourseFormat } from "@/db/schema";

export type { CourseLevel, CourseFormat };

export async function list(): Promise<Course[]> {
  return db.select().from(schema.courses).all();
}

export async function findById(id: string): Promise<Course | undefined> {
  const rows = db.select().from(schema.courses).where(eq(schema.courses.id, id)).all();
  return rows[0];
}

export async function upsert(values: CourseInsert): Promise<void> {
  await db
    .insert(schema.courses)
    .values(values)
    .onConflictDoUpdate({
      target: schema.courses.id,
      set: {
        title: values.title,
        subtitle: values.subtitle,
        level: values.level,
        format: values.format,
        instructor: values.instructor,
        durationHours: values.durationHours,
        lessons: values.lessons,
        price: values.price,
        studentsEnrolled: values.studentsEnrolled,
        rating: values.rating,
        highlights: values.highlights,
        outline: values.outline,
        tags: values.tags,
        videoUrl: values.videoUrl ?? null,
        coverUrl: values.coverUrl ?? null,
        nextLiveAt: values.nextLiveAt ?? null,
      },
    });
}

export async function remove(id: string): Promise<void> {
  await db.delete(schema.courses).where(eq(schema.courses.id, id));
}

export type { Course };
