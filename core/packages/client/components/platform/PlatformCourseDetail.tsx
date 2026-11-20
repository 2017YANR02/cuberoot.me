'use client';

import { ArrowRight, LockKeyhole, Play } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import PageBackLink from '@/components/PageBackLink';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { nextQuery, useAuthUser } from '@/lib/auth-store';
import { commerceMoney, commerceRecord, commerceText } from '@/lib/platform-commerce-format';
import { courseCatalogDetails, courseLessonAccess } from '@/lib/platform-course-catalog';
import { learningTime } from '@/lib/platform-learning';
import { platformPathname } from '@/lib/platform-navigation';
import { platformCourseLessonSection } from '@/lib/platform-routes';
import { platformTrialLessonIds } from '@cuberoot/shared/platform';
import type { PlatformEntity } from '@/lib/platform-types';
import { PlatformCourseCover, PlatformCourseLabels } from './PlatformCourseCatalog';
import { PlatformCoursePresentation } from './PlatformLearningWorkspace';

function isLearningSpaceEntry(href: string): boolean {
  const path = platformPathname(href);
  return path === '/platform' || path.startsWith('/platform/');
}

export function PlatformCourseDetail({ course, lessons }: { course: PlatformEntity; lessons: Record<string, unknown>[] }) {
  const t = useT();
  const lang = useLang();
  const user = useAuthUser();
  const data = course.data ?? {};
  const trialLessonIds = platformTrialLessonIds(data.presentation);
  const details = courseCatalogDetails(course);
  const { entries, canWatch } = courseLessonAccess(data);
  const root = `/platform/courses/${encodeURIComponent(course.id)}`;
  const lessonHref = ({ id, introduction }: { id: string; introduction: boolean }) =>
    `${root}/sections/${introduction ? 'introduction' : 'core'}?lesson=${encodeURIComponent(id)}`;
  const signInHref = (lesson: Parameters<typeof lessonHref>[0]) =>
    `/account${nextQuery(`${lang === 'zh' ? '/zh' : ''}${lessonHref(lesson)}`)}`;
  const directory = lessons.flatMap(lesson => {
    const id = typeof lesson.id === 'string' ? lesson.id : typeof lesson.slug === 'string' ? lesson.slug : null;
    if (!id) return [];
    const title = t(String(lesson.titleZh || lesson.titleEn || lesson.title || ''), String(lesson.titleEn || lesson.titleZh || lesson.title || '')).replace(/^(?:试听课|Trial (?:lessons?\s*)?)\s*\d*\s*[：:–-]?\s*/i, '')
      || t('未命名课时', 'Untitled lesson');
    const section = platformCourseLessonSection(lesson, trialLessonIds);
    return [{
      id, title, duration: Number(lesson.durationSeconds),
      introduction: section === 'introduction',
      preview: section === 'trial',
      locked: !canWatch(id, lesson.accessScope),
    }];
  });
  const groups = [
    { id: 'introduction', title: t('引言', 'Introduction'), lessons: directory.filter(lesson => lesson.introduction) },
    { id: 'core', title: t('正式课', 'Core lessons'), lessons: directory.filter(lesson => !lesson.introduction) },
  ].filter(group => group.lessons.length > 0);
  const locked = directory.some(lesson => lesson.locked);
  const originalLessons = new Map(directory.map(lesson => [lesson.id, lesson]));
  const ongoing = entries.find(lesson => lesson.status === 'in_progress' && typeof lesson.id === 'string' && originalLessons.get(lesson.id)?.locked === false);
  const firstUnlocked = directory.find(lesson => !lesson.locked);
  const firstCore = directory.find(lesson => !lesson.introduction && !lesson.locked);
  const nextLesson = ongoing && typeof ongoing.id === 'string' && originalLessons.has(ongoing.id)
    ? originalLessons.get(ongoing.id)
    : locked ? firstUnlocked : firstCore ?? firstUnlocked;
  const firstAction = ongoing ? t('继续学习', 'Continue learning')
    : locked && nextLesson?.introduction ? t('观看引言', 'Watch introduction')
      : locked && nextLesson?.preview ? t('开始试听', 'Start preview') : t('开始学习', 'Start learning');
  const availablePreview = directory.find(lesson => lesson.preview && !lesson.locked);
  const restrictedPreview = !user && directory.find(lesson => lesson.preview && lesson.locked);
  const previewLink = availablePreview
    ? { href: lessonHref(availablePreview), label: t('试看课时', 'Watch a preview') }
    : restrictedPreview ? {
        href: signInHref(restrictedPreview),
        label: t('登录查看试看', 'Sign in to view a preview'),
      } : null;
  const unlock = data.enrollmentMode === 'invite'
    ? { label: t('兑换课程', 'Redeem course'), href: '/platform/account/invites' }
    : data.enrollmentMode === 'purchase'
      ? { label: t('购买课程', 'Buy course'), href: '#platform-course-access' }
      : data.enrollmentMode === 'free'
        ? { label: t('加入课程', 'Enroll'), href: '#platform-course-access' }
        : { label: t('查看获取方式', 'How to get access'), href: '#platform-course-access' };
  const instructors = Array.isArray(data.instructors) ? data.instructors.map(commerceRecord) : [];
  const summary = data.slug === 'yan-ruimin-3x3-beginner'
    ? t('用层先法，从十字开始学到独立复原。', 'Learn the layer-by-layer method, from the first cross to solving on your own.')
    : course.summary;
  const lock = <><LockKeyhole size={14} aria-hidden /><span className="sr-only">{t('需要解锁', 'Unlock required')}</span></>;

  return <div className="platform-course-detail-content">
    <header className="platform-course-overview">
      <PageBackLink fallback="/platform" label={t('返回学习中心', 'Back to Learning Center')} acceptEntry={isLearningSpaceEntry} />
      <div className="platform-course-overview-title">
        <h1>{course.title}</h1>
        {instructors.length > 0 ? <div className="platform-course-instructors">
          {instructors.map((instructor, index) => {
            const name = commerceText(instructor, 'displayName', t);
            const teacherId = instructor.teacherEntryId;
            return teacherId != null
              ? <AppLink key={String(instructor.id ?? index)} href={`/platform/teachers/${encodeURIComponent(String(teacherId))}`} prefetch={false}>{name}</AppLink>
              : <span key={String(instructor.id ?? index)}>{name}</span>;
          })}
        </div> : details.instructors.length > 0 && <div className="platform-course-instructors">
          {details.fallbackInstructorEn ? t(details.instructors[0], details.fallbackInstructorEn) : details.instructors.join(t('、', ', '))}
        </div>}
        <div className="platform-course-overview-labels">
          <PlatformCourseLabels details={details} />
          {directory.length > 0 && <span>{t(`${directory.length} 课时`, `${directory.length} lessons`)}</span>}
        </div>
      </div>
      {details.coverUrl && <PlatformCourseCover {...details} eager />}
      <div className="platform-course-overview-copy">
        {summary && <p>{summary}</p>}
        <div className="platform-home-actions">
          {nextLesson && <AppLink className="platform-button platform-button-primary" href={lessonHref(nextLesson)} prefetch={false}>
            <Play aria-hidden />{firstAction}
          </AppLink>}
          {previewLink && (!availablePreview || availablePreview.id !== nextLesson?.id) && <AppLink className="platform-button" href={previewLink.href} prefetch={false}>
            {previewLink.label}
          </AppLink>}
          {locked && <AppLink className={nextLesson ? 'platform-button' : 'platform-button platform-button-primary'} href={unlock.href} prefetch={false}>
            {unlock.label}<ArrowRight aria-hidden />
          </AppLink>}
        </div>
        {locked && data.enrollmentMode === 'invite' && <p className="platform-course-access-note">{t('带锁课时需兑换后观看。', 'Redeem a code to watch locked lessons.')}</p>}
        {locked && data.enrollmentMode === 'purchase' && data.baseAmountMinor != null && <p className="platform-course-access-note">
          {commerceMoney(data.baseAmountMinor, data.currency)}
        </p>}
      </div>
    </header>

    <section className="platform-course-directory" aria-labelledby="platform-course-directory-title">
      <h2 id="platform-course-directory-title">{t('课程目录', 'Course lessons')}</h2>
      {groups.length === 0 && <p>{t('暂无课时。', 'No lessons yet.')}</p>}
      {groups.map((group, index) => <details className="platform-course-chapter" data-site-surface="panel" key={group.id} open={index === 0}>
        <MoreToggle as="summary" className="platform-course-chapter-summary">
          <span>{group.title}</span>
          <span>{t(`${group.lessons.length} 节`, `${group.lessons.length} lessons`)}</span>
          {group.lessons.every(lesson => lesson.locked) && <span className="platform-course-chapter-lock">{lock}</span>}
        </MoreToggle>
        <ol className="platform-course-lesson-rows">
          {group.lessons.map(lesson => <li key={lesson.id}>
            {lesson.locked ? <span className="platform-course-lesson-row platform-course-lesson-locked">
              <span>{lesson.title}</span>
              <span className="platform-course-lesson-actions">
                {lesson.duration > 0 && <small>{learningTime(lesson.duration)}</small>}
                {!user && lesson.preview && (
                  <AppLink className="platform-course-lesson-sign-in" href={signInHref(lesson)} prefetch={false}
                    aria-label={t(`登录查看「${lesson.title}」的观看权限`, `Sign in to check access to “${lesson.title}”`)}>
                    {t('登录解锁', 'Sign in')}
                  </AppLink>
                )}
                {lock}
              </span>
            </span> : <AppLink className="platform-course-lesson-row" href={lessonHref(lesson)} prefetch={false}>
              <span>{lesson.title}</span>
              <small>{lesson.duration > 0 && learningTime(lesson.duration)}<Play size={14} aria-hidden /></small>
            </AppLink>}
          </li>)}
        </ol>
      </details>)}
    </section>
    <PlatformCoursePresentation entity={course} />
  </div>;
}
