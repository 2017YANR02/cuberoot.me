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
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EventSelect } from '../../components/EventSelect';
import { Flag } from '../../utils/flag';
import { formatWcaResult } from '../../utils/wca_format_result';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import LangToggle from '../../components/LangToggle';
import './wca_stats.css';
import './historical_ranks.css';

const EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
  '333ft','magic','mmagic','333mbo',
];

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

interface Country {
  id: string;
  iso2: string | null;
  name: string;
  continentId: string;
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
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryQuery, setCountryQuery] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);

  // 加载国家列表(只一次,nginx 缓存)
  useEffect(() => {
    fetch(apiUrl('/v1/wca/historical-ranks/countries'))
      .then(r => r.json())
      .then((j: { countries: Country[] }) => setCountries(j.countries))
      .catch(() => setCountries([]));
  }, []);

  const filteredCountries = useMemo(() => {
    if (!countryQuery) return countries;
    const q = countryQuery.toLowerCase();
    return countries.filter(c => c.name.toLowerCase().includes(q) || (c.iso2 ?? '').toLowerCase().includes(q));
  }, [countries, countryQuery]);

  const selectedCountry = useMemo(() => {
    if (!country) return null;
    return countries.find(c => c.id === country) ?? null;
  }, [countries, country]);

  // 主数据 fetch
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

  // 333mbf 没有 average——避免出错
  const allowAverage = event !== '333mbf';

  return (
    <div className="historical-ranks-page">
      <header className="hr-header">
        <div className="hr-header-row">
          <Link to={`/wca-stats?lang=${i18n.language}`} className="hr-back">
            <ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}
          </Link>
          <LangToggle />
        </div>
        <h1>{isZh ? '历史排名' : 'Historical Ranks'}</h1>
        <p className="hr-subtitle">
          {isZh
            ? '查询任意年末截止时全世界 / 单国家累积最佳排名'
            : 'Query end-of-year cumulative best rankings, worldwide or by country'}
        </p>
      </header>

      <div className="hr-filters">
        <div className="hr-filter">
          <label>{isZh ? '项目' : 'Event'}</label>
          <EventSelect events={EVENTS} value={event} onChange={(v) => updateParam('event', v)} />
        </div>

        <div className="hr-filter">
          <label>{isZh ? '年份' : 'Year'}</label>
          <select value={year} onChange={(e) => updateParam('year', e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="hr-filter hr-country">
          <label>{isZh ? '国家' : 'Country'}</label>
          <div className="hr-country-trigger">
            <button type="button" onClick={() => setCountryOpen(o => !o)}>
              {selectedCountry ? (
                <>
                  {selectedCountry.iso2 && <Flag iso2={selectedCountry.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                  <span>{selectedCountry.name}</span>
                </>
              ) : (
                <span>{isZh ? '全球' : 'Worldwide'}</span>
              )}
            </button>
            {country && (
              <button
                type="button"
                className="hr-country-clear"
                onClick={() => updateParam('country', '')}
                aria-label={isZh ? '清除' : 'Clear'}
              >
                ×
              </button>
            )}
          </div>
          {countryOpen && (
            <div className="hr-country-popup">
              <div className="hr-country-search">
                <Search size={14} />
                <input
                  autoFocus
                  value={countryQuery}
                  onChange={(e) => setCountryQuery(e.target.value)}
                  placeholder={isZh ? '搜索国家...' : 'Search country...'}
                />
              </div>
              <div className="hr-country-list">
                <button
                  className={`hr-country-item ${!country ? 'active' : ''}`}
                  onClick={() => { updateParam('country', ''); setCountryOpen(false); setCountryQuery(''); }}
                >
                  {isZh ? '全球' : 'Worldwide'}
                </button>
                {filteredCountries.map(c => (
                  <button
                    key={c.id}
                    className={`hr-country-item ${country === c.id ? 'active' : ''}`}
                    onClick={() => { updateParam('country', c.id); setCountryOpen(false); setCountryQuery(''); }}
                  >
                    {c.iso2 && <Flag iso2={c.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hr-filter">
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

      <div className="hr-table-wrapper">
        {loading && <div className="hr-state">{isZh ? '加载中...' : 'Loading...'}</div>}
        {error && <div className="hr-state hr-state-error">Error: {error}</div>}
        {data && !loading && (
          <>
            <div className="hr-result-meta">
              {isZh
                ? `共 ${data.total.toLocaleString()} 人,${data.rows.length} 条`
                : `${data.total.toLocaleString()} cubers, showing ${data.rows.length}`}
            </div>
            <table className="hr-table">
              <thead>
                <tr>
                  <th className="hr-rank-col">{isZh ? '#' : '#'}</th>
                  <th>{isZh ? '选手' : 'Person'}</th>
                  <th className="hr-value-col">{isZh ? (type === 'single' ? '单次' : '平均') : (type === 'single' ? 'Single' : 'Average')}</th>
                  {!country && <th>{isZh ? '国家' : 'Country'}</th>}
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.wcaId}>
                    <td className="hr-rank-col">{r.rank}</td>
                    <td>
                      <a href={`https://www.worldcubeassociation.org/persons/${r.wcaId}`} target="_blank" rel="noopener noreferrer">
                        {displayCuberName(r.name, isZh)}
                      </a>
                    </td>
                    <td className="hr-value-col">
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
              <div className="hr-pagination">
                <button
                  disabled={page <= 1}
                  onClick={() => updateParam('page', String(page - 1), false)}
                >
                  <ChevronLeft size={14} />
                </button>
                <span>
                  {isZh ? '第' : 'Page'} {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => updateParam('page', String(page + 1), false)}
                >
                  <ChevronRight size={14} />
                </button>
                <select value={size} onChange={(e) => updateParam('size', e.target.value)}>
                  {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}/{isZh ? '页' : 'pg'}</option>)}
                </select>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
