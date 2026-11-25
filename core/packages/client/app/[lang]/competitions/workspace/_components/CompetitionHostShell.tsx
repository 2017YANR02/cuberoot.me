'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarDays, LayoutDashboard, ListChecks, Plus } from '@app-foundation/icons/lucide';
import { NavigationShell } from '@app-foundation/navigation-ui';
import '@app-foundation/navigation-ui/navigation.css';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import PageBackLink from '@/components/PageBackLink';
import { PlatformState } from '@/components/platform/PlatformState';
import { CompetitionHostAccessContext, useCompetitionRole } from '@/hooks/useCompetitionRole';
import { useT } from '@/hooks/useT';
import { hasAdminAccess, nextQuery, useAuthUser, useOwnerKey } from '@/lib/auth-store';
import { COMPETITIONS_PATH, COMPETITION_ACTIVITIES_PATH, COMPETITION_ACTIVITIES_TITLE, COMPETITION_HOST_PATH, COMPETITION_HOST_TITLE, COMPETITION_WORKSPACES, competitionWorkspaceHref, matchCompetitionHostRoute } from '@/lib/competition-links';

export function CompetitionHostShell({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const user = useAuthUser();
  const owner = useOwnerKey();
  const admin = hasAdminAccess(user);
  const organizer = useCompetitionRole(admin ? null : 'organizer');
  const allowed = Boolean(user) && (admin || organizer.allowed);
  const path = pathname.replace(/^\/(?:en|zh)(?=\/|$)/, '');
  const route = matchCompetitionHostRoute(path.slice(COMPETITION_HOST_PATH.length).split('/').filter(Boolean));
  const active = route?.mode;
  let fallback = COMPETITION_HOST_PATH;
  if (active === 'overview') fallback = COMPETITIONS_PATH;
  if (route?.id) fallback = active === 'activities' ? COMPETITION_ACTIVITIES_PATH : competitionWorkspaceHref('manage');
  const items = [
    { id: 'overview', href: COMPETITION_HOST_PATH, label: t('概览', 'Overview'), icon: <LayoutDashboard size={19} /> },
    { id: 'manage', href: competitionWorkspaceHref('manage'), label: t(COMPETITION_WORKSPACES.manage.title.zh, COMPETITION_WORKSPACES.manage.title.en), icon: <ListChecks size={19} /> },
    { id: 'create', href: competitionWorkspaceHref('create'), label: t(COMPETITION_WORKSPACES.create.title.zh, COMPETITION_WORKSPACES.create.title.en), icon: <Plus size={19} /> },
    ...(admin ? [
      { id: 'activities', href: COMPETITION_ACTIVITIES_PATH, label: t(COMPETITION_ACTIVITIES_TITLE.zh, COMPETITION_ACTIVITIES_TITLE.en), icon: <CalendarDays size={19} /> },
    ] : []),
  ];

  const body = !user ? <PlatformState kind="permission" permissionHref={'/account' + nextQuery(pathname)} />
    : !organizer.ready ? <PlatformState kind="loading" />
      : !allowed ? <PlatformState kind="permission"
        message={t('通过主办资格审核后可使用办赛工作台。', 'The competition workspace is available to approved organizers.')}
        permissionHref={competitionWorkspaceHref('apply')}
        permissionLabel={t('查看主办资格申请', 'View organizer application')} />
        : active === 'activities' && !admin ? <PlatformState kind="permission"
          message={t('只有网站管理员可以管理活动。', 'Event management requires a site administrator.')}
          permissionHref={COMPETITION_HOST_PATH} permissionLabel={t('返回办赛概览', 'Back to workspace overview')} />
          : <CompetitionHostAccessContext key={owner} value>{children}</CompetitionHostAccessContext>;

  return <NavigationShell className="competition-host" mainClassName="competition-host-main competition-center" contentAs="main"
    showNavigation={allowed} items={allowed ? items.map(item => ({ ...item, active: item.id === active })) : []}
    labels={{
      navigation: t('办赛工作台导航', 'Competition workspace navigation'),
      show: t('展开侧栏', 'Expand sidebar'), hide: t('收起侧栏', 'Collapse sidebar'),
      openMobile: t('打开导航', 'Open navigation'), closeMobile: t('关闭导航', 'Close navigation'),
    }}
    renderLink={props => <AppLink {...props} prefetch={false} />}
    togglePlacement="sidebar"
    header={mobileToggle => <header className="competition-host-header" data-site-surface="heading">
      <div>{mobileToggle}<PageBackLink fallback={fallback} acceptEntry={href => href.split(/[?#]/)[0].replace(/^\/(?:en|zh)(?=\/|$)/, '') === fallback} /><strong>{t(COMPETITION_HOST_TITLE.zh, COMPETITION_HOST_TITLE.en)}</strong></div>
      <HeaderToggles />
    </header>}>
    {body}
  </NavigationShell>;
}
