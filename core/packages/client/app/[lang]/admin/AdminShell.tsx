'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';
import { NavigationShell, type NavigationItem } from '@app-foundation/navigation-ui';
import { Activity, BookOpen, Folder, LayoutDashboard, ShieldCheck, Users, Wrench } from '@app-foundation/icons/lucide';
import '@app-foundation/navigation-ui/navigation.css';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { ADMIN_SECTION_LABELS, ADMIN_SECTIONS, SYSTEM_VIEWS, SYSTEM_VIEW_LABELS, adminSectionForPath } from './sections';
import './admin.css';

function Shell({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const [section] = useQueryState('section', parseAsString);
  const [view] = useQueryState('view', parseAsString);
  const isAdmin = useIsAdmin();
  const user = useAuthUser();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !isAdmin) return <>{children}</>;

  const active = adminSectionForPath(pathname, section);
  const isSystemHome = pathname.replace(/^\/zh(?=\/|$)/, '').replace(/\/$/, '') === '/admin' && active === 'system';
  const selectedView = SYSTEM_VIEWS.find(item => item === view) ?? 'tools';
  const icons = { overview: LayoutDashboard, users: Users, content: BookOpen, commerce: Activity, system: Wrench };
  const items: NavigationItem[] = ADMIN_SECTIONS.filter(id => id !== 'system').map(id => {
    const Icon = icons[id];
    return { id, href: id === 'overview' ? '/admin' : `/admin?section=${id}`, label: t(...ADMIN_SECTION_LABELS[id]), icon: <Icon size={18} aria-hidden />, active: id === active && !isSystemHome };
  });
  const systemIcons = { tools: Wrench, workspace: Folder, monitoring: Activity, tax: ShieldCheck };
  const systemItems = SYSTEM_VIEWS.map(id => {
    const Icon = systemIcons[id];
    return { id: `system-${id}`, href: `/admin?section=system&view=${id}`, label: t(...SYSTEM_VIEW_LABELS[id]), icon: <Icon size={15} aria-hidden />, active: isSystemHome && id === selectedView };
  });
  return <NavigationShell className="admin-navigation" mainClassName="admin-navigation__content" contentAs="div"
    items={items} groups={[{ id: 'system', label: t(...ADMIN_SECTION_LABELS.system), icon: <Wrench size={18} aria-hidden />, items: systemItems, defaultOpen: active === 'system' }]} labels={{ navigation: t('后台导航', 'Administration navigation'), show: t('显示侧边栏', 'Show sidebar'), hide: t('隐藏侧边栏', 'Hide sidebar'), openMobile: t('打开导航', 'Open navigation'), closeMobile: t('关闭导航', 'Close navigation') }}
    renderLink={props => <AppLink {...props} prefetch={false} />}
    header={toggle => <header className="admin-navigation__header">{toggle}<AppLink href="/admin" prefetch={false} className="admin-navigation__brand">CubeRoot <span>{t('管理后台', 'Administration')}</span></AppLink><AppLink href="/account" prefetch={false} className="admin-navigation__account">{user?.name || t('我的账号', 'My account')}</AppLink></header>}>
    {children}
  </NavigationShell>;
}

export default function AdminShell({ children }: { children: ReactNode }) {
  return <Suspense fallback={children}><Shell>{children}</Shell></Suspense>;
}
