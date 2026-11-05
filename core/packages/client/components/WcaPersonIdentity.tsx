import type { ComponentProps, ReactNode } from 'react';
import { WcaPersonTeamBadge } from '@/components/WcaPersonTeamBadge';

/** Shared identity layout, including for custom links and result-popup triggers. */
export function WcaPersonIdentity({
  wcaId, team, linked, showTeam = true, flag, children,
}: ComponentProps<typeof WcaPersonTeamBadge> & {
  showTeam?: boolean;
  flag?: ReactNode;
  children: ReactNode;
}) {
  return <span className="wca-person-identity">
    {showTeam && <WcaPersonTeamBadge wcaId={wcaId} team={team} linked={linked} />}
    <span className="wca-person-identity-content">{flag}{children}</span>
  </span>;
}
