'use client';

import { createContext, useEffect, useState } from 'react';
import { useAuthUser } from '@/lib/auth-store';
import { listOrganizerApplications, listSupervisedCompetitions } from '@/lib/online-competition-api';
import { listTeachingOrganizations } from '@/lib/teaching-saas-api';

type Role = 'organizer' | 'supervisor' | 'applicant';

export const CompetitionHostAccessContext = createContext(false);

async function checkRole(role: Role): Promise<boolean> {
  if (role === 'organizer') return (await listOrganizerApplications()).eligibleOrganizationIds.length > 0;
  if (role === 'supervisor') return (await listSupervisedCompetitions()).competitions.length > 0;
  return (await listTeachingOrganizations()).some(org => org.status === 'active' && ['owner', 'admin'].includes(org.role));
}

export function useCompetitionRole(role: Role | null) {
  const user = useAuthUser();
  const [result, setResult] = useState<{ user: NonNullable<typeof user>; role: Role; allowed: boolean } | null>(null);
  useEffect(() => {
    if (!user || !role) return;
    let active = true;
    const settle = (allowed: boolean) => { if (active) setResult({ user, role, allowed }); };
    void checkRole(role).then(settle, () => settle(false));
    return () => { active = false; };
  }, [user, role]);
  const current = user && result?.user === user && result.role === role ? result : null;
  return { ready: !role || !user || !!current, allowed: current?.allowed ?? false };
}
