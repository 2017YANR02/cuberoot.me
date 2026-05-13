/**
 * 排名 — 同一 URL 下两种视图(Show 切换):
 *   show=results (默认) — 每条 valid 成绩一行;server 端 ORDER BY value 翻页,
 *                         可叠加 country / year / month / 选手或比赛搜索
 *   show=persons        — 每选手一行(年末累积最佳);走 /v1/wca/historical-ranks,
 *                         只支持 year / country / type,year 必填(自动 fallback 到当前年)
 * /wca-stats/all-results
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
import { ClearButton } from '../../components/ClearButton';
import { formatWcaResult } from '../../utils/wca_format_result';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import LangToggle from '../../components/LangToggle';
import CountrySelect, { useCountries } from './CountrySelect';
import ShowToggle, { type ShowMode } from './ShowToggle';
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

interface ResultRow {
  rank: number; value: number; wcaId: string; name: string;
  countryId: string; iso2: string | null;
  compId: string; compName: string | null; compDate: string | null;
  attempts: number[];
}

interface PersonRow {
  rank: number; wcaId: string; name: string;
  value: number | null;
  countryId: string; iso2: string | null;
  // PB 上下文(2026-05 加):值非空时,这三项也应有.NULL → 老数据(管道未重灌).
  compId: string | null; compName: string | null; compDate: string | null;
  attempts: number[];
}

type Data =
  | { mode: 'results'; rows: ResultRow[]; total: number }
  | { mode: 'persons'; rows: PersonRow[]; total: number };

export default function AllResultsPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [params, setParams] = useSearchParams();

  const show: ShowMode = (params.get('show') === 'persons') ? 'persons' : 'results';
  const event = params.get('event') ?? '333';
  const type = (params.get('type') ?? 'single') as 'single' | 'average';
  const country = params.get('country') ?? '';
  const currentYear = new Date().getUTCFullYear();
  // persons 模式要求 year 必填: URL 没有就用当前年(不写回 URL,避免污染历史)
  const yearRaw = parseInt(params.get('year') ?? '0', 10);
  const year = show === 'persons' && yearRaw === 0 ? currentYear : yearRaw;
  const month = parseInt(params.get('month') ?? '0', 10);
  const qFromUrl = params.get('q') ?? '';
  const page = parseInt(params.get('page') ?? '1', 10);
  const size = parseInt(params.get('size') ?? '100', 10);

  const update = (k: string, v: string, resetPage = true) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (resetPage) next.delete('page');
    // 切到 333mbf 但 type=average → 自动归 single
    if (k === 'event' && v === '333mbf' && next.get('type') === 'average') {
      next.delete('type');
    }
    setParams(next, { replace: false });
  };

  // Show 切换: persons 模式清掉 month / q(historical-ranks 不支持)
  const handleShowChange = (v: ShowMode) => {
    const next = new URLSearchParams(params);
    if (v === 'results') next.delete('show'); else next.set('show', v);
    if (v === 'persons') {
      next.delete('month');
      next.delete('q');
      // persons 不支持 "全部年份"; 自动填当前年
      if (!next.get('year') || next.get('year') === '0') next.set('year', String(currentYear));
    }
    next.delete('page');
    setParams(next, { replace: false });
  };

  // q debounced — 只在 results 模式起作用
  const [qInput, setQInput] = useState(qFromUrl);
  useEffect(() => { setQInput(qFromUrl); }, [qFromUrl]);
  useEffect(() => {
    if (show !== 'results') return;
    if (qInput === qFromUrl) return;
    const t = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (qInput) next.set('q', qInput); else next.delete('q');
        next.delete('page');
        return next;
      }, { replace: false });
    }, 300);
    return () => clearTimeout(t);
  }, [qInput, qFromUrl, setParams, show]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = currentYear; y >= 2003; y--) ys.push(y);
    return ys;
  }, [currentYear]);

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setFlagBust] = useState(0);
  const countries = useCountries();
  const allowAvg = event !== '333mbf';

  useEffect(() => { loadFlagData().then(v => setFlagBust(v)); }, []);

  useEffect(() => {
    setLoading(true); setError(null);
    if (show === 'persons') {
      const url = new URL(apiUrl('/v1/wca/historical-ranks'), window.location.origin);
      url.searchParams.set('event', event);
      url.searchParams.set('year', String(year));
      url.searchParams.set('type', type);
      url.searchParams.set('page', String(page));
      url.searchParams.set('size', String(size));
      if (country) url.searchParams.set('country', country);
      fetch(url.toString().replace(window.location.origin, ''))
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j: { rows: PersonRow[]; total: number }) => setData({ mode: 'persons', rows: j.rows, total: j.total }))
        .catch(e => setError(e.message)).finally(() => setLoading(false));
    } else {
      const url = new URL(apiUrl('/v1/wca/all-results'), window.location.origin);
      url.searchParams.set('event', event);
      url.searchParams.set('type', type);
      url.searchParams.set('page', String(page));
      url.searchParams.set('size', String(size));
      if (country) url.searchParams.set('country', country);
      if (year > 0) url.searchParams.set('year', String(year));
      if (month > 0) url.searchParams.set('month', String(month));
      if (qFromUrl) url.searchParams.set('q', qFromUrl);
      fetch(url.toString().replace(window.location.origin, ''))
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j: { rows: ResultRow[]; total: number }) => setData({ mode: 'results', rows: j.rows, total: j.total }))
        .catch(e => setError(e.message)).finally(() => setLoading(false));
    }
  }, [show, event, type, country, year, month, qFromUrl, page, size]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link to={`/wca-stats?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
          <LangToggle />
        </div>
        <h1>{isZh ? '排名' : 'Rankings'}</h1>
        <p className="wse-subtitle">
          {show === 'persons'
            ? (isZh ? '截至指定年末的全球 / 单国家累积最佳' : 'End-of-year cumulative best, worldwide or by country')
            : (isZh ? '全部 valid 成绩按值升序;可叠加国家 / 年份 / 月份 / 选手或比赛搜索' : 'All valid results sorted by value; filter by country / year / month / person or competition search')}
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
        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
        <div className="wse-filter">
          <label>{isZh ? '年份' : 'Year'}</label>
          <select value={year} onChange={e => update('year', e.target.value === '0' ? '' : e.target.value)}>
            {show === 'results' && <option value={0}>{isZh ? '全部年份' : 'All years'}</option>}
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {show === 'results' && (
          <div className="wse-filter">
            <label>{isZh ? '月份' : 'Month'}</label>
            <select value={month} onChange={e => update('month', e.target.value === '0' ? '' : e.target.value)}>
              <option value={0}>{isZh ? '全年' : 'All months'}</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
        <div className="wse-filter">
          <label>{isZh ? '类型' : 'Type'}</label>
          <select value={type} onChange={e => update('type', e.target.value)}>
            <option value="single">{isZh ? '单次' : 'Single'}</option>
            {allowAvg && <option value="average">{isZh ? '平均' : 'Average'}</option>}
          </select>
        </div>
        {show === 'results' && (
          <div className="wse-filter wse-filter-q">
            <label>{isZh ? '搜索' : 'Search'}</label>
            <div className="wse-q-wrap">
              <input
                type="search"
                value={qInput}
                onChange={e => setQInput(e.target.value)}
                placeholder={isZh ? '选手或比赛名' : 'Person or competition'}
              />
              {qInput && (
                <ClearButton
                  onClick={() => { setQInput(''); update('q', ''); }}
                  isZh={isZh}
                  preserveFocus
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{isZh ? '加载中...' : 'Loading...'}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {data && !loading && data.mode === 'results' && (
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
                  <th>{isZh ? '日期' : 'Date'}</th>
                  <th>{isZh ? '比赛' : 'Competition'}</th>
                  <th className="wse-attempts-col">{isZh ? '详细成绩' : 'Solves'}</th>
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
                    <td className="wse-detail-cell">{r.compDate ?? ''}</td>
                    <td>
                      <a href={`https://www.worldcubeassociation.org/competitions/${r.compId}`} target="_blank" rel="noopener noreferrer">
                        <CompCell compId={r.compId} compName={r.compName} isZh={isZh} />
                      </a>
                    </td>
                    <td className="wse-attempts-col">{formatAttempts(r.attempts, event, type, r.value)}</td>
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
        {data && !loading && data.mode === 'persons' && (
          <>
            <div className="wse-result-meta">
              {isZh ? `共 ${data.total.toLocaleString()} 人,${data.rows.length} 条` : `${data.total.toLocaleString()} cubers, showing ${data.rows.length}`}
            </div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{isZh ? '选手' : 'Person'}</th>
                  <th className="wse-value-col">{isZh ? (type === 'single' ? '单次' : '平均') : (type === 'single' ? 'Single' : 'Average')}</th>
                  <th>{isZh ? '日期' : 'Date'}</th>
                  <th>{isZh ? '比赛' : 'Competition'}</th>
                  <th className="wse-attempts-col">{isZh ? '详细成绩' : 'Solves'}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.wcaId}>
                    <td className="wse-rank-col">{r.rank}</td>
                    <td>
                      {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                      <a href={`https://www.worldcubeassociation.org/persons/${r.wcaId}`} target="_blank" rel="noopener noreferrer">
                        {displayCuberName(r.name, isZh)}
                      </a>
                    </td>
                    <td className="wse-value-col">
                      {r.value != null ? formatWcaResult(r.value, event, type) : '—'}
                    </td>
                    <td className="wse-detail-cell">{r.compDate ?? ''}</td>
                    <td>
                      {r.compId ? (
                        <a href={`https://www.worldcubeassociation.org/competitions/${r.compId}`} target="_blank" rel="noopener noreferrer">
                          <CompCell compId={r.compId} compName={r.compName} isZh={isZh} />
                        </a>
                      ) : ''}
                    </td>
                    <td className="wse-attempts-col">
                      {r.value != null && r.attempts.length > 0 ? formatAttempts(r.attempts, event, type, r.value) : ''}
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

// Format 5 attempts as "x x (best) x x (worst)" style
export function formatAttempts(attempts: (number | null)[], event: string, type: 'single' | 'average', value: number): string {
  const valid = attempts.filter(a => a != null) as number[];
  if (valid.length === 0) return '';
  if (type === 'single') {
    return valid.map(v => formatWcaResult(v, event, 'single', { failure: 'dnf' })).join('  ');
  }
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
  void value;
  return items.join('  ');
}
