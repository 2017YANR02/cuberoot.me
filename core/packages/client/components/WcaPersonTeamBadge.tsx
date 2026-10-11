'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { CubingBrandLabel } from '@/components/CubingBrandLabel';
import { getWcaPersonTeam, requestWcaPersonTeam, subscribeWcaTeams } from '@/lib/wca-team-directory';
import { tr } from '@/i18n/tr';
import './wca-person-team-badge.css';

/** Current, explicitly recorded team affiliation; never inferred from equipment. */
export function WcaPersonTeamBadge({ wcaId }: { wcaId?: string | null }) {
  const team = useSyncExternalStore(subscribeWcaTeams, () => getWcaPersonTeam(wcaId ?? ''), () => undefined);
  useEffect(() => { if (wcaId) requestWcaPersonTeam(wcaId); }, [wcaId]);
  if (!team) return null;
  return <span className="wca-person-team-badge" title={tr({ zh: `战队：${team.name}`, en: `Team: ${team.name}` })}>
    <CubingBrandLabel name={team.name} logoOnly fallbackToName />
  </span>;
}
