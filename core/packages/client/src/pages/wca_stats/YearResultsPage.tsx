/**
 * 当年成绩排行 — top 200 ww + top 30/country per (year, event, type)
 * 两种视图(Show 切换):
 *   show=results (默认) — 当年每条 valid 成绩一行
 *   show=persons        — 当年每选手最佳一行(客户端去重,fetch 满 cap=200 后 dedup)
 * /wca-stats/year-results
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import Paginator from './Paginator';
import WcaEventSelector from '../../components/WcaEventSelector';
import { Flag } from '../../utils/flag';
import { loadFlagData } from '../../utils/country_flags';
import { CompCell } from '../../components/CompCell/CompCell';
import { formatWcaResult } from '../../utils/wca_format_result';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import LangToggle from '../../components/LangToggle';
import CountrySelect, { useCountries } from './CountrySelect';
import ShowToggle, { type ShowMode } from './ShowToggle';
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
const CAP_WW = 200;
const CAP_COUNTRY = 30;

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
  const show: ShowMode = (params.get('show') === 'persons') ? 'persons' : 'results';
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

  const handleShowChange = (v: ShowMode) => {
    const next = new URLSearchParams(params);
    if (v === 'results') next.delete('show'); else next.set('show', v);
    next.delete('page');
    setParams(next, { replace: false });
  };

  const [rawRows, setRawRows] = useState<Row[]>([]);
  const [rawTotal, setRawTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setFlagBust] = useState(0);
  const countries = useCountries();
  const allowAvg = event !== '333mbf';

  useEffect(() => { loadFlagData().then(v => setFlagBust(v)); }, []);

  // persons 模式: 拉全 cap 行(无服务端分页),客户端按 wca_id 去重
  // results 模式: 走服务端分页
  useEffect(() => {
    setLoading(true); setError(null);
    const url = new URL(apiUrl('/v1/wca/year-results'), window.location.origin);
    url.searchParams.set('year', String(year));
    if (month > 0) url.searchParams.set('month', String(month));
    url.searchParams.set('event', event);
    url.searchParams.set('type', type);
    if (show === 'persons') {
      const cap = country ? CAP_COUNTRY : CAP_WW;
      url.searchParams.set('page', '1');
      url.searchParams.set('size', String(cap));
    } else {
      url.searchParams.set('page', String(page));
      url.searchParams.set('size', String(size));
    }
    if (country) url.searchParams.set('country', country);
    fetch(url.toString().replace(window.location.origin, ''))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j: { rows: Row[]; total: number }) => { setRawRows(j.rows); setRawTotal(j.total); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [show, year, month, event, type, country, page, size]);

  // persons 视图: 按 wca_id 去重,保留每人 value 最小(行已按 rank_in_scope 升序到达)
  const personRows = useMemo(() => {
    if (show !== 'persons') return [] as Row[];
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const r of rawRows) {
      if (seen.has(r.wcaId)) continue;
      seen.add(r.wcaId);
      out.push(r);
    }
    return out.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [show, rawRows]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = currentYear; y >= 2003; y--) ys.push(y);
    return ys;
  }, [currentYear]);

  const totalPages = rawTotal ? Math.max(1, Math.ceil(rawTotal / size)) : 1;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link to={`/wca-stats?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
          <LangToggle />
        </div>
        <h1>{isZh ? '当年成绩排行' : 'Year Rankings'}</h1>
        <p className="wse-subtitle">{isZh
          ? (show === 'persons'
              ? '当年每选手最佳(全球前 200 / 各国前 30 内去重)'
              : '某年某月成绩榜(每年每国 top 30、全球 top 200)')
          : (show === 'persons'
              ? 'Each cuber\'s best in year (deduped within worldwide top 200 / per-country top 30)'
              : 'Top results within a year/month (top 30/country, 200 worldwide)')}
        </p>
      </header>

      <WcaEventSelector
        availableEvents={EVENTS_SET}
        selectedEvent={event}
        onSelect={v => update('event', v)}
        isZh={isZh}
      />

      <div className="wse-filters">
        <div className="wse-filter wse-filter-show">
          <label>{isZh ? '显示' : 'Show'}</label>
          <ShowToggle value={show} onChange={handleShowChange} isZh={isZh} />
        </div>
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
        {!loading && !error && show === 'results' && (
          <>
            <div className="wse-result-meta">
              {isZh ? `共 ${rawTotal.toLocaleString()} 条,显示 ${rawRows.length}` : `${rawTotal.toLocaleString()} results, showing ${rawRows.length}`}
            </div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{isZh ? '选手' : 'Person'}</th>
                  <th className="wse-value-col">{isZh ? (type === 'single' ? '单次' : '平均') : (type === 'single' ? 'Single' : 'Average')}</th>
                  <th>{isZh ? '比赛' : 'Competition'}</th>
                  <th>{isZh ? '日期' : 'Date'}</th>
                  <th className="wse-attempts-col">{isZh ? '详细成绩' : 'Solves'}</th>
                </tr>
              </thead>
              <tbody>
                {rawRows.map(r => (
                  <tr key={`${r.rank}-${r.wcaId}-${r.compId}`}>
                    <td className="wse-rank-col">{r.rank}</td>
                    <td>
                      {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                      <a href={`https://www.worldcubeassociation.org/persons/${r.wcaId}`} target="_blank" rel="noopener noreferrer">{displayCuberName(r.name, isZh)}</a>
                    </td>
                    <td className="wse-value-col">{formatWcaResult(r.value, event, type)}</td>
                    <td>
                      <a href={`https://www.worldcubeassociation.org/competitions/${r.compId}`} target="_blank" rel="noopener noreferrer">
                        <CompCell compId={r.compId} compName={r.compName} isZh={isZh} />
                      </a>
                    </td>
                    <td className="wse-detail-cell">{r.compDate ?? ''}</td>
                    <td className="wse-attempts-col">{formatAttempts(r.attempts, event, type, r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rawTotal > size && (
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
        {!loading && !error && show === 'persons' && (
          <>
            <div className="wse-result-meta">
              {isZh ? `共 ${personRows.length.toLocaleString()} 人` : `${personRows.length.toLocaleString()} cubers`}
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
                {personRows.map(r => (
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
          </>
        )}
      </div>
    </div>
  );
}
