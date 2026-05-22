// 成绩 tab:按项目 / 按比赛 子切换 + 项目图标条(在按项目模式下).

import { useSearchParams } from 'react-router-dom';
import { Suspense, lazy, useMemo } from 'react';
import { ALL_EVENT_IDS } from '../../../event_constants';
import { EventIcon } from '../../../../../components/EventIcon';
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '../../wca_api';

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
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [sp, setSp] = useSearchParams();
  const rawSub = (sp.get('sub') ?? 'event').toLowerCase();
  const sub: Sub = rawSub === 'comp' ? 'comp' : 'event';
  const setSub = (s: Sub) => {
    const next = new URLSearchParams(sp);
    next.set('sub', s);
    setSp(next, { replace: true });
  };

  const eventIds = useMemo(() => {
    const set = new Set<string>();
    if (results) for (const r of results) set.add(r.event_id);
    return ALL_EVENT_IDS.filter((eid) => set.has(eid));
  }, [results]);

  const rawEv = (sp.get('event') ?? '').toLowerCase();
  const activeEvent = eventIds.includes(rawEv) ? rawEv : (eventIds[0] ?? '333');
  const setEvent = (eid: string) => {
    const next = new URLSearchParams(sp);
    next.set('event', eid);
    setSp(next, { replace: true });
  };

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
