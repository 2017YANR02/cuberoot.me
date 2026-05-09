/**
 * 当年成绩排行 — top 200 ww + top 30/country per (year, event, type)
 * /wca-stats/year-results
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import Paginator from './Paginator';
import WcaEventSelector from './WcaEventSelector';
import { Flag } from '../../utils/flag';
import { formatWcaResult } from '../../utils/wca_format_result';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import LangToggle from '../../components/LangToggle';
import CountrySelect, { useCountries } from './CountrySelect';
import { formatAttempts } from './AllResultsPage';
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

interface Row {
  rank: number; value: number; wcaId: string; name: string;
  countryId: string; iso2: string | null;
  compId: string; compName: string | null; compDate: string | null; compMonth: number;
  attempts: number[];
}

export default function YearResultsPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [params, setParams] = useSearchParams();
  const currentYear = new Date().getUTCFullYear();
  const year = parseInt(params.get('year') ?? String(currentYear), 10);
  const month = parseInt(params.get('month') ?? '0', 10);
  const event = params.get('event') ?? '333';
  const type = (params.get('type') ?? 'single') as 'single' | 'average';
  const country = params.get('country') ?? '';
  const page = parseInt(params.get('page') ?? '1', 10);
  const size = parseInt(params.get('size') ?? '100', 10);

  const update = (k: string, v: string, resetPage = true) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (resetPage) next.delete('page');
    setParams(next, { replace: false });
  };

  const [data, setData] = useState<{ rows: Row[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countries = useCountries();
  const allowAvg = event !== '333mbf';

  useEffect(() => {
    setLoading(true); setError(null);
    const url = new URL(apiUrl('/v1/wca/year-results'), window.location.origin);
    url.searchParams.set('year', String(year));
    if (month > 0) url.searchParams.set('month', String(month));
    url.searchParams.set('event', event);
    url.searchParams.set('type', type);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(size));
    if (country) url.searchParams.set('country', country);
    fetch(url.toString().replace(window.location.origin, ''))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [year, month, event, type, country, page, size]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = currentYear; y >= 2003; y--) ys.push(y);
    return ys;
  }, [currentYear]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link to={`/wca-stats?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
          <LangToggle />
        </div>
        <h1>{isZh ? '当年成绩排行' : 'Current Year Ranking'}</h1>
        <p className="wse-subtitle">{isZh ? '某年某月成绩榜(每年每国 top 30、全球 top 200)' : 'Top results within a year/month (top 30/country, 200 worldwide)'}</p>
      </header>

      <WcaEventSelector
        availableEvents={EVENTS_SET}
        selectedEvent={event}
        onSelect={v => update('event', v)}
        isZh={isZh}
      />

      <div className="wse-filters">
        <div className="wse-filter">
          <label>{isZh ? '年份' : 'Year'}</label>
          <select value={year} onChange={e => update('year', e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="wse-filter">
          <label>{isZh ? '月份' : 'Month'}</label>
          <select value={month} onChange={e => update('month', e.target.value)}>
            <option value={0}>{isZh ? '全年' : 'All months'}</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
        <div className="wse-filter">
          <label>{isZh ? '类型' : 'Type'}</label>
          <select value={type} onChange={e => update('type', e.target.value)}>
            <option value="single">{isZh ? '单次' : 'Single'}</option>
            {allowAvg && <option value="average">{isZh ? '平均' : 'Average'}</option>}
          </select>
        </div>
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{isZh ? '加载中...' : 'Loading...'}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {data && !loading && (
          <>
            <div className="wse-result-meta">
              {isZh ? `共 ${data.total.toLocaleString()} 条,显示 ${data.rows.length}` : `${data.total.toLocaleString()} results, showing ${data.rows.length}`}
            </div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{isZh ? '选手' : 'Person'}</th>
                  <th className="wse-value-col">{isZh ? (type === 'single' ? '单次' : '平均') : (type === 'single' ? 'Single' : 'Average')}</th>
                  <th className="wse-attempts-col">{isZh ? '详细成绩' : 'Solves'}</th>
                  <th>{isZh ? '比赛' : 'Competition'}</th>
                  <th>{isZh ? '日期' : 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={`${r.rank}-${r.wcaId}-${r.compId}`}>
                    <td className="wse-rank-col">{r.rank}</td>
                    <td>
                      {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                      <a href={`https://www.worldcubeassociation.org/persons/${r.wcaId}`} target="_blank" rel="noopener noreferrer">{displayCuberName(r.name, isZh)}</a>
                    </td>
                    <td className="wse-value-col">{formatWcaResult(r.value, event, type)}</td>
                    <td className="wse-attempts-col">{formatAttempts(r.attempts, event, type, r.value)}</td>
                    <td>{r.compName ?? r.compId}</td>
                    <td className="wse-detail-cell">{r.compDate ?? ''}</td>
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
                onPageChange={(p) => update('page', String(p), false)}
                onSizeChange={(s) => update('size', String(s))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
