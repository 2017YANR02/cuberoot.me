'use client';

// Ported from packages/client/src/pages/wca_stats/RecordsPage.tsx.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useQueryStates, parseAsString } from 'nuqs';
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
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

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
  const [q, setQ] = useQueryStates(
    {
      show: parseAsString,
      region: parseAsString,
      event: parseAsString,
    },
    { history: 'replace', scroll: false },
  );

  const show: Show = q.show === 'mixed' ? 'mixed' : 'history';
  const region = q.region || 'world';
  const event = q.event || '';

  useEffect(() => {
    if (q.show !== 'history' && q.show !== 'mixed') {
      setQ({ show: 'history' });
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
            <ChevronLeft size={16} /> {tr({ zh: '返回', en: 'Back' })}
          </Link>
        </div>
        <h1>{tr({ zh: '纪录', en: 'Records',
            zhHant: "紀錄"
        })}</h1>
        <p className="wse-subtitle">
          {tr({ zh: '历史上所有曾被打破的世界 / 大洲 / 国家纪录', en: 'Every world / continental / national record ever set',
              zhHant: "歷史上所有曾被打破的世界 / 大洲 / 國家紀錄"
        })}
        </p>
      </header>

      <div className="records-toolbar">
        <div className="records-toolbar-row">
          <div className="records-show-toggle">
            <button
              type="button"
              className={show === 'history' ? 'active' : ''}
              onClick={() => update('show', 'history')}
            >{tr({ zh: '历史', en: 'History',
                zhHant: "歷史"
            })}</button>
            <button
              type="button"
              className={show === 'mixed' ? 'active' : ''}
              onClick={() => update('show', 'mixed')}
            >{tr({ zh: '混合', en: 'Mixed' })}</button>
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
        {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...',
            zhHant: "載入中..."
        })}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {bundle && !loading && (
          <>
            {visibleRows.length === 0 && (
              <div className="wse-state">{tr({ zh: '该区域 / 项目暂无历史纪录', en: 'No historical records for this region / event',
                  zhHant: "該區域 / 專案暫無歷史紀錄"
            })}</div>
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
          <th>{tr({ zh: '类型', en: 'Type',
              zhHant: "型別"
        })}</th>
          {showEvent && <th>{tr({ zh: '项目', en: 'Event',
              zhHant: "專案"
        })}</th>}
          <th className="wse-value-col">{tr({ zh: '单次', en: 'Single',
              zhHant: "單次"
        })}</th>
          <th className="wse-value-col">{tr({ zh: '平均', en: 'Average' })}</th>
          <th>{tr({ zh: '选手', en: 'Person',
              zhHant: "選手"
        })}</th>
          <th>{tr({ zh: '比赛', en: 'Competition',
              zhHant: "比賽"
        })}</th>
          <th>{tr({ zh: '日期', en: 'Date' })}</th>
          <th className="wse-attempts-col">{tr({ zh: '详细成绩', en: 'Solves',
              zhHant: "詳細成績"
        })}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.p}-${r.c}-${r.e}-${r.t}-${i}`}>
            <td>
              <RecordBadge record={r.l} />
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
            <td className="wse-value-col">{r.t === 's' ? formatWcaResult(r.v, r.e, 'single') : ''}</td>
            <td className="wse-value-col">{r.t === 'a' ? formatWcaResult(r.v, r.e, 'average') : ''}</td>
            <td>
              {r.pc && <Flag iso2={r.pc} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
              <Link prefetch={false} href={`/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${r.p}`}>
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
