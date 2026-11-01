'use client';

import AppLink from '@/components/AppLink';
import { CubingBrandLabel } from '@/components/CubingBrandLabel';
import type { WcaTeam } from '@/lib/wca-teams-api';
import { tr } from '@/i18n/tr';

/** Team identity links to its filtered directory, independently of person/row actions. */
export function WcaTeamLink({ team, className }: { team: WcaTeam; className?: string }) {
  return <AppLink href={`/wca/teams?team=${team.id}`} prefetch={false} className={className}
    aria-label={tr({ zh: `战队：${team.name}`, en: `Team: ${team.name}` })}
    onClick={event => event.stopPropagation()}>
    <CubingBrandLabel name={team.name} logoOnly fallbackToName />
  </AppLink>;
}
