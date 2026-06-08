'use client';

// Ported from packages/client/src/pages/wca_stats/HistoricalRanksPage.tsx.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { apiUrl } from '@/lib/api-base';
import Paginator from '@/components/wca-stats/Paginator';
import WcaEventSelector from '@/components/WcaEventSelector';
import CountrySelect, { useCountries } from '@/components/wca-stats/CountrySelect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';
import '../_historical_ranks.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

const EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
  '333ft','magic','mmagic','333mbo',
];
const EVENTS_SET = new Set(EVENTS);

const PAGE_SIZE_OPTIONS = [50, 100, 200];

interface RankRow {
  rank: number;
  wcaId: string;
  name: string;
  value: number | null;
  countryId: string;
  iso2: string | null;
}

interface RanksResponse {
  event: string;
  year: number;
  country: string;
  type: 'single' | 'average';
  page: number;
  size: number;
  total: number;
  rows: RankRow[];
}

function HistoricalRanksPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('历史排名', 'Historical Ranks', "歷史排名");
  const [q, setQ] = useQueryStates(
    {
      event: parseAsString,
      year: parseAsString,
      country: parseAsString,
      type: parseAsString,
      page: parseAsString,
      size: parseAsString,
    },
    { history: 'replace', scroll: false },
  );

  const currentYear = new Date().getUTCFullYear();
  const event = q.event || '333';
  const year = parseInt(q.year || String(currentYear), 10);
  const country = q.country || '';
  const type = (q.type || 'single') as 'single' | 'average';
  const page = parseInt(q.page || '1', 10);
  const size = parseInt(q.size || '100', 10);

  const updateParam = (k: string, v: string, resetPage = true) => {
    setQ({ [k]: v || null, ...(resetPage ? { page: null } : {}) } as Parameters<typeof setQ>[0]);
  };

  const [data, setData] = useState<RanksResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countries = useCountries();

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    qs.set('event', event);
    qs.set('year', String(year));
    qs.set('type', type);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);

    fetch(apiUrl(`/v1/wca/historical-ranks?${qs.toString()}`))
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [event, year, country, type, page, size]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = currentYear; y >= 2003; y--) ys.push(y);
    return ys;
  }, [currentYear]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  const allowAverage = event !== '333mbf';

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link href={`/wca?lang=${i18n.language}`} className="wse-back">
            <ChevronLeft size={16} /> {tr({ zh: '返回', en: 'Back' })}
          </Link>
        </div>
        <h1>{tr({ zh: '历史排名', en: 'Historical Ranks',
            zhHant: "歷史排名"
        })}</h1>
        <p className="wse-subtitle">
          {tr({ zh: '查询任意年末截止时全世界 / 单国家累积最佳排名', en: 'Query end-of-year cumulative best rankings, worldwide or by country',
              zhHant: "查詢任意年末截止時全世界 / 單國家累積最佳排名"
        })}
        </p>
      </header>

      <WcaEventSelector
        availableEvents={EVENTS_SET}
        selectedEvent={event}
        onSelect={(v) => updateParam('event', v)}
        isZh={isZh}
      />

      <div className="wse-filters">
        <div className="wse-filter">
          <label>{tr({ zh: '年份', en: 'Year' })}</label>
          <select value={year} onChange={(e) => updateParam('year', e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={(v) => updateParam('country', v)} />

        <div className="wse-filter">
          <label>{tr({ zh: '类型', en: 'Type',
              zhHant: "型別"
        })}</label>
          <select
            value={type}
            onChange={(e) => updateParam('type', e.target.value)}
            disabled={!allowAverage && type === 'average'}
          >
            <option value="single">{tr({ zh: '单次', en: 'Single',
                zhHant: "單次"
            })}</option>
            {allowAverage && <option value="average">{tr({ zh: '平均', en: 'Average' })}</option>}
          </select>
        </div>
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...',
            zhHant: "載入中..."
        })}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {data && !loading && (
          <>
            <div className="wse-result-meta">
              {i18n.language === 'zh-Hant' ? (`共 ${data.total.toLocaleString()} 人,${data.rows.length} 條`) : (isZh
                                          ? `共 ${data.total.toLocaleString()} 人,${data.rows.length} 条`
                                          : `${data.total.toLocaleString()} cubers, showing ${data.rows.length}`)}
            </div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{tr({ zh: '选手', en: 'Person',
                      zhHant: "選手"
                })}</th>
                  <th className="wse-value-col">{i18n.language === 'zh-Hant' ? ((type === 'single' ? '單次' : '平均')) : (isZh ? (type === 'single' ? '单次' : '平均') : (type === 'single' ? 'Single' : 'Average'))}</th>
                  {!country && <th>{tr({ zh: '国家', en: 'Country',
                      zhHant: "國家"
                })}</th>}
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.wcaId}>
                    <td className="wse-rank-col">{r.rank}</td>
                    <td>
                      <Link prefetch={false} href={`/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${r.wcaId}`}>
                        {displayCuberName(r.name, isZh)}
                      </Link>
                    </td>
                    <td className="wse-value-col">
                      {r.value != null ? formatWcaResult(r.value, event, type) : '—'}
                    </td>
                    {!country && (
                      <td>
                        {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                        <span>{r.countryId}</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {data.total > size && (
              <Paginator
                page={page}
                totalPages={totalPages}
                size={size}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                isZh={isZh}
                onPageChange={(p) => updateParam('page', String(p), false)}
                onSizeChange={(s) => updateParam('size', String(s))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function HistoricalRanksPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <HistoricalRanksPageInner />
    </Suspense>
  );
}
