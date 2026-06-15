'use client';
// 成绩 tab:按项目 / 按比赛 子切换 + 项目图标条(在按项目模式下).

import { useQueryStates, parseAsString } from 'nuqs';
import { Suspense, lazy, useCallback, useMemo } from 'react';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import { mergePersonLive } from '@/lib/person-live-merge';
import i18n from "@/i18n/i18n-client";

const ByCompList = lazy(() => import('./ByCompList'));
const ByEventView = lazy(() => import('./ByEventView'));

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  liveResults?: WcaResultRow[] | null;
  liveComps?: WcaCompetition[] | null;
  reconLookup: Map<string, number> | null;
  isZh: boolean;
}

type Sub = 'event' | 'comp';

export default function ResultsTab({ profile, results, comps, liveResults, liveComps, reconLookup, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  // 子 tab(按项目 / 按比赛)+ 选中项目均为页内瞬时态 → replace,不堆历史
  const [q, setQ] = useQueryStates(
    { sub: parseAsString, event: parseAsString },
    { history: 'replace', scroll: false },
  );
  const rawSub = (q.sub ?? 'event').toLowerCase();
  const sub: Sub = rawSub === 'comp' ? 'comp' : 'event';
  const setSub = useCallback((s: Sub) => setQ({ sub: s }), [setQ]);

  // 官方 + 直播(非官方)合并,按比赛粒度去重(官方已收录的比赛丢弃直播行)。
  // 仅成绩 tab 用;PR 表 / Hero 等仍只见官方 results。
  const merged = useMemo(() => {
    if (!results || !comps) return { results, comps };
    if (!liveResults || liveResults.length === 0) return { results, comps };
    return mergePersonLive(results, comps, liveResults, liveComps ?? []);
  }, [results, comps, liveResults, liveComps]);
  const mResults = merged.results;
  const mComps = merged.comps;

  const eventIds = useMemo(() => {
    const set = new Set<string>();
    if (mResults) for (const r of mResults) set.add(r.event_id);
    return ALL_EVENT_IDS.filter((eid) => set.has(eid));
  }, [mResults]);

  const rawEv = (q.event ?? '').toLowerCase();
  const activeEvent = eventIds.includes(rawEv) ? rawEv : (eventIds[0] ?? '333');
  const setEvent = useCallback((eid: string) => setQ({ event: eid }), [setQ]);

  return (
    <div className="wp-results-tab">
      <div className="wp-subtab-bar">
        <button
          className={`wp-subtab-btn ${sub === 'event' ? 'is-active' : ''}`}
          onClick={() => setSub('event')}
        >{t('按项目', 'By Event')}</button>
        <button
          className={`wp-subtab-btn ${sub === 'comp' ? 'is-active' : ''}`}
          onClick={() => setSub('comp')}
        >{t('按比赛', 'By Competition')}</button>
      </div>

      {sub === 'event' && eventIds.length > 0 && (
        <div className="wp-event-strip wp-event-strip-tabs">
          {eventIds.map((eid) => (
            <button
              key={eid}
              className={`wp-event-tab ${eid === activeEvent ? 'is-active' : ''}`}
              onClick={() => setEvent(eid)}
              title={eid}
            >
              <EventIcon event={eid} className="wp-event-icon-md" />
            </button>
          ))}
        </div>
      )}

      <Suspense fallback={<div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>}>
        {sub === 'event' && (
          <ByEventView
            profile={profile}
            results={mResults}
            comps={mComps}
            reconLookup={reconLookup}
            eventId={activeEvent}
            isZh={isZh}
          />
        )}
        {sub === 'comp' && (
          <ByCompList wcaId={profile.person.wca_id} personName={profile.person.name} results={mResults} comps={mComps} reconLookup={reconLookup} isZh={isZh} />
        )}
      </Suspense>
    </div>
  );
}
