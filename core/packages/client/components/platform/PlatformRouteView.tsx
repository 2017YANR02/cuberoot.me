'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, ExternalLink, Play, Search } from 'lucide-react';
import { parseAsFloat, parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import { AccountPanel, LoginForm } from '@/components/AuthPanel';
import BoolToggle from '@/components/BoolToggle';
import SearchInput from '@/components/SearchInput';
import SortArrow from '@/components/SortArrow';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { useT } from '@/hooks/useT';
import { getSessionToken, useAuthUser, useIsAdmin } from '@/lib/auth-store';
import {
  executePlatformAction,
  loadPlatformResource,
  PLATFORM_ACTION_LABELS,
  PlatformPermissionError,
} from '@/lib/platform-gateway';
import { fillPlatformParams, PLATFORM_ROUTES } from '@/lib/platform-routes';
import { listTeachingLearningContexts, listTeachingOrganizations } from '@/lib/teaching-saas-api';
import type { TeachingLearningContext } from '@cuberoot/shared/teaching';
import type { TeachingOrganizationAccess } from '@/lib/teaching-saas-api';
import type {
  PlatformActionId,
  PlatformActionResult,
  PlatformEntity,
  PlatformResourceResult,
  PlatformRouteDefinition,
} from '@/lib/platform-types';
import { PlatformState } from './PlatformState';
import { PlatformDomainActions } from './PlatformDomainActions';
import { PlatformDomainContent } from './PlatformDomainContent';
import { PlatformPrivacySettings } from './PlatformPrivacySettings';
import { PlatformQrCardStudio } from './PlatformQrCardStudio';
import { OnlineCompetitionPreview } from './OnlineCompetitionPreview';

function titleFor(t: ReturnType<typeof useT>, definition: PlatformRouteDefinition): string {
  return t(definition.title.zh, definition.title.en);
}

function localDetailHref(definition: PlatformRouteDefinition, entity: PlatformEntity): string | null {
  const base = `/platform/${definition.pattern}`.replace(/\/$/, '');
  if (definition.kind !== 'collection') return null;
  if (definition.id === 'teachers') return `/platform/teachers/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'community') return `/platform/community/posts/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'community-circle') return `/platform/community/posts/${encodeURIComponent(entity.id)}`;
  if (['courses', 'paths', 'events', 'news', 'shop', 'orders'].includes(definition.id)) {
    return `${base}/${encodeURIComponent(entity.id)}`;
  }
  const adminCollections: Record<string, string> = {
    'admin-algorithms': 'algorithms',
    'admin-applications': 'teacher-applications',
    'admin-courses': 'courses',
    'admin-events': 'events',
    'admin-teachers': 'teachers',
    'admin-news': 'news',
    'admin-orders': 'orders',
    'admin-products': 'products',
    'admin-qr': 'qr',
  };
  if (adminCollections[definition.id]) return `/platform/admin/${adminCollections[definition.id]}/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'instructor-courses') return `/platform/instructor/courses/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'account-courses') return `/platform/courses/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'account-favorites') {
    const targetType = entity.data?.targetType;
    if (targetType === 'course') return `/platform/courses/${encodeURIComponent(entity.id)}`;
    if (targetType === 'product') return `/platform/shop/${encodeURIComponent(entity.id)}`;
    if (targetType === 'event') return `/platform/events/${encodeURIComponent(entity.id)}`;
  }
  if (definition.id === 'account-wishlist') return `/platform/shop/${encodeURIComponent(entity.id)}`;
  return null;
}

function favoriteType(definition: PlatformRouteDefinition, item: PlatformEntity): 'course' | 'product' | 'event' {
  const explicit = item.data?.targetType;
  if (explicit === 'product' || explicit === 'event') return explicit;
  if (definition.resource === 'products') return 'product';
  if (definition.resource === 'events') return 'event';
  return 'course';
}

const TEACHER_EVENTS = ['all', '333', '222', '444', '555', '333oh', 'pyram', 'skewb'] as const;

function PlatformLanding() {
  const t = useT();
  const [teacherEvent, setTeacherEvent] = useQueryState('teacherEvent', parseAsStringEnum([...TEACHER_EVENTS]).withDefault('all'));
  // Presentation-only fictional people; never seed these into the real teacher directory.
  const demoTeachers = [
    { name: t('林知远', 'Lin Zhiyuan'), events: ['333', '222'], focus: t('从零开始，也可以很从容', 'A confident first solve'), bio: t('把复杂步骤拆成小目标，陪你理解每一次转动。', 'Small, clear goals that make every move feel natural.') },
    { name: t('陈予安', 'Chen Yuan'), events: ['333', '333oh'], focus: t('找到自己的流畅节奏', 'Find your flow'), bio: t('从双手到单手，让观察与转动慢慢连成一体。', 'Connect recognition and movement, with one hand or two.') },
    { name: t('诺亚 布鲁克斯', 'Noah Brooks'), events: ['444', '555', '333'], focus: t('多一层，也多一种可能', 'Go beyond three layers'), bio: t('从三阶走向高阶，用清晰的思路处理更多模块。', 'Build on your 3×3 skills with a clear approach to bigger cubes.') },
    { name: t('许星禾', 'Xu Xinghe'), events: ['222', 'pyram', 'skewb'], focus: t('小魔方，大乐趣', 'Small puzzles, big discoveries'), bio: t('换一种形状探索，在短小练习中发现解题的乐趣。', 'Explore new shapes and discover the joy in short practice sessions.') },
    { name: t('利奥 摩根', 'Leo Morgan'), events: ['333', '444', '333oh'], focus: t('让每一次练习更有方向', 'Practice with a purpose'), bio: t('关注停顿与衔接，把练习变成看得见的小进步。', 'Work on pauses and transitions, one achievable improvement at a time.') },
    { name: t('米拉 沙阿', 'Mira Shah'), events: ['pyram', 'skewb', '222'], focus: t('不止一种解法', 'A different way to think'), bio: t('从直觉出发理解结构，在不同项目间找到相通之处。', 'Start with intuition and find connections between different puzzles.') },
  ];
  const teacherEvents = [...new Set(demoTeachers.flatMap(teacher => teacher.events))];
  const visibleTeachers = demoTeachers.map((teacher, index) => ({ ...teacher, index }))
    .filter(teacher => teacherEvent === 'all' || teacher.events.includes(teacherEvent));
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
    { href: '/platform/teachers', title: t('讲师名录', 'Teacher directory'), description: t('查看主站中的真实讲师资料与教学方向。', 'Meet verified teachers and explore their specialties.') },
    { href: '/platform/community', title: t('学习社区', 'Learning community'), description: t('把问题、经验与学习成果带到讨论中。', 'Bring questions, experience, and progress into the discussion.') },
    { href: '/platform/events', title: t('活动与实践', 'Events and practice'), description: t('参加活动，并继续使用主站计时器与公式库练习。', 'Join events and keep practicing with the main-site tools.') },
  ];

  return (
    <div className="platform-landing">
      <header className="platform-home-hero">
        <span className="platform-kicker">{t('CubeRoot 学习空间', 'CubeRoot Learning')}</span>
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
          <span className="platform-kicker">{t('跟着老师，一起练', 'Meet your instructor')}</span>
          <h2 id="platform-feature-title">{t('颜瑞民课程', 'Yan Ruimin Courses')}</h2>
          <p>{t('认识魔方，也认识每一步的道理。引言、试听课与正式课，循序渐进地学。', 'Understand the cube, and the reason behind every move. Explore the introduction, trial lessons, and full course at your own pace.')}</p>
          <AppLink className="platform-home-secondary" href="/platform/courses/yan-ruimin-3x3-beginner" prefetch={false}><span className="platform-play-orb" aria-hidden><Play /></span>{t('了解课程', 'Explore the course')}<ArrowRight aria-hidden /></AppLink>
        </div>
      </section>

      <section className="platform-instructors" aria-labelledby="platform-instructors-title">
        <div className="platform-instructors-heading">
          <span className="platform-kicker">{t('不同专长，同样热爱', 'Different specialties. Shared passion.')}</span>
          <h2 id="platform-instructors-title">{t('找到合拍的老师。', 'Find your kind of teacher.')}</h2>
          <p>{t('一个项目，不止一位老师。一位老师，也不止一种可能。', 'More than one teacher for every puzzle. More than one path with every teacher.')}</p>
        </div>
        <div className="platform-instructors-toolbar">
          <PuzzlePicker selectedEvent={teacherEvent} isZh={t('zh', 'en') === 'zh'} showTriggerIcon={false}
            placeholderLabel={t('按项目找老师', 'Find teachers by puzzle')}
            groups={[{ id: 'teacher-events', label: t('教学项目', 'Teaching specialties'), items: [
              { id: 'all', label: t('全部项目', 'All puzzles'), textLabel: t('全部', 'All') },
              ...teacherEvents.map(id => ({ id, label: eventDisplayName(id, t('zh', 'en') === 'zh'), iconClass: `event-${id}` })),
            ] }]}
            onSelect={id => {
              const selected = TEACHER_EVENTS.find(event => event === id);
              if (selected) void setTeacherEvent(selected);
            }} />
          <p>{t('以下为虚拟老师展示，尚未开放课程或预约。', 'Fictional teacher previews. Courses and bookings are not available yet.')}</p>
        </div>
        <div className="platform-instructor-grid" aria-live="polite">
          {visibleTeachers.map(teacher => <article key={teacher.index} className="platform-instructor-card">
            <div className="platform-instructor-portrait" aria-hidden="true" style={{ backgroundPosition: `${(teacher.index % 3) * 50}% ${Math.floor(teacher.index / 3) * 100}%` }}>
              <span className="platform-instructor-demo platform-glass">{t('虚拟老师', 'Demo teacher')}</span>
            </div>
            <div className="platform-instructor-info platform-glass">
              <span className="platform-instructor-focus">{teacher.focus}</span>
              <h3>{teacher.name}</h3>
              <p>{teacher.bio}</p>
              <div className="platform-instructor-events">{teacher.events.map(event => <span key={event}><EventIcon event={event} />{eventDisplayName(event, t('zh', 'en') === 'zh')}</span>)}</div>
              <span className="platform-instructor-availability">{t('展示样例', 'Preview only')}</span>
            </div>
          </article>)}
        </div>
      </section>

      {signedIn ? (
        <section className="platform-home-learning" aria-labelledby="platform-home-learning-title">
          <div className="platform-home-section-heading">
            <span>{t('你的下一步', 'Your next step')}</span>
            <h2 id="platform-home-learning-title">{t(`${user?.name ?? ''}，继续上次的学习。`, `Continue where you left off, ${user?.name ?? ''}.`)}</h2>
          </div>
          {loading ? (
            <p className="platform-home-status" role="status" aria-busy="true" aria-live="polite">{t('正在读取学习进度与工作区…', 'Loading your learning and workspaces…')}</p>
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
            <AppLink href="/platform/account/progress" prefetch={false}>{t('学习进度', 'Learning progress')}</AppLink>
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
        <AppLink href="/platform/shop" prefetch={false}>{t('商店', 'Shop')}</AppLink>
        <AppLink href="/platform/about" prefetch={false}>{t('关于 Platform', 'About Platform')}</AppLink>
      </footer>
    </div>
  );
}

function PlatformAboutView() {
  const t = useT();
  return (
    <div className="platform-static-view">
      <section>
        <h2>{t('现在的 Platform', 'Platform today')}</h2>
        <p>{t('Platform 已迁入 CubeRoot 主站：课程、学习记录、订单、讲师和运营工作区使用同一个账号与数据权限，不再维护第二套独立前端。', 'Platform now lives in the CubeRoot main site. Courses, learning records, orders, instructors, and operations use the same account and authorization model, without a second standalone frontend.')}</p>
      </section>
      <section>
        <h2>{t('复用原则', 'Reuse policy')}</h2>
        <p>{t('论坛、计时器、公式库、讲师名录和教学机构已有成熟主站实现；Platform 页面保留业务上下文，并把最终操作交给这些唯一实现。', 'The forum, timer, algorithm library, teacher directory, and organizations already have canonical main-site implementations. Platform keeps the product context and hands final interaction to those single implementations.')}</p>
      </section>
      <div className="platform-write-actions">
        <AppLink className="platform-button platform-button-primary" href="/platform/courses">{t('浏览课程', 'Browse courses')}</AppLink>
        <AppLink className="platform-button" href="/platform/account/courses">{t('我的学习', 'My learning')}</AppLink>
      </div>
    </div>
  );
}

function PlatformOfflineView() {
  const t = useT();
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return (
    <div className="platform-static-view">
      <section>
        <h2>{online === null ? t('正在检测连接', 'Checking connection') : online ? t('当前已联网', 'You are online') : t('当前处于离线状态', 'You are offline')}</h2>
        <p>{t('课程目录、订单、学习进度和后台操作需要实时连接。已经由浏览器缓存的主站工具可能仍可打开，但离线期间不会伪造同步成功。', 'Course catalogs, orders, progress, and administration require a live connection. Main-site tools already cached by the browser may still open, but no synchronization is presented as successful while offline.')}</p>
      </section>
      <div className="platform-write-actions">
        <button type="button" className="platform-button platform-button-primary" onClick={() => window.location.reload()}>{t('重新连接', 'Reconnect')}</button>
        <AppLink className="platform-button" href="/timer">{t('打开计时器', 'Open timer')}</AppLink>
        <AppLink className="platform-button" href="/alg">{t('打开公式库', 'Open algorithms')}</AppLink>
      </div>
    </div>
  );
}

function PlatformAccountView({ loginOnly }: { loginOnly: boolean }) {
  const user = useAuthUser();
  const t = useT();
  if (!user || loginOnly) {
    return (
      <div className="platform-auth-view">
        <p>{t('Platform 与主站共用同一个账号，不需要再次注册。', 'Platform shares the main-site account; no second registration is needed.')}</p>
        <LoginForm onDone={() => window.location.reload()} />
      </div>
    );
  }
  return <AccountPanel />;
}

function PlatformCanonicalView({
  definition,
  params,
}: {
  definition: PlatformRouteDefinition;
  params: Record<string, string>;
}) {
  const t = useT();
  const href = fillPlatformParams(definition.canonicalHref ?? '/', params);
  const related = PLATFORM_ROUTES
    .filter((item) => item.area === definition.area && item.id !== definition.id)
    .filter((item) => !item.pattern.includes(':'))
    .slice(0, 4);
  return (
    <div className="platform-canonical">
      <div className="platform-canonical-status">
        <strong>{t('共享主站能力', 'Shared main-site capability')}</strong>
        <p>{t('账号、数据和权限均为同一套；此页提供 Platform 上下文，具体交互使用主站的唯一实现。', 'Account, data, and permissions are shared. This page provides Platform context while the interaction uses the main site’s single implementation.')}</p>
      </div>
      <AppLink href={href} className="platform-button platform-button-primary" prefetch={false}>
        {t(definition.canonicalLabel?.zh ?? '打开功能', definition.canonicalLabel?.en ?? 'Open feature')}
        <ExternalLink aria-hidden />
      </AppLink>
      {related.length ? (
        <section className="platform-related">
          <h2>{t('同一区域', 'In this area')}</h2>
          <div>
            {related.map((item) => (
              <AppLink key={item.id} href={`/platform${item.pattern ? `/${item.pattern}` : ''}`} prefetch={false}>
                {titleFor(t, item)}
              </AppLink>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PlatformEntityList({
  definition,
  items,
  onAction,
  actionBusy,
}: {
  definition: PlatformRouteDefinition;
  items: PlatformEntity[];
  onAction: (action: PlatformActionId, id: string, payload?: Record<string, unknown>) => void;
  actionBusy: string | null;
}) {
  const t = useT();
  const baseActions = definition.kind === 'collection' || definition.kind === 'dashboard'
    ? (definition.actions ?? []).filter((action) => ['favorite', 'wishlist', 'enroll', 'cancel-order', 'delete-course', 'delete-note'].includes(action))
    : [];
  const quickActions: PlatformActionId[] = [
    ...baseActions,
    ...(definition.id === 'admin-qr' ? ['qr-toggle' as const] : []),
    ...(['admin-paths', 'admin-events', 'admin-news', 'admin-products', 'admin-teachers'].includes(definition.id) ? ['admin-delete' as const] : []),
  ];
  const learnerCourses = ['courses', 'account-courses'].includes(definition.id);
  // Course API fields and publication statuses are not learner-facing content.
  const learnerContent = learnerCourses || definition.id === 'course-lesson';
  return (
    <div className={`platform-entity-list${learnerCourses ? ' platform-course-list' : ''}`}>
      {items.map((item) => {
        const href = item.href?.startsWith('/') ? item.href : localDetailHref(definition, item);
        return (
          <article className="platform-entity" key={item.id}>
            <div className="platform-entity-heading">
              <div>
                {item.eyebrow ? <span>{item.eyebrow}</span> : null}
                <h2>{href ? <AppLink href={href} prefetch={false}>{item.title}</AppLink> : item.title}</h2>
              </div>
              {!learnerContent && item.status ? <span className="platform-status">{item.status}</span> : null}
            </div>
            {item.summary ? <p>{item.summary}</p> : null}
            {!learnerContent && item.fields?.length ? (
              <dl>
                {item.fields.map((field) => (
                  <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                ))}
              </dl>
            ) : null}
            {learnerCourses && href ? <AppLink className="platform-home-secondary" href={href} prefetch={false}>{t('查看课程', 'View course')}<ArrowRight aria-hidden /></AppLink> : null}
            {quickActions.length ? (
              <div className="platform-row-actions">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="platform-text-button"
                    disabled={actionBusy === `${action}:${item.id}`}
                    onClick={() => {
                      if (action === 'admin-delete' && !window.confirm(t('确定归档这条记录吗？', 'Archive this record?'))) return;
                      if (action === 'delete-course' && !window.confirm(t('确定归档这门课程吗？', 'Archive this course?'))) return;
                      if (action === 'cancel-order' && !window.confirm(t('确定取消这笔订单吗？', 'Cancel this order?'))) return;
                      if (action === 'delete-note' && !window.confirm(t('确定删除这条笔记吗？', 'Delete this note?'))) return;
                      const payload = action === 'favorite'
                        ? { targetType: favoriteType(definition, item), active: definition.id !== 'account-favorites' }
                        : action === 'wishlist'
                          ? { active: definition.id !== 'account-wishlist' }
                          : action === 'qr-toggle'
                            ? { disabled: item.data?.status !== 'disabled' }
                            : undefined;
                      onAction(action, item.id, payload);
                    }}
                  >
                    {actionBusy === `${action}:${item.id}` ? t('处理中…', 'Working…') : t(PLATFORM_ACTION_LABELS[action].zh, PLATFORM_ACTION_LABELS[action].en)}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function PlatformResourceRouteView({
  definition,
  params,
}: {
  definition: PlatformRouteDefinition;
  params: Record<string, string>;
}) {
  const t = useT();
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [selectedLessonId, setSelectedLessonId] = useQueryState('lesson', parseAsString.withOptions({ history: 'push', scroll: false }));
  const [lessonStartTime, setLessonStartTime] = useQueryState('t', parseAsFloat.withDefault(0));
  const [sort, setSort] = useQueryState('sort', parseAsStringEnum(['title', 'updated'] as const).withDefault('updated'));
  const [owned, setOwned] = useQueryState('owned', parseAsStringEnum(['0', '1'] as const).withDefault('0'));
  const [stay] = useQueryState('stay', parseAsStringEnum(['0', '1'] as const).withDefault('0'));
  const [result, setResult] = useState<PlatformResourceResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retry, setRetry] = useState(0);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);
  const loadsResource = Boolean(definition.resource)
    && definition.id !== 'account-invites'
    && definition.id !== 'account-privacy'
    && (definition.kind !== 'form' || definition.id === 'teacher-apply');
  const permissionDenied = error instanceof PlatformPermissionError;
  const isQrCardStudio = definition.id === 'admin-qr-cards';

  useEffect(() => { setMounted(true); }, []);
  const allowed = definition.access === 'public'
    || (definition.access === 'admin' ? isAdmin : Boolean(user));

  useEffect(() => {
    if (!mounted || !allowed || !definition.resource || !loadsResource) return;
    const controller = new AbortController();
    setResult(null);
    setError(null);
    void loadPlatformResource(definition.resource, {
      routeId: definition.id,
      params,
      query,
      sort,
      owned: owned === '1',
      signal: controller.signal,
    }).then(setResult).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => controller.abort();
  }, [allowed, definition.resource, loadsResource, mounted, owned, params, query, retry, sort]);

  const sortedItems = useMemo(() => {
    if (!result) return [];
    return [...result.items].sort((a, b) => sort === 'title'
      ? a.title.localeCompare(b.title)
      : (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }, [result, sort]);

  const runAction = async (action: PlatformActionId, id?: string, payload: Record<string, unknown> = {}): Promise<PlatformActionResult | undefined> => {
    const key = id ? `${action}:${id}` : action;
    setActionBusy(key);
    setActionMessage(null);
    try {
      const response = await executePlatformAction(definition, { action, resourceId: id, payload });
      if (action === 'redeem-invite') setRedeemed(true);
      setActionMessage(response.message ?? t('操作已完成。', 'Action completed.'));
      if (definition.id === 'admin-qr-detail' && action === 'admin-save' && params.code
        && response.code && response.code !== params.code) {
        const url = new URL(window.location.href);
        url.pathname = `${url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1)}${encodeURIComponent(response.code)}`;
        url.search = '';
        window.location.replace(url);
        return response;
      }
      setRetry((value) => value + 1);
      return response;
    } catch (reason) {
      setActionMessage(reason instanceof Error ? reason.message : t('操作失败。', 'Action failed.'));
    } finally {
      setActionBusy(null);
    }
    return undefined;
  };

  if (definition.id === 'home') return <PlatformLanding />;
  if (definition.id === 'account-invites') {
    return <div className="platform-route platform-redemption">
      {!mounted ? <PlatformState kind="loading" /> : !user ? (
        <AppLink href="/account" className="platform-button" prefetch={false}>{t('登录', 'Sign in')}</AppLink>
      ) : redeemed ? (
        <>
          <p role="status">{t('兑换成功', 'Code redeemed')}</p>
          <AppLink href="/platform/account/courses" className="platform-button" prefetch={false}>{t('开始学习', 'Start learning')}</AppLink>
        </>
      ) : (
        <>
          <PlatformDomainActions definition={definition} params={params} busy={actionBusy} runAction={runAction} />
          {actionMessage ? <p className="platform-action-message" role="status">{actionMessage}</p> : null}
        </>
      )}
    </div>;
  }
  const courseDetail = definition.id === 'course-detail';
  const inviteManager = definition.id === 'admin-invites';
  const courseSection = definition.id.startsWith('course-section-');
  const course = courseDetail && !error ? sortedItems[0] : undefined;

  return (
    <div className={`platform-route${courseDetail ? ' platform-course-detail' : ''}${courseSection ? ' platform-course-classroom' : ''}${inviteManager ? ' platform-invite-page' : ''}`}>
      <header className="platform-route-header">
        <div className="platform-route-heading">
          {courseSection && params.id ? <div>
            <AppLink className="platform-home-secondary" href={`/platform/courses/${encodeURIComponent(params.id)}`} prefetch={false}>
              {t('返回课程', 'Back to course')}
            </AppLink>
          </div> : null}
          {!inviteManager ? <span className="platform-route-area">{courseDetail || courseSection || definition.id === 'course-lesson' || definition.id === 'courses' ? t('CubeRoot 课程', 'CubeRoot Courses') : definition.area}</span> : null}
          <h1>{course?.title ?? titleFor(t, definition)}</h1>
          {!courseSection && !courseDetail && !inviteManager ? <p>{t(definition.description.zh, definition.description.en)}</p> : null}
          {course ? <div className="platform-home-actions">
            <AppLink className="platform-home-secondary" href="/platform/account/invites" prefetch={false}>{t('兑换课程', 'Redeem a code')}<ArrowRight aria-hidden /></AppLink>
          </div> : null}
        </div>
      </header>

      {definition.id === 'events' ? <p><AppLink href="/platform/events/preview" prefetch={false} className="platform-home-secondary">{t('体验线上赛事流程', 'Explore online competitions')}<ArrowRight aria-hidden /></AppLink></p> : null}

      {definition.id === 'about' ? (
        <PlatformAboutView />
      ) : definition.id === 'offline' ? (
        <PlatformOfflineView />
      ) : (definition.id === 'login' || definition.id === 'account') ? (
        <PlatformAccountView loginOnly={definition.id === 'login'} />
      ) : definition.id === 'account-privacy' ? (
        !mounted ? <PlatformState kind="loading" /> : !allowed ? <PlatformState kind="permission" /> : <PlatformPrivacySettings definition={definition} />
      ) : definition.kind === 'canonical' ? (
        !mounted ? <PlatformState kind="loading" /> : !allowed ? <PlatformState kind="permission" /> : <PlatformCanonicalView definition={definition} params={params} />
      ) : !mounted ? (
        <PlatformState kind="loading" />
      ) : !allowed ? (
        <PlatformState kind="permission" />
      ) : definition.resource ? (
        <>
          {(definition.kind === 'collection' || definition.kind === 'dashboard')
            && definition.id !== 'membership'
            && definition.id !== 'me-membership'
            && !isQrCardStudio
            && !inviteManager
            && !permissionDenied ? (
            <div className="platform-toolbar">
              <SearchInput
                value={query}
                onChange={(value) => { void setQuery(value || null); }}
                placeholder={t('搜索当前内容', 'Search this view')}
                ariaLabel={t('搜索当前内容', 'Search this view')}
                className="platform-search"
                inputClassName="platform-search-input"
              />
              <div className="platform-sort" aria-label={t('排序', 'Sort')}>
                <Search aria-hidden />
                <button type="button" className="platform-sort-button" onClick={() => { void setSort('updated'); }}>
                  {t('最近更新', 'Updated')}<SortArrow active={sort === 'updated'} dir="desc" />
                </button>
                <button type="button" className="platform-sort-button" onClick={() => { void setSort('title'); }}>
                  {t('标题', 'Title')}<SortArrow active={sort === 'title'} dir="asc" />
                </button>
              </div>
              {definition.access === 'instructor' || definition.access === 'admin' ? (
                <BoolToggle
                  value={owned === '1'}
                  onChange={(value) => { void setOwned(value ? '1' : '0'); }}
                  label={t('只看我负责的', 'Only my items')}
                />
              ) : null}
            </div>
          ) : null}

          {!loadsResource ? null : permissionDenied ? (
            <PlatformState kind="permission" message={error.status === 403 ? t('当前账号没有访问这个工作区的角色。', 'Your account does not have the role required for this workspace.') : undefined} />
          ) : error ? (
            <PlatformState kind="error" message={error.message} onRetry={() => setRetry((value) => value + 1)} />
          ) : !result ? (
            <PlatformState kind="loading" />
          ) : isQrCardStudio ? (
            <PlatformQrCardStudio
              entities={sortedItems}
              query={query}
              onQueryChange={(value) => { void setQuery(value || null); }}
            />
          ) : inviteManager ? null : sortedItems.length === 0 && definition.id !== 'membership' && definition.id !== 'me-membership' ? (
            <PlatformState
              kind="empty"
              message={definition.id === 'teacher-detail'
                ? t('这个旧讲师标识没有对应的主站讲师资料。旧 Platform 的演示讲师未导入，请返回主站讲师名录查找真实资料。', 'This legacy teacher identifier has no matching main-site profile. Demo teachers from the legacy Platform were not imported; use the main-site directory to find current profiles.')
                : undefined}
            />
          ) : courseDetail || courseSection || definition.id === 'membership' || definition.id === 'me-membership' || definition.id === 'qr' ? null : (
            <PlatformEntityList
              definition={definition}
              items={sortedItems}
              actionBusy={actionBusy}
              onAction={(action, id, payload) => { void runAction(action, id, payload); }}
            />
          )}

          {definition.canonicalHref ? (
            <AppLink href={fillPlatformParams(definition.canonicalHref, params)} className="platform-canonical-link" prefetch={false}>
              {t(definition.canonicalLabel?.zh ?? '打开完整功能', definition.canonicalLabel?.en ?? 'Open the full feature')}
              <ExternalLink aria-hidden />
            </AppLink>
          ) : null}

          {!permissionDenied ? <PlatformDomainContent definition={definition} params={params} entity={sortedItems[0]} previewRedirect={stay === '1'} selectedLessonId={selectedLessonId} lessonStartTime={lessonStartTime} onSelectLesson={id => { void setLessonStartTime(null); void setSelectedLessonId(id); }} /> : null}

          {permissionDenied || definition.id === 'qr' || (['membership', 'me-membership'].includes(definition.id) && !result) ? null : (
            <PlatformDomainActions
              definition={definition}
              params={params}
              entity={sortedItems[0]}
              entities={sortedItems}
              busy={actionBusy}
              runAction={runAction}
            />
          )}
          {actionMessage ? <p className="platform-action-message" role="status">{actionMessage}</p> : null}
        </>
      ) : (
        <PlatformCanonicalView definition={definition} params={params} />
      )}
    </div>
  );
}

export function PlatformRouteView(props: { definition: PlatformRouteDefinition; params: Record<string, string> }) {
  if (props.definition.id === 'online-competition-preview') return <OnlineCompetitionPreview />;
  return <PlatformResourceRouteView {...props} />;
}
