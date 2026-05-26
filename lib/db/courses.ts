import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type {
  Course,
  CourseInsert,
  CourseLevel,
  CourseFormat,
  Lesson,
  User,
} from "@/db/schema";
import { searchCourses, searchCoursesCount } from "@/lib/db/search";

export type { CourseLevel, CourseFormat };

export async function list(): Promise<Course[]> {
  return db.select().from(schema.courses).all();
}

export async function listByInstructor(
  instructorId: string,
  opts?: { page?: number; pageSize?: number },
): Promise<PagedResult<Course>> {
  const page = Math.max(1, Math.floor(opts?.page ?? 1));
  const pageSize = opts?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const totalRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.courses)
    .where(eq(schema.courses.instructorId, instructorId))
    .all();
  const total = totalRow[0]?.n ?? 0;
  const items = db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.instructorId, instructorId))
    .limit(pageSize)
    .offset(offset)
    .all();
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function findByIdForInstructor(
  id: string,
  instructorId: string,
): Promise<Course | undefined> {
  const rows = db
    .select()
    .from(schema.courses)
    .where(
      and(eq(schema.courses.id, id), eq(schema.courses.instructorId, instructorId)),
    )
    .all();
  return rows[0];
}

export type CourseOwnerPatch = {
  title?: string;
  subtitle?: string;
  level?: CourseLevel;
  format?: CourseFormat;
  durationHours?: number;
  lessons?: number;
  price?: number;
  highlights?: string[];
  outline?: { week: string; topic: string }[];
  tags?: string[];
  videoUrl?: string | null;
  coverUrl?: string | null;
  nextLiveAt?: number | null;
};

export async function updateByOwner(
  courseId: string,
  instructorId: string,
  patch: CourseOwnerPatch,
): Promise<boolean> {
  // Only update rows where instructor_id matches the owner, returns whether
  // any row was updated.
  const result = await db
    .update(schema.courses)
    .set(patch)
    .where(
      and(
        eq(schema.courses.id, courseId),
        eq(schema.courses.instructorId, instructorId),
      ),
    )
    .run();
  return result.changes > 0;
}

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ListOpts = { q?: string; page?: number; pageSize?: number };

export async function listPaged({
  q,
  page = 1,
  pageSize = 12,
}: ListOpts = {}): Promise<PagedResult<Course>> {
  const safePage = Math.max(1, Math.floor(page));
  const offset = (safePage - 1) * pageSize;
  const query = q?.trim() ?? "";

  if (query) {
    const [items, total] = await Promise.all([
      searchCourses(query, { limit: pageSize, offset }),
      searchCoursesCount(query),
    ]);
    return {
      items,
      total,
      page: safePage,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const totalRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.courses)
    .all();
  const total = totalRow[0]?.n ?? 0;
  const items = db
    .select()
    .from(schema.courses)
    .limit(pageSize)
    .offset(offset)
    .all();
  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
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
        instructorId: values.instructorId ?? null,
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

export async function hasUserPaidForCourse(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const rows = db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.userId, userId),
        eq(schema.orders.type, "course"),
        eq(schema.orders.refId, courseId),
        eq(schema.orders.status, "paid"),
      ),
    )
    .all();
  return rows.length > 0;
}

export type CourseAccessReason =
  | "price_zero"
  | "free_lesson"
  | "paid"
  | "not_logged_in"
  | "not_paid";

export type CourseAccessResult = {
  allowed: boolean;
  reason: CourseAccessReason;
};

export async function canAccessCourse(
  user: User | null,
  course: Pick<Course, "id" | "price">,
  lesson?: Pick<Lesson, "free"> | null,
): Promise<CourseAccessResult> {
  if (course.price === 0) {
    return { allowed: true, reason: "price_zero" };
  }
  if (lesson?.free) {
    return { allowed: true, reason: "free_lesson" };
  }
  if (!user) {
    return { allowed: false, reason: "not_logged_in" };
  }
  const paid = await hasUserPaidForCourse(user.id, course.id);
  return paid
    ? { allowed: true, reason: "paid" }
    : { allowed: false, reason: "not_paid" };
}

export type { Course };
