'use client';

/**
 * 排名 — 同一 URL 下两种视图(Show 切换):
 *   show=results (默认) — 每条 valid 成绩一行
 *   show=persons        — 每选手一行(年末累积最佳)
 * /wca/all-results
 * Ported from packages/client/src/pages/wca_stats/AllResultsPage.tsx.
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import Paginator from '@/components/wca-stats/Paginator';
import WcaEventSelector from '@/components/WcaEventSelector';
import { Flag } from '@/components/Flag';
import { loadFlagData } from '@/lib/country-flags';
import { CompCell } from '@/components/CompCell/CompCell';
import { ClearButton } from '@/components/ClearButton';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { RecordBadge } from '@/components/RecordBadge';
import { apiUrl } from '@/lib/api-base';
import { compLinkProps } from '@/lib/comp-link';
import CountrySelect, { useCountries } from '@/components/wca-stats/CountrySelect';
import ShowToggle, { type ShowMode } from '@/components/wca-stats/ShowToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';

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
  record: string | null;
}

interface PersonRow {
  rank: number; wcaId: string; name: string;
  value: number | null;
  countryId: string; iso2: string | null;
  compId: string | null; compName: string | null; compDate: string | null;
  attempts: number[];
}

type Data =
  | { mode: 'results'; rows: ResultRow[]; total: number }
  | { mode: 'persons'; rows: PersonRow[]; total: number };

function AllResultsPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('全部成绩', 'All Results');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const show: ShowMode = (params.get('show') === 'persons') ? 'persons' : 'results';
  const event = params.get('event') ?? '333';
  const type = (params.get('type') ?? 'single') as 'single' | 'average';
  const country = params.get('country') ?? '';
  const currentYear = new Date().getUTCFullYear();
  const yearRaw = parseInt(params.get('year') ?? '0', 10);
  const year = show === 'persons' && yearRaw === 0 ? currentYear : yearRaw;
  const month = parseInt(params.get('month') ?? '0', 10);
  const qFromUrl = params.get('q') ?? '';
  const page = parseInt(params.get('page') ?? '1', 10);
  const size = parseInt(params.get('size') ?? '100', 10);
  // 口径:截至(到所选年末的累积最佳)/ 当期(仅所选年或月内)。
  // 默认随模式:选手=截至(走快照秒出),成绩=当期(现状)。
  const basisRaw = params.get('basis');
  const basis: 'period' | 'cumulative' =
    basisRaw === 'cumulative' || basisRaw === 'period'
      ? basisRaw
      : (show === 'persons' ? 'cumulative' : 'period');

  const pushSearch = (next: URLSearchParams) => {
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const update = (k: string, v: string, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v); else next.delete(k);
    if (resetPage) next.delete('page');
    if (k === 'event' && v === '333mbf' && next.get('type') === 'average') {
      next.delete('type');
    }
    pushSearch(next);
  };

  const handleBasisChange = (v: 'period' | 'cumulative') => {
    const next = new URLSearchParams(params.toString());
    next.set('basis', v);
    if (v === 'cumulative') next.delete('month');   // 截至按年末,月份无意义
    next.delete('page');
    pushSearch(next);
  };

  const handleShowChange = (v: ShowMode) => {
    const next = new URLSearchParams(params.toString());
    if (v === 'results') next.delete('show'); else next.set('show', v);
    if (v === 'persons') {
      next.delete('month');
      next.delete('q');
      if (!next.get('year') || next.get('year') === '0') next.set('year', String(currentYear));
    }
    next.delete('page');
    pushSearch(next);
  };

  const [qInput, setQInput] = useState(qFromUrl);
  useEffect(() => { setQInput(qFromUrl); }, [qFromUrl]);
  useEffect(() => {
    if (show !== 'results') return;
    if (qInput === qFromUrl) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (qInput) next.set('q', qInput); else next.delete('q');
      next.delete('page');
      pushSearch(next);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput, qFromUrl, show]);

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
    const qs = new URLSearchParams();
    qs.set('event', event);
    qs.set('type', type);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    if (show === 'persons' && basis === 'cumulative') {
      // 选手 · 截至年末:走预计算快照(秒出),年粒度
      qs.set('year', String(year));
      const url = apiUrl(`/v1/wca/historical-ranks?${qs.toString()}`);
      fetch(url)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j: { rows: PersonRow[]; total: number }) => setData({ mode: 'persons', rows: j.rows, total: j.total }))
        .catch(e => setError(e.message)).finally(() => setLoading(false));
    } else if (show === 'persons') {
      // 选手 · 当期(年 / 月):实时聚合 over wca_results_top(group=person)
      qs.set('group', 'person');
      qs.set('basis', 'period');
      qs.set('year', String(year));
      if (month > 0) qs.set('month', String(month));
      const url = apiUrl(`/v1/wca/all-results?${qs.toString()}`);
      fetch(url)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j: { rows: PersonRow[]; total: number }) => setData({ mode: 'persons', rows: j.rows, total: j.total }))
        .catch(e => setError(e.message)).finally(() => setLoading(false));
    } else {
      // 成绩:每条成绩一行,basis 决定截至(comp_year<=)/ 当期(comp_year=[+月])
      qs.set('basis', basis);
      if (year > 0) qs.set('year', String(year));
      if (basis === 'period' && month > 0) qs.set('month', String(month));
      if (qFromUrl) qs.set('q', qFromUrl);
      const url = apiUrl(`/v1/wca/all-results?${qs.toString()}`);
      fetch(url)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j: { rows: ResultRow[]; total: number }) => setData({ mode: 'results', rows: j.rows, total: j.total }))
        .catch(e => setError(e.message)).finally(() => setLoading(false));
    }
  }, [show, basis, event, type, country, year, month, qFromUrl, page, size]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link href={`/wca?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
        </div>
        <h1 className="wse-title-row">
          {isZh ? '排名' : 'Rankings'}
          <Link
            href="/wca/about/all-results"
            className="wse-title-help"
            title={isZh ? '这页是干啥的?' : 'What is this page?'}
            aria-label={isZh ? '查看说明' : 'About this page'}
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </Link>
        </h1>
        <p className="wse-subtitle">
          {show === 'persons'
            ? (basis === 'cumulative'
                ? (isZh ? '截至所选年末的累积最佳排名(全球 / 单国家)' : 'Ranking by best up to end of the selected year (worldwide / by country)')
                : (isZh ? '仅所选年(或月)内取得的最佳排名(全球 / 单国家)' : 'Ranking by best within the selected year (or month)'))
            : (basis === 'cumulative'
                ? (isZh ? '截至所选年末的全部 valid 成绩,按值升序' : 'All valid results up to end of the selected year, sorted by value')
                : (isZh ? '所选年 / 月内的全部 valid 成绩,按值升序;可叠加国家 / 选手或比赛搜索' : 'All valid results within the selected year / month, sorted by value'))}
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
          <label>{isZh ? '类型' : 'Type'}</label>
          <select value={type} onChange={e => update('type', e.target.value)}>
            <option value="single">{isZh ? '单次' : 'Single'}</option>
            {allowAvg && <option value="average">{isZh ? '平均' : 'Average'}</option>}
          </select>
        </div>
        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
        <div className="wse-filter wse-filter-show">
          <label>{isZh ? '口径' : 'Basis'}</label>
          <div className="wse-show-toggle">
            <button
              type="button"
              className={basis === 'cumulative' ? 'active' : ''}
              onClick={() => handleBasisChange('cumulative')}
            >
              {isZh ? '截至' : 'Cumulative'}
            </button>
            <button
              type="button"
              className={basis === 'period' ? 'active' : ''}
              onClick={() => handleBasisChange('period')}
            >
              {isZh ? '当期' : 'Period'}
            </button>
          </div>
        </div>
        <div className="wse-filter">
          <label>{isZh ? '年份' : 'Year'}</label>
          <select value={year} onChange={e => update('year', e.target.value === '0' ? '' : e.target.value)}>
            {show === 'results' && <option value={0}>{isZh ? '全部年份' : 'All years'}</option>}
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="wse-filter">
          <label>{isZh ? '月份' : 'Month'}</label>
          <select
            value={basis === 'cumulative' ? 0 : month}
            disabled={basis === 'cumulative'}
            title={basis === 'cumulative' ? (isZh ? '截至口径按年末,不分月' : 'Cumulative basis is year-end; month not applicable') : undefined}
            onChange={e => update('month', e.target.value === '0' ? '' : e.target.value)}
          >
            <option value={0}>{isZh ? '全年' : 'All months'}</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
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
                      <Link prefetch={false} href={`/${isZh ? 'zh' : 'en'}/wca/persons/${r.wcaId}`}>{displayCuberName(r.name, isZh)}</Link>
                    </td>
                    <td className="wse-value-col">
                      <span className="record-num-cell">
                        {formatWcaResult(r.value, event, type)}
                        {r.record && <RecordBadge record={r.record} variant="inline" iso2={r.iso2} />}
                      </span>
                    </td>
                    <td className="wse-detail-cell">{r.compDate ?? ''}</td>
                    <td>
                      <Link {...compLinkProps(r.compId)}>
                        <CompCell compId={r.compId} compName={r.compName} isZh={isZh} />
                      </Link>
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
                      <Link prefetch={false} href={`/${isZh ? 'zh' : 'en'}/wca/persons/${r.wcaId}`}>
                        {displayCuberName(r.name, isZh)}
                      </Link>
                    </td>
                    <td className="wse-value-col">
                      {r.value != null ? formatWcaResult(r.value, event, type) : '—'}
                    </td>
                    <td className="wse-detail-cell">{r.compDate ?? ''}</td>
                    <td>
                      {r.compId ? (
                        <Link {...compLinkProps(r.compId)}>
                          <CompCell compId={r.compId} compName={r.compName} isZh={isZh} />
                        </Link>
                      ) : ''}
                    </td>
                    <td className="wse-attempts-col">
                      {r.value != null && r.attempts && r.attempts.length > 0 ? formatAttempts(r.attempts, event, type, r.value) : ''}
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

export default function AllResultsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <AllResultsPageInner />
    </Suspense>
  );
}
