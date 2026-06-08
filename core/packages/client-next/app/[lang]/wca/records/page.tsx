'use client';

// Ported from packages/client/src/pages/wca_stats/RecordsPage.tsx.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import WcaEventSelector from '@/components/WcaEventSelector';
import { EventIcon } from '@/components/EventIcon';
import { Flag } from '@/components/Flag';
import { loadFlagData } from '@/lib/country-flags';
import { statsUrl } from '@/lib/stats-base';
import { countryName } from '@/lib/country-name';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { eventDisplayName } from '@/lib/wca-events';
import { CompCell } from '@/components/CompCell/CompCell';
import { compLinkProps } from '@/lib/comp-link';
import { RecordBadge } from '@/components/RecordBadge';
import { RegionPicker } from '@/components/RegionPicker';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { formatAttempts } from '../all-results/page';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';
import '../_records.css';

interface Row {
  e: string; t: 's' | 'a'; v: number; l: string;
  p: string; pn: string; pc: string;
  c: string; cn: string; cc: string;
  d: string; a: number[] | null;
}

interface Bundle { updated: string; rows: Row[] }

const CONTINENT_SLUGS = new Set(['africa', 'asia', 'europe', 'northAmerica', 'oceania', 'southAmerica']);

function regionUrl(region: string): string {
  if (region === 'world' || region === '') return '/stats/records/history/world.json';
  if (CONTINENT_SLUGS.has(region)) return `/stats/records/history/continent/${region}.json`;
  return `/stats/records/history/country/${region}.json`;
}

type Show = 'history' | 'mixed';

function RecordsPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('纪录', 'Records');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const show: Show = params.get('show') === 'mixed' ? 'mixed' : 'history';
  const region = params.get('region') || 'world';
  const event = params.get('event') || '';

  useEffect(() => {
    if (params.get('show') !== 'history' && params.get('show') !== 'mixed') {
      const next = new URLSearchParams(params.toString());
      next.set('show', 'history');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const update = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v); else next.delete(k);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
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
    const collator = new Intl.Collator(isZh ? 'zh-Hans-CN' : 'en', { sensitivity: 'base' });
    return [...manifest.countries].sort((a, b) => collator.compare(countryName(a, isZh), countryName(b, isZh)));
  }, [manifest, isZh]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setBundle(null);
    fetch(statsUrl(regionUrl(region)))
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: Bundle) => setBundle(j))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [region]);

  const visibleRows = useMemo(() => {
    if (!bundle) return [];
    return event ? bundle.rows.filter(r => r.e === event) : bundle.rows;
  }, [bundle, event]);

  const availableEvents = useMemo(() => {
    if (!bundle) return new Set<string>();
    return new Set(bundle.rows.map(r => r.e));
  }, [bundle]);

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

  return (
    <div className="wse-page records-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link href={`/wca?lang=${i18n.language}`} className="wse-back">
            <ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}
          </Link>
        </div>
        <h1>{isZh ? '纪录' : 'Records'}</h1>
        <p className="wse-subtitle">
          {isZh
            ? '历史上所有曾被打破的世界 / 大洲 / 国家纪录'
            : 'Every world / continental / national record ever set'}
        </p>
      </header>

      <div className="records-toolbar">
        <div className="records-toolbar-row">
          <div className="records-show-toggle">
            <button
              type="button"
              className={show === 'history' ? 'active' : ''}
              onClick={() => update('show', 'history')}
            >{isZh ? '历史' : 'History'}</button>
            <button
              type="button"
              className={show === 'mixed' ? 'active' : ''}
              onClick={() => update('show', 'mixed')}
            >{isZh ? '混合' : 'Mixed'}</button>
          </div>

          <RegionPicker
            value={region}
            isZh={isZh}
            restrictTo={manifestCountriesSorted}
            onChange={(v) => update('region', v)}
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

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{isZh ? '加载中...' : 'Loading...'}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {bundle && !loading && (
          <>
            {visibleRows.length === 0 && (
              <div className="wse-state">{isZh ? '该区域 / 项目暂无历史纪录' : 'No historical records for this region / event'}</div>
            )}

            {show === 'history' && grouped && grouped.map(g => (
              <section key={g.event} className="records-event-group">
                {!event && (
                  <h2 className="records-event-h2">
                    <EventIcon event={g.event} />
                    <span>{eventDisplayName(g.event, isZh)}</span>
                  </h2>
                )}
                <RowsTable rows={g.rows} isZh={isZh} showEvent={false} />
              </section>
            ))}

            {show === 'mixed' && visibleRows.length > 0 && (
              <RowsTable rows={visibleRows} isZh={isZh} showEvent={!event} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface RowsTableProps {
  rows: Row[];
  isZh: boolean;
  showEvent: boolean;
}

function RowsTable({ rows, isZh, showEvent }: RowsTableProps) {
  const ranks = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.e}-${r.t}`;
      totals.set(k, (totals.get(k) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    const out: number[] = [];
    for (const r of rows) {
      const k = `${r.e}-${r.t}`;
      const s = seen.get(k) ?? 0;
      out.push((totals.get(k) ?? 0) - s);
      seen.set(k, s + 1);
    }
    return out;
  }, [rows]);

  return (
    <table className="wse-table records-table">
      <thead>
        <tr>
          <th>{isZh ? '类型' : 'Type'}</th>
          {showEvent && <th>{isZh ? '项目' : 'Event'}</th>}
          <th className="wse-value-col">{isZh ? '成绩' : 'Result'}</th>
          <th>{isZh ? '选手' : 'Person'}</th>
          <th>{isZh ? '比赛' : 'Competition'}</th>
          <th>{isZh ? '日期' : 'Date'}</th>
          <th className="wse-attempts-col">{isZh ? '详细成绩' : 'Solves'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.p}-${r.c}-${r.e}-${r.t}-${i}`}>
            <td>
              <RecordBadge record={r.l} />
              {' '}
              <span className="records-type-sub">{r.t === 's' ? (isZh ? '单次' : 'Single') : (isZh ? '平均' : 'Avg')}</span>
              {' '}
              <span className="records-rank">#{ranks[i]}</span>
            </td>
            {showEvent && (
              <td>
                <EventIcon event={r.e} />
                {' '}
                <span>{eventDisplayName(r.e, isZh)}</span>
              </td>
            )}
            <td className="wse-value-col">{formatWcaResult(r.v, r.e, r.t === 's' ? 'single' : 'average')}</td>
            <td>
              {r.pc && <Flag iso2={r.pc} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
              <Link prefetch={false} href={`/${isZh ? 'zh' : 'en'}/wca/persons/${r.p}`}>
                {displayCuberName(r.pn, isZh)}
              </Link>
            </td>
            <td>
              <Link {...compLinkProps(r.c)}>
                <CompCell compId={r.c} compName={r.cn} isZh={isZh} />
              </Link>
            </td>
            <td className="wse-detail-cell">{r.d}</td>
            <td className="wse-attempts-col">
              {r.a && r.a.length > 0 ? formatAttempts(r.a, r.e, r.t === 's' ? 'single' : 'average', r.v) : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <RecordsPageInner />
    </Suspense>
  );
}
