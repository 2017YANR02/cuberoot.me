/**
 * 参赛届别排名 — 同届(首参赛年)内排名
 * /wca/cohort-ranks
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import Paginator from './Paginator';
import WcaEventSelector from '../../components/WcaEventSelector';
import { Flag } from '../../utils/flag';
import { formatWcaResult } from '../../utils/wca_format_result';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import LangToggle from '../../components/LangToggle';
import CountrySelect, { useCountries } from './CountrySelect';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
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
  rank: number; wcaId: string; name: string; value: number;
  countryId: string; iso2: string | null;
}

export default function CohortRanksPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('届别排名', 'Cohort Ranks');
  const [params, setParams] = useSearchParams();
  const currentYear = new Date().getUTCFullYear();
  const cohort = parseInt(params.get('cohort') ?? String(currentYear), 10);
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
    const url = new URL(apiUrl('/v1/wca/cohort-ranks'), window.location.origin);
    url.searchParams.set('cohort', String(cohort));
    url.searchParams.set('event', event);
    url.searchParams.set('type', type);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(size));
    if (country) url.searchParams.set('country', country);
    fetch(url.toString().replace(window.location.origin, ''))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [cohort, event, type, country, page, size]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = currentYear; y >= 1982; y--) ys.push(y);
    return ys;
  }, [currentYear]);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link to={`/wca?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
          <LangToggle />
        </div>
        <h1 className="wse-title-row">
          {isZh ? '参赛届别排名' : 'Cohort Ranks'}
          <Link
            to="/wca/about/cohort-ranks"
            className="wse-title-help"
            title={isZh ? '这页是干啥的?' : 'What is this page?'}
            aria-label={isZh ? '查看说明' : 'About this page'}
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </Link>
        </h1>
        <p className="wse-subtitle">{isZh ? '按选手首次参赛年份分组,组内 PB 排名' : 'PB ranking among cubers whose first WCA competition was in the chosen year'}</p>
      </header>

      <WcaEventSelector
        availableEvents={EVENTS_SET}
        selectedEvent={event}
        onSelect={v => update('event', v)}
        isZh={isZh}
      />

      <div className="wse-filters">
        <div className="wse-filter">
          <label>{isZh ? '届别(首参赛年)' : 'Cohort year'}</label>
          <select value={cohort} onChange={e => update('cohort', e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
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
            <div className="wse-result-meta">{isZh ? `共 ${data.total.toLocaleString()} 人` : `${data.total.toLocaleString()} cubers`}</div>
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
                      <a href={`https://www.worldcubeassociation.org/persons/${r.wcaId}`} target="_blank" rel="noopener noreferrer">{displayCuberName(r.name, isZh)}</a>
                    </td>
                    <td className="wse-value-col">{formatWcaResult(r.value, event, type)}</td>
                    {!country && (
                      <td>
                        {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
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
