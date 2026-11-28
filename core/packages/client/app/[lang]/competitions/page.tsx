'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, LayoutDashboard, Video } from '@app-foundation/icons/lucide';
import { OnlineCompetitions } from '@/components/competitions/OnlineCompetitions';
import { CompetitionTestCreateButton } from '@/components/competitions/CompetitionTestActions';
import { PlatformState } from '@/components/platform/PlatformState';
import { CompetitionHostAccessContext, useCompetitionRole } from '@/hooks/useCompetitionRole';
import { useT } from '@/hooks/useT';
import { hasAdminAccess, useAuthUser, useOwnerKey } from '@/lib/auth-store';
import { COMPETITION_ACTIVITIES_TITLE, COMPETITION_HOST_TITLE, COMPETITION_WORKSPACES, type CompetitionWorkspaceMode } from '@/lib/competition-links';
import { CompetitionHeader } from './_components/CompetitionHeader';
import { MyCompetitions } from './_components/MyCompetitions';
import { CompetitionHostOverview } from './workspace/_components/CompetitionHostOverview';
import './workspace/workspace.css';

const CompetitionActivityPanel = dynamic(() => import('./workspace/_components/CompetitionActivityPanel').then(module => module.CompetitionActivityPanel),
  { loading: () => <PlatformState kind="loading" /> });

type Panel = 'browse' | 'overview' | 'activities' | CompetitionWorkspaceMode;

export default function CompetitionCenter() {
  const owner = useOwnerKey();
  return <CompetitionCenterContent key={owner} />;
}

function CompetitionCenterContent() {
  const t = useT();
  const user = useAuthUser();
  const admin = hasAdminAccess(user);
  const organizer = useCompetitionRole(admin ? null : 'organizer');
  const supervisor = useCompetitionRole(admin ? null : 'supervisor');
  const canHost = Boolean(user) && (admin || organizer.allowed);
  const canJudge = Boolean(user) && (admin || supervisor.allowed);
  const applicant = useCompetitionRole(!canHost && organizer.ready ? 'applicant' : null);
  const [selection, setSelection] = useState<{ panel: Panel; id?: string }>({ panel: 'browse' });
  const hostPanels = ['overview', 'manage', 'create', ...(admin ? ['activities'] as const : [])] as const;
  const hostOpen = canHost && hostPanels.some(panel => panel === selection.panel);
  const view = hostOpen || (selection.panel === 'review' && admin)
    || (selection.panel === 'supervise' && canJudge) || (selection.panel === 'apply' && applicant.allowed)
    ? selection.panel : 'browse';
  const navigate = (panel: Panel, id?: string) => setSelection({ panel, id });
  const title = (panel: Panel) => {
    if (panel === 'browse') return t('赛事大厅', 'Competition lobby');
    if (panel === 'overview') return t('概览', 'Overview');
    if (panel === 'activities') return t(COMPETITION_ACTIVITIES_TITLE.zh, COMPETITION_ACTIVITIES_TITLE.en);
    return t(COMPETITION_WORKSPACES[panel].title.zh, COMPETITION_WORKSPACES[panel].title.en);
  };
  const buttonClass = (active: boolean) => active ? 'competition-primary' : 'competition-secondary';
  const navVisible = canHost || canJudge || applicant.allowed;

  return <main className="competition-center">
    <CompetitionHeader title={t('线上比赛与线下合作赛', 'Online and in-person partner competitions')} />
    {navVisible && <nav className="competition-workspace-links" aria-label={t('赛事视图', 'Competition views')}>
      <button type="button" className={buttonClass(view === 'browse')} aria-pressed={view === 'browse'}
        onClick={() => navigate('browse')}>{title('browse')}</button>
      {canHost && <button type="button" className={buttonClass(hostOpen)} aria-pressed={hostOpen} onClick={() => navigate('overview')}>
        <LayoutDashboard size={16} aria-hidden />{t(COMPETITION_HOST_TITLE.zh, COMPETITION_HOST_TITLE.en)}
      </button>}
      {canJudge && <button type="button" className={buttonClass(view === 'supervise')} aria-pressed={view === 'supervise'}
        onClick={() => navigate('supervise')}><Video size={16} aria-hidden />{title('supervise')}</button>}
      {admin && <button type="button" className={buttonClass(view === 'review')} aria-pressed={view === 'review'}
        onClick={() => navigate('review')}>{title('review')}</button>}
      {applicant.allowed && <button type="button" className={buttonClass(view === 'apply')} aria-pressed={view === 'apply'}
        onClick={() => navigate('apply')}>{title('apply')}</button>}
    </nav>}
    {view === 'browse' ? <>
      {user && <MyCompetitions />}
      <OnlineCompetitions mode="browse" />
    </> : <section className="competition-inline-workspace" aria-label={hostOpen
      ? t(COMPETITION_HOST_TITLE.zh, COMPETITION_HOST_TITLE.en) : title(view)}>
      {hostOpen && <nav className="competition-workspace-links" aria-label={t('办赛工作台栏目', 'Workspace sections')}>
        {hostPanels.map(panel => <button key={panel} type="button" className={buttonClass(view === panel)} aria-pressed={view === panel}
          onClick={() => navigate(panel)}>{title(panel)}</button>)}
      </nav>}
      <CompetitionHostAccessContext value={canHost}>
        {view === 'overview' ? <>
          <div className="competition-toolbar"><CompetitionTestCreateButton onCreated={id => navigate('manage', id)} /></div>
          <CompetitionHostOverview onManage={id => navigate('manage', id)} />
        </> : view === 'activities' ? <>
          {selection.id && <button className="competition-secondary competition-inline-back" type="button" onClick={() => navigate('activities')}>
            <ArrowLeft size={16} aria-hidden />{t('返回活动列表', 'Back to events')}
          </button>}
          <CompetitionActivityPanel id={selection.id} onNavigate={id => navigate('activities', id)} />
        </> : <OnlineCompetitions key={view} mode={view} id={selection.id} onNavigate={navigate} />}
      </CompetitionHostAccessContext>
    </section>}
  </main>;
}
