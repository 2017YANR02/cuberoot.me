'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Play } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { HomeLearningPath } from './HomeLearningPath';
import { fetchTeacherDirectory, type TeacherDirectoryEntry } from '@/lib/teacher-directory-api';
import { useT } from '@/hooks/useT';
import { getSessionToken, nextQuery, useAuthUser } from '@/lib/auth-store';
import { useLang } from '@/i18n/tr';
import { loadPlatformLessonMedia, loadPlatformResource, platformMediaBrowserUrl } from '@/lib/platform-gateway';
import { listTeachingLearningContexts, listTeachingOrganizations } from '@/lib/teaching-saas-api';
import type { TeachingLearningContext } from '@cuberoot/shared/teaching';
import type { TeachingOrganizationAccess } from '@/lib/teaching-saas-api';
import type { PlatformEntity } from '@/lib/platform-types';
import { SkeletonBlock } from '@/components/ContentSkeleton';
import { courseCatalogDetails, courseLessonAccess, loadCourseCatalog } from '@/lib/platform-course-catalog';
import { commerceRecord } from '@/lib/platform-commerce-format';
import { learningTime } from '@/lib/platform-learning';
import { platformCourseLessonSection } from '@/lib/platform-routes';
import { platformTrialLessonIds } from '@cuberoot/shared/platform';
import { PlatformHomepageCarousel } from './PlatformHomepageCarousel';
import { PlatformInstructorCard } from './PlatformInstructorCard';

function HomeResume({ course, progress, detail, trialOnly }: { course: PlatformEntity; progress?: PlatformEntity; detail?: PlatformEntity; trialOnly: boolean }) {
  const t = useT();
  const bps = course.data?.progressBps;
  const percent = typeof bps === 'number' && Number.isFinite(bps) ? Math.min(10000, Math.max(0, bps)) : null;
  const lessonId = progress?.data?.lessonId ?? (progress ? progress.id : course.data?.continueLessonId);
  const [poster, setPoster] = useState<{ lessonId: string; url: string } | null>(null);
  useEffect(() => {
    if (typeof lessonId !== 'string') return;
    const controller = new AbortController();
    void loadPlatformLessonMedia(lessonId, controller.signal).then(media => { if (!controller.signal.aborted && media.posterUrl) setPoster({ lessonId, url: platformMediaBrowserUrl(media.posterUrl) }); }).catch(() => {});
    return () => controller.abort();
  }, [lessonId]);
  const cover = poster?.lessonId === lessonId ? poster?.url : undefined;
  const lessonRows = detail?.data?.lessons ?? course.data?.lessons;
  const lesson = Array.isArray(lessonRows) ? lessonRows.map(commerceRecord).find(row => row.id === lessonId) : undefined;
  const lessonTitle = progress?.title || t(String(lesson?.titleZh || lesson?.titleEn || ''), String(lesson?.titleEn || lesson?.titleZh || ''));
  const position = progress?.data?.positionSeconds;
  const duration = lesson?.durationSeconds;
  const hasPosition = typeof position === 'number' && Number.isFinite(position) && position >= 0;
  const remaining = hasPosition && typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? Math.max(0, Math.floor(duration) - Math.floor(position)) : null;
  const completedPreview = progress?.data?.status === 'completed';
  const href = `/platform/courses/${encodeURIComponent(course.id)}${typeof lessonId === 'string' && !completedPreview ? `/learn/${encodeURIComponent(lessonId)}` : ''}`;
  const resumes = Boolean(progress && progress.data?.status !== 'completed');
  return <section className="platform-home-learning" aria-labelledby="platform-home-learning-title">
    <h1 id="platform-home-learning-title">{resumes ? t('继续学习', 'Continue learning') : t('我的学习', 'My learning')}</h1>
    <AppLink href={href} className="platform-home-resume platform-entry-link" data-has-cover="true" prefetch={false}>
      <span className="platform-home-learning-main">
        <span className="platform-home-learning-cover">
          {cover && <Image key={cover} src={cover} alt="" fill sizes="(max-width: 479px) 112px, 224px" unoptimized onError={event => { event.currentTarget.hidden = true; }} />}
          <span className="platform-home-learning-play"><Play aria-hidden size={15} /></span>
        </span>
        <span className="platform-home-learning-copy">
          <strong>{course.title}</strong>
          {lessonTitle && <small>{t('当前课时', 'Current lesson')}：{lessonTitle}</small>}
          {percent !== null && <span className="platform-home-progress"><span>{t('课程进度', 'Course progress')} {Math.round(percent / 100)}%</span><progress max={10000} value={percent} aria-label={t('课程进度', 'Course progress')} /></span>}
          {hasPosition && <small className="platform-home-lesson-time"><span>{t('本课上次观看至', 'Last watched in this lesson')} {learningTime(position)}</span>{remaining !== null && <span>{t('本课剩余', 'Lesson remaining')} {learningTime(remaining)}</span>}</small>}
        </span>
      </span>
      <span className="platform-button platform-button-primary platform-home-learning-action">{resumes ? t('从上次位置继续', 'Resume where you left off') : completedPreview ? t('查看课程', 'View course') : t('开始学习', 'Start learning')}<ArrowRight aria-hidden /></span>
    </AppLink>
    {trialOnly && <p className="platform-home-trial-note"><AppLink href="/platform/account/invites" prefetch={false}>{t('试听结束后，可兑换码解锁完整课程', 'After your preview, redeem a code to unlock the full course')}</AppLink></p>}
  </section>;
}

export function PlatformLanding() {
  const t = useT();
  const lang = useLang();
  const user = useAuthUser();
  const [teachers, setTeachers] = useState<TeacherDirectoryEntry[]>([]);
  const [trial, setTrial] = useState<{ id: string; lessonId: string } | null>(null);
  const [trialChecked, setTrialChecked] = useState(false);
  const [personal, setPersonal] = useState<{ owner: typeof user; courses: PlatformEntity[]; accountCourseIds: Set<string>; progress: PlatformEntity[]; failed: boolean } | null>(null);
  const [learningContexts, setLearningContexts] = useState<TeachingLearningContext[]>([]);
  const [organizations, setOrganizations] = useState<TeachingOrganizationAccess[]>([]);
  const [currentDetail, setCurrentDetail] = useState<PlatformEntity>();

  useEffect(() => {
    const controller = new AbortController();
    void fetchTeacherDirectory().then(items => {
      if (!controller.signal.aborted) setTeachers(items.filter(item => item.kind === 'teacher').slice(0, 3));
    }).catch(() => {});
    void loadPlatformResource('courses', { params: {}, page: 1, pageSize: 12, signal: controller.signal }).then(async result => {
      if (controller.signal.aborted) return;
      const courses = result.items.filter(item => item.status === 'published');
      const candidates = courses.filter(item => platformTrialLessonIds(item.data?.presentation)?.length !== 0).toSorted((a, b) => Number(Boolean(platformTrialLessonIds(b.data?.presentation)?.length)) - Number(Boolean(platformTrialLessonIds(a.data?.presentation)?.length)) || Number(courseCatalogDetails(b).topics.includes('beginner')) - Number(courseCatalogDetails(a).topics.includes('beginner')));
      let incomplete = result.total != null ? result.total > result.items.length : result.items.length >= 12;
      for (const candidate of candidates) {
        if (controller.signal.aborted) return;
        try {
          const detail = (await loadPlatformResource('courses', { params: { id: candidate.id }, signal: controller.signal })).items[0];
          const lessons = Array.isArray(detail?.data?.lessons) ? detail.data.lessons.map(commerceRecord) : [];
          const ids = platformTrialLessonIds(detail?.data?.presentation);
          const first = lessons.find(lesson => typeof lesson.id === 'string' && lesson.accessScope === 'public' && platformCourseLessonSection(lesson, ids) === 'trial');
          if (first && !controller.signal.aborted) { setTrial({ id: candidate.id, lessonId: String(first.id) }); return; }
          if (!detail) incomplete = true;
        } catch { incomplete = true; /* Try the next published course if this detail is unavailable. */ }
      }
      if (!controller.signal.aborted && !incomplete) setTrialChecked(true);
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setPersonal(null); setLearningContexts([]); setOrganizations([]);
    if (!user) return;
    const controller = new AbortController();
    const options = { params: {}, signal: controller.signal };
    void Promise.allSettled([
      loadPlatformResource('account-courses', options).then(async result => {
        const publicIds = result.items.some(item => item.data?.courseStatus == null)
          ? new Set((await loadCourseCatalog(controller.signal)).map(item => item.id)) : null;
        return { courses: result.items.filter(item => (item.status == null || item.status === 'active') && (item.data?.courseStatus === 'published'
          || (item.data?.courseStatus == null && publicIds?.has(item.id)))), accountCourseIds: new Set(result.items.map(item => item.id)) };
      }),
      loadPlatformResource('account-progress', options),
    ]).then(async ([courses, progress]) => {
      const owned = courses.status === 'fulfilled' ? courses.value.courses : [];
      const accountCourseIds = courses.status === 'fulfilled' ? courses.value.accountCourseIds : new Set<string>();
      const records = progress.status === 'fulfilled' ? progress.value.items : [];
      // A learner can have saved progress from a free trial before enrollment.
      // Only include it if the existing public course API confirms both the
      // course's publication and the lesson's public access scope.
      const recent = records.find(item => item.data?.status === 'in_progress' && typeof item.data?.courseId === 'string')
        ?? (owned.length === 0 ? records.find(item => item.data?.status === 'completed' && typeof item.data?.courseId === 'string') : undefined);
      const recentCourseId = recent?.data?.courseId;
      if (typeof recentCourseId === 'string' && !owned.some(item => item.id === recentCourseId) && !controller.signal.aborted) {
        try {
          const candidate = (await loadPlatformResource('courses', { params: { id: recentCourseId }, signal: controller.signal })).items[0];
          const lessons = Array.isArray(candidate?.data?.lessons) ? candidate.data.lessons.map(commerceRecord) : [];
          const lessonId = recent?.data?.lessonId ?? recent?.id;
          const watched = lessons.find(lesson => lesson.id === lessonId && lesson.accessScope === 'public');
          const completedPreview = recent?.data?.status === 'completed';
          if (candidate?.id === recentCourseId && candidate.status === 'published' && watched && (!completedPreview || (platformCourseLessonSection(watched, platformTrialLessonIds(candidate.data?.presentation)) === 'trial' && lessons.some(lesson => lesson.accessScope === 'entitled')))) {
            const recordByLesson = new Map<unknown, unknown>(records.filter(item => item.data?.courseId === candidate.id).map(item => [item.data?.lessonId ?? item.id, item.data?.progressBps]));
            const totalBps = lessons.reduce((sum, lesson) => { const value = recordByLesson.get(lesson.id); return sum + (typeof value === 'number' && Number.isFinite(value) ? Math.min(10000, Math.max(0, value)) : 0); }, 0);
            owned.push({ ...candidate, data: { ...candidate.data, progressBps: Math.round(totalBps / lessons.length) } });
          }
        } catch { /* A missing or private course is never recommended. */ }
      }
      if (!controller.signal.aborted) setPersonal({ owner: user, courses: owned, accountCourseIds, progress: records, failed: courses.status === 'rejected' || progress.status === 'rejected' });
    });
    if (getSessionToken()) {
      void listTeachingOrganizations().then(items => { if (!controller.signal.aborted) setOrganizations(items); }).catch(() => {});
      void listTeachingLearningContexts().then(items => { if (!controller.signal.aborted) setLearningContexts(items); }).catch(() => {});
    }
    return () => controller.abort();
  }, [user]);

  const current = personal?.owner === user ? personal : null;
  const excludedCourseIds = useMemo(() => new Set([...(current?.courses.map(item => item.id) ?? []), ...(current?.progress.filter(item => item.data?.status === 'in_progress' || item.data?.status === 'completed').flatMap(item => typeof item.data?.courseId === 'string' ? [item.data.courseId] : []) ?? [])]), [current]);
  const accessible = current?.courses ?? [];
  const progress = current?.progress.filter(item => typeof item.data?.courseId === 'string' && accessible.some(course => course.id === item.data?.courseId)) ?? [];
  const next = progress.find(item => item.data?.status === 'in_progress');
  const course = accessible.find(item => item.id === next?.data?.courseId) ?? accessible.find(item => item.data?.progressBps !== 10000);
  const courseId = course?.id;
  const resumeProgress = next ?? (courseId && current && !current.accountCourseIds.has(courseId) ? progress.find(item => item.data?.courseId === courseId && item.data?.status === 'completed') : undefined);
  const [trialHint, setTrialHint] = useState<{ personal: NonNullable<typeof personal>; courseId: string } | null>(null);
  useEffect(() => {
    setTrialHint(null);
    if (!current || current.failed || !courseId || !resumeProgress || current.accountCourseIds.has(courseId)) return;
    const studied = current.progress.filter(item => item.data?.status === 'in_progress' || item.data?.status === 'completed' || Number(item.data?.progressBps) > 0 || Number(item.data?.positionSeconds) > 0);
    if (!studied.length || studied.some(item => typeof item.data?.courseId !== 'string' || current.accountCourseIds.has(item.data.courseId))) return;
    const controller = new AbortController();
    // Confirm every studied course, including courses not visible on the home
    // page. Public lessons alone do not prove the user lacks full access.
    void (async () => {
      for (const id of new Set(studied.map(item => String(item.data?.courseId)))) {
        if (controller.signal.aborted) return;
        const detail = (await loadPlatformResource('courses', { params: { id }, includeCourseAccess: true, signal: controller.signal })).items[0];
        const data = detail?.data;
        if (detail?.id !== id || !Array.isArray(data?.lessons) || !Array.isArray(data.lessonAccess)) return;
        const lessons = data.lessons.map(commerceRecord);
        const { canWatch } = courseLessonAccess(data);
        const restricted = lessons.filter(lesson => lesson.accessScope === 'entitled');
        const trialIds = platformTrialLessonIds(data.presentation);
        if (!restricted.length || restricted.some(lesson => typeof lesson.id !== 'string' || canWatch(lesson.id, lesson.accessScope))) return;
        if (!studied.filter(record => record.data?.courseId === id).every(record => {
          const lesson = lessons.find(row => row.id === (record.data?.lessonId ?? record.id));
          return lesson?.accessScope === 'public' && platformCourseLessonSection(lesson, trialIds) === 'trial';
        })) return;
      }
      if (!controller.signal.aborted) setTrialHint({ personal: current, courseId });
    })().catch(() => { /* Unknown entitlement or incomplete history: no redemption prompt. */ });
    return () => controller.abort();
  }, [current, courseId, resumeProgress]);
  const hasLessonRows = Array.isArray(course?.data?.lessons);
  useEffect(() => {
    setCurrentDetail(undefined);
    if (!courseId || hasLessonRows) return;
    const controller = new AbortController();
    void loadPlatformResource('courses', { params: { id: courseId }, signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setCurrentDetail(result.items[0]);
    }).catch(() => {});
    return () => controller.abort();
  }, [courseId, hasLessonRows]);

  const trialHref = trial ? `/platform/courses/${encodeURIComponent(trial.id)}/sections/core?lesson=${encodeURIComponent(trial.lessonId)}` : trialChecked ? '/platform/courses' : '/platform/courses?trial=1';
  const trialLabel = trial || !trialChecked ? t('免费试听第一课', 'Try your first lesson for free') : t('浏览课程', 'Browse courses');
  return <div className="platform-landing">
    {user && !current ? <section className="platform-home-learning" aria-label={t('正在读取学习进度', 'Loading learning progress')} aria-busy="true"><h1>{t('我的学习', 'My learning')}</h1><div className="platform-home-resume platform-home-resume-skeleton" data-has-cover="true"><span className="platform-home-learning-main"><SkeletonBlock className="platform-home-learning-cover" /><span className="platform-home-learning-copy"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></span></span><SkeletonBlock className="platform-home-skeleton-action" /></div></section>
      : course ? <HomeResume course={course} progress={resumeProgress} detail={currentDetail?.id === course.id ? currentDetail : undefined} trialOnly={trialHint?.personal === current && trialHint.courseId === course.id} />
      : learningContexts[0] ? <section className="platform-home-hero"><h1>{t('我的学习档案', 'My learning record')}</h1><p>{learningContexts[0].student.displayName} · {learningContexts[0].organization.name}</p><div className="platform-home-actions"><AppLink className="platform-button platform-button-primary" href="/learn" prefetch={false}>{t('查看学习档案', 'View learning record')}<ArrowRight aria-hidden /></AppLink></div></section>
      : current?.failed ? <section className="platform-home-hero"><h1>{t('我的学习', 'My learning')}</h1><p role="status">{t('学习进度暂时无法读取。', 'Your learning progress is temporarily unavailable.')}</p><div className="platform-home-actions"><AppLink className="platform-button platform-button-primary" href="/platform/account/courses" prefetch={false}>{t('查看我的课程', 'View my courses')}<ArrowRight aria-hidden /></AppLink></div></section>
      : <header className="platform-home-hero">
        <h1>{t('从第一次复原，到下一次突破。', 'From your first solve to your next breakthrough.')}</h1>
        <p>{t('跟随讲师系统学习，找到适合自己的训练节奏。', 'Learn with instructors and find your training rhythm.')}</p>
        <div className="platform-home-actions">
          <AppLink className="platform-button platform-button-primary" href={trialHref} prefetch={false}><Play aria-hidden />{trialLabel}<ArrowRight aria-hidden /></AppLink>
          {!user && <AppLink className="platform-home-secondary" href={`/account${nextQuery(lang === 'zh' ? '/zh/platform' : '/platform')}`} prefetch={false}>{t('登录 / 注册', 'Sign in / sign up')}</AppLink>}
          <AppLink className="platform-home-secondary" href="/timer" prefetch={false}>{t('测一测我的水平', 'Test my level')}</AppLink>
          <AppLink className="platform-home-secondary platform-home-redeem" href="/platform/account/invites" prefetch={false}>{t('兑换课程', 'Redeem course')}</AppLink>
        </div>
      </header>}

    <HomeLearningPath key={user ? String(user.uid ?? user.wcaId) : 'guest'} owner={user ? String(user.uid ?? user.wcaId) : 'guest'} />
    {(!user || (current && !current.failed)) && <PlatformHomepageCarousel excludedCourseIds={excludedCourseIds} />}

    {teachers.length > 0 && <section className="platform-instructors" aria-labelledby="platform-instructors-title">
      <div className="platform-instructors-header"><div className="platform-instructors-heading"><h2 id="platform-instructors-title">{t('找到合拍的讲师', 'Find your kind of instructor')}</h2></div>
        <AppLink className="platform-home-secondary" href="/platform/teachers" prefetch={false}>{t('查看全部讲师', 'View all teachers')}<ArrowRight aria-hidden /></AppLink></div>
      <div className="platform-instructor-grid">{teachers.map(teacher => <PlatformInstructorCard key={teacher.id} teacher={teacher} />)}</div>
    </section>}
    {user && current && organizations.length > 0 && <section className="platform-home-workspaces"><h2>{t('你的机构', 'Your organizations')}</h2>
      <div className="platform-home-workspace-list">{organizations.map(org => <AppLink key={org.slug} className="platform-entry-link" data-site-surface="panel" href={`/platform/org/${encodeURIComponent(org.slug)}`} prefetch={false}><strong>{org.name}</strong><ArrowRight aria-hidden /></AppLink>)}</div></section>}
  </div>;
}
