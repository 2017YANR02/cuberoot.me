'use client';
// 选手页 5-tab 容器:成绩 / 赛事 / 项目统计 / 里程碑 / 点亮城市.
// URL 通过 ?tab= 持久化.

import { useQueryState, parseAsStringEnum } from 'nuqs';
import { Suspense, lazy } from 'react';
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';

const ResultsTab = lazy(() => import('./results/ResultsTab'));
const CompsTab = lazy(() => import('./CompsTab'));
const EventStatsTab = lazy(() => import('./EventStatsTab'));
const MilestonesTab = lazy(() => import('./MilestonesTab'));
const LitCitiesTab = lazy(() => import('./LitCitiesTab'));
const MiscTab = lazy(() => import('./MiscTab'));

type TabKey = 'results' | 'comps' | 'events' | 'milestones' | 'cities' | 'misc';
const TAB_KEYS: TabKey[] = ['results', 'comps', 'events', 'milestones', 'cities', 'misc'];

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  /** 直播·非官方成绩 + 对应比赛元数据(仅成绩 tab 用,不进其它 tab / PR 表) */
  liveResults?: WcaResultRow[] | null;
  liveComps?: WcaCompetition[] | null;
  reconLookup: Map<string, number> | null;
  isZh: boolean;
}

export default function PersonTabs({ profile, results, comps, liveResults, liveComps, reconLookup, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  // tab 切换 push 进历史 → 后退能在选手页 tab 间返回(nuqs 自动同步,无需手写 popstate)
  const [active, setActive] = useQueryState(
    'tab',
    parseAsStringEnum<TabKey>(TAB_KEYS).withDefault('results').withOptions({ history: 'push' }),
  );

  const labels: Record<TabKey, string> = {
    results: t('成绩', 'Results'),
    comps: t('赛事', 'Competitions'),
    events: t('项目统计', 'Event Stats'),
    milestones: t('里程碑', 'Milestones'),
    cities: t('点亮城市', 'Cities'),
    misc: t('杂项', 'Misc'),
  };

  return (
    <section className="wp-card wp-tabs-card">
      <div className="wp-tabs-bar">
        {TAB_KEYS.map((k) => (
          <button
            key={k}
            className={`wp-tab-btn ${k === active ? 'is-active' : ''}`}
            onClick={() => setActive(k)}
          >
            {labels[k]}
          </button>
        ))}
      </div>
      <div className="wp-tab-body">
        <Suspense fallback={<div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>}>
          {active === 'results' && <ResultsTab profile={profile} results={results} comps={comps} liveResults={liveResults} liveComps={liveComps} reconLookup={reconLookup} isZh={isZh} />}
          {active === 'comps' && <CompsTab profile={profile} results={results} comps={comps} isZh={isZh} />}
          {active === 'events' && <EventStatsTab results={results} comps={comps} isZh={isZh} />}
          {active === 'milestones' && <MilestonesTab profile={profile} results={results} comps={comps} isZh={isZh} />}
          {active === 'cities' && <LitCitiesTab profile={profile} comps={comps} isZh={isZh} />}
          {active === 'misc' && <MiscTab profile={profile} comps={comps} isZh={isZh} />}
        </Suspense>
      </div>
    </section>
  );
}
