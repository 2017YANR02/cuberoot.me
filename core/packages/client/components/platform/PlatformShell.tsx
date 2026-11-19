'use client';

import { useContext, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BookOpen, Building2, Compass, GraduationCap, UsersRound } from '@app-foundation/icons/lucide';
import PageBackLink from '@/components/PageBackLink';
import AppLink from '@/components/AppLink';
import LandingSearch from '@/components/LandingSearch';
import { CompactSelect } from '@/components/CompactSelect';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { SEARCH_CARDS, isLandingSearchCardVisible } from '@/lib/landing-sections';
import { platformParentHref, PLATFORM_PUBLIC_NAV, PLATFORM_ROUTES } from '@/lib/platform-routes';
import { PLATFORM_SECTION_NAV, platformNavigationState, platformPathname } from '@/lib/platform-navigation';
import { PlatformNavigationContext } from '@/lib/platform-navigation-context';
import { SHOP_ROOT } from '@/lib/shop';
import './platform.css';

const AREA_ICONS = {
  discover: Compass,
  courses: BookOpen,
  community: UsersRound,
  teachers: GraduationCap,
  organizations: Building2,
} satisfies Record<(typeof PLATFORM_PUBLIC_NAV)[number]['id'], typeof Compass>;

const PERSONAL_IDS = new Set(['account-courses', 'progress', 'orders', 'account-invites', 'account-favorites', 'account-notes', 'account-badges', 'me-membership', 'account-shipping', 'community-mine']);

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
  const { primary, secondary, definition } = platformNavigationState(pathname);
  const showNavigation = definition?.id !== 'course-detail';
  const sections = primary ? PLATFORM_SECTION_NAV[primary] : [];
  const segments = platformPathname(pathname).replace(/^\/platform\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const personalPage = definition?.area === 'account' || definition?.id === 'progress' || definition?.id === 'orders' || definition?.id === 'order-detail';
  const personalRoutes = PLATFORM_ROUTES.filter(item => PERSONAL_IDS.has(item.id));
  const workspaceRoutes = PLATFORM_ROUTES.filter(item => !item.pattern.includes(':') && item.kind !== 'form'
    && (definition?.area === 'admin' ? isAdmin && item.area === 'admin'
      : definition?.area === 'instructor' && definition.id !== 'teacher-apply' ? user && item.access === 'instructor'
        : personalPage ? user && PERSONAL_IDS.has(item.id) : false));
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
              {personalRoutes.map(item => <AppLink key={item.id} href={`/platform/${item.pattern}`} prefetch={false}
                onClick={() => setAccountOpen(false)}>{t(item.title.zh, item.title.en)}</AppLink>)}
              {(isAdmin || definition?.area === 'instructor' && definition.id !== 'teacher-apply') && <AppLink href="/platform/instructor" prefetch={false} onClick={() => setAccountOpen(false)}>{t('讲师工作台', 'Instructor workspace')}</AppLink>}
              {isAdmin && <>
                <AppLink href="/platform/admin" prefetch={false} onClick={() => setAccountOpen(false)}>{t('管理', 'Administration')}</AppLink>
                <AppLink href={SHOP_ROOT} prefetch={false} onClick={() => setAccountOpen(false)}>{t('商店', 'Shop')}</AppLink>
              </>}
              <AppLink href="/account" prefetch={false} onClick={() => setAccountOpen(false)}>{t('账号设置', 'Account settings')}</AppLink>
            </>} /> : <AppLink href="/account" className="platform-account-link" prefetch={false}>{t('登录', 'Sign in')}</AppLink>}
          <div className="platform-site-search">
            <LandingSearch cards={cards} lang={lang} workspaceEntry />
          </div>
        </header>

        <nav className="platform-nav platform-glass" aria-label={t('Platform 功能区', 'Platform sections')}>
          {PLATFORM_PUBLIC_NAV.map(item => {
            const Icon = AREA_ICONS[item.id];
            const active = item.id === primary;
            return <AppLink key={item.id} href={item.href}
              className={`platform-nav-link${active ? ' is-active' : ''}`}
              aria-current={active ? 'location' : undefined} prefetch={false}>
              <Icon aria-hidden /><span>{t(item.label.zh, item.label.en)}</span>
            </AppLink>;
          })}
        </nav>
        {sections.length > 0 && <nav className="platform-context-nav" data-site-surface="heading" aria-label={t('当前栏目功能', 'Current section navigation')}>
          {sections.map(item => <AppLink key={item.id} href={item.href} prefetch={false}
            aria-current={item.id === secondary ? 'page' : undefined}>{t(item.label.zh, item.label.en)}</AppLink>)}
        </nav>}

        {workspaceRoutes.length > 0 && <nav className="platform-workspace-nav" aria-label={t('工作台功能', 'Workspace sections')} data-site-surface="panel">
          {workspaceRoutes.map(item => <AppLink key={item.id} href={`/platform/${item.pattern}`} prefetch={false}
            aria-current={definition?.id === item.id ? 'page' : undefined}>{t(item.title.zh, item.title.en)}</AppLink>)}
        </nav>}
      </>}
      <Content className="platform-main">{children}</Content>
    </div>
  </PlatformNavigationContext>;
}
