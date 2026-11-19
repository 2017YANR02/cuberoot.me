'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Bell, BookOpen, ChartNoAxesColumnIncreasing, IdCard, Layers, MessagesSquare, Play, Timer, UserRound } from '@app-foundation/icons/lucide';
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
import { courseCatalogDetails } from '@/lib/platform-course-catalog';

export function PlatformLanding() {
  const t = useT();
  const [teachers, setTeachers] = useState<TeacherDirectoryEntry[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(true);
  const [teachersError, setTeachersError] = useState(false);
  useEffect(() => {
    let active = true;
    void fetchTeacherDirectory()
      .then(items => { if (active) setTeachers(items.filter(item => item.kind === 'teacher').slice(0, 3)); })
      .catch(() => { if (active) setTeachersError(true); })
      .finally(() => { if (active) setTeachersLoading(false); });
    return () => { active = false; };
  }, []);
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
  const learningTitle = currentCourse?.title ?? firstLearningContext?.student.displayName
    ?? (partialFailure ? t('浏览课程', 'Browse courses') : t('开始你的第一门课', 'Start your first course'));
  const learningDescription = currentCourse
    ? nextProgress?.title
    : firstLearningContext?.organization.name ?? t('选择适合自己的课程', 'Choose a course for your level');
  const learningHref = currentCourse ? continueHref : firstLearningContext ? '/learn' : '/platform/courses';
  const learningAction = currentCourse ? t('继续学习', 'Continue learning')
    : firstLearningContext ? t('查看学习档案', 'View learning record') : t('查看全部课程', 'View all courses');
  const learningCover = currentCourse && courseCatalogDetails(currentCourse).coverUrl;

  const discovery = [
    { href: '/platform/courses', title: t('系统课程', 'Structured courses'), description: t('按主题与学习阶段选课', 'Courses by topic and skill level'), icon: BookOpen },
    { href: '/platform/teachers', title: t('讲师名录', 'Teacher directory'), description: t('认识讲师与他们的教学方向', 'Meet teachers and explore their specialties'), icon: IdCard },
    { href: '/platform/community', title: t('学习社区', 'Learning community'), description: t('分享练习、心得与学习成果', 'Share practice, insights, and progress'), icon: MessagesSquare },
    { href: '/platform/events', title: t('活动与实践', 'Events and practice'), description: t('参加活动与专项练习', 'Join events and practice your skills'), icon: Timer },
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
          <AppLink className="platform-button" href="/platform/account/invites" prefetch={false}>{t('已有兑换码？解锁课程', 'Have a code? Unlock your course')}<ArrowRight aria-hidden /></AppLink>
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
        <div className="platform-instructors-header">
          <div className="platform-instructors-heading">
            <h2 id="platform-instructors-title">{t('找到合拍的老师。', 'Find your kind of teacher.')}</h2>
            <p>{t('一个项目，不止一位老师。一位老师，也不止一种可能。', 'More than one teacher for every puzzle. More than one path with every teacher.')}</p>
          </div>
          <AppLink className="platform-home-secondary" href="/teachers" prefetch={false}>{t('查看全部讲师', 'View all teachers')}<ArrowRight aria-hidden /></AppLink>
        </div>
        {teachers.length > 0 ? (
          <div className="platform-instructor-grid">
            {teachers.map(teacher => {
              const photo = teacher.images.find(item => item.kind === 'teaching')
                ?? teacher.images.find(item => item.kind === 'portrait') ?? teacher.images[0];
              const specialties = t(
                teacher.specialtiesZh.join(' · ') || teacher.specialtiesEn.join(' · '),
                teacher.specialtiesEn.join(' · ') || teacher.specialtiesZh.join(' · '),
              );
              return <AppLink key={teacher.id} className="platform-instructor-card" href={`/teachers?teacher=${teacher.id}`} prefetch={false}>
                <div className="platform-instructor-cover">
                  <UserRound aria-hidden />
                  {photo && <img src={photo.url} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
                </div>
                <div className="platform-instructor-info">
                  <h3>{t(teacher.nameZh || teacher.nameEn, teacher.nameEn || teacher.nameZh)}</h3>
                  <p>{specialties || t(teacher.descriptionZh || teacher.descriptionEn, teacher.descriptionEn || teacher.descriptionZh)}</p>
                </div>
              </AppLink>;
            })}
          </div>
        ) : (
          <div className="platform-instructors-empty" role="status">
            {teachersLoading ? <LoadingIndicator>{t('正在读取讲师资料…', 'Loading teachers…')}</LoadingIndicator>
              : teachersError ? t('讲师资料暂时无法加载。', 'Teacher profiles are temporarily unavailable.')
                : t('暂无公开讲师资料。', 'No public teacher profiles yet.')}
          </div>
        )}
      </section>

      {signedIn ? (
        <section className="platform-home-learning" aria-labelledby="platform-home-learning-title">
          <div className="platform-home-section-heading">
            <h2 id="platform-home-learning-title">{t('你的下一步', 'Your next step')}</h2>
          </div>
          {loading ? (
            <p className="platform-home-status" role="status" aria-busy="true" aria-live="polite"><LoadingIndicator>{t('正在读取学习进度与工作区…', 'Loading your learning and workspaces…')}</LoadingIndicator></p>
          ) : (
            <AppLink className="platform-home-resume platform-entry-link" data-has-cover={Boolean(learningCover)} data-site-surface="panel" href={learningHref} prefetch={false}>
              {learningCover && <span className="platform-home-learning-cover">
                <Image src={learningCover} alt="" fill sizes="(max-width: 479px) 112px, 224px" unoptimized={!learningCover.startsWith('/')} onError={event => { event.currentTarget.hidden = true; }} />
              </span>}
              <span className="platform-home-learning-copy">
                <strong>{learningTitle}</strong>
                {learningDescription && <small>{learningDescription}</small>}
                {currentCourse && progressBps !== null && <span className="platform-home-progress">
                  <progress max={10_000} value={progressBps} aria-label={t('课程进度', 'Course progress')} />
                  <span>{Math.round(progressBps / 100)}%</span>
                </span>}
              </span>
              <span className="platform-button platform-button-primary platform-home-learning-action">{learningAction}<ArrowRight aria-hidden /></span>
            </AppLink>
          )}
          <div className="platform-home-quick-links">
            <AppLink className="platform-home-quick-link" href="/platform/progress" prefetch={false}><ChartNoAxesColumnIncreasing aria-hidden />{t('学习进度', 'Learning progress')}</AppLink>
            <AppLink className="platform-home-quick-link" href="/platform/notifications" prefetch={false}><Bell aria-hidden />{t('消息', 'Messages')}</AppLink>
            <AppLink className="platform-home-quick-link" href="/platform/account/courses" prefetch={false}><Layers aria-hidden />{t('我的课程', 'My courses')}</AppLink>
          </div>
          {partialFailure ? <p className="platform-home-note">{t('部分个人入口暂时未能加载，公开内容仍可正常使用。', 'Some personal entries could not load; public content is still available.')}</p> : null}
        </section>
      ) : null}

      <section className="platform-home-discovery" aria-labelledby="platform-home-discovery-title">
        <div className="platform-home-section-heading">
          <h2 id="platform-home-discovery-title">{t('现在想做什么？', 'What do you want to do now?')}</h2>
        </div>
        <div className="platform-home-action-list">
          {discovery.map((item) => (
            <AppLink key={item.href} className="platform-home-tile" data-site-surface="panel" href={item.href} prefetch={false}>
              <item.icon className="platform-home-tile-icon" aria-hidden strokeWidth={1.7} />
              <span className="platform-home-tile-copy">
                <strong>{item.title}</strong><ArrowRight aria-hidden />
                <small>{item.description}</small>
              </span>
            </AppLink>
          ))}
        </div>
      </section>

      {signedIn && hasWorkspaces ? (
        <section className="platform-home-workspaces" aria-labelledby="platform-home-workspaces-title">
          <div className="platform-home-section-heading">
            <h2 id="platform-home-workspaces-title">{t('你的工作区', 'Your workspaces')}</h2>
          </div>
          <div className="platform-home-workspace-list">
            {instructor ? (
              <AppLink className="platform-entry-link" data-site-surface="panel" href="/platform/instructor" prefetch={false}>
                <span><strong>{t('讲师工作台', 'Instructor workspace')}</strong><small>{t('管理课程、学员与收入', 'Manage courses, students, and earnings')}</small></span>
                <ArrowRight aria-hidden />
              </AppLink>
            ) : null}
            {firstOrganization ? (
              <AppLink className="platform-entry-link" data-site-surface="panel" href={`/platform/org/${encodeURIComponent(firstOrganization.slug)}`} prefetch={false}>
                <span><strong>{firstOrganization.name}</strong><small>{organizations.length > 1 ? t(`另有 ${organizations.length - 1} 个机构`, `${organizations.length - 1} more organizations`) : t('机构工作台', 'Organization workspace')}</small></span>
                <ArrowRight aria-hidden />
              </AppLink>
            ) : null}
            {mounted && isAdmin ? (
              <AppLink className="platform-entry-link" data-site-surface="panel" href="/platform/admin" prefetch={false}>
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
