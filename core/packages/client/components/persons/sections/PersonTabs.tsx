'use client';
// 选手页 5-tab 容器:成绩 / 赛事 / 项目统计 / 里程碑 / 点亮城市.
// URL 通过 ?tab= 持久化.

import { useQueryState, parseAsStringEnum } from 'nuqs';
import { Suspense, lazy, Fragment, useState, useMemo, useEffect } from 'react';
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import { fetchWcaPersonChampionshipPodiums, type ChampionshipPodiumRow } from '@/lib/wca-person-api';
import type { ReconAttemptInfo } from '@/lib/recon-attempt-lookup';

const ResultsTab = lazy(() => import('./results/ResultsTab'));
const RecordsTab = lazy(() => import('./RecordsTab'));
const ChampionshipPodiumsTab = lazy(() => import('./ChampionshipPodiumsTab'));
const EventStatsTab = lazy(() => import('./EventStatsTab'));
const MilestonesTab = lazy(() => import('./MilestonesTab'));
const LitCitiesTab = lazy(() => import('./LitCitiesTab'));
const MiscTab = lazy(() => import('./MiscTab'));

type TabKey = 'results' | 'records' | 'podiums' | 'events' | 'milestones' | 'cities' | 'misc';
const TAB_KEYS: TabKey[] = ['results', 'records', 'podiums', 'events', 'milestones', 'cities', 'misc'];

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  /** 直播·非官方成绩 + 对应比赛元数据(仅成绩 tab 用,不进其它 tab / PR 表) */
  liveResults?: WcaResultRow[] | null;
  liveComps?: WcaCompetition[] | null;
  reconLookup: Map<string, ReconAttemptInfo> | null;
  isZh: boolean;
}

export default function PersonTabs({ profile, results, comps, liveResults, liveComps, reconLookup, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  // tab 切换 push 进历史 → 后退能在选手页 tab 间返回(nuqs 自动同步,无需手写 popstate)
  const [active, setActive] = useQueryState(
    'tab',
    parseAsStringEnum<TabKey>(TAB_KEYS).withDefault('results').withOptions({ history: 'push' }),
  );
  // 成绩 tab 的「按项目 / 按比赛」子视图开关 —— 与 ResultsTab 共享同一个 ?sub= 参数(nuqs 自动同步)。
  // 「成绩」本身=按项目视图;右侧「比赛」是同款主 tab(sub=comp),点「成绩」回到 sub=event。
  const [sub, setSub] = useQueryState(
    'sub',
    parseAsStringEnum(['event', 'comp']).withDefault('event').withOptions({ history: 'replace', scroll: false }),
  );

  // 内容为空的 tab 置灰提示。纪录从 results 的区域纪录标记直接判定(无需进 tab,可前置置灰)。
  const recordsEmpty = useMemo(
    () => !!results && !results.some((r) => !r.live && (r.regional_single_record || r.regional_average_record)),
    [results],
  );

  // 锦标赛领奖台数据后端预计算(资格内重排)、客户端拿不到可靠代理(profile.medals 口径不同),
  // 故在容器层预取一次:无领奖台 → 整个 tab 不出现(不是置灰);有则把 rows 直接喂给 tab,免二次请求。
  const [podiumRows, setPodiumRows] = useState<ChampionshipPodiumRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPodiumRows(null);
    fetchWcaPersonChampionshipPodiums(profile.person.wca_id)
      .then((r) => { if (!cancelled) setPodiumRows(r); })
      .catch(() => { if (!cancelled) setPodiumRows([]); });
    return () => { cancelled = true; };
  }, [profile.person.wca_id]);
  const hasPodiums = (podiumRows?.length ?? 0) > 0;

  // 领奖台未加载完(null)前先不显示按钮;加载完无数据则永久隐藏。其余 tab 恒显。
  const visibleTabs = useMemo<TabKey[]>(
    () => TAB_KEYS.filter((k) => k !== 'podiums' || hasPodiums),
    [hasPodiums],
  );
  // URL 指向已隐藏的 tab(深链 ?tab=podiums 但无数据,或加载中)→ 回退到成绩。
  const effectiveActive: TabKey = visibleTabs.includes(active) ? active : 'results';
  const tabEmpty = (k: TabKey): boolean => k === 'records' && recordsEmpty;

  const labels: Record<TabKey, string> = {
    results: t('成绩', 'Results'),
    records: t('纪录', 'Records'),
    podiums: t('锦标赛领奖台', 'Championship Podiums'),
    events: t('项目统计', 'Event Stats'),
    milestones: t('里程碑', 'Milestones'),
    cities: t('点亮城市', 'Cities'),
    misc: t('杂项', 'Misc'),
  };

  return (
    <section className="wp-card wp-tabs-card">
      <div className="wp-tabs-bar">
        {visibleTabs.map((k) => (
          <Fragment key={k}>
            <button
              className={`wp-tab-btn ${k === effectiveActive && !(k === 'results' && sub === 'comp') ? 'is-active' : ''} ${tabEmpty(k) ? 'wp-tab-btn--empty' : ''}`}
              disabled={tabEmpty(k)}
              onClick={() => { setActive(k); if (k === 'results') setSub('event'); }}
            >
              {labels[k]}
            </button>
            {k === 'results' && (
              <button
                type="button"
                className={`wp-tab-btn ${effectiveActive === 'results' && sub === 'comp' ? 'is-active' : ''}`}
                onClick={() => { setActive('results'); setSub('comp'); }}
              >{t('比赛', 'Comp')}</button>
            )}
          </Fragment>
        ))}
      </div>
      <div className="wp-tab-body">
        <Suspense fallback={<div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>}>
          {effectiveActive === 'results' && <ResultsTab profile={profile} results={results} comps={comps} liveResults={liveResults} liveComps={liveComps} reconLookup={reconLookup} isZh={isZh} />}
          {effectiveActive === 'records' && <RecordsTab profile={profile} results={results} comps={comps} isZh={isZh} />}
          {effectiveActive === 'podiums' && hasPodiums && <ChampionshipPodiumsTab rows={podiumRows!} isZh={isZh} />}
          {effectiveActive === 'events' && <EventStatsTab results={results} comps={comps} isZh={isZh} />}
          {effectiveActive === 'milestones' && <MilestonesTab profile={profile} results={results} comps={comps} isZh={isZh} />}
          {effectiveActive === 'cities' && <LitCitiesTab profile={profile} comps={comps} isZh={isZh} />}
          {effectiveActive === 'misc' && <MiscTab profile={profile} comps={comps} isZh={isZh} />}
        </Suspense>
      </div>
    </section>
  );
}
