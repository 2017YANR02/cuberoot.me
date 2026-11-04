'use client';

import { selectCurrentRecords } from '@cuberoot/shared/wca-records';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { WcaStatView } from '@/components/wca-stats/WcaStatView';
import { WR_METRICS, RANK_TYPE_IDS } from '@/lib/wr-metrics';
import PageHeading from '@/components/PageHeading';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { WcaGenderSelect } from '@/components/wca-stats/WcaGenderSelect';
import WcaEventSelector from '@/components/WcaEventSelector';
import { EventIcon } from '@/components/EventIcon';
import { loadFlagData } from '@/lib/country-flags';
import { statsUrl } from '@/lib/stats-base';
import { countryName } from '@/lib/country-name';
import { eventDisplayName } from '@/lib/wca-events';
import { RegionPicker } from '@/components/RegionPicker';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import {
  WcaRecordRowsTable,
  type WcaRecordRowsTableRow,
} from '@/components/wca-records/WcaRecordRowsTable';
import '@/app/[lang]/wca/_wca_stats_extra.css';
import '@/app/[lang]/wca/_records.css';
import '@/components/wca-stats/wca-stats-controls.css';
import { tr } from '@/i18n/tr';
import { useWcaTeachers } from '@/components/WcaTeacherCell';
import { LoadingIndicator } from '@/components/LoadingIndicator';
const SorCensus = dynamic(() => import('@/components/wca-stats/SorCensus'), {
  ssr: false,
  loading: () => <div className="wse-state"><LoadingIndicator /></div>,
});

interface Row extends WcaRecordRowsTableRow { cc: string }

interface Bundle { updated: string; rows: Row[] }

const CONTINENT_SLUGS = new Set(['africa', 'asia', 'europe', 'northAmerica', 'oceania', 'southAmerica']);

function regionUrl(region: string, gender: 'all' | 'm' | 'f'): string {
  if (gender !== 'all') {
    const base = `/stats/records/history/gender/${gender}`;
    if (CONTINENT_SLUGS.has(region)) return `${base}/continent/${region}.json`;
    if (region === 'world' || region === '') return `${base}/world.json`;
    return `${base}/country/${region.toUpperCase()}.json`;
  }
  if (region === 'world' || region === '') return '/stats/records/history/world.json';
  if (CONTINENT_SLUGS.has(region)) return `/stats/records/history/continent/${region}.json`;
  return `/stats/records/history/country/${region.toUpperCase()}.json`;
}

type Show = 'current' | 'history' | 'mixed';

/** Both routes use the same records, tables and filters throughout migration. */
export default function RecordsView({ embedded = false, leadingControls }: { embedded?: boolean; leadingControls?: ReactNode }) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const sorLabel = tr({ zh: '名次和', en: 'Sum of ranks' });
  const [q, setQ] = useQueryStates(
    {
      show: parseAsString,
      region: parseAsString,
      event: parseAsString,
      gender: parseAsString,
      metric: parseAsString,
      events: parseAsString,
    },
    {
      history: 'replace', scroll: false,
      // Ranking's show/events/gender must survive a round trip through Records.
      urlKeys: embedded ? { show: 'rshow', region: 'rregion', event: 'revent', gender: 'rgender', metric: 'rtype' } : undefined,
    },
  );

  const metric = WR_METRICS.some(m => m.id === q.metric) ? q.metric! : 'both';
  const derived = metric !== 'both' && !RANK_TYPE_IDS.has(metric);
  const requestedShow: Show = q.show === 'mixed' ? 'mixed' : q.show === 'history' ? 'history' : 'current';
  const show: Show = derived && requestedShow === 'current' ? 'history' : requestedShow;
  const region = q.region || 'world';
  // Legacy SOR links used events=all without a separate record scope.
  // Explicit revent=all now means ordinary records for all events.
  const sorScope = !derived && (q.event === 'sor' || (
    embedded && !q.event && q.events === 'all' && show !== 'current'
  ));
  const event = q.event === 'all' || q.event === 'sor' || sorScope ? '' : q.event || '';
  const gender: 'all' | 'm' | 'f' = q.gender === 'm' || q.gender === 'f' ? q.gender : 'all';
  const canShowHistoryDetails = !sorScope && !derived && show !== 'current' && region === 'world' && gender === 'all' && metric !== 'both';

  const update = (k: string, v: string) => {
    setQ({ [k]: v || null } as Parameters<typeof setQ>[0]);
  };

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<{ countries: string[] } | null>(null);
  const [genderManifest, setGenderManifest] = useState<{ countries: Record<'m' | 'f', string[]> } | null>(null);

  useEffect(() => { void loadFlagData(); }, []);

  useEffect(() => {
    fetch(statsUrl('/stats/records/history/manifest.json'))
      .then(r => r.ok ? r.json() : null)
      .then((j) => { if (j) setManifest({ countries: j.countries }); })
      .catch(() => { /* keep null */ });
    fetch(statsUrl('/stats/records/history/gender/manifest.json'))
      .then(r => r.ok ? r.json() : null)
      .then((j) => { if (j) setGenderManifest({ countries: j.countries }); })
      .catch(() => { /* keep null */ });
  }, []);

  const manifestCountriesSorted = useMemo(() => {
    const countries = gender === 'all' ? manifest?.countries : genderManifest?.countries[gender];
    if (!countries) return [];
    const collator = new Intl.Collator((i18n.language.startsWith('zh') ? 'zh-Hans-CN' : 'en'), { sensitivity: 'base' });
    return [...countries].sort((a, b) => collator.compare(countryName(a, isZh), countryName(b, isZh)));
  }, [manifest, genderManifest, gender, isZh, i18n.language]);

  useEffect(() => {
    if (sorScope) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setBundle(null);
    fetch(statsUrl(regionUrl(region, gender)), { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: Bundle) => { if (!controller.signal.aborted) setBundle(j); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [region, gender, sorScope]);

  // 选中地区在新性别下没有纪录时,回到世界;等待 manifest 加载后再判断深链.
  useEffect(() => {
    if (!sorScope && !derived && gender !== 'all' && genderManifest && region !== 'world'
      && !CONTINENT_SLUGS.has(region)
      && !genderManifest.countries[gender].includes(region.toUpperCase())) {
      setQ({ region: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, genderManifest, region, derived, sorScope]);

  const visibleRows = useMemo(() => {
    if (sorScope || !bundle) return [];
    const rows = bundle.rows.filter(r => (!event || r.e === event) && (metric === 'both' || derived || r.t === (metric === 'single' ? 's' : 'a')));
    return gender === 'f' ? rows.map(r => ({ ...r, l: `F${r.l}` })) : rows;
  }, [bundle, event, gender, metric, derived, sorScope]);

  const availableEvents = useMemo(() => {
    if (sorScope) return new Set(ALL_EVENT_IDS);
    if (!bundle) return new Set<string>();
    return new Set(bundle.rows.map(r => r.e));
  }, [bundle, sorScope]);

  // A single event/type has nothing to interleave. Single + average still has
  // two groups, even when only one event is selected.
  const canArrangeHistory = !sorScope && show !== 'current' && (derived
    ? !event && region === 'world' && gender === 'all'
    : !loading && new Set(visibleRows.map(r => `${r.e}:${r.t}`)).size > 1);

  // 「当前」视图:每个 (项目, 类型) 在该区域的现行纪录 = 历史进程里成绩最好(v 最小)的那行;
  // 并列(同值多人)全列,按日期升序 —— 与 wr_current 当前世界纪录页的并列处理一致。
  // 区域选择器决定口径:world → 当前世界纪录,某洲 → 当前大洲纪录,某国 → 当前国家纪录。
  const currentRows = useMemo(() => {
    if (show !== 'current') return [];
    return selectCurrentRecords(visibleRows);
  }, [visibleRows, show]);

  const grouped = useMemo(() => {
    if (show !== 'history') return null;
    const map = new Map<string, Row[]>();
    for (const r of visibleRows) {
      const arr = map.get(r.e) ?? [];
      arr.push(r);
      map.set(r.e, arr);
    }
    return ALL_EVENT_IDS
      .filter(id => map.has(id))
      .map(id => {
        const rows = map.get(id)!;
        const singles = rows.filter(r => r.t === 's');
        const averages = rows.filter(r => r.t === 'a');
        return { event: id, rows: [...singles, ...averages] };
      });
  }, [visibleRows, show]);

  const teacherStudentIds = useMemo(
    () => derived ? [] : (show === 'current' ? currentRows : visibleRows).map((row) => row.p),
    [derived, show, currentRows, visibleRows],
  );
  const teacherEventIds = useMemo(
    () => derived ? [] : (show === 'current' ? currentRows : visibleRows).map((row) => row.e),
    [derived, show, currentRows, visibleRows],
  );
  const teacherDirectory = useWcaTeachers(teacherStudentIds, teacherEventIds);

  return (
    <div className={embedded ? "records-page" : "wse-page records-page"}>
      {!embedded && <header className="wse-header">
        <PageHeading backHref="/wca">{tr({ zh: '纪录', en: 'Records'
        })}</PageHeading>
      </header>}

      <div className="records-toolbar">
        <WcaEventSelector presentation="inline" availableEvents={availableEvents}
          selectedEvent={sorScope ? 'sor' : event}
          appendEvents={[{ id: 'sor', iconClass: '', textLabel: sorLabel, label: sorLabel }]}
          onSelect={v => setQ({ event: v || 'all', ...(v === 'sor'
            ? { show: 'history', ...(derived ? { metric: 'single' } : {}) } : {}) })}
          isZh={isZh} allowAll />
        <div className="records-toolbar-row wca-stats-controls">
          <div className="wse-filter">
            <select aria-label={tr({ zh: '类型', en: 'Type' })} className="wse-filter-select" value={metric} onChange={e => update('metric', e.target.value)}>
              <option value="both">{tr({ zh: '单次及平均', en: 'Single and average' })}</option>
              {WR_METRICS.filter(m => !sorScope || RANK_TYPE_IDS.has(m.id)).map(m => <option key={m.id} value={m.id}>{tr({ zh: m.zh, en: m.en })}</option>)}
            </select>
          </div>
          <RegionPicker value={region} isZh={isZh} restrictTo={manifestCountriesSorted}
            onChange={v => update('region', v)} />
          <WcaGenderSelect className="records-toolbar-select" value={gender}
            onChange={v => update('gender', v === 'all' ? '' : v)} />
          {leadingControls}
          {!sorScope && !derived && <div className="wca-stats-tab-bar wca-stats-tab-bar-connected"
            role="group" aria-label={tr({ zh: '纪录范围', en: 'Record scope' })}>
            <button type="button" className={`wca-stats-tab${show === 'current' ? ' active' : ''}`}
              aria-pressed={show === 'current'} onClick={() => update('show', 'current')}>
              {tr({ zh: '当前', en: 'Current' })}
            </button>
            <button type="button" className={`wca-stats-tab${show !== 'current' ? ' active' : ''}`}
              aria-pressed={show !== 'current'}
              onClick={() => update('show', requestedShow === 'mixed' ? 'mixed' : 'history')}>
              {tr({ zh: '历史', en: 'History' })}
            </button>
          </div>}
          {canArrangeHistory && <label className="wse-filter">
            <span>{tr({ zh: '排列', en: 'Layout' })}</span>
            <select className="wse-filter-select" value={show === 'mixed' ? 'mixed' : 'history'}
              onChange={e => update('show', e.target.value)}>
              <option value="history">{tr({ zh: '分组', en: 'Grouped' })}</option>
              <option value="mixed">{tr({ zh: '混合', en: 'Mixed' })}</option>
            </select>
          </label>}
        </div>
      </div>

      {sorScope && region === 'world' && gender === 'all' && (
        <>
          {(metric === 'single' || metric === 'both') && <SorCensus type="single" />}
          {(metric === 'average' || metric === 'both') && <SorCensus type="average" />}
        </>
      )}

      {sorScope && (region !== 'world' || gender !== 'all') && <p role="status" className="wse-state">{tr({
        zh: '项目组合名次和年度统计仅提供全球、不限性别的数据。',
        en: 'Annual event-combination sum-of-ranks statistics are only available worldwide with all genders.',
      })}</p>}

      {derived && (region !== 'world' || gender !== 'all') && <p role="status" className="wse-state">{tr({
        zh: '该指标暂无此地区或性别的纪录数据。可选择全部区域、不限性别查看已有全球纪录历史。',
        en: 'Records for this metric are unavailable for this region or gender. Select all regions and genders to view the existing world record history.',
      })}</p>}
      {derived && region === 'world' && gender === 'all' && <>
        <p className="wca-stats-note">{tr({
          zh: '该指标目前提供全球纪录历史；当前纪录及其全部并列成绩尚无完整原始数据。',
          en: 'World record history is available for this metric; complete raw data for current records and all ties is not yet available.',
        })}</p>
        <WcaStatView statId="wr_metric" headerMode="note" urlScope="m"
          metricId={metric} eventId={event} hideEventSelector panelId="history" panelNavigation={false}
          historyLayout={show === 'mixed' ? 'mixed' : 'grouped'} />
      </>}
      {canShowHistoryDetails && <WcaStatView statId="wr_metric" headerMode="none" urlScope="m"
        metricId={metric} eventId={event} hideEventSelector panelId="history" panelNavigation={false}
        historyLayout={show === 'mixed' ? 'mixed' : 'grouped'} />}

      {!sorScope && !derived && !canShowHistoryDetails && <div className="wse-table-wrapper sticky-scroll">
        {loading && <div className="wse-state"><LoadingIndicator>{tr({ zh: '加载中...', en: 'Loading...'
        })}</LoadingIndicator></div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {bundle && !loading && (
          <>
            {visibleRows.length === 0 && (
              <div className="wse-state">{tr({ zh: '该区域 / 项目暂无纪录', en: 'No records for this region / event'
            })}</div>
            )}

            {show === 'current' && currentRows.length > 0 && (
              <WcaRecordRowsTable rows={currentRows} isZh={isZh} showEvent={!event} showRank={false} teacherDirectory={teacherDirectory} />
            )}

            {show === 'history' && grouped && grouped.map(g => (
              <section key={g.event} className="records-event-group">
                {!event && (
                  <h2 className="records-event-h2">
                    <EventIcon event={g.event} />
                    <span>{eventDisplayName(g.event, isZh)}</span>
                  </h2>
                )}
                <WcaRecordRowsTable rows={g.rows} isZh={isZh} showEvent={false} teacherDirectory={teacherDirectory} />
              </section>
            ))}

            {show === 'mixed' && visibleRows.length > 0 && (
              <WcaRecordRowsTable rows={visibleRows} isZh={isZh} showEvent={!event} teacherDirectory={teacherDirectory} />
            )}
          </>
        )}
      </div>}
    </div>
  );
}
