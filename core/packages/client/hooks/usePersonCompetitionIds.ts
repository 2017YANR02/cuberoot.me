'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchPersonUpcomingCompetitionIds } from '@/lib/person-upcoming';
import { fetchWcaPersonCompetitions, type WcaCompetition } from '@/lib/wca-person-api';

type Lookup = { wcaId: string; ids: string[] };

export function usePersonCompetitionIds(wcaId: string | undefined, indexedIds?: ReadonlySet<string>) {
  const [past, setPast] = useState<Lookup>();
  const [upcoming, setUpcoming] = useState<Lookup>();

  useEffect(() => {
    if (!wcaId) return;
    let active = true;
    const savePast = (comps: WcaCompetition[]) => {
      if (active) setPast({ wcaId, ids: comps.map(comp => comp.id) });
    };
    void fetchWcaPersonCompetitions(wcaId, savePast).then(savePast).catch(() => {});
    void fetchPersonUpcomingCompetitionIds(wcaId).then(ids => {
      if (active) setUpcoming({ wcaId, ids });
    }).catch(() => {});
    return () => { active = false; };
  }, [wcaId]);

  return useMemo(() => {
    if (!wcaId) return null;
    const ids = new Set(indexedIds);
    if (past?.wcaId === wcaId) for (const id of past.ids) ids.add(id);
    if (upcoming?.wcaId === wcaId) for (const id of upcoming.ids) ids.add(id);
    return ids;
  }, [wcaId, indexedIds, past, upcoming]);
}
