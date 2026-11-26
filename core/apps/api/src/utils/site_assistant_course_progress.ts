import { assistantDeadline, assistantStage } from './site_assistant_diagnostics.js';
import { personalFormulaReviewRequest, readMyFormulaReviews } from './site_assistant_formula_reviews.js';
import type { AssistantAnswer } from '@cuberoot/shared/site-assistant';
import { query, type QueryRunner } from '../db/connection.js';
import { courseEntitlementPredicate } from '../platform/db.js';

export function personalCourseProgressRequest(question: string): boolean {
  const text = question.normalize('NFKC').trim();
  if (/^(?:请(?:问|帮我|告诉我)\s*)?(?:(?:根据|按(?:照)?)(?:我的|我本人(?:的)?)?(?:课程|学习)进度[，,\s]*)?(?:我(?:现在|接下来|应该|该|要|的)?\s*)?(?:下一[课节](?:课)?(?:该)?学(?:什么|哪一课)|该(?:继续)?学哪(?:一)?[节课](?:课)?|应该(?:继续)?学哪(?:一)?[节课](?:课)?|(?:课程|学习)进度(?:到哪(?:一)?[节课](?:课)?(?:了)?|怎么样|是多少)?|继续哪(?:一)?[节课](?:课)?)[\s？?。.!！]*$/.test(text)) return true;
  return /^(?:please\s+)?(?:tell me\s+)?(?:(?:based on|using) my (?:course|learning) progress,?\s+)?(?:what(?:'s| is) my (?:course|learning) progress|(?:which|what) lesson (?:should i|i should) (?:take|study|continue|watch) next|what (?:course )?lesson is next for me)[?.!]*$/i.test(text);
}

type LessonRow = {
  course_id: string;
  course_zh: string;
  course_en: string;
  lesson_id: string | null;
  lesson_zh: string | null;
  lesson_en: string | null;
  status: 'not_started' | 'in_progress' | null;
  progress_bps: number | null;
  position_seconds: number | null;
  completed: number;
  available: number;
};

/** Read the current actor's visible lessons only, using the classroom entitlement rule. */
export async function assistantCourseProgress(
  userId: number | undefined, lang: 'zh' | 'en', queryDb: QueryRunner = query,
): Promise<AssistantAnswer> {
  const label = (zh: string, en: string) => ({ zh, en })[lang];
  const courses = { id: 'my-learning-progress', href: '/platform/account/courses', title: label('我的课程', 'My courses') };
  if (!userId) return {
    answer: label('登录后可以查看本人课程进度和下一课。', 'Sign in to check your course progress and next lesson.'),
    sources: [{ ...courses, read: false }], actions: [courses],
  };

  const [row] = await queryDb<LessonRow>(`
    WITH started AS (
      SELECT DISTINCT lesson.course_id
        FROM platform_lesson_progress p
        JOIN platform_lessons lesson ON lesson.id = p.lesson_id
       WHERE p.user_id = $1 AND p.status IN ('in_progress', 'completed')
    ), visible AS (
      SELECT lesson.id, lesson.course_id, lesson.ordinal, rev.title_zh, rev.title_en,
             p.status, p.progress_bps, p.position_seconds, p.updated_at
        FROM platform_lessons lesson
        JOIN started ON started.course_id = lesson.course_id
        JOIN platform_courses course ON course.id = lesson.course_id
        JOIN platform_lesson_revisions rev ON rev.lesson_id = lesson.id AND rev.revision = lesson.current_revision
        LEFT JOIN platform_lesson_progress p ON p.user_id = $1 AND p.lesson_id = lesson.id
       WHERE lesson.status = 'published' AND course.status IN ('published', 'unlisted')
         AND (lesson.access_scope = 'public' OR (${courseEntitlementPredicate('lesson.course_id', 'lesson.id')}))
    ), recent AS (
      SELECT course_id FROM visible
       WHERE status IN ('in_progress', 'completed')
       ORDER BY updated_at DESC, id
       LIMIT 1
    )
    SELECT course.id::text AS course_id, cr.title_zh AS course_zh, cr.title_en AS course_en,
           next.id::text AS lesson_id, next.title_zh AS lesson_zh, next.title_en AS lesson_en,
           next.status, next.progress_bps, next.position_seconds,
           (SELECT COUNT(*)::int FROM visible WHERE course_id = course.id AND status = 'completed') AS completed,
           (SELECT COUNT(*)::int FROM visible WHERE course_id = course.id) AS available
      FROM recent
      JOIN platform_courses course ON course.id = recent.course_id
      JOIN platform_course_revisions cr ON cr.course_id = course.id AND cr.revision = course.current_revision
      LEFT JOIN LATERAL (
        SELECT * FROM visible WHERE course_id = course.id AND status IS DISTINCT FROM 'completed'
         ORDER BY (status = 'in_progress') DESC NULLS LAST, ordinal, id
         LIMIT 1
      ) next ON TRUE
  `, [userId]);
  if (!row) return {
    answer: label('当前可访问的课程中，暂无已记录的学习进度。可以从「我的课程」打开一节课开始。',
      'There is no saved progress in the courses currently available to you. Open My courses to start a lesson.'),
    sources: [{ ...courses, read: true }], actions: [courses],
  };

  const courseName = label(row.course_zh || row.course_en, row.course_en || row.course_zh);
  const progress = label(`最近学习的是「${courseName}」。当前可访问的课时已完成 ${row.completed}/${row.available} 节。 [[${courses.id}]]`,
    `Your most recent course was “${courseName}”. You have completed ${row.completed}/${row.available} of its currently accessible lessons. [[${courses.id}]]`);
  if (!row.lesson_id) return {
    answer: progress + label(' 这门课当前可访问的课时已全部完成。', ' You have completed all currently accessible lessons in this course.'),
    sources: [{ ...courses, read: true }], actions: [courses],
  };
  const lessonTitle = label(row.lesson_zh || row.lesson_en || '', row.lesson_en || row.lesson_zh || '');
  const position = row.status === 'in_progress' ? Number(row.position_seconds ?? 0) : 0;
  const href = `/platform/courses/${encodeURIComponent(row.course_id)}/learn/${encodeURIComponent(row.lesson_id)}`;
  const action = { id: 'my-next-lesson', title: lessonTitle, href: position > 0 ? `${href}?t=${position}` : href };
  const next = row.status === 'in_progress'
    ? label(`继续「${lessonTitle}」，已记录进度 ${Number(row.progress_bps ?? 0) / 100}%。`,
      `Continue “${lessonTitle}” at ${Number(row.progress_bps ?? 0) / 100}% saved progress.`)
    : label(`下一课是「${lessonTitle}」。`, `Your next lesson is “${lessonTitle}”.`);
  return { answer: `${progress} ${next} [[${action.id}]]`, sources: [{ ...action, read: true }, { ...courses, read: true }], actions: [action, courses] };
}

function personalCourseAndReviews(question: string) {
  const parts = question.split(/[。？?；;\n]+/).map(part => part.trim()).filter(Boolean);
  if (parts.length !== 2) return;
  const courseIndex = parts.findIndex(personalCourseProgressRequest);
  if (courseIndex < 0) return;
  const review = personalFormulaReviewRequest(parts[1 - courseIndex]);
  if (review?.standalone) return { courseIndex, review };
}

export function personalLearningRequest(question: string) {
  const combined = personalCourseAndReviews(question);
  return {
    combined,
    course: !!combined || personalCourseProgressRequest(question),
    review: combined?.review ?? personalFormulaReviewRequest(question),
  };
}

export async function answerPersonalLearningRequest(
  courseAndReviews: ReturnType<typeof personalCourseAndReviews>,
  lang: 'zh' | 'en', signal: AbortSignal, requestedLimit?: number, viewerUserId?: number, viewerWcaId?: string,
): Promise<AssistantAnswer> {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(4500)]);
  const [course, reviews] = await Promise.allSettled([
    assistantStage('data', () => assistantDeadline(() => assistantCourseProgress(viewerUserId, lang), deadline)),
    courseAndReviews ? assistantDeadline(() => readMyFormulaReviews(
      { tool: 'my_formula_reviews', set: courseAndReviews.review.set, limit: Math.min(5, requestedLimit ?? 3) }, viewerWcaId, lang), deadline) : undefined,
  ]);
  signal.throwIfAborted();
  const courseAnswer = course.status === 'fulfilled' ? course.value : { answer: {
    zh: '暂时读不到你的课程进度，请稍后再试。', en: 'Your course progress could not be read right now. Please try again later.',
  }[lang], sources: [] };
  if (!courseAndReviews) return courseAnswer;
  const reviewResult = reviews.status === 'fulfilled' ? reviews.value : undefined;
  const reviewAnswer = reviewResult?.factualSummary ?? {
    zh: '暂时读不到这个账号的公式复习记录。', en: 'Your formula reviews could not be read right now.',
  }[lang];
  return { answer: (courseAndReviews.courseIndex === 0 ? [courseAnswer.answer, reviewAnswer] : [reviewAnswer, courseAnswer.answer]).join('\n\n'),
    sources: [...courseAnswer.sources, ...(reviewResult?.sources ?? [])],
    actions: [...(courseAnswer.actions ?? []), ...(reviewResult?.sources.map(({ id, title, href }) => ({ id, title, href })) ?? [])],
  };
}
