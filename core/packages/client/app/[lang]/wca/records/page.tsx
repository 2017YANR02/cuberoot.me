'use client';

// Ported from packages/client-vite/src/pages/wca_stats/RecordsPage.tsx.
import { Suspense, useEffect, useMemo, useState } from 'react';
import HomeLink from '@/components/HomeLink';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Mars, Venus } from 'lucide-react';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';
import { EventIcon } from '@/components/EventIcon';
import { loadFlagData } from '@/lib/country-flags';
import { statsUrl } from '@/lib/stats-base';
import { countryName } from '@/lib/country-name';
import { eventDisplayName } from '@/lib/wca-events';
import { RegionPicker } from '@/components/RegionPicker';
import { ListSelect } from '@/components/ListSelect';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import {
  WcaRecordRowsTable,
  type WcaRecordRowsTableRow,
} from '@/components/wca-records/WcaRecordRowsTable';
import '../_wca_stats_extra.css';
import '../_records.css';
import { tr } from '@/i18n/tr';
import { useWcaTeachers } from '@/components/WcaTeacherCell';

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

function RecordsPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [q, setQ] = useQueryStates(
    {
      show: parseAsString,
      region: parseAsString,
      event: parseAsString,
      gender: parseAsString,
    },
    { history: 'replace', scroll: false },
  );

  const show: Show = q.show === 'mixed' ? 'mixed' : q.show === 'history' ? 'history' : 'current';
  const region = q.region || 'world';
  const event = q.event || '';
  const gender: 'all' | 'm' | 'f' = q.gender === 'm' || q.gender === 'f' ? q.gender : 'all';

  useEffect(() => {
    if (q.show !== 'current' && q.show !== 'history' && q.show !== 'mixed') {
      setQ({ show: 'current' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.show]);

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
  }, [region, gender]);

  // 选中地区在新性别下没有纪录时,回到世界;等待 manifest 加载后再判断深链.
  useEffect(() => {
    if (gender !== 'all' && genderManifest && region !== 'world'
      && !CONTINENT_SLUGS.has(region)
      && !genderManifest.countries[gender].includes(region.toUpperCase())) {
      setQ({ region: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, genderManifest, region]);

  const visibleRows = useMemo(() => {
    if (!bundle) return [];
    const rows = event ? bundle.rows.filter(r => r.e === event) : bundle.rows;
    return gender === 'f' ? rows.map(r => ({ ...r, l: `F${r.l}` })) : rows;
  }, [bundle, event, gender]);

  const availableEvents = useMemo(() => {
    if (!bundle) return new Set<string>();
    return new Set(bundle.rows.map(r => r.e));
  }, [bundle]);

  const eventPickerGroups = useMemo<readonly PuzzlePickerGroup[]>(() => [{
    id: 'wca',
    label: tr({ zh: 'WCA 项目', en: 'WCA events' }),
    items: [
      { id: '', label: tr({ zh: '全部', en: 'All' }), textLabel: tr({ zh: '全', en: 'All' }) },
      ...ALL_EVENT_IDS.filter(id => availableEvents.has(id)).map(id => ({
        id,
        label: eventDisplayName(id, isZh),
        iconClass: `event-${id}`,
      })),
    ],
  }], [availableEvents, isZh]);

  // 「当前」视图:每个 (项目, 类型) 在该区域的现行纪录 = 历史进程里成绩最好(v 最小)的那行;
  // 并列(同值多人)全列,按日期升序 —— 与 wr_current 当前世界纪录页的并列处理一致。
  // 区域选择器决定口径:world → 当前世界纪录,某洲 → 当前大洲纪录,某国 → 当前国家纪录。
  const currentRows = useMemo(() => {
    if (show !== 'current') return [];
    const best = new Map<string, { v: number; rows: Row[] }>();
    for (const r of visibleRows) {
      const k = `${r.e}-${r.t}`;
      const cur = best.get(k);
      if (!cur || r.v < cur.v) best.set(k, { v: r.v, rows: [r] });
      else if (r.v === cur.v) cur.rows.push(r);
    }
    const out: Row[] = [];
    for (const id of ALL_EVENT_IDS) {
      for (const t of ['s', 'a'] as const) {
        const g = best.get(`${id}-${t}`);
        if (g) out.push(...[...g.rows].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)));
      }
    }
    return out;
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
    () => (show === 'current' ? currentRows : visibleRows).map((row) => row.p),
    [show, currentRows, visibleRows],
  );
  const teacherEventIds = useMemo(
    () => (show === 'current' ? currentRows : visibleRows).map((row) => row.e),
    [show, currentRows, visibleRows],
  );
  const teacherDirectory = useWcaTeachers(teacherStudentIds, teacherEventIds);

  return (
    <div className="wse-page records-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <HomeLink className="wse-back">
            <ChevronLeft size={16} /> {tr({ zh: '首页', en: 'Home' })}
          </HomeLink>
        </div>
        <h1>{tr({ zh: '纪录', en: 'Records'
        })}</h1>
        <p className="wse-subtitle">
          {gender !== 'all'
            ? (show === 'current'
              ? tr({ zh: `${gender === 'f' ? '女子' : '男子'}各项目当前的世界 / 大洲 / 国家纪录`, en: `Current ${gender === 'f' ? "women's" : "men's"} world / continental / national record per event` })
              : tr({ zh: `历史上所有${gender === 'f' ? '女子' : '男子'}世界 / 大洲 / 国家纪录`, en: `Every ${gender === 'f' ? "women's" : "men's"} world / continental / national record ever set` }))
            : (show === 'current'
              ? tr({ zh: '各项目当前的世界 / 大洲 / 国家纪录', en: 'Current world / continental / national record for each event' })
              : tr({ zh: '历史上所有曾被打破的世界 / 大洲 / 国家纪录', en: 'Every world / continental / national record ever set' }))}
        </p>
      </header>

      <div className="records-toolbar">
        <div className="records-toolbar-row">
          <PuzzlePicker
            groups={eventPickerGroups}
            selectedEvent={event}
            onSelect={(v) => update('event', v)}
            isZh={isZh}
          />
          <ListSelect
            className="records-toolbar-select"
            items={[
              { value: 'current', label: tr({ zh: '当前', en: 'Current' }) },
              { value: 'history', label: tr({ zh: '历史', en: 'History' }) },
              { value: 'mixed', label: tr({ zh: '混合', en: 'Mixed' }) },
            ]}
            value={show}
            onChange={(v) => update('show', v)}
            allLabel={tr({ zh: '当前', en: 'Current' })}
            clearable={false}
          />

          <RegionPicker
            value={region}
            isZh={isZh}
            restrictTo={manifestCountriesSorted}
            onChange={(v) => update('region', v)}
          />

          <ListSelect
            className="records-toolbar-select"
            items={[
              { value: 'all', label: tr({ zh: '不限性别', en: 'All genders' }) },
              { value: 'm', label: tr({ zh: '男子', en: 'Male' }), icon: <Mars size={16} /> },
              { value: 'f', label: tr({ zh: '女子', en: 'Female' }), icon: <Venus size={16} /> },
            ]}
            value={gender}
            onChange={(v) => update('gender', v === 'all' ? '' : v)}
            allLabel={tr({ zh: '所有', en: 'All' })}
            clearable={false}
          />
        </div>

      </div>

      <div className="wse-table-wrapper sticky-scroll">
        {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...'
        })}</div>}
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
      </div>
    </div>
  );
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <RecordsPageInner />
    </Suspense>
  );
}
