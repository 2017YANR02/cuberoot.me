/**
 * 全项目达成排行榜 — 完成全 17 项 WCA 项目的人,按耗时升序
 * /wca-stats/all-events-done
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import Paginator from './Paginator';
import { loadFlagData } from '../../utils/country_flags';
import { CompCell } from '../../components/CompCell/CompCell';
import { Flag } from '../../utils/flag';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import LangToggle from '../../components/LangToggle';
import CountrySelect, { useCountries } from './CountrySelect';
import './wca_stats_extra.css';

const PAGE_SIZE_OPTIONS = [50, 100, 200];

interface Row {
  wcaId: string; name: string;
  countryId: string; iso2: string | null;
  doneCount: number; isDone: boolean;
  firstCompId: string | null; firstCompDate: string | null;
  achievementCompId: string | null; achievementCompName: string | null; achievementCompDate: string | null;
  daysToComplete: number | null;
  totalCompCount: number;
}

export default function AllEventsDonePage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [params, setParams] = useSearchParams();
  const country = params.get('country') ?? '';
  const onlyDone = params.get('onlyDone') !== '0';
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
  const [, setFlagBust] = useState(0);
  const countries = useCountries();

  useEffect(() => { loadFlagData().then(v => setFlagBust(v)); }, []);

  useEffect(() => {
    setLoading(true); setError(null);
    const url = new URL(apiUrl('/v1/wca/all-events-done'), window.location.origin);
    url.searchParams.set('onlyDone', onlyDone ? '1' : '0');
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(size));
    if (country) url.searchParams.set('country', country);
    fetch(url.toString().replace(window.location.origin, ''))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [country, onlyDone, page, size]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link to={`/wca-stats?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
          <LangToggle />
        </div>
        <h1>{isZh ? '全项目达成排行榜' : 'All Events Achievement'}</h1>
        <p className="wse-subtitle">{isZh ? '完成全 17 项 WCA 官方项目所用天数(从首次参赛到最后一项达成)' : 'Days from first WCA comp to completing all 17 events'}</p>
      </header>

      <div className="wse-filters">
        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
        <div className="wse-filter">
          <label>{isZh ? '视图' : 'View'}</label>
          <select value={onlyDone ? '1' : '0'} onChange={e => update('onlyDone', e.target.value)}>
            <option value="1">{isZh ? '全达成' : 'Completed'}</option>
            <option value="0">{isZh ? '全部' : 'All'}</option>
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
                  <th className="wse-value-col">{isZh ? '达成天数' : 'Days'}</th>
                  <th>{isZh ? '达成比赛' : 'At competition'}</th>
                  <th className="wse-value-col">{isZh ? '比赛场次' : 'Comps'}</th>
                  {!onlyDone && <th className="wse-value-col">{isZh ? '完成项目' : 'Done'}</th>}
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
                    <td className="wse-value-col">{r.daysToComplete != null ? `${r.daysToComplete.toLocaleString()} ${isZh ? '天' : 'd'}` : '—'}</td>
                    <td>{r.achievementCompId ? <CompCell compId={r.achievementCompId} compName={r.achievementCompName} isZh={isZh} /> : ''}</td>
                    <td className="wse-value-col">{r.totalCompCount}</td>
                    {!onlyDone && <td className="wse-value-col">{r.doneCount}/17</td>}
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
