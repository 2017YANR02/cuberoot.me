'use client';

// Ported from packages/client-vite/src/pages/wca_stats/RecordsPage.tsx.
import { Suspense, useEffect, useMemo, useState } from 'react';
import HomeLink from '@/components/HomeLink';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import WcaEventSelector from '@/components/WcaEventSelector';
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
import {
  WcaTeacherNote,
  useWcaTeachers,
} from '@/components/WcaTeacherCell';

interface Row extends WcaRecordRowsTableRow { cc: string }

interface Bundle { updated: string; rows: Row[] }

const CONTINENT_SLUGS = new Set(['africa', 'asia', 'europe', 'northAmerica', 'oceania', 'southAmerica']);

function regionUrl(region: string, gender: 'all' | 'm' | 'f'): string {
  if (gender !== 'all') {
    // 性别(女子/男子)纪录只做 world + 6 大洲,无国家级 → 非洲名归 world 兜底
    const base = `/stats/records/history/gender/${gender}`;
    if (CONTINENT_SLUGS.has(region)) return `${base}/continent/${region}.json`;
    return `${base}/world.json`;
  }
  if (region === 'world' || region === '') return '/stats/records/history/world.json';
  if (CONTINENT_SLUGS.has(region)) return `/stats/records/history/continent/${region}.json`;
  return `/stats/records/history/country/${region}.json`;
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

  useEffect(() => { void loadFlagData(); }, []);

  useEffect(() => {
    fetch(statsUrl('/stats/records/history/manifest.json'))
      .then(r => r.ok ? r.json() : null)
      .then((j) => { if (j) setManifest({ countries: j.countries }); })
      .catch(() => { /* keep null */ });
  }, []);

  const manifestCountriesSorted = useMemo(() => {
    if (!manifest) return [];
    const collator = new Intl.Collator((i18n.language.startsWith('zh') ? 'zh-Hans-CN' : 'en'), { sensitivity: 'base' });
    return [...manifest.countries].sort((a, b) => collator.compare(countryName(a, isZh), countryName(b, isZh)));
  }, [manifest, isZh]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setBundle(null);
    fetch(statsUrl(regionUrl(region, gender)))
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: Bundle) => setBundle(j))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [region, gender]);

  // 切到性别(女子/男子)纪录时,国家级不存在 → 把残留的国家区域回退到 world
  useEffect(() => {
    if (gender !== 'all' && region !== 'world' && !CONTINENT_SLUGS.has(region)) {
      setQ({ region: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, region]);

  const visibleRows = useMemo(() => {
    if (!bundle) return [];
    return event ? bundle.rows.filter(r => r.e === event) : bundle.rows;
  }, [bundle, event]);

  const availableEvents = useMemo(() => {
    if (!bundle) return new Set<string>();
    return new Set(bundle.rows.map(r => r.e));
  }, [bundle]);

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
              ? tr({ zh: `${gender === 'f' ? '女子' : '男子'}各项目当前的世界 / 大洲纪录`, en: `Current ${gender === 'f' ? "women's" : "men's"} world / continental record per event` })
              : tr({ zh: `历史上所有${gender === 'f' ? '女子' : '男子'}世界 / 大洲纪录`, en: `Every ${gender === 'f' ? "women's" : "men's"} world / continental record ever set` }))
            : (show === 'current'
              ? tr({ zh: '各项目当前的世界 / 大洲 / 国家纪录', en: 'Current world / continental / national record for each event' })
              : tr({ zh: '历史上所有曾被打破的世界 / 大洲 / 国家纪录', en: 'Every world / continental / national record ever set' }))}
        </p>
      </header>

      <div className="records-toolbar">
        <div className="records-toolbar-row">
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
            restrictTo={gender === 'all' ? manifestCountriesSorted : []}
            onChange={(v) => update('region', v)}
          />

          <ListSelect
            className="records-toolbar-select"
            items={[
              { value: 'all', label: tr({ zh: '所有', en: 'All' }) },
              { value: 'm', label: tr({ zh: '男', en: 'Male' }) },
              { value: 'f', label: tr({ zh: '女', en: 'Female' }) },
            ]}
            value={gender}
            onChange={(v) => update('gender', v === 'all' ? '' : v)}
            allLabel={tr({ zh: '所有', en: 'All' })}
            clearable={false}
          />
        </div>

        <WcaEventSelector
          availableEvents={availableEvents}
          selectedEvent={event}
          onSelect={(v) => update('event', v)}
          isZh={isZh}
          allowAll
        />
      </div>

      <WcaTeacherNote />

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
