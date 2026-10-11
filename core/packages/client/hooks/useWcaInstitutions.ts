'use client';
import { useEffect, useState } from 'react';
import { listWcaInstitutions, saveWcaInstitution, type WcaInstitutionsResponse } from '@/lib/wca-institutions-api';

export function useWcaInstitutions(studentKeys: string[]) {
  const key = [...new Set(studentKeys)].sort().join(',');
  const [data, setData] = useState<WcaInstitutionsResponse>({ institutions: [], assignments: [] });
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const ids = key ? key.split(',') : [];
    const batches = [];
    for (let i = 0; i < Math.max(1, ids.length); i += 100) batches.push(listWcaInstitutions(ids.slice(i, i + 100)));
    Promise.all(batches).then(groups => {
      if (cancelled) return;
      setData({ institutions: groups[0].institutions, assignments: groups.flatMap(group => group.assignments) });
      setResolvedKey(key);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [key, revision]);
  return {
    ...data,
    ready: resolvedKey === key && !failed,
    failed,
    retry: () => setRevision(value => value + 1),
    get: (studentKey: string) => data.institutions.find(institution => institution.id === data.assignments.find(row => row.studentKey === studentKey)?.institutionId),
    save: async (studentKey: string, institutionId: string | null) => {
      await saveWcaInstitution(studentKey, institutionId);
      setData(current => ({ ...current, assignments: [
        ...current.assignments.filter(row => row.studentKey !== studentKey),
        ...(institutionId ? [{ studentKey, institutionId }] : []),
      ] }));
    },
  };
}
