'use client';
// 选手页 5-tab 容器:成绩 / 赛事 / 项目统计 / 里程碑 / 点亮城市.
// URL 通过 ?tab= 持久化.

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Suspense, lazy, useCallback } from 'react';
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';

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
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = (sp?.get('tab') ?? 'results').toLowerCase();
  const active: TabKey = (TAB_KEYS as string[]).includes(raw) ? (raw as TabKey) : 'results';

  const setActive = useCallback((k: TabKey) => {
    const next = new URLSearchParams(sp?.toString() ?? '');
    next.set('tab', k);
    router.replace(`${pathname}?${next.toString()}`);
  }, [pathname, router, sp]);

  const labels: Record<TabKey, string> = {
    results: t('成绩', 'Results'),
    comps: t('赛事', 'Competitions'),
    events: t('项目统计', 'Event Stats'),
    milestones: t('里程碑', 'Milestones'),
    cities: t('点亮城市', 'Cities'),
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
