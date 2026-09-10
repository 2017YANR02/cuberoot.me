'use client';

import { usePathname } from 'next/navigation';
import { BookOpen, Building2, Compass, GraduationCap, UsersRound } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { matchPlatformRoute, PLATFORM_PUBLIC_NAV } from '@/lib/platform-routes';
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
  const definition = matchPlatformRoute(platformSegments(pathname))?.definition;
  const activeId = publicNavId(definition);
  const competitionPage = definition?.id === 'online-competitions' || definition?.id === 'online-competition';
  const orderPage = definition?.id === 'orders' || definition?.id === 'order-detail';
  const compactPage = competitionPage || orderPage;

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

      <main className="platform-main">{children}</main>
    </div>
  );
}
