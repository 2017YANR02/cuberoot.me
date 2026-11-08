'use client';
import '@/components/wca-stats/wca-stats-tabs.css';

// 成绩 tab:按项目 / 按比赛 子切换 + 项目图标条(在按项目模式下).

import { useQueryStates, parseAsString } from 'nuqs';
import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { tr } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import { AttemptRanksToggle } from './AttemptRanksToggle';
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import { mergePersonLive } from '@/lib/person-live-merge';
import type { ReconAttemptInfo } from '@/lib/recon-attempt-lookup';

// 默认子视图不再串行请求第二层 chunk；其他视图仍按需加载。
import ByEventView from './ByEventView';
import { ContentSkeleton } from '@/components/ContentSkeleton';

const ByCompList = lazy(() => import('./ByCompList'));
const CompsTab = lazy(() => import('../CompsTab'));

interface Props {
  profile: WcaPersonProfile;
  femaleRecordLookup: ReadonlyMap<string, string>;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  liveResults?: WcaResultRow[] | null;
  liveComps?: WcaCompetition[] | null;
  reconLookup: Map<string, ReconAttemptInfo> | null;
  isZh: boolean;
}

type Sub = 'event' | 'comp';

export default function ResultsTab({ profile, results, comps, liveResults, liveComps, reconLookup, isZh, femaleRecordLookup }: Props) {
  const t = useT();
  // 「详细成绩」逐把 PR 名次角标的显示开关(默认开;开关 UI 在各视图「全部成绩」标题右侧)。
  const [showAttemptRanks, setShowAttemptRanks] = useState(true);
  // 「成绩」默认开启；关闭后显示紧凑赛事列表。
  const [compView, setCompView] = useState<'results' | 'list'>('results');
  // 比赛视图的工具(# PR 名次)由本组件统一渲染,与成绩开关同一行;ByCompList 自带的工具行不再
  // 渲染(不传 onToggle* 回调即隐藏)。编辑改由点成绩弹窗内做(无全局编辑模式 / 铅笔)。
  // 子 tab(按项目 / 按比赛)+ 选中项目均为页内瞬时态 → replace,不堆历史
  const [q, setQ] = useQueryStates(
    { sub: parseAsString, event: parseAsString },
    { history: 'replace', scroll: false },
  );
  // 成绩内部切换分组方式；沿用 ?sub=，兼容现有按比赛深链。
  const rawSub = (q.sub ?? 'event').toLowerCase();
  const sub: Sub = rawSub === 'comp' ? 'comp' : 'event';

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
      <div className="wp-comp-subtoggle">
        <div className="wca-stats-tab-bar wca-stats-tab-bar-connected" role="group" aria-label={t('成绩分组', 'Group results')}>
          <button type="button" className={`wca-stats-tab${sub === 'event' ? ' active' : ''}`}
            aria-pressed={sub === 'event'} onClick={() => setQ({ sub: null })}>
            {t('按项目', 'By event')}
          </button>
          <button type="button" className={`wca-stats-tab${sub === 'comp' ? ' active' : ''}`}
            aria-pressed={sub === 'comp'} onClick={() => setQ({ sub: 'comp' })}>
            {t('按比赛', 'By competition')}
          </button>
        </div>
        {sub === 'comp' && <>
          <BoolToggle
            label={t('成绩', 'Results')}
            value={compView === 'results'}
            onChange={show => setCompView(show ? 'results' : 'list')}
          />
          <AppLink
            href={`/wca/competition_streaks?q=${encodeURIComponent(profile.person.wca_id)}`}
            prefetch={false}
            className="btn-secondary"
          >
            {tr({ zh: '特种兵', en: 'Competition streaks' })}
          </AppLink>
          {compView === 'results' && (
            <span className="wp-section-h-tools">
              <AttemptRanksToggle active={showAttemptRanks} onToggle={() => setShowAttemptRanks((v) => !v)} />
            </span>
          )}
        </>}
        {sub === 'event' && eventIds.length > 0 && (
          <div className="wp-event-strip wp-event-strip-tabs">
            {eventIds.map((eid) => (
              <button
                key={eid}
                type="button"
                className={`wp-event-tab ${eid === activeEvent ? 'is-active' : ''}`}
                onClick={() => setEvent(eid)}
                title={eid}
              >
                <EventIcon event={eid} className="wp-event-icon-md" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Suspense fallback={<ContentSkeleton variant="table" />}>
        {sub === 'event' && (
          <ByEventView
            profile={profile}
            femaleRecordLookup={femaleRecordLookup}
            results={mResults}
            comps={mComps}
            reconLookup={reconLookup}
            eventId={activeEvent}
            isZh={isZh}
            showAttemptRanks={showAttemptRanks}
            onToggleAttemptRanks={() => setShowAttemptRanks((v) => !v)}
          />
        )}
        {sub === 'comp' && compView === 'results' && (
          <ByCompList wcaId={profile.person.wca_id} personName={profile.person.name} personCountry={profile.person.country_iso2} results={mResults} comps={mComps} reconLookup={reconLookup} isZh={isZh} showAttemptRanks={showAttemptRanks} femaleRecordLookup={femaleRecordLookup} />
        )}
        {sub === 'comp' && compView === 'list' && (
          <CompsTab profile={profile} results={mResults} comps={mComps} isZh={isZh} />
        )}
      </Suspense>
    </div>
  );
}
