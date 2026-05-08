/**
 * 项目成功率 — solved/attempted per (event, person)
 * /wca-stats/success-rate
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import Paginator from './Paginator';
import { EventSelect } from '../../components/EventSelect';
import { Flag } from '../../utils/flag';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import LangToggle from '../../components/LangToggle';
import CountrySelect, { useCountries } from './CountrySelect';
import './wca_stats_extra.css';

const EVENTS = [
  '333bf','444bf','555bf','333mbf','333fm','333',  // BLD/FMC 在前
  '222','444','555','666','777','333oh',
  'minx','pyram','clock','skewb','sq1',
];
const MIN_OPTIONS = [3, 5, 12, 50, 100, 200, 500];
const PAGE_SIZE_OPTIONS = [50, 100, 200];

interface Row {
  wcaId: string; name: string;
  countryId: string; iso2: string | null;
  solved: number; attempted: number; percentage: number;
}

export default function SuccessRatePage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [params, setParams] = useSearchParams();
  const event = params.get('event') ?? '333bf';
  const country = params.get('country') ?? '';
  const minAttempted = parseInt(params.get('minAttempted') ?? '3', 10);
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

  useEffect(() => {
    setLoading(true); setError(null);
    const url = new URL(apiUrl('/v1/wca/success-rate'), window.location.origin);
    url.searchParams.set('event', event);
    url.searchParams.set('minAttempted', String(minAttempted));
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(size));
    if (country) url.searchParams.set('country', country);
    fetch(url.toString().replace(window.location.origin, ''))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [event, country, minAttempted, page, size]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link to={`/wca-stats?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
          <LangToggle />
        </div>
        <h1>{isZh ? '项目成功率' : 'Event Success Rate'}</h1>
        <p className="wse-subtitle">{isZh ? '每位选手在该项目中成功完成的轮次占比(主要看盲拧 / FMC 等失败率高的项目)' : 'Per-cuber success rate per event (most relevant for BLD / FMC)'}</p>
      </header>

      <div className="wse-filters">
        <div className="wse-filter">
          <label>{isZh ? '项目' : 'Event'}</label>
          <EventSelect events={EVENTS} value={event} onChange={v => update('event', v)} />
        </div>
        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
        <div className="wse-filter">
          <label>{isZh ? '最小尝试数' : 'Min attempts'}</label>
          <select value={minAttempted} onChange={e => update('minAttempted', e.target.value)}>
            {MIN_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{isZh ? '加载中...' : 'Loading...'}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {data && !loading && (
          <>
            <div className="wse-result-meta">{isZh ? `共 ${data.total.toLocaleString()} 人` : `${data.total.toLocaleString()} cubers`}</div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{isZh ? '选手' : 'Person'}</th>
                  <th className="wse-value-col">{isZh ? '成功率' : 'Rate'}</th>
                  <th className="wse-value-col">{isZh ? '复原' : 'Solved'}</th>
                  <th className="wse-value-col">{isZh ? '尝试' : 'Attempts'}</th>
                  <th>{isZh ? '国家' : 'Country'}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.wcaId}>
                    <td className="wse-rank-col">{(page - 1) * size + i + 1}</td>
                    <td>
                      <a href={`https://www.worldcubeassociation.org/persons/${r.wcaId}`} target="_blank" rel="noopener noreferrer">{displayCuberName(r.name, isZh)}</a>
                    </td>
                    <td className="wse-value-col">{r.percentage.toFixed(2)}%</td>
                    <td className="wse-value-col">{r.solved}</td>
                    <td className="wse-value-col">{r.attempted}</td>
                    <td>
                      {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                      <span>{r.countryId}</span>
                    </td>
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
