'use client';
// 选手页 5-tab 容器:成绩 / 赛事 / 项目统计 / 里程碑 / 点亮城市.
// URL 通过 ?tab= 持久化.

import { useQueryState, parseAsStringEnum } from 'nuqs';
import { Suspense, lazy } from 'react';
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import i18n from "@/i18n/i18n-client";

const ResultsTab = lazy(() => import('./results/ResultsTab'));
const CompsTab = lazy(() => import('./CompsTab'));
const EventStatsTab = lazy(() => import('./EventStatsTab'));
const MilestonesTab = lazy(() => import('./MilestonesTab'));
const LitCitiesTab = lazy(() => import('./LitCitiesTab'));

type TabKey = 'results' | 'comps' | 'events' | 'milestones' | 'cities';
const TAB_KEYS: TabKey[] = ['results', 'comps', 'events', 'milestones', 'cities'];

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  reconLookup: Map<string, number> | null;
  isZh: boolean;
}

export default function PersonTabs({ profile, results, comps, reconLookup, isZh }: Props) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  // tab 切换 push 进历史 → 后退能在选手页 tab 间返回(nuqs 自动同步,无需手写 popstate)
  const [active, setActive] = useQueryState(
    'tab',
    parseAsStringEnum<TabKey>(TAB_KEYS).withDefault('results').withOptions({ history: 'push' }),
  );

  const labels: Record<TabKey, string> = {
    results: t('成绩', 'Results', "成績"),
    comps: t('赛事', 'Competitions', "賽事"),
    events: t('项目统计', 'Event Stats', "項目統計"),
    milestones: t('里程碑', 'Milestones'),
    cities: t('点亮城市', 'Cities', "點亮城市"),
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
        <Suspense fallback={<div className="wp-loading-inline">{t('加载中…', 'Loading…', "載入中…")}</div>}>
          {active === 'results' && <ResultsTab profile={profile} results={results} comps={comps} reconLookup={reconLookup} isZh={isZh} />}
          {active === 'comps' && <CompsTab profile={profile} results={results} comps={comps} isZh={isZh} />}
          {active === 'events' && <EventStatsTab results={results} comps={comps} isZh={isZh} />}
          {active === 'milestones' && <MilestonesTab profile={profile} results={results} comps={comps} isZh={isZh} />}
          {active === 'cities' && <LitCitiesTab profile={profile} comps={comps} isZh={isZh} />}
        </Suspense>
      </div>
    </section>
  );
}
