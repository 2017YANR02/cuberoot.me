import { requirePlatformActor } from '../auth.js';
import { type PlatformDb, platformDb, platformQuery, requireCourseEntitlement } from '../db.js';
import { notFound } from '../errors.js';

export async function requireLessonAccess(
  actor: Awaited<ReturnType<typeof requirePlatformActor>>,
  lessonId: string,
  db: PlatformDb = platformDb(),
): Promise<{ courseId: string; revision: number }> {
  const rows = await platformQuery<{ course_id: string; current_revision: number; access_scope: string }>(db, `
    SELECT lesson.course_id::text, lesson.current_revision, lesson.access_scope
    FROM platform_lessons lesson
    JOIN platform_courses course ON course.id = lesson.course_id
    WHERE lesson.id = $1::uuid AND lesson.status = 'published' AND lesson.current_revision IS NOT NULL
      AND course.status IN ('published', 'unlisted')
  `, [lessonId]);
  const lesson = rows[0];
  if (!lesson) notFound('Lesson');
  if (lesson.access_scope !== 'public') {
    await requireCourseEntitlement(db, actor, lesson.course_id, lessonId);
  }
  return { courseId: lesson.course_id, revision: lesson.current_revision };
}
