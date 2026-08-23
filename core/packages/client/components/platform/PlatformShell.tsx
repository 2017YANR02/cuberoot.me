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

  return (
    <div className="platform-shell">
      <header className="platform-masthead">
        <AppLink href="/platform" className="platform-wordmark" aria-label={t('Platform 首页', 'Platform home')}>
          <span className="platform-wordmark-mark" aria-hidden>CR</span>
          <span>Platform</span>
        </AppLink>
        <p>{t('主站中的学习与服务中枢', 'Learning and services, inside the main site')}</p>
        <AppLink
          href={user ? '/platform/account/courses' : '/account'}
          className="platform-account-link"
          prefetch={false}
        >
          {user ? t('我的学习', 'My learning') : t('登录', 'Sign in')}
        </AppLink>
      </header>

      <nav className="platform-nav" aria-label={t('Platform 功能区', 'Platform sections')}>
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
      </nav>

      <main className="platform-main">{children}</main>
    </div>
  );
}
