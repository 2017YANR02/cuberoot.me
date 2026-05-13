/**
 * Historical Ranks - 任意 (event, year, country, type) 切片
 * /wca-stats/historical
 *
 * API: GET /v1/wca/historical-ranks 返回当年末累积最佳排名(分页).
 * 数据每天 GH Actions 灌一次,nginx 缓存 1 day.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { Flag } from '../../utils/flag';
import { formatWcaResult } from '../../utils/wca_format_result';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import LangToggle from '../../components/LangToggle';
import Paginator from './Paginator';
import WcaEventSelector from '../../components/WcaEventSelector';
import CountrySelect, { useCountries } from './CountrySelect';
import './wca_stats_extra.css';

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

export default function HistoricalRanksPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [searchParams, setSearchParams] = useSearchParams();

  const currentYear = new Date().getUTCFullYear();
  const event = searchParams.get('event') || '333';
  const year = parseInt(searchParams.get('year') || String(currentYear), 10);
  const country = searchParams.get('country') || '';
  const type = (searchParams.get('type') || 'single') as 'single' | 'average';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const size = parseInt(searchParams.get('size') || '100', 10);

  const updateParam = (k: string, v: string, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set(k, v); else next.delete(k);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: false });
  };

  const [data, setData] = useState<RanksResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countries = useCountries();

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url = new URL(apiUrl('/v1/wca/historical-ranks'), window.location.origin);
    url.searchParams.set('event', event);
    url.searchParams.set('year', String(year));
    url.searchParams.set('type', type);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(size));
    if (country) url.searchParams.set('country', country);

    fetch(url.toString().replace(window.location.origin, ''))
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
          <Link to={`/wca-stats?lang=${i18n.language}`} className="wse-back">
            <ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}
          </Link>
          <LangToggle />
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
