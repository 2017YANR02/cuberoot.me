'use client';

import { useEffect, useSyncExternalStore, type ComponentProps } from 'react';
import { CubingBrandLabel } from '@/components/CubingBrandLabel';
import { WcaTeamLink } from '@/components/WcaTeamLink';
import { getWcaPersonTeams, requestWcaPersonTeams, subscribeWcaTeams } from '@/lib/wca-team-directory';
import { tr } from '@/i18n/tr';
import './wca-person-team-badge.css';

/** Current, explicitly recorded team affiliation; never inferred from equipment. */
export function WcaPersonTeamBadge({ wcaId, linked = true, teams: suppliedTeams }: {
  wcaId?: string | null;
  linked?: boolean;
  teams?: ComponentProps<typeof WcaTeamLink>['team'][];
}) {
  const cachedTeams = useSyncExternalStore(subscribeWcaTeams, () => getWcaPersonTeams(wcaId ?? ''), () => undefined);
  const teams = suppliedTeams ?? cachedTeams;
  useEffect(() => { if (wcaId && !suppliedTeams) requestWcaPersonTeams(wcaId); }, [wcaId, suppliedTeams]);
  return <span className="wca-person-team-slot">{teams?.map(team => linked
    ? <WcaTeamLink key={team.id} team={team} className="wca-person-team-badge" />
    : <span key={team.id} className="wca-person-team-badge" title={tr({ zh: `战队：${team.name}`, en: `Team: ${team.name}` })}>
      <CubingBrandLabel name={team.name} logoOnly fallbackToName />
    </span>
  )}</span>;
}
