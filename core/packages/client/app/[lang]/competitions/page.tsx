'use client';

import { LayoutDashboard } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { OnlineCompetitions } from '@/components/competitions/OnlineCompetitions';
import { useCompetitionRole } from '@/hooks/useCompetitionRole';
import { useT } from '@/hooks/useT';
import { hasAdminAccess, useAuthUser, useOwnerKey } from '@/lib/auth-store';
import { COMPETITION_HOST_PATH, COMPETITION_HOST_TITLE, COMPETITION_WORKSPACES, competitionWorkspaceHref, type CompetitionWorkspaceMode } from '@/lib/competition-links';
import { CompetitionHeader } from './_components/CompetitionHeader';
import { MyCompetitions } from './_components/MyCompetitions';

export default function CompetitionCenter() {
  const t = useT();
  const user = useAuthUser();
  const owner = useOwnerKey();
  const admin = hasAdminAccess(user);
  const organizer = useCompetitionRole(admin ? null : 'organizer');
  const supervisor = useCompetitionRole('supervisor');
  const canHost = Boolean(user) && (admin || organizer.allowed);
  const applicant = useCompetitionRole(!canHost && organizer.ready ? 'applicant' : null);
  const links: CompetitionWorkspaceMode[] = [];
  if (admin) links.push('review');
  if (supervisor.allowed) links.push('supervise');
  if (applicant.allowed) links.push('apply');
  const hostAction = canHost ? (
    <AppLink href={COMPETITION_HOST_PATH} className="competition-primary" prefetch={false}>
      <LayoutDashboard size={16} aria-hidden />{t(COMPETITION_HOST_TITLE.zh, COMPETITION_HOST_TITLE.en)}
    </AppLink>
  ) : undefined;

  return <main className="competition-center">
    <CompetitionHeader title={t('线上比赛与线下合作赛', 'Online and in-person partner competitions')} actions={hostAction} />
    {links.length > 0 && <nav className="competition-workspace-links" aria-label={t('赛事工作台', 'Competition workspaces')}>
      {links.map(mode => <AppLink key={mode} href={competitionWorkspaceHref(mode)} prefetch={false}>
        {t(COMPETITION_WORKSPACES[mode].title.zh, COMPETITION_WORKSPACES[mode].title.en)}
      </AppLink>)}
    </nav>}
    {user && <MyCompetitions key={owner} />}
    <OnlineCompetitions />
  </main>;
}
