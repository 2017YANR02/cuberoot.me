'use client';

import { usePathname } from 'next/navigation';
import { BookOpen, Building2, Compass, GraduationCap, UsersRound } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { matchPlatformRoute, PLATFORM_PUBLIC_NAV, PLATFORM_ROUTES } from '@/lib/platform-routes';
import type { PlatformRouteDefinition } from '@/lib/platform-types';
import './platform.css';

const AREA_ICONS = {
  discover: Compass,
  courses: BookOpen,
  community: UsersRound,
  teachers: GraduationCap,
  organizations: Building2,
} satisfies Record<(typeof PLATFORM_PUBLIC_NAV)[number]['id'], typeof Compass>;

function platformSegments(pathname: string): string[] {
  const bare = pathname.replace(/^\/(en|zh)(?=\/|$)/, '');
  const rest = bare.replace(/^\/platform\/?/, '');
  return rest ? rest.split('/').map((part) => decodeURIComponent(part)) : [];
}

function publicNavId(definition: PlatformRouteDefinition | undefined): (typeof PLATFORM_PUBLIC_NAV)[number]['id'] | null {
  if (!definition) return 'discover';
  if (definition.id === 'teachers' || definition.id === 'teacher-detail') return 'teachers';
  if (definition.area === 'learning') return 'courses';
  if (definition.area === 'community') return 'community';
  if (definition.area === 'organization') return 'organizations';
  if (definition.area === 'discover' || definition.area === 'commerce') return 'discover';
  return null;
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const definition = matchPlatformRoute(platformSegments(pathname))?.definition;
  const activeId = publicNavId(definition);
  const competitionPage = definition?.id === 'online-competitions' || definition?.id === 'online-competition';
  const orderPage = definition?.id === 'orders' || definition?.id === 'order-detail';
  const compactPage = competitionPage || orderPage;
  const personalPage = definition?.area === 'account' || definition?.id === 'progress' || orderPage;
  const workspaceRoutes = PLATFORM_ROUTES.filter(item => !item.pattern.includes(':') && item.kind !== 'form'
    && (definition?.area === 'admin' ? isAdmin && item.area === 'admin'
      : definition?.area === 'instructor' ? user && item.access === 'instructor'
        : personalPage ? user && (item.area === 'account' && item.id !== 'login' || item.id === 'progress' || item.id === 'orders') : false));

  return (
    <div className={`platform-shell${compactPage ? ' platform-shell--competitions' : ''}`}>
      <header className="platform-masthead">
        <AppLink href={competitionPage ? '/platform/events/online' : orderPage ? '/platform/orders' : '/platform'} className="platform-wordmark" aria-label={competitionPage ? t('比赛首页', 'Competitions home') : orderPage ? t('我的订单', 'My orders') : t('Platform 首页', 'Platform home')}>
          <span className="platform-wordmark-mark" aria-hidden>CR</span>
          <span>{competitionPage ? t('比赛', 'Competitions') : orderPage ? t('订单', 'Orders') : t('学习空间', 'Learning')}</span>
        </AppLink>
        <p>CubeRoot</p>
        <AppLink
          href={user ? (compactPage ? '/platform/orders' : '/platform/account/courses') : '/account'}
          className="platform-account-link"
          prefetch={false}
        >
          {user ? (compactPage ? t('我的订单', 'My orders') : t('我的学习', 'My learning')) : t('登录', 'Sign in')}
        </AppLink>
      </header>

      {!compactPage && <nav className="platform-nav platform-glass" aria-label={t('Platform 功能区', 'Platform sections')}>
        {PLATFORM_PUBLIC_NAV.map((item) => {
          const Icon = AREA_ICONS[item.id];
          const active = item.id === activeId;
          return (
            <AppLink
              key={item.id}
              href={item.href}
              className={`platform-nav-link${active ? ' is-active' : ''}`}
              aria-current={active && pathname.replace(/^\/(en|zh)(?=\/|$)/, '') === item.href ? 'page' : undefined}
              prefetch={false}
            >
              <Icon aria-hidden />
              <span>{t(item.label.zh, item.label.en)}</span>
            </AppLink>
          );
        })}
      </nav>}

      {!compactPage && <nav className="platform-context-nav" aria-label={t('更多学习与服务', 'More learning and services')}>
        <AppLink href="/search" prefetch={false}>{t('搜索', 'Search')}</AppLink>
        <AppLink href="/platform/paths" prefetch={false}>{t('学习路径', 'Learning paths')}</AppLink>
        <AppLink href="/platform/events" prefetch={false}>{t('活动', 'Events')}</AppLink>
        <AppLink href="/platform/news" prefetch={false}>{t('资讯', 'News')}</AppLink>
        <AppLink href="/platform/leaderboard" prefetch={false}>{t('学习榜', 'Learning leaderboard')}</AppLink>
        <AppLink href="/platform/shop" prefetch={false}>{t('商店', 'Shop')}</AppLink>
        <AppLink href="/platform/membership" prefetch={false}>{t('课程会员', 'Course membership')}</AppLink>
        <AppLink href="/platform/teachers/apply" prefetch={false}>{t('讲师入驻', 'Teach with us')}</AppLink>
        {user && <AppLink href="/platform/account/courses" prefetch={false}>{t('学习工作台', 'My learning')}</AppLink>}
        {isAdmin && <AppLink href="/platform/admin" prefetch={false}>{t('管理', 'Administration')}</AppLink>}
      </nav>}
      {workspaceRoutes.length > 0 && <nav className="platform-workspace-nav" aria-label={t('工作台功能', 'Workspace sections')} data-site-surface="panel">
        {workspaceRoutes.map(item => <AppLink key={item.id} href={`/platform/${item.pattern}`} prefetch={false}
          aria-current={definition?.id === item.id ? 'page' : undefined}>{t(item.title.zh, item.title.en)}</AppLink>)}
      </nav>}
      <main className="platform-main">{children}</main>
    </div>
  );
}
