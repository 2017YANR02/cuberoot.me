'use client';
import { useEffect, useState } from 'react';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { useAuthUser } from '@/lib/auth-store';
import type { WcaTeamsResponse } from '@/lib/wca-teams-api';
import { fetchWcaTeamDirectory, saveWcaPersonTeams } from '@/lib/wca-team-directory';

export function useWcaTeams(wcaIds: string[]) {
  const user = useAuthUser();
  const key = [...new Set(wcaIds)].sort().join(',');
  const [data, setData] = useState<WcaTeamsResponse>({ teams: [], assignments: [] });
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setResolvedKey(null);

    const ids = key ? key.split(',') : [];
    const requests = key ? [] : [fetchWcaTeamDirectory([])];
    for (let i = 0; i < ids.length; i += 100) requests.push(fetchWcaTeamDirectory(ids.slice(i, i + 100)));
    Promise.all(requests).then(groups => {
      if (cancelled) return;
      setData({ teams: groups[0].teams, assignments: groups.flatMap(group => group.assignments) });
      setResolvedKey(key);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [key, revision]);
  return {
    ...data,
    ready: resolvedKey === key && !failed,
    failed,
    isAdmin: isAdminWcaId(user?.wcaId),
    retry: () => setRevision(value => value + 1),
    save: async (wcaId: string, names: string[]) => {
      const { teams } = await saveWcaPersonTeams(wcaId, names);
      setData(current => ({
        teams: [...current.teams, ...teams.filter(team => !current.teams.some(item => item.id === team.id))],
        assignments: [
          ...current.assignments.filter(item => item.wcaId !== wcaId),
          ...teams.map(team => ({ wcaId, teamId: team.id })),
        ],
      }));
    },
  };
}
