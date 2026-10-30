'use client';

import { useEffect, useState } from 'react';
import { WCA_ID_REGEX } from '@/lib/wca-api';
import { fetchWcaPersonCompetitions } from '@/lib/wca-person-api';
import { fetchPersonUpcomingCompetitions } from '@/lib/person-upcoming';
import { syncCalendarCompetitions } from '@/lib/calendar-api';
import { fetchFollows } from '@/lib/comp-follows';
import { loadComps } from '@/lib/comp-search';
import { mergeCalendarCompetitions, type CalendarCompetition } from './competitions';

interface Snapshot { owner: string; competitions: CalendarCompetition[]; loading: boolean; incomplete: boolean }
const EMPTY: Snapshot = { owner: '', competitions: [], loading: false, incomplete: false };

/** 复用选手页/比赛中心数据；账号改变时立即隔离旧结果，只将与我有关的比赛去重写入个人日程。 */
export function useWcaCalendar(owner: string, today: string, onSynced?: () => Promise<void>) {
  const wcaId = WCA_ID_REGEX.test(owner) ? owner : '';
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!owner || !today) return;
    let cancelled = false;
    setSnapshot((s) => ({ owner, competitions: s.owner === owner ? s.competitions : [], loading: true, incomplete: false }));
    void Promise.allSettled([
      loadComps(), wcaId ? fetchWcaPersonCompetitions(wcaId) : Promise.resolve([]),
      wcaId ? fetchPersonUpcomingCompetitions(wcaId) : Promise.resolve({ ids: [], incomplete: false }), fetchFollows(),
    ]).then(async ([index, history, registered, followed]) => {
      if (cancelled) return;
      const rows = index.status === 'fulfilled' ? index.value : [];
      const past = history.status === 'fulfilled' ? history.value : [];
      const registrations = registered.status === 'fulfilled' ? registered.value.ids : [];
      const follows = followed.status === 'fulfilled' ? followed.value : [];
      const known = new Set(rows.map((c) => c.id));
      const competitions = mergeCalendarCompetitions(rows, past, registrations, follows, today)
        .filter((c) => c.source !== 'upcoming');
      let incomplete = [index, history, registered, followed].some((r) => r.status === 'rejected')
        || (registered.status === 'fulfilled' && registered.value.incomplete)
        || [...registrations, ...follows].some((id) => !known.has(id));
      try {
        for (let i = 0; i < competitions.length; i += 100) {
          if (cancelled) return;
          await syncCalendarCompetitions(competitions.slice(i, i + 100).map((c) => ({
            id: c.id, title: c.name, startDate: c.start_date, endDate: c.end_date || c.start_date, location: c.city ?? '',
          })), false, owner);
        }
      } catch { incomplete = true; }
      if (cancelled) return;
      await onSynced?.();
      if (!cancelled) setSnapshot({ owner, loading: false, competitions, incomplete });
    });
    return () => { cancelled = true; };
  }, [owner, wcaId, today, revision, onSynced]);
  useEffect(() => {
    const refresh = () => setRevision((r) => r + 1);
    window.addEventListener('focus', refresh);
    window.addEventListener('competition-follows-changed', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('competition-follows-changed', refresh); };
  }, []);
  return { ...(snapshot.owner === owner ? snapshot : { ...EMPTY, loading: !!owner }), refresh: () => setRevision((r) => r + 1) };
}
