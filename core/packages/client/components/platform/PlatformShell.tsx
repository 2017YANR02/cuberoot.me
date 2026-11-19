'use client';

import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BookOpen, Building2, CalendarDays, Compass, GraduationCap, LayoutDashboard, QrCode, ShoppingBag, UsersRound } from '@app-foundation/icons/lucide';
import PageBackLink from '@/components/PageBackLink';
import AppLink from '@/components/AppLink';
import dynamic from 'next/dynamic';
import { CompactSelect } from '@/components/CompactSelect';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { SEARCH_CARDS, isLandingSearchCardVisible } from '@/lib/landing-sections';
import { platformParentHref, PLATFORM_PUBLIC_NAV } from '@/lib/platform-routes';
import { PLATFORM_ADMIN_NAV, PLATFORM_PERSONAL_ROUTES, PLATFORM_SECTION_NAV, platformAdminNavigationState, platformNavigationState, platformPathname, platformWorkspaceRoutes } from '@/lib/platform-navigation';
import { PlatformNavigationContext, PlatformSearchContext, type PlatformSearchBinding, type PlatformSearchScope } from '@/lib/platform-navigation-context';
import { PlatformScopedSearch } from './PlatformScopedSearch';
import { SHOP_ROOT } from '@/lib/shop';
import './platform.css';

// Scoped catalog searches do not need the global search/Agent bundle.
const LandingSearch = dynamic(() => import('@/components/LandingSearch'));

const AREA_ICONS = {
  discover: Compass,
  courses: BookOpen,
  community: UsersRound,
  teachers: GraduationCap,
  organizations: Building2,
} satisfies Record<(typeof PLATFORM_PUBLIC_NAV)[number]['id'], typeof Compass>;

const ADMIN_ICONS = { overview: LayoutDashboard, learning: BookOpen, teaching: GraduationCap,
  operations: CalendarDays, commerce: ShoppingBag, qr: QrCode } satisfies Record<(typeof PLATFORM_ADMIN_NAV)[number]['id'], typeof Compass>;

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
  const [searchBinding, setSearchBinding] = useState<PlatformSearchBinding | null>(null);
  const { primary, secondary, definition } = platformNavigationState(pathname);
  const admin = isAdmin ? platformAdminNavigationState(definition) : null;
  const searchScope: PlatformSearchScope | null = primary === 'community' ? 'forum'
    : primary === 'courses' ? (secondary === 'paths' ? 'paths' : 'courses')
    : primary === 'discover' && (secondary === 'events' || secondary === 'news') ? secondary : null;
  const searchRouteId = definition?.id;
  const searchOutlet = useMemo(() => searchScope ? { scope: searchScope, routeId: searchRouteId, bind: setSearchBinding } : null, [searchScope, searchRouteId]);
  const currentSearchBinding = searchBinding?.scope === searchScope && searchBinding.routeId === searchRouteId ? searchBinding : null;
  const showNavigation = definition?.id !== 'course-detail';
  const sections = admin?.group.items ?? (primary ? PLATFORM_SECTION_NAV[primary] : []);
  const primaryLinks = admin ? PLATFORM_ADMIN_NAV.map(group => ({ ...group, href: group.items[0].href, Icon: ADMIN_ICONS[group.id] }))
    : PLATFORM_PUBLIC_NAV.map(item => ({ ...item, Icon: AREA_ICONS[item.id] }));
  const activePrimary = admin?.group.id ?? primary;
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
  const segments = platformPathname(pathname).replace(/^\/platform\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const workspaceRoutes = platformWorkspaceRoutes(definition, Boolean(user), isAdmin);
  const cards = useMemo(() => SEARCH_CARDS.filter(card => isLandingSearchCardVisible(card, isAdmin)), [isAdmin]);
  const Content = shared ? 'div' : 'main';

  return <PlatformNavigationContext value={true}>
    <div className={`platform-shell${shared ? ' platform-shell--shared' : ''}`}>
      {showNavigation && <>
        <header className="platform-masthead">
          <div className="page-back-heading platform-masthead-brand">
            <PageBackLink fallback={platformParentHref(segments)} />
            <AppLink href="/platform" className="platform-wordmark" aria-label={t('Platform 首页', 'Platform home')}>
              <span className="platform-wordmark-mark" aria-hidden>CR</span>
              <span>{t('学习空间', 'Learning')}</span>
            </AppLink>
            <p>CubeRoot</p>
          </div>
          {user ? <CompactSelect open={accountOpen} onOpenChange={setAccountOpen} unstyledTrigger className="platform-account-control"
            triggerClassName="platform-account-link" popupClassName="platform-account-menu"
            ariaLabel={t('我的学习与账号', 'My learning and account')} label={t('我的学习', 'My learning')}
            items={[]} onChange={() => {}} panelContent={<>
              {PLATFORM_PERSONAL_ROUTES.map(item => <AppLink key={item.id} href={`/platform/${item.pattern}`} prefetch={false}
                onClick={() => setAccountOpen(false)}>{t(item.title.zh, item.title.en)}</AppLink>)}
              {(isAdmin || definition?.area === 'instructor' && definition.id !== 'teacher-apply') && <AppLink href="/platform/instructor" prefetch={false} onClick={() => setAccountOpen(false)}>{t('讲师工作台', 'Instructor workspace')}</AppLink>}
              {isAdmin && <>
                <AppLink href="/platform/admin" prefetch={false} onClick={() => setAccountOpen(false)}>{t('管理', 'Administration')}</AppLink>
                <AppLink href={SHOP_ROOT} prefetch={false} onClick={() => setAccountOpen(false)}>{t('商店', 'Shop')}</AppLink>
              </>}
              <AppLink href="/account" prefetch={false} onClick={() => setAccountOpen(false)}>{t('账号设置', 'Account settings')}</AppLink>
            </>} /> : <AppLink href="/account" className="platform-account-link" prefetch={false}>{t('登录', 'Sign in')}</AppLink>}
          <div className="platform-site-search">
            {searchScope ? <PlatformScopedSearch key={searchScope} lang={lang} scope={searchScope} binding={currentSearchBinding} />
              : <LandingSearch cards={cards} lang={lang} workspaceEntry />}
          </div>
        </header>

        <nav className={`platform-nav platform-glass${admin ? ' platform-admin-nav' : ''}`} aria-label={admin ? t('管理工作台功能区', 'Administration sections') : t('Platform 功能区', 'Platform sections')}>
          {primaryLinks.map(item => {
            const Icon = item.Icon;
            const active = item.id === activePrimary;
            return <AppLink key={item.id} href={item.href}
              className={`platform-nav-link${active ? ' is-active' : ''}`}
              aria-current={active ? 'location' : undefined} scroll={false} prefetch={false}>
              <Icon aria-hidden /><span>{t(item.label.zh, item.label.en)}</span>
            </AppLink>;
          })}
        </nav>
        {sections.length > 0 && <nav ref={admin ? adminContextNav : undefined} className={`platform-context-nav${admin ? ' platform-admin-context-nav' : ''}`} data-site-surface="heading" aria-label={t('当前栏目功能', 'Current section navigation')}>
          {sections.map(item => <AppLink key={item.id} href={item.href} prefetch={false}
            scroll={false} aria-current={item.id === activeSecondary ? 'page' : undefined}>{t(item.label.zh, item.label.en)}</AppLink>)}
        </nav>}

        {!admin && workspaceRoutes.length > 0 && <nav className="platform-workspace-nav" aria-label={t('工作台功能', 'Workspace sections')} data-site-surface="panel">
          {workspaceRoutes.map(item => <AppLink key={item.id} href={`/platform/${item.pattern}`} scroll={false} prefetch={false}
            aria-current={definition?.id === item.id ? 'page' : undefined}>{t(item.title.zh, item.title.en)}</AppLink>)}
        </nav>}
      </>}
      <Content className="platform-main" role={shared && definition?.kind !== 'canonical' ? 'main' : undefined}>
        <PlatformSearchContext value={searchOutlet}>{children}</PlatformSearchContext>
      </Content>
    </div>
  </PlatformNavigationContext>;
}
