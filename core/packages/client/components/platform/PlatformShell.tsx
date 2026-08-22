'use client';

import { usePathname } from 'next/navigation';
import { BookOpen, Building2, Compass, GraduationCap, Settings2, ShoppingBag, UserRound, UsersRound } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { matchPlatformRoute, PLATFORM_NAV } from '@/lib/platform-routes';
import type { PlatformArea } from '@/lib/platform-types';
import './platform.css';

const AREA_ICONS = {
  discover: Compass,
  learning: BookOpen,
  community: UsersRound,
  commerce: ShoppingBag,
  account: UserRound,
  instructor: GraduationCap,
  organization: Building2,
  admin: Settings2,
} satisfies Record<PlatformArea, typeof Compass>;

function platformSegments(pathname: string): string[] {
  const bare = pathname.replace(/^\/(en|zh)(?=\/|$)/, '');
  const rest = bare.replace(/^\/platform\/?/, '');
  return rest ? rest.split('/').map((part) => decodeURIComponent(part)) : [];
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const area = matchPlatformRoute(platformSegments(pathname))?.definition.area ?? 'discover';

  return (
    <div className="platform-shell">
      <header className="platform-masthead">
        <AppLink href="/platform" className="platform-wordmark" aria-label={t('Platform 首页', 'Platform home')}>
          <span className="platform-wordmark-mark" aria-hidden>CR</span>
          <span>Platform</span>
        </AppLink>
        <p>{t('主站中的学习与服务中枢', 'Learning and services, inside the main site')}</p>
      </header>

      <nav className="platform-nav" aria-label={t('Platform 功能区', 'Platform sections')}>
        {PLATFORM_NAV.map((item) => {
          const Icon = AREA_ICONS[item.area];
          const active = item.area === area;
          return (
            <AppLink
              key={item.area}
              href={item.href}
              className={`platform-nav-link${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
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
