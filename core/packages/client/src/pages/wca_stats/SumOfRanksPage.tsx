/**
 * 全项目排行 — 累加各项世界(或国家)排名
 * /wca-stats/sum-of-ranks
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import Paginator from './Paginator';
import { EventIcon } from '../../components/EventIcon';
import { Flag } from '../../utils/flag';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import LangToggle from '../../components/LangToggle';
import CountrySelect, { useCountries } from './CountrySelect';
import './wca_stats_extra.css';

const ACTIVE_EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
];
const PAGE_SIZE_OPTIONS = [50, 100, 200];

interface Row {
  wcaId: string; name: string;
  countryId: string; iso2: string | null;
  eventsDone: number;
  totalWorldRank?: number;
  totalCountryRank?: number;
  subsetTotal?: number;
  ranks: number[];   // ACTIVE_EVENTS 顺序
}

export default function SumOfRanksPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [params, setParams] = useSearchParams();
  const type = (params.get('type') ?? 'single') as 'single' | 'average';
  const country = params.get('country') ?? '';
  const eventsParam = params.get('events') ?? '';
  const hidePodium = params.get('hidePodium') === '1';
  const page = parseInt(params.get('page') ?? '1', 10);
  const size = parseInt(params.get('size') ?? '100', 10);

  const selectedSet = new Set(eventsParam ? eventsParam.split(',').filter(Boolean) : ACTIVE_EVENTS);
  const update = (k: string, v: string, resetPage = true) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (resetPage) next.delete('page');
    setParams(next, { replace: false });
  };
  const toggleEvent = (ev: string) => {
    const cur = new Set(selectedSet);
    if (cur.has(ev)) cur.delete(ev); else cur.add(ev);
    if (cur.size === ACTIVE_EVENTS.length) update('events', '');
    else update('events', Array.from(cur).join(','));
  };
  const selectAll = () => update('events', '');
  const clearAll = () => update('events', '__none__');  // 用 sentinel 避免 0 项导致服务器报错

  const [data, setData] = useState<{ rows: Row[]; total: number; events: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countries = useCountries();

  useEffect(() => {
    if (eventsParam === '__none__') { setData(null); setError(isZh ? '请至少选择一个项目' : 'Select at least one event'); return; }
    setLoading(true); setError(null);
    const url = new URL(apiUrl('/v1/wca/sum-of-ranks'), window.location.origin);
    url.searchParams.set('type', type);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(size));
    if (country) url.searchParams.set('country', country);
    if (eventsParam && eventsParam !== '__none__') url.searchParams.set('events', eventsParam);
    if (hidePodium) url.searchParams.set('hidePodium', '1');
    fetch(url.toString().replace(window.location.origin, ''))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [type, country, eventsParam, hidePodium, page, size, isZh]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  const isCountryMode = !!country;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link to={`/wca-stats?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
          <LangToggle />
        </div>
        <h1>{isZh ? '全项目排行' : 'Sum of Ranks'}</h1>
        <p className="wse-subtitle">{isZh ? '把所选项目的(世界 / 国家)排名相加,缺项以该项目"参赛人数+1"(比倒数第一再差一名)计入' : 'Sum of (world / country) ranks across selected events; missing events default to "participants+1" (one worse than last)'}</p>
      </header>

      <div className="wse-filters">
        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
        <div className="wse-filter">
          <label>{isZh ? '类型' : 'Type'}</label>
          <select value={type} onChange={e => update('type', e.target.value)}>
            <option value="single">{isZh ? '单次' : 'Single'}</option>
            <option value="average">{isZh ? '平均' : 'Average'}</option>
          </select>
        </div>
        <div className="wse-filter" style={{ minWidth: 120 }}>
          <label>{isZh ? '隐藏' : 'Hide'}</label>
          <label className="wse-toggle" style={{ height: 34, alignItems: 'center', display: 'flex' }}>
            <input type="checkbox" checked={hidePodium} onChange={e => update('hidePodium', e.target.checked ? '1' : '')} />
            {isZh ? '隐藏登过奖台' : 'Hide podium-ers'}
          </label>
        </div>
        <div className="wse-filter" style={{ minWidth: '100%' }}>
          <label>{isZh ? '项目(已选 ' + selectedSet.size + ' / 17)' : `Events (${selectedSet.size}/17 selected)`}</label>
          <div className="wse-events-bar">
            <button type="button" onClick={selectAll}>{isZh ? '全选' : 'All'}</button>
            <button type="button" onClick={clearAll}>{isZh ? '清除' : 'None'}</button>
          </div>
          <div className="wse-events-grid">
            {ACTIVE_EVENTS.map(ev => (
              <label key={ev}>
                <input type="checkbox" checked={selectedSet.has(ev)} onChange={() => toggleEvent(ev)} />
                <EventIcon event={ev} /> {ev}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{isZh ? '加载中...' : 'Loading...'}</div>}
        {error && <div className="wse-state wse-state-error">{error}</div>}
        {data && !loading && (
          <>
            <div className="wse-result-meta">{isZh ? `共 ${data.total.toLocaleString()} 人` : `${data.total.toLocaleString()} cubers`}</div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{isZh ? '选手' : 'Person'}</th>
                  <th>{isZh ? '国家' : 'Country'}</th>
                  {ACTIVE_EVENTS.map(ev => (
                    <th key={ev} className="wse-sor-evcell" style={{ opacity: selectedSet.has(ev) ? 1 : 0.3 }}>
                      <EventIcon event={ev} />
                    </th>
                  ))}
                  <th className="wse-value-col">{isZh ? '名次总和' : 'Total'}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.wcaId}>
                    <td className="wse-rank-col">{(page - 1) * size + i + 1}</td>
                    <td>
                      <a href={`https://www.worldcubeassociation.org/persons/${r.wcaId}`} target="_blank" rel="noopener noreferrer">{displayCuberName(r.name, isZh)}</a>
                    </td>
                    <td>
                      {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                      <span>{r.countryId}</span>
                    </td>
                    {ACTIVE_EVENTS.map((ev, j) => {
                      const rk = r.ranks[j] ?? 0;
                      const cls = rk > 0 && rk <= 3 ? `wse-sor-evcell podium-${rk}` :
                                  rk === 0 ? 'wse-sor-evcell empty' : 'wse-sor-evcell';
                      return (
                        <td key={ev} className={cls} style={{ opacity: selectedSet.has(ev) ? 1 : 0.3 }}>
                          {rk > 0 ? rk : ''}
                        </td>
                      );
                    })}
                    <td className="wse-value-col">{
                      r.subsetTotal != null ? r.subsetTotal :
                      isCountryMode ? r.totalCountryRank :
                      r.totalWorldRank
                    }</td>
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
