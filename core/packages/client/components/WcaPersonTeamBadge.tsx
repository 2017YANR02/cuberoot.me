'use client';

import { useEffect, useSyncExternalStore, type ComponentProps } from 'react';
import { CubingBrandLabel } from '@/components/CubingBrandLabel';
import { WcaTeamLink } from '@/components/WcaTeamLink';
import { getWcaPersonTeam, requestWcaPersonTeam, subscribeWcaTeams } from '@/lib/wca-team-directory';
import { tr } from '@/i18n/tr';
import './wca-person-team-badge.css';

/** Current, explicitly recorded team affiliation; never inferred from equipment. */
export function WcaPersonTeamBadge({ wcaId, linked = true, team: suppliedTeam }: {
  wcaId?: string | null;
  linked?: boolean;
  team?: ComponentProps<typeof WcaTeamLink>['team'];
}) {
  const cachedTeam = useSyncExternalStore(subscribeWcaTeams, () => getWcaPersonTeam(wcaId ?? ''), () => undefined);
  const team = suppliedTeam ?? cachedTeam;
  useEffect(() => { if (wcaId && !suppliedTeam) requestWcaPersonTeam(wcaId); }, [wcaId, suppliedTeam]);
  return <span className="wca-person-team-slot">{team && (linked
    ? <WcaTeamLink team={team} className="wca-person-team-badge" />
    : <span className="wca-person-team-badge" title={tr({ zh: `战队：${team.name}`, en: `Team: ${team.name}` })}>
      <CubingBrandLabel name={team.name} logoOnly fallbackToName />
    </span>
  )}</span>;
}
