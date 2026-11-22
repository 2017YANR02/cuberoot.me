'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, BookOpen, LayoutDashboard, Search, Sparkles, UserRound, UsersRound, Wallet } from '@app-foundation/icons/lucide';
import { ClearButton } from '@/components/ClearButton';
import { NavigationShell } from '@app-foundation/navigation-ui';
import '@app-foundation/navigation-ui/navigation.css';
import PageBackLink from '@/components/PageBackLink';
import CubeRootLogo from '@/components/CubeRootLogo';
import AppLink from '@/components/AppLink';
import dynamic from 'next/dynamic';
import { CompactSelect } from '@/components/CompactSelect';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { SEARCH_CARDS, isLandingSearchCardVisible } from '@/lib/landing-sections';
import { isPlatformInstructorApplication, isPlatformInstructorCourseEditor, PLATFORM_PUBLIC_NAV } from '@/lib/platform-routes';
import { PLATFORM_ADMIN_NAV, PLATFORM_SECTION_NAV, platformAdminNavigationState, platformNavigationState, platformPathname, platformWorkspaceRoutes } from '@/lib/platform-navigation';
import { PlatformCompetitionAccessContext, PlatformNavigationContext, PlatformInstructorAccessRefreshContext } from '@/lib/platform-navigation-context';
import { PlatformAccountMenu } from './PlatformAccountMenu';
import { canUseAssistant } from '@/lib/assistant-auth-continuation';
import { useInstalledGenerativeAiDisabled } from '@/lib/installed-content';
import { assistantOwner, assistantConversations } from '@/lib/assistant-conversations';
import { ensureAssistantConversation, useAssistantWorkspace } from '@/hooks/useAssistantWorkspace';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import './platform.css';

const AssistantConversationView = dynamic(() => import('@/components/AssistantConversationView'), { ssr: false });

function HomeAvatar({ name, avatar }: { name: string; avatar: string }) {
  const [loaded, setLoaded] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // Cached images may have loaded or failed before React hydrated the header.
    if (image.current?.complete) setLoaded(image.current.naturalWidth > 0);
  }, []);
  return <span className="platform-home-avatar" aria-hidden>
    <span hidden={loaded}>{Array.from(name?.trim() || '?')[0]?.toUpperCase()}</span>
    {avatar && <img ref={image} src={avatar} alt="" hidden={!loaded} onLoad={event => setLoaded(event.currentTarget.naturalWidth > 0)} onError={() => setLoaded(false)} />}
  </span>;
}

function HomeAssistant({ close, lang, cards }: { close: () => void; lang: 'zh' | 'en'; cards: typeof SEARCH_CARDS }) {
  const t = useT();
  const user = useAuthUser();
  const owner = assistantOwner(user);
  const allowed = canUseAssistant(user);
  const state = useAssistantWorkspace(owner);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useModalBackdrop(close);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);
  useEffect(() => {
    if (allowed) { assistantConversations.restorePinned(owner); ensureAssistantConversation(owner); }
  }, [allowed, owner]);
  const conversation = state.conversations.find(item => item.id === state.activeId);
  return <dialog ref={dialog} className="platform-home-assistant" aria-labelledby="platform-home-assistant-title" onCancel={event => { event.preventDefault(); close(); }} {...dismiss}>
    <div className="platform-home-assistant-panel">
      <header><h2 id="platform-home-assistant-title">{t('魔方根 AI 助手', 'CubeRoot AI assistant')}</h2><ClearButton variant="standalone" className="platform-home-icon" onClick={close} ariaLabel={t('关闭助手', 'Close assistant')} /></header>
      {allowed ? <>
        <AppLink className="platform-home-secondary" href="/chat" onClick={close} prefetch={false}>{t('打开完整聊天', 'Open full chat')}</AppLink>
        {conversation && <AssistantConversationView owner={owner} conversation={conversation} active lang={lang} cards={cards} />}
      </> : <div className="platform-home-assistant-intro">
        <p>{t('查询魔方知识、分析成绩，获取个人训练建议。绑定 WCA 后可关联官方成绩。', 'Explore cubing knowledge, analyse results and get training suggestions. Link WCA to connect official results.')}</p>
        <AppLink className="platform-button platform-button-primary" href="/account" onClick={close} prefetch={false}>{user ? t('前往个人中心绑定 WCA', 'Link WCA in account settings') : t('登录账号', 'Sign in')}</AppLink>
      </div>}
    </div>
  </dialog>;
}

const HEADER_ORDER = ['discover', 'courses', 'teachers', 'community'] as const;

function PlatformSecondaryNav({ items, active, label, className = '', navRef }: {
  items: ReadonlyArray<{ id: string; href: string; label: { zh: string; en: string } }>;
  active?: string | null; label: string; className?: string; navRef?: Ref<HTMLElement>;
}) {
  const t = useT();
  if (!items.length) return null;
  return <nav ref={navRef} className={`platform-context-nav ${className}`} aria-label={label}>
    {items.map(item => <AppLink key={item.id} href={item.href} prefetch={false} scroll={false} aria-current={item.id === active ? 'page' : undefined}>{t(item.label.zh, item.label.en)}</AppLink>)}
  </nav>;
}

function isLearningSpaceOutsideWorkspace(href: string): boolean {
  const path = platformPathname(href);
  return (path === '/platform' || path.startsWith('/platform/')) && !/^\/platform\/(instructor|admin)(\/|$)/.test(path);
}

export function PlatformShell({ children, shared = false }: { children: ReactNode; shared?: boolean }) {
  const hasShell = useContext(PlatformNavigationContext);
  // Shared rewrites can retain the previous route layout while the destination loads.
  // The nearest existing frame owns chrome; retained layouts contribute content only.
  return hasShell ? children : <PlatformShellContent shared={shared}>{children}</PlatformShellContent>;
}

function PlatformShellContent({ children, shared }: { children: ReactNode; shared: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const lang = useLang() === 'en' ? 'en' : 'zh';
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const [accountOpen, setAccountOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const aiDisabled = useInstalledGenerativeAiDisabled();
  const [instructorAccess, setInstructorAccess] = useState<{ owner: string; active: boolean; pending: boolean } | null>(null);
  const [instructorRevision, setInstructorRevision] = useState(0);
  const refreshInstructorAccess = useCallback(() => {
    setInstructorAccess(null);
    setInstructorRevision(value => value + 1);
  }, []);
  const owner = user ? String(user.uid ?? user.wcaId) : '';
  const { primary, secondary, definition } = platformNavigationState(pathname);
  const home = definition?.id === 'home';
  useEffect(() => { setAssistantOpen(false); setAccountOpen(false); }, [pathname]);
  const admin = isAdmin ? platformAdminNavigationState(definition) : null;
  const instructorWorkspace = definition?.area === 'instructor' && !isPlatformInstructorApplication(definition.id);
  const instructorHome = definition?.id === 'instructor';
  const instructorCourseEditor = isPlatformInstructorCourseEditor(definition?.id);
  const instructorStudio = instructorWorkspace && !instructorCourseEditor;
  const checkInstructor = Boolean(owner);
  useEffect(() => {
    if (!checkInstructor) return;
    const controller = new AbortController();
    setInstructorAccess(null);
    void import('@/lib/platform-gateway').then(({ loadPlatformResource }) => controller.signal.aborted ? undefined : loadPlatformResource('instructor-application', { params: {}, signal: controller.signal }))
      .then(result => { if (result && !controller.signal.aborted) setInstructorAccess({ owner, active: result.items[0]?.data?.instructorStatus === 'active', pending: result.items[0]?.status === 'pending' }); })
      .catch(() => { if (!controller.signal.aborted) setInstructorAccess({ owner, active: false, pending: false }); });
    return () => controller.abort();
  }, [owner, checkInstructor, instructorRevision]);
  const isInstructor = checkInstructor && instructorAccess?.owner === owner && instructorAccess.active;
  const [roles, setRoles] = useState<{ owner: string; organization: boolean; learner: boolean; organizer: boolean; supervisor: boolean } | null>(null);
  const checkRoles = accountOpen || definition?.id === 'online-competitions' || primary === 'organizations';
  useEffect(() => {
    if (!owner || isAdmin) { setRoles(null); return; }
    if (!checkRoles) return;
    let current = true;
    const teaching = import('@/lib/teaching-saas-api');
    const competitions = import('@/lib/online-competition-api');
    void Promise.allSettled([
      teaching.then(api => api.listTeachingOrganizations()).then(items => items.some(item => item.status === 'active')),
      teaching.then(api => api.listTeachingLearningContexts()).then(items => items.length > 0),
      competitions.then(api => api.listOrganizerApplications()).then(result => result.eligibleOrganizationIds.length > 0),
      competitions.then(api => api.listSupervisedCompetitions()).then(result => result.competitions.length > 0),
    ]).then(results => {
      if (!current) return;
      const [organization, learner, organizer, supervisor] = results.map(result => result.status === 'fulfilled' && result.value);
      setRoles({ owner, organization, learner, organizer, supervisor });
    });
    return () => { current = false; };
  }, [owner, isAdmin, checkRoles]);
  const mine = roles?.owner === owner ? roles : null;
  const organizer = isAdmin || Boolean(mine?.organizer);
  const supervisor = isAdmin || Boolean(mine?.supervisor);
  const organization = isAdmin || Boolean(mine?.organization);
  const applicationLabel = isInstructor ? t('讲师身份设置', 'Instructor account settings') : instructorAccess?.owner === owner && instructorAccess.pending
    ? t('查看讲师申请进度', 'Instructor application status') : t('成为讲师', 'Become an instructor');
  const sections = admin?.group.id === 'operations' ? [...admin.group.items,
    { id: 'organizer-review', href: '/platform/events/online?view=review', label: { zh: '主办方申请', en: 'Organizer applications' } },
    { id: 'organization-review', href: '/platform/org?view=admin', label: { zh: '机构认证审核', en: 'Organization verification' } },
  ] : admin?.group.items ?? (primary === 'organizations' && !organization ? [] : primary ? PLATFORM_SECTION_NAV[primary] : []);
  const activeSecondary = admin?.secondary ?? secondary;
  const adminContextNav = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = adminContextNav.current;
    const active = nav?.querySelector('[aria-current="page"]');
    if (!nav || !active) return;
    const bounds = nav.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.left < bounds.left) nav.scrollLeft += item.left - bounds.left;
    else if (item.right > bounds.right) nav.scrollLeft += item.right - bounds.right;
  }, [activeSecondary]);
  const workspaceRoutes = platformWorkspaceRoutes(definition, Boolean(user), isAdmin);
  const activeWorkspace = definition?.id;
  const workspaceNav = workspaceRoutes.length > 0 && <nav className="platform-workspace-nav" aria-label={t('工作台功能', 'Workspace sections')} data-site-surface="panel">
    {workspaceRoutes.map(item => <AppLink key={item.id} href={`/platform/${item.pattern}`} scroll={false} prefetch={false}
      aria-current={activeWorkspace === item.id ? 'page' : undefined}>{t(item.title.zh, item.title.en)}</AppLink>)}
  </nav>;
  const contextNav = <PlatformSecondaryNav items={sections} active={activeSecondary} label={t('当前栏目功能', 'Current section navigation')} className={admin ? 'platform-admin-context-nav' : ''} navRef={admin ? adminContextNav : undefined} />;
  const cards = useMemo(() => SEARCH_CARDS.filter(card => isLandingSearchCardVisible(card, isAdmin)), [isAdmin]);
  const Content = shared ? 'div' : 'main';

  const pageContent = <PlatformInstructorAccessRefreshContext value={refreshInstructorAccess}><PlatformCompetitionAccessContext value={{ organizer, supervisor, ready: isAdmin || !owner || Boolean(mine) }}>{children}</PlatformCompetitionAccessContext></PlatformInstructorAccessRefreshContext>;
  const header = <header className="platform-home-header">
    <div className="platform-masthead-brand"><CubeRootLogo className="back-home platform-home-logo" height={38}><span className="platform-home-brand-text">{t('魔方根 CubeRoot', 'CubeRoot')}</span></CubeRootLogo></div>
    <nav className="platform-home-nav" aria-label={t('学习导航', 'Learning navigation')}>
      {HEADER_ORDER.map(id => PLATFORM_PUBLIC_NAV.find(item => item.id === id)!).map(item => <AppLink key={item.id} href={item.href} aria-current={item.id === primary ? 'location' : undefined} prefetch={false}>{t(item.label.zh, item.label.en)}</AppLink>)}
    </nav>
    <div className="platform-home-header-actions">
      {isAdmin && <AppLink className="platform-home-admin-link" href="/platform/admin" prefetch={false}>{t('平台管理', 'Platform admin')}</AppLink>}
      <AppLink className="platform-home-icon" href="/search" aria-label={t('搜索', 'Search')} prefetch={false}><Search aria-hidden /></AppLink>
      {!aiDisabled && <button type="button" className="platform-home-icon platform-home-ai" aria-label={t('AI 助手', 'AI assistant')} aria-haspopup="dialog" onClick={() => setAssistantOpen(true)}><Sparkles aria-hidden /><span>{t('AI 助手', 'AI assistant')}</span></button>}
      {user && <AppLink className="platform-home-icon" href="/platform/notifications" aria-label={t('消息', 'Messages')} prefetch={false}><Bell aria-hidden /></AppLink>}
      <CompactSelect open={accountOpen} onOpenChange={setAccountOpen} unstyledTrigger className="platform-home-account" triggerClassName="platform-home-icon" popupClassName="platform-account-menu"
        ariaLabel={user ? t('我的账号', 'My account') : t('登录与账号', 'Sign in and account')} label={user ? <HomeAvatar key={user.avatar} name={user.name} avatar={user.avatar} /> : <UserRound aria-hidden />}
        items={[]} onChange={() => {}} panelContent={<PlatformAccountMenu key={owner} name={user?.name} signedIn={Boolean(user)}
          admin={isAdmin} instructor={Boolean(isInstructor)} organization={organization} organizer={organizer}
          supervisor={supervisor} learner={isAdmin || Boolean(mine?.learner)} applicationLabel={applicationLabel}
          close={() => setAccountOpen(false)} />} />
    </div>
    {assistantOpen && <HomeAssistant close={() => setAssistantOpen(false)} lang={lang} cards={cards} />}
  </header>;
  const footer = <footer className="platform-home-more platform-shared-footer">
    <AppLink href="/platform/events" prefetch={false}>{t('活动', 'Events')}</AppLink>
    <AppLink href="/platform/news" prefetch={false}>{t('资讯', 'News')}</AppLink>
    <AppLink href="/platform/org" prefetch={false}>{t('机构入驻', 'Register an organization')}</AppLink>
    <AppLink href="/platform/about" prefetch={false}>{t('关于魔方根', 'About CubeRoot')}</AppLink>
    {(!isInstructor || isAdmin) && <AppLink href="/platform/teachers/apply" prefetch={false}>{applicationLabel}</AppLink>}
  </footer>;
  if (instructorStudio) {
    const studioItems = [
      { id: 'instructor', href: '/platform/instructor', label: t('概览','Overview'), icon: <LayoutDashboard size={19}/> },
      { id: 'instructor-courses', href: '/platform/instructor/courses', label: t('课程','Courses'), icon: <BookOpen size={19}/> },
      { id: 'instructor-students', href: '/platform/instructor/students', label: t('学员','Learners'), icon: <UsersRound size={19}/> },
      { id: 'instructor-earnings', href: '/platform/instructor/earnings', label: t('收入','Earnings'), icon: <Wallet size={19}/> },
      { id: 'instructor-profile', href: '/platform/instructor/profile', label: t('个人主页','Personal profile'), icon: <UserRound size={19}/> },
    ];
    const accessKnown = instructorAccess?.owner === owner;
    return <PlatformNavigationContext value={true}><div className="platform-shell platform-instructor-studio-shell">
      {header}
      <NavigationShell className="platform-instructor-studio" mainClassName="platform-main platform-instructor-studio-main" contentAs={Content}
        showNavigation={Boolean(owner) && (!accessKnown || isInstructor || isAdmin)} items={isInstructor || isAdmin ? studioItems.map(item=>({...item,active:item.id===definition?.id})) : []}
        labels={{ navigation:t('讲师工作台导航','Instructor studio navigation'), show:t('展开侧栏','Expand sidebar'), hide:t('收起侧栏','Collapse sidebar'), openMobile:t('打开导航','Open navigation'), closeMobile:t('关闭导航','Close navigation') }}
        renderLink={props=><AppLink {...props} prefetch={false} scroll={false}/>}
        togglePlacement="sidebar"
        header={()=><header className="platform-instructor-navigation platform-instructor-studio-header" data-site-surface="heading">
          <div className="platform-instructor-masthead"><div className="platform-instructor-studio-brand"><PageBackLink fallback={instructorHome?'/platform':'/platform/instructor'}
            label={instructorHome?t('返回学习空间','Back to Learning Space'):t('返回讲师工作台','Back to instructor workspace')}
            acceptEntry={instructorHome?isLearningSpaceOutsideWorkspace:href=>platformPathname(href)==='/platform/instructor'}/><span>{t('讲师工作台','Instructor studio')}</span></div></div>
        </header>}
      >{pageContent}</NavigationShell>
      {footer}
    </div></PlatformNavigationContext>;
  }

  return <PlatformNavigationContext value={true}>
    <div className={`platform-shell${shared ? ' platform-shell--shared' : ''}${home ? ' platform-home-shell' : ''}`}>
      {header}
      {!home && admin && <PlatformSecondaryNav items={PLATFORM_ADMIN_NAV.map(group => ({ ...group, href: group.items[0].href }))} active={admin.group.id} label={t('管理功能区', 'Administration sections')} className="platform-admin-group-nav" />}
      {!home && contextNav}
      {!admin && workspaceNav}
      <Content className="platform-main" role={shared && definition?.kind !== 'canonical' ? 'main' : undefined}>
        {pageContent}
      </Content>
      {footer}
    </div>
  </PlatformNavigationContext>;
}
