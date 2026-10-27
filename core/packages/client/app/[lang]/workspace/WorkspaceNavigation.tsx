'use client';

import { Suspense, type ReactNode, type MouseEvent } from 'react';
import { usePathname } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';
import { NavigationShell } from '@app-foundation/navigation-ui';
import { Activity, BookOpen, ClipboardList, FolderKanban, LayoutDashboard, LogOut, ScanEye, ShieldCheck, UserRoundPlus, Users, Workflow, Wrench } from '@app-foundation/icons/lucide';
import '@app-foundation/navigation-ui/navigation.css';
import '@app-foundation/workspace-ui/workspace.css';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import './workspace.css';
import '../admin/admin.css';

function Navigation({ children }: { children: ReactNode }) {
  const t = useT();
  const user = useAuthUser();
  const admin = useIsAdmin();
  const pathname = usePathname().replace(/^\/(?:zh|en)(?=\/|$)/, '').replace(/\/$/, '');
  const [section] = useQueryState('section', parseAsString);
  const [view] = useQueryState('view', parseAsString);
  if (!user) return <>{children}</>;

  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/') && !pathname.startsWith('/admin/team');
  const teamItems = [
    { id: 'mine', label: t('我的工作', 'My work'), Icon: ClipboardList },
    { id: 'updates', label: t('团队动态', 'Team updates'), Icon: Users },
    { id: 'projects', label: t('项目', 'Projects'), Icon: FolderKanban },
    { id: 'checklists', label: t('清单', 'Checklists'), Icon: ClipboardList },
    { id: 'schedule', label: t('排期', 'Schedule'), Icon: FolderKanban },
    ...(admin ? [{ id: 'members', label: t('成员与权限', 'Members and access'), Icon: ShieldCheck }] : []),
    { id: 'onboarding', label: t('入职', 'Onboarding'), Icon: UserRoundPlus },
    { id: 'sop', label: 'SOP', Icon: Workflow },
    { id: 'quality', label: t('质量标准', 'Quality standards'), Icon: ScanEye },
    { id: 'offboarding', label: t('离职', 'Offboarding'), Icon: LogOut },
  ].map(({ id, label, Icon }) => ({ id, label, href: `/admin/team?section=${id}`, icon: <Icon size={18} aria-hidden />, active: !inAdmin && (section ?? 'mine') === id }));
  const adminItems = [
    { id: 'overview', label: t('运营总览', 'Overview'), Icon: LayoutDashboard, href: '/admin' },
    { id: 'users', label: t('用户与会员', 'Users and memberships'), Icon: Users, href: '/admin?section=users' },
    { id: 'content', label: t('内容与社区', 'Content and community'), Icon: BookOpen, href: '/admin?section=content' },
    { id: 'commerce', label: t('课程与商业', 'Courses and commerce'), Icon: Activity, href: '/admin?section=commerce' },
    { id: 'system', label: t('系统工具', 'System tools'), Icon: Wrench, href: '/admin?section=system&view=tools' },
    { id: 'work', label: t('工作资料', 'Work resources'), Icon: FolderKanban, href: '/admin?section=system&view=workspace' },
    { id: 'monitoring', label: t('助手与诊断', 'Assistant and diagnostics'), Icon: Activity, href: '/admin?section=system&view=monitoring' },
    { id: 'tax', label: t('税务办理', 'Tax filing'), Icon: ShieldCheck, href: '/admin?section=system&view=tax' },
  ].map(({ id, label, Icon, href }) => {
    const selected = pathname === '/admin/users' ? 'users'
      : pathname === '/admin/interview' ? 'work'
      : pathname === '/admin/disk' || pathname === '/admin/releases' ? 'system'
      : section === 'system' ? ({ workspace: 'work', monitoring: 'monitoring', tax: 'tax' }[view ?? ''] ?? 'system')
      : section ?? 'overview';
    return { id, label, href, icon: <Icon size={18} aria-hidden />, active: inAdmin && selected === id };
  });
  const onGroupClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const summary = target.closest('summary');
    const group = summary?.parentElement;
    if (!(group instanceof HTMLDetailsElement) || group.open || !group.matches('.af-nav-sidebar > div > .af-nav-group')) return;
    group.parentElement?.querySelectorAll<HTMLDetailsElement>(':scope > .af-nav-group[open]').forEach(other => {
      if (other !== group) other.open = false;
    });
  };
  return <div onClickCapture={onGroupClick}><NavigationShell className="staff-workspace cuberoot-workspace-navigation" mainClassName={`staff-main${inAdmin ? ' admin-navigation__content' : ''}`} contentAs="div"
    items={[]} groups={[
      { id: 'team', label: t('团队协作', 'Team collaboration'), icon: <Users size={18} aria-hidden />, items: teamItems, defaultOpen: !inAdmin },
      ...(admin ? [{ id: 'admin', label: t('网站管理', 'Site management'), icon: <ShieldCheck size={18} aria-hidden />, items: adminItems, defaultOpen: inAdmin }] : []),
    ]}
    labels={{ navigation: t('工作台导航', 'Workspace navigation'), show: t('显示侧边栏', 'Show sidebar'), hide: t('隐藏侧边栏', 'Hide sidebar'), openMobile: t('打开导航', 'Open navigation'), closeMobile: t('关闭导航', 'Close navigation') }}
    renderLink={props => <AppLink {...props} prefetch={false} />}
    header={toggle => <header className="staff-header">{toggle}<AppLink href="/" className="staff-brand" prefetch={false}>CubeRoot</AppLink><div className="staff-header-actions"><AppLink href="/account" prefetch={false}>{user.name || t('我的账号', 'My account')}</AppLink></div></header>}>
    {children}
  </NavigationShell></div>;
}

export default function WorkspaceNavigation({ children }: { children: ReactNode }) {
  return <Suspense fallback={children}><Navigation>{children}</Navigation></Suspense>;
}
