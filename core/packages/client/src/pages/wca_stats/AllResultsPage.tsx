/**
 * 全部成绩排行 — top 5000 ww + top 500/country per (event, type)
 * /wca-stats/all-results
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import Paginator from './Paginator';
import { EventSelect } from '../../components/EventSelect';
import { Flag } from '../../utils/flag';
import { formatWcaResult } from '../../utils/wca_format_result';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import LangToggle from '../../components/LangToggle';
import CountrySelect, { useCountries } from './CountrySelect';
import './wca_stats_extra.css';

const EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
  '333ft','magic','mmagic','333mbo',
];
const PAGE_SIZE_OPTIONS = [50, 100, 200];

interface Row {
  rank: number; value: number; wcaId: string; name: string;
  countryId: string; iso2: string | null;
  compId: string; compName: string | null; compDate: string | null;
  attempts: number[];
}

export default function AllResultsPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [params, setParams] = useSearchParams();
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
    const url = new URL(apiUrl('/v1/wca/all-results'), window.location.origin);
    url.searchParams.set('event', event);
    url.searchParams.set('type', type);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(size));
    if (country) url.searchParams.set('country', country);
    fetch(url.toString().replace(window.location.origin, ''))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [event, type, country, page, size]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link to={`/wca-stats?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
          <LangToggle />
        </div>
        <h1>{isZh ? '全部成绩排行' : 'All Results Ranking'}</h1>
        <p className="wse-subtitle">{isZh ? '所有成绩按值排序(每个国家保留 top 500、全球保留 top 5000)' : 'Top 500/country, top 5000 worldwide per event/type'}</p>
      </header>

      <div className="wse-filters">
        <div className="wse-filter">
          <label>{isZh ? '项目' : 'Event'}</label>
          <EventSelect events={EVENTS} value={event} onChange={v => update('event', v)} />
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

// Format 5 attempts as "x x (best) x x (worst)" style
export function formatAttempts(attempts: (number | null)[], event: string, type: 'single' | 'average', value: number): string {
  const valid = attempts.filter(a => a != null) as number[];
  if (valid.length === 0) return '';
  // single → just show all values
  if (type === 'single') {
    return valid.map(v => formatWcaResult(v, event, 'single', { failure: 'dnf' })).join('  ');
  }
  // average mo3 / ao5: mark best/worst with parens (only if 5 attempts and not DNF)
  const items = valid.map(v => formatWcaResult(v, event, 'single', { failure: 'dnf' }));
  if (valid.length === 5) {
    let bestIdx = 0, worstIdx = 0;
    let bestVal = Number.MAX_SAFE_INTEGER, worstVal = -1;
    valid.forEach((v, i) => {
      if (v > 0 && v < bestVal) { bestVal = v; bestIdx = i; }
      if (v === -1 || (v > 0 && v > worstVal)) { worstVal = v; worstIdx = i; }
    });
    items[bestIdx] = `(${items[bestIdx]})`;
    if (worstIdx !== bestIdx) items[worstIdx] = `(${items[worstIdx]})`;
  }
  // 333mbf displays differently; just attempts row
  // value isn't directly used here but kept for future
  void value;
  return items.join('  ');
}
