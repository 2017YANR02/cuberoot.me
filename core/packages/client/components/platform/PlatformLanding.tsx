'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Play } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { SHOP_ROOT } from '@/lib/shop';
import { fetchTeacherDirectory, type TeacherDirectoryEntry } from '@/lib/teacher-directory-api';
import { useT } from '@/hooks/useT';
import { getSessionToken, useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { loadPlatformResource, PlatformPermissionError } from '@/lib/platform-gateway';
import { listTeachingLearningContexts, listTeachingOrganizations } from '@/lib/teaching-saas-api';
import type { TeachingLearningContext } from '@cuberoot/shared/teaching';
import type { TeachingOrganizationAccess } from '@/lib/teaching-saas-api';
import type { PlatformEntity } from '@/lib/platform-types';
import { LoadingIndicator } from '@/components/LoadingIndicator';

export function PlatformLanding() {
  const t = useT();
  const [teachers, setTeachers] = useState<TeacherDirectoryEntry[]>([]);
  const [teachersError, setTeachersError] = useState(false);
  useEffect(() => { let active = true; void fetchTeacherDirectory().then(items => { if (active) setTeachers(items.filter(item => item.kind === 'teacher').slice(0, 6)); }).catch(() => { if (active) setTeachersError(true); }); return () => { active = false; }; }, []);
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<PlatformEntity[]>([]);
  const [progress, setProgress] = useState<PlatformEntity[]>([]);
  const [learningContexts, setLearningContexts] = useState<TeachingLearningContext[]>([]);
  const [organizations, setOrganizations] = useState<TeachingOrganizationAccess[]>([]);
  const [instructor, setInstructor] = useState(false);
  const [partialFailure, setPartialFailure] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted || !user) {
      setCourses([]);
      setProgress([]);
      setLearningContexts([]);
      setOrganizations([]);
      setInstructor(false);
      setPartialFailure(false);
      setLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setCourses([]);
    setProgress([]);
    setLearningContexts([]);
    setOrganizations([]);
    setInstructor(false);
    setPartialFailure(false);
    const platformOptions = { params: {}, signal: controller.signal };
    const hasTeachingSession = Boolean(getSessionToken());
    void Promise.allSettled([
      loadPlatformResource('account-courses', platformOptions),
      loadPlatformResource('account-progress', platformOptions),
      loadPlatformResource('instructor-courses', platformOptions),
      hasTeachingSession ? listTeachingOrganizations() : Promise.resolve([]),
      hasTeachingSession ? listTeachingLearningContexts() : Promise.resolve([]),
    ]).then(([courseResult, progressResult, instructorResult, organizationResult, contextResult]) => {
      if (!active) return;
      setCourses(courseResult.status === 'fulfilled' ? courseResult.value.items : []);
      setProgress(progressResult.status === 'fulfilled' ? progressResult.value.items : []);
      setInstructor(instructorResult.status === 'fulfilled');
      setOrganizations(organizationResult.status === 'fulfilled' ? organizationResult.value : []);
      setLearningContexts(contextResult.status === 'fulfilled' ? contextResult.value : []);
      const unexpectedInstructorFailure = instructorResult.status === 'rejected'
        && !(instructorResult.reason instanceof PlatformPermissionError);
      setPartialFailure(
        courseResult.status === 'rejected'
        || progressResult.status === 'rejected'
        || organizationResult.status === 'rejected'
        || contextResult.status === 'rejected'
        || unexpectedInstructorFailure,
      );
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [mounted, user]);

  const signedIn = mounted && Boolean(user);
  const nextProgress = progress.find((item) => item.data?.status !== 'completed') ?? progress[0];
  const currentCourse = courses.find((item) => item.id === nextProgress?.data?.courseId) ?? courses[0];
  const progressBps = typeof currentCourse?.data?.progressBps === 'number' && Number.isFinite(currentCourse.data.progressBps)
    ? Math.min(10_000, Math.max(0, currentCourse.data.progressBps))
    : null;
  const continueHref = nextProgress && typeof nextProgress.data?.courseId === 'string'
    ? `/platform/courses/${encodeURIComponent(nextProgress.data.courseId)}/learn/${encodeURIComponent(String(nextProgress.data.lessonId ?? nextProgress.id))}`
    : currentCourse
      ? `/platform/courses/${encodeURIComponent(currentCourse.id)}`
      : '/platform/courses';
  const primaryLabel = signedIn && currentCourse
    ? t('继续学习', 'Continue learning')
    : t('浏览课程', 'Browse courses');
  const firstLearningContext = learningContexts[0];
  const firstOrganization = organizations[0];
  const hasWorkspaces = instructor || Boolean(firstOrganization) || (mounted && isAdmin);

  const discovery = [
    { href: '/platform/courses', title: t('系统课程', 'Structured courses'), description: t('按主题找到课程、课时与学习路径。', 'Find courses, lessons, and paths by topic.') },
    { href: '/platform/teachers', title: t('讲师名录', 'Teacher directory'), description: t('查看主站中的真实讲师资料与教学方向。', 'Meet teachers and explore their specialties.') },
    { href: '/platform/community', title: t('学习社区', 'Learning community'), description: t('把问题、经验与学习成果带到讨论中。', 'Bring questions, experience, and progress into the discussion.') },
    { href: '/platform/events', title: t('活动与实践', 'Events and practice'), description: t('参加活动，并继续使用主站计时器与公式库练习。', 'Join events and keep practicing with the main-site tools.') },
  ];

  return (
    <div className="platform-landing">
      <header className="platform-home-hero">

        <h1>{t('每一次转动，', 'Every turn.')}<br /><span>{t('都有新收获。', 'A new discovery.')}</span></h1>
        <p>{t('从第一次复原，到下一次突破。跟随讲师的镜头，把热爱练成自己的本领。', 'From your first solve to your next breakthrough. Learn alongside your instructor, one move at a time.')}</p>
        <div className="platform-home-actions">
          <AppLink className="platform-button platform-button-primary" href={signedIn ? continueHref : '/platform/courses'} prefetch={false}>
            {primaryLabel}<ArrowRight aria-hidden />
          </AppLink>
          <AppLink className="platform-home-secondary" href="/platform/account/invites" prefetch={false}>{t('已有兑换码？解锁课程', 'Have a code? Unlock your course')}<ArrowRight aria-hidden /></AppLink>
        </div>
      </header>

      <section className="platform-teacher-feature" aria-labelledby="platform-feature-title">
        <Image className="platform-feature-photo" src="/images/ruimin/gallery/photo-03.webp" width={3200} height={2400} sizes="(max-width: 1160px) 100vw, 1120px" priority alt={t('颜瑞民在魔方比赛现场展示复原结果', 'Yan Ruimin demonstrating a solve at a cubing competition')} />
        <span className="platform-feature-caption platform-glass">{t('热爱，在这里发生。', 'This is where it begins.')}</span>
        <div className="platform-feature-copy platform-glass">

          <h2 id="platform-feature-title">{t('颜瑞民课程', 'Yan Ruimin Courses')}</h2>
          <p>{t('认识魔方，也认识每一步的道理。引言、试听课与正式课，循序渐进地学。', 'Understand the cube, and the reason behind every move. Explore the introduction, trial lessons, and full course at your own pace.')}</p>
          <AppLink className="platform-home-secondary" href="/platform/courses/yan-ruimin-3x3-beginner" prefetch={false}><span className="platform-play-orb" aria-hidden><Play /></span>{t('了解课程', 'Explore the course')}<ArrowRight aria-hidden /></AppLink>
        </div>
      </section>

      <section className="platform-instructors" aria-labelledby="platform-instructors-title">
        <div className="platform-instructors-heading">

          <h2 id="platform-instructors-title">{t('找到合拍的老师。', 'Find your kind of teacher.')}</h2>
          <p>{t('一个项目，不止一位老师。一位老师，也不止一种可能。', 'More than one teacher for every puzzle. More than one path with every teacher.')}</p>
        </div>
        <div className="platform-instructor-grid">
          {teachers.map(teacher => <article key={teacher.id} className="platform-instructor-card" data-site-surface="panel">
            {teacher.images[0] && <img className="platform-entity-cover" src={teacher.images[0].url} alt="" loading="lazy" />}
            <div className="platform-instructor-info">
              <h3><AppLink href={`/teachers?teacher=${teacher.id}`} prefetch={false}>{t(teacher.nameZh || teacher.nameEn, teacher.nameEn || teacher.nameZh)}</AppLink></h3>
              <p>{t(teacher.descriptionZh || teacher.descriptionEn, teacher.descriptionEn || teacher.descriptionZh)}</p>
            </div>
          </article>)}
        </div>
        {teachersError && <p role="status">{t('讲师资料暂时无法加载。', 'Teacher profiles are temporarily unavailable.')}</p>}
        <AppLink href="/teachers" prefetch={false}>{t('浏览完整讲师名录', 'Browse the teacher directory')}<ArrowRight aria-hidden /></AppLink>
      </section>

      {signedIn ? (
        <section className="platform-home-learning" aria-labelledby="platform-home-learning-title">
          <div className="platform-home-section-heading">
            <span>{t('你的下一步', 'Your next step')}</span>
            <h2 id="platform-home-learning-title">{t(`${user?.name ?? ''}，继续上次的学习。`, `Continue where you left off, ${user?.name ?? ''}.`)}</h2>
          </div>
          {loading ? (
            <p className="platform-home-status" role="status" aria-busy="true" aria-live="polite"><LoadingIndicator>{t('正在读取学习进度与工作区…', 'Loading your learning and workspaces…')}</LoadingIndicator></p>
          ) : currentCourse ? (
            <AppLink className="platform-home-resume" href={continueHref} prefetch={false}>
              <span>
                <small>{t('继续课程', 'Continue course')}</small>
                <strong>{currentCourse.title}</strong>
                {nextProgress ? <span>{nextProgress.title}</span> : null}
              </span>
              <span className="platform-home-progress">
                {progressBps === null ? t('打开', 'Open') : `${Math.round(progressBps / 100)}%`}
                <ArrowRight aria-hidden />
              </span>
            </AppLink>
          ) : firstLearningContext ? (
            <AppLink className="platform-home-resume" href="/learn" prefetch={false}>
              <span>
                <small>{firstLearningContext.organization.name}</small>
                <strong>{firstLearningContext.student.displayName}</strong>
                <span>{t('打开主站学习档案', 'Open the main-site learning record')}</span>
              </span>
              <span className="platform-home-progress">{t('查看', 'View')}<ArrowRight aria-hidden /></span>
            </AppLink>
          ) : (
            <div className="platform-home-empty">
              <p>{t('还没有进行中的课程。先选一门真正想学的内容。', 'No course is in progress yet. Start with something you genuinely want to learn.')}</p>
              <AppLink href="/platform/courses" prefetch={false}>{t('查看全部课程', 'See all courses')}<ArrowRight aria-hidden /></AppLink>
            </div>
          )}
          <div className="platform-home-quick-links">
            <AppLink href="/platform/progress" prefetch={false}>{t('学习进度', 'Learning progress')}</AppLink>
            <AppLink href="/platform/notifications" prefetch={false}>{t('消息', 'Messages')}</AppLink>
            <AppLink href="/platform/account/courses" prefetch={false}>{t('我的课程', 'My courses')}</AppLink>
          </div>
          {partialFailure ? <p className="platform-home-note">{t('部分个人入口暂时未能加载，公开内容仍可正常使用。', 'Some personal entries could not load; public content is still available.')}</p> : null}
        </section>
      ) : null}

      <section className="platform-home-discovery" aria-labelledby="platform-home-discovery-title">
        <div className="platform-home-section-heading">
          <span>{t('从需求出发', 'Start with the need')}</span>
          <h2 id="platform-home-discovery-title">{t('现在想做什么？', 'What do you want to do now?')}</h2>
        </div>
        <div className="platform-home-action-list">
          {discovery.map((item) => (
            <AppLink key={item.href} href={item.href} prefetch={false}>
              <span><strong>{item.title}</strong><small>{item.description}</small></span>
              <ArrowRight aria-hidden />
            </AppLink>
          ))}
        </div>
      </section>

      {signedIn && hasWorkspaces ? (
        <section className="platform-home-workspaces" aria-labelledby="platform-home-workspaces-title">
          <div className="platform-home-section-heading">
            <span>{t('身份与协作', 'Roles and collaboration')}</span>
            <h2 id="platform-home-workspaces-title">{t('你的工作区', 'Your workspaces')}</h2>
          </div>
          <div className="platform-home-workspace-list">
            {instructor ? (
              <AppLink href="/platform/instructor" prefetch={false}>
                <span><strong>{t('讲师工作台', 'Instructor workspace')}</strong><small>{t('管理课程、学员与收入', 'Manage courses, students, and earnings')}</small></span>
                <ArrowRight aria-hidden />
              </AppLink>
            ) : null}
            {firstOrganization ? (
              <AppLink href={`/platform/org/${encodeURIComponent(firstOrganization.slug)}`} prefetch={false}>
                <span><strong>{firstOrganization.name}</strong><small>{organizations.length > 1 ? t(`另有 ${organizations.length - 1} 个机构`, `${organizations.length - 1} more organizations`) : t('机构工作台', 'Organization workspace')}</small></span>
                <ArrowRight aria-hidden />
              </AppLink>
            ) : null}
            {mounted && isAdmin ? (
              <AppLink href="/platform/admin" prefetch={false}>
                <span><strong>{t('Platform 管理', 'Platform administration')}</strong><small>{t('进入统一管理工作区', 'Open the unified administration workspace')}</small></span>
                <ArrowRight aria-hidden />
              </AppLink>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className="platform-home-more">
        <span>{t('继续探索', 'Keep exploring')}</span>
        <AppLink href="/platform/paths" prefetch={false}>{t('学习路径', 'Learning paths')}</AppLink>
        <AppLink href="/platform/news" prefetch={false}>{t('资讯', 'News')}</AppLink>
        {isAdmin && <AppLink href={SHOP_ROOT} prefetch={false}>{t('商店', 'Shop')}</AppLink>}
        <AppLink href="/platform/about" prefetch={false}>{t('关于 Platform', 'About Platform')}</AppLink>
      </footer>
    </div>
  );
}
