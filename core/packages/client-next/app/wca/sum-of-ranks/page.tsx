'use client';

// Ported from packages/client/src/pages/wca_stats/SumOfRanksPage.tsx.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import Paginator from '@/components/wca-stats/Paginator';
import { EventIcon } from '@/components/EventIcon';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/cuber-name-display';
import { apiUrl } from '@/lib/api-base';
import LangToggle from '@/components/LangToggle';
import CountrySelect, { useCountries } from '@/components/wca-stats/CountrySelect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';

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
  ranks: number[];
}

export default function SumOfRanksPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('名次和', 'Sum of Ranks');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const type = (params.get('type') ?? 'single') as 'single' | 'average';
  const country = params.get('country') ?? '';
  const eventsParam = params.get('events') ?? '';
  const hidePodium = params.get('hidePodium') === '1';
  const fourthKing = params.get('bestMisser') === '4';
  const page = parseInt(params.get('page') ?? '1', 10);
  const size = parseInt(params.get('size') ?? '100', 10);

  const selectedSet = new Set(eventsParam ? eventsParam.split(',').filter(Boolean) : ACTIVE_EVENTS);
  const pushSearch = (next: URLSearchParams) => {
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
  const update = (k: string, v: string, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v); else next.delete(k);
    if (resetPage) next.delete('page');
    pushSearch(next);
  };
  const toggleEvent = (ev: string) => {
    const cur = new Set(selectedSet);
    if (cur.has(ev)) cur.delete(ev); else cur.add(ev);
    if (cur.size === ACTIVE_EVENTS.length) update('events', '');
    else update('events', Array.from(cur).join(','));
  };
  const selectAll = () => update('events', '');
  const clearAll = () => update('events', '__none__');

  const [data, setData] = useState<{ rows: Row[]; total: number; events: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countries = useCountries();

  useEffect(() => {
    if (eventsParam === '__none__') { setData(null); setError(isZh ? '请至少选择一个项目' : 'Select at least one event'); return; }
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('type', type);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    if (eventsParam && eventsParam !== '__none__') qs.set('events', eventsParam);
    if (fourthKing) qs.set('bestMisser', '4');
    else if (hidePodium) qs.set('hidePodium', '1');
    fetch(apiUrl(`/v1/wca/sum-of-ranks?${qs.toString()}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [type, country, eventsParam, hidePodium, fourthKing, page, size, isZh]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  const isCountryMode = !!country;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link href={`/wca?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
          <LangToggle />
        </div>
        <h1 className="wse-title-row">
          {isZh ? '全项目排名' : 'Sum of Ranks'}
          <Link
            href="/wca/about/sum-of-ranks"
            className="wse-title-help"
            title={isZh ? '这页是干啥的?' : 'What is this page?'}
            aria-label={isZh ? '查看说明' : 'About this page'}
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </Link>
        </h1>
        <p className="wse-subtitle">{isZh ? '把所选项目的(世界 / 国家)排名相加,缺项以该项目"参赛人数+1"(比倒数第一再差一名)计入。"未登领奖台" / "殿军之王" 按比赛决赛(final round)实际名次过滤' : 'Sum of (world / country) ranks across selected events; missing events default to "participants+1" (one worse than last). "No podium" / "Fourth-place king" filter by actual final-round position'}</p>
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
        <div className="wse-filter" style={{ minWidth: 220 }}>
          <label>{isZh ? '过滤' : 'Filter'}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: 34, justifyContent: 'center' }}>
            <label className="wse-toggle" style={{ alignItems: 'center', display: 'flex', gap: 6 }}>
              <input
                type="checkbox"
                checked={hidePodium}
                onChange={e => {
                  const next = new URLSearchParams(params.toString());
                  if (e.target.checked) { next.set('hidePodium', '1'); next.delete('bestMisser'); }
                  else { next.delete('hidePodium'); }
                  next.delete('page');
                  pushSearch(next);
                }}
              />
              {isZh ? '未登领奖台' : 'No podium'}
            </label>
            <label className="wse-toggle" style={{ alignItems: 'center', display: 'flex', gap: 6 }}>
              <input
                type="checkbox"
                checked={fourthKing}
                onChange={e => {
                  const next = new URLSearchParams(params.toString());
                  if (e.target.checked) { next.set('bestMisser', '4'); next.delete('hidePodium'); }
                  else { next.delete('bestMisser'); }
                  next.delete('page');
                  pushSearch(next);
                }}
              />
              {isZh ? '殿军之王(最佳名次=4)' : 'Fourth-place king (best=4)'}
            </label>
          </div>
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
