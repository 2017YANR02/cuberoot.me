'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, Search } from 'lucide-react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import { AccountPanel, LoginForm } from '@/components/AuthPanel';
import BoolToggle from '@/components/BoolToggle';
import SearchInput from '@/components/SearchInput';
import SortArrow from '@/components/SortArrow';
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

function PlatformLanding() {
  const t = useT();
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
        <span className="platform-kicker">{t('CubeRoot 学习与服务', 'Learning and services on CubeRoot')}</span>
        <h1>{t('学会一件事，然后在同一个地方继续进步。', 'Learn something, then keep moving in the same place.')}</h1>
        <p>{t('课程、讲师、社区、练习工具和教学协作都在主站共用同一个账号。Platform 负责把下一步放在你面前，而不是再造一套站点。', 'Courses, teachers, community, practice tools, and teaching work share one main-site account. Platform puts the next step in front of you instead of becoming another site.')}</p>
        <div className="platform-home-actions">
          <AppLink className="platform-button platform-button-primary" href={signedIn ? continueHref : '/platform/courses'} prefetch={false}>
            {primaryLabel}<ArrowRight aria-hidden />
          </AppLink>
          <AppLink className="platform-home-secondary" href="/platform/teachers" prefetch={false}>{t('寻找讲师', 'Find a teacher')}</AppLink>
        </div>
      </header>

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
  return (
    <div className="platform-entity-list">
      {items.map((item) => {
        const href = item.href?.startsWith('/') ? item.href : localDetailHref(definition, item);
        return (
          <article className="platform-entity" key={item.id}>
            <div className="platform-entity-heading">
              <div>
                {item.eyebrow ? <span>{item.eyebrow}</span> : null}
                <h2>{href ? <AppLink href={href} prefetch={false}>{item.title}</AppLink> : item.title}</h2>
              </div>
              {item.status ? <span className="platform-status">{item.status}</span> : null}
            </div>
            {item.summary ? <p>{item.summary}</p> : null}
            {item.fields?.length ? (
              <dl>
                {item.fields.map((field) => (
                  <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                ))}
              </dl>
            ) : null}
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

export function PlatformRouteView({
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
  const [sort, setSort] = useQueryState('sort', parseAsStringEnum(['title', 'updated'] as const).withDefault('updated'));
  const [owned, setOwned] = useQueryState('owned', parseAsStringEnum(['0', '1'] as const).withDefault('0'));
  const [stay] = useQueryState('stay', parseAsStringEnum(['0', '1'] as const).withDefault('0'));
  const [result, setResult] = useState<PlatformResourceResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retry, setRetry] = useState(0);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const loadsResource = Boolean(definition.resource)
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

  return (
    <div className="platform-route">
      <header className="platform-route-header">
        <span className="platform-route-area">{definition.area}</span>
        <h1>{titleFor(t, definition)}</h1>
        <p>{t(definition.description.zh, definition.description.en)}</p>
      </header>

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
          ) : sortedItems.length === 0 && definition.id !== 'membership' && definition.id !== 'me-membership' ? (
            <PlatformState
              kind="empty"
              message={definition.id === 'teacher-detail'
                ? t('这个旧讲师标识没有对应的主站讲师资料。旧 Platform 的演示讲师未导入，请返回主站讲师名录查找真实资料。', 'This legacy teacher identifier has no matching main-site profile. Demo teachers from the legacy Platform were not imported; use the main-site directory to find current profiles.')
                : undefined}
            />
          ) : definition.id === 'membership' || definition.id === 'me-membership' || definition.id === 'qr' ? null : (
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

          {!permissionDenied ? <PlatformDomainContent definition={definition} params={params} entity={sortedItems[0]} previewRedirect={stay === '1'} /> : null}

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
