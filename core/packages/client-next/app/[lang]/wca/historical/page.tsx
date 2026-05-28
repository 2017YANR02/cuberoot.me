'use client';

// Ported from packages/client/src/pages/wca_stats/HistoricalRanksPage.tsx.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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
  useDocumentTitle('历史排名', 'Historical Ranks');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentYear = new Date().getUTCFullYear();
  const event = searchParams.get('event') || '333';
  const year = parseInt(searchParams.get('year') || String(currentYear), 10);
  const country = searchParams.get('country') || '';
  const type = (searchParams.get('type') || 'single') as 'single' | 'average';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const size = parseInt(searchParams.get('size') || '100', 10);

  const updateParam = (k: string, v: string, resetPage = true) => {
    const next = new URLSearchParams(searchParams.toString());
    if (v) next.set(k, v); else next.delete(k);
    if (resetPage) next.delete('page');
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
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
            <ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}
          </Link>
        </div>
        <h1>{isZh ? '历史排名' : 'Historical Ranks'}</h1>
        <p className="wse-subtitle">
          {isZh
            ? '查询任意年末截止时全世界 / 单国家累积最佳排名'
            : 'Query end-of-year cumulative best rankings, worldwide or by country'}
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
          <label>{isZh ? '年份' : 'Year'}</label>
          <select value={year} onChange={(e) => updateParam('year', e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={(v) => updateParam('country', v)} />

        <div className="wse-filter">
          <label>{isZh ? '类型' : 'Type'}</label>
          <select
            value={type}
            onChange={(e) => updateParam('type', e.target.value)}
            disabled={!allowAverage && type === 'average'}
          >
            <option value="single">{isZh ? '单次' : 'Single'}</option>
            {allowAverage && <option value="average">{isZh ? '平均' : 'Average'}</option>}
          </select>
        </div>
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{isZh ? '加载中...' : 'Loading...'}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {data && !loading && (
          <>
            <div className="wse-result-meta">
              {isZh
                ? `共 ${data.total.toLocaleString()} 人,${data.rows.length} 条`
                : `${data.total.toLocaleString()} cubers, showing ${data.rows.length}`}
            </div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{isZh ? '选手' : 'Person'}</th>
                  <th className="wse-value-col">{isZh ? (type === 'single' ? '单次' : '平均') : (type === 'single' ? 'Single' : 'Average')}</th>
                  {!country && <th>{isZh ? '国家' : 'Country'}</th>}
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.wcaId}>
                    <td className="wse-rank-col">{r.rank}</td>
                    <td>
                      <a href={`https://www.worldcubeassociation.org/persons/${r.wcaId}`} target="_blank" rel="noopener noreferrer">
                        {displayCuberName(r.name, isZh)}
                      </a>
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
