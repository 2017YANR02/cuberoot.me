import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Course, Instructor } from "@/db/schema";

/**
 * 公开讲师视图:在原始 instructor 行上融合其课程聚合(开课数 / 累计报名学员数)。
 * 数据层只做读,页面 await 后直接渲染。
 */

export type InstructorWithStats = Instructor & {
  courseCount: number;
  /** 该讲师所有课程的 studentsEnrolled 之和(展示用,非去重真人数) */
  studentsEnrolled: number;
};

export type InstructorPublic = {
  instructor: Instructor;
  courses: Course[];
  courseCount: number;
  studentsEnrolled: number;
};

/**
 * 全部讲师 + 课程聚合。用一条按 instructor_id 分组的子查询把课程数与累计报名数
 * 算好,再 left join 回 instructors(没开课的讲师计数为 0)。
 */
export async function listWithStats(): Promise<InstructorWithStats[]> {
  const agg = db
    .select({
      instructorId: schema.courses.instructorId,
      courseCount: sql<number>`COUNT(*)`.as("course_count"),
      studentsEnrolled:
        sql<number>`COALESCE(SUM(${schema.courses.studentsEnrolled}), 0)`.as(
          "students_enrolled",
        ),
    })
    .from(schema.courses)
    .groupBy(schema.courses.instructorId)
    .as("agg");

  const rows = db
    .select({
      instructor: schema.instructors,
      courseCount: sql<number>`COALESCE(${agg.courseCount}, 0)`,
      studentsEnrolled: sql<number>`COALESCE(${agg.studentsEnrolled}, 0)`,
    })
    .from(schema.instructors)
    .leftJoin(agg, eq(agg.instructorId, schema.instructors.id))
    .all();

  return rows.map((r) => ({
    ...r.instructor,
    courseCount: r.courseCount,
    studentsEnrolled: r.studentsEnrolled,
  }));
}

/** 单个讲师 + 其开设课程列表(按报名数降序)。讲师不存在返回 undefined。 */
export async function findPublicById(
  id: string,
): Promise<InstructorPublic | undefined> {
  const instRows = db
    .select()
    .from(schema.instructors)
    .where(eq(schema.instructors.id, id))
    .all();
  const instructor = instRows[0];
  if (!instructor) return undefined;

  const courses = db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.instructorId, id))
    .all()
    .sort((a, b) => b.studentsEnrolled - a.studentsEnrolled);

  const studentsEnrolled = courses.reduce(
    (sum, c) => sum + c.studentsEnrolled,
    0,
  );

  return {
    instructor,
    courses,
    courseCount: courses.length,
    studentsEnrolled,
  };
}
