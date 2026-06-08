'use client';
// 成绩 tab:按项目 / 按比赛 子切换 + 项目图标条(在按项目模式下).

import { useQueryStates, parseAsString } from 'nuqs';
import { Suspense, lazy, useCallback, useMemo } from 'react';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import i18n from "@/i18n/i18n-client";

const ByCompList = lazy(() => import('./ByCompList'));
const ByEventView = lazy(() => import('./ByEventView'));

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  reconLookup: Map<string, number> | null;
  isZh: boolean;
}

type Sub = 'event' | 'comp';

export default function ResultsTab({ profile, results, comps, reconLookup, isZh }: Props) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  // 子 tab(按项目 / 按比赛)+ 选中项目均为页内瞬时态 → replace,不堆历史
  const [q, setQ] = useQueryStates(
    { sub: parseAsString, event: parseAsString },
    { history: 'replace', scroll: false },
  );
  const rawSub = (q.sub ?? 'event').toLowerCase();
  const sub: Sub = rawSub === 'comp' ? 'comp' : 'event';
  const setSub = useCallback((s: Sub) => setQ({ sub: s }), [setQ]);

  const eventIds = useMemo(() => {
    const set = new Set<string>();
    if (results) for (const r of results) set.add(r.event_id);
    return ALL_EVENT_IDS.filter((eid) => set.has(eid));
  }, [results]);

  const rawEv = (q.event ?? '').toLowerCase();
  const activeEvent = eventIds.includes(rawEv) ? rawEv : (eventIds[0] ?? '333');
  const setEvent = useCallback((eid: string) => setQ({ event: eid }), [setQ]);

  return (
    <div className="wp-results-tab">
      <div className="wp-subtab-bar">
        <button
          className={`wp-subtab-btn ${sub === 'event' ? 'is-active' : ''}`}
          onClick={() => setSub('event')}
        >{t('按项目', 'By Event', "按專案")}</button>
        <button
          className={`wp-subtab-btn ${sub === 'comp' ? 'is-active' : ''}`}
          onClick={() => setSub('comp')}
        >{t('按比赛', 'By Competition', "按比賽")}</button>
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

      <Suspense fallback={<div className="wp-loading-inline">{t('加载中…', 'Loading…', "載入中…")}</div>}>
        {sub === 'event' && (
          <ByEventView
            profile={profile}
            results={results}
            comps={comps}
            reconLookup={reconLookup}
            eventId={activeEvent}
            isZh={isZh}
          />
        )}
        {sub === 'comp' && (
          <ByCompList results={results} comps={comps} reconLookup={reconLookup} isZh={isZh} />
        )}
      </Suspense>
    </div>
  );
}
