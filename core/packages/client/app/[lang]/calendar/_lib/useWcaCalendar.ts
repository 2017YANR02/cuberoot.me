'use client';

import { useEffect, useState } from 'react';
import { fetchWcaPersonCompetitions } from '@/lib/wca-person-api';
import { fetchPersonUpcomingCompetitions } from '@/lib/person-upcoming';
import { fetchFollows } from '@/lib/comp-follows';
import { loadComps } from '@/lib/comp-search';
import { mergeCalendarCompetitions, type CalendarCompetition } from './competitions';

interface Snapshot { owner: string; competitions: CalendarCompetition[]; loading: boolean; incomplete: boolean }
const EMPTY: Snapshot = { owner: '', competitions: [], loading: false, incomplete: false };

/** 复用选手页/比赛中心数据；账号改变时立即隔离旧结果，不把公开赛程写成个人可编辑事件。 */
export function useWcaCalendar(wcaId: string, today: string) {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!wcaId) return;
    let cancelled = false;
    setSnapshot((s) => ({ owner: wcaId, competitions: s.owner === wcaId ? s.competitions : [], loading: true, incomplete: false }));
    void Promise.allSettled([
      loadComps(), fetchWcaPersonCompetitions(wcaId), fetchPersonUpcomingCompetitions(wcaId), fetchFollows(),
    ]).then(([index, history, registered, followed]) => {
      if (cancelled) return;
      const rows = index.status === 'fulfilled' ? index.value : [];
      const past = history.status === 'fulfilled' ? history.value : [];
      const registrations = registered.status === 'fulfilled' ? registered.value.ids : [];
      const follows = followed.status === 'fulfilled' ? followed.value : [];
      const known = new Set(rows.map((c) => c.id));
      setSnapshot({
        owner: wcaId, loading: false,
        competitions: mergeCalendarCompetitions(rows, past, registrations, follows, today),
        incomplete: [index, history, registered, followed].some((r) => r.status === 'rejected')
          || (registered.status === 'fulfilled' && registered.value.incomplete)
          || registrations.some((id) => !known.has(id)),
      });
    });
    return () => { cancelled = true; };
  }, [wcaId, today, revision]);
  return { ...(snapshot.owner === wcaId ? snapshot : { ...EMPTY, loading: !!wcaId }), refresh: () => setRevision((r) => r + 1) };
}
