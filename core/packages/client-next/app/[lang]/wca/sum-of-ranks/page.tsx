'use client';

// Ported from packages/client/src/pages/wca_stats/SumOfRanksPage.tsx.
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import Paginator from '@/components/wca-stats/Paginator';
import { EventIcon } from '@/components/EventIcon';
import WcaEventSelector from '@/components/WcaEventSelector';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import type { WcaPersonLite } from '@/lib/wca-api';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/cuber-name-display';
import { apiUrl } from '@/lib/api-base';
import CountrySelect, { useCountries } from '@/components/wca-stats/CountrySelect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';

const ACTIVE_EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
];
// 默认榜单 = 17 活跃项;另追加 4 个废止项(脚拧/八板/十二板/旧多盲)作可勾选额外项,默认不选.
// 顺序须与 server RANK_EVENTS 一致(ranks 数组按此对齐).
const CANCELLED_EVENTS = ['333ft', 'magic', 'mmagic', '333mbo'];
const RANK_EVENTS = [...ACTIVE_EVENTS, ...CANCELLED_EVENTS];
const RANK_EVENT_SET = new Set(RANK_EVENTS);
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

interface ComboBest { rank: number; events: string[]; }
interface PlayerBest {
  wcaId: string; name: string; countryId: string; iso2: string | null;
  best: { single?: ComboBest; average?: ComboBest };
}
interface CensusRow { rank: number; wcaId: string; name: string; iso2: string | null; subsetsWon: number; }
interface Census { type: string; distinct: number; totalSubsets: number; rows: CensusRow[]; }

function SumOfRanksPageInner() {
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
  const selectedCount = RANK_EVENTS.filter(e => selectedSet.has(e)).length;
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
    // 恰好选中 17 活跃项 → 折叠成默认(空 param,走快路径);否则按 RANK_EVENTS 顺序序列化
    if (cur.size === ACTIVE_EVENTS.length && ACTIVE_EVENTS.every(e => cur.has(e))) update('events', '');
    else update('events', RANK_EVENTS.filter(e => cur.has(e)).join(','));
  };
  const selectAll = () => update('events', '');
  const clearAll = () => update('events', '__none__');
  // 把"最优组合"应用到主榜单(组合是世界口径 → 清掉国家筛选 + 切到对应 type)
  const applyCombo = (events: string[], comboType: 'single' | 'average') => {
    const next = new URLSearchParams(params.toString());
    next.set('type', comboType);
    next.delete('country');
    next.delete('page');
    const set = new Set(events);
    if (set.size === ACTIVE_EVENTS.length && ACTIVE_EVENTS.every(e => set.has(e))) next.delete('events');
    else next.set('events', RANK_EVENTS.filter(e => set.has(e)).join(','));
    pushSearch(next);
  };

  const [data, setData] = useState<{ rows: Row[]; total: number; events: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countries = useCountries();

  // Q1: 指定选手最优组合
  const [picked, setPicked] = useState<WcaPersonLite | null>(null);
  const [pb, setPb] = useState<PlayerBest | null>(null);
  const [pbLoading, setPbLoading] = useState(false);
  // Q2: 名人堂(懒加载,展开才拉)
  const [census, setCensus] = useState<Census | null>(null);
  const [censusOpen, setCensusOpen] = useState(false);
  const [censusExpanded, setCensusExpanded] = useState(false);

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

  // 选手最优组合
  useEffect(() => {
    if (!picked) { setPb(null); return; }
    setPbLoading(true);
    fetch(apiUrl(`/v1/wca/sum-of-ranks/player-best?wcaId=${encodeURIComponent(picked.id)}`))
      .then(r => (r.ok ? r.json() : null))
      .then(setPb).catch(() => setPb(null)).finally(() => setPbLoading(false));
  }, [picked]);

  // 名人堂(展开时 + type 变化时拉)
  useEffect(() => {
    if (!censusOpen) return;
    setCensus(null); setCensusExpanded(false);
    fetch(apiUrl(`/v1/wca/sum-of-ranks/census?type=${type}`))
      .then(r => (r.ok ? r.json() : null)).then(setCensus).catch(() => {});
  }, [censusOpen, type]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  const isCountryMode = !!country;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link href={`/wca?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
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
          <label>{isZh ? `项目(已选 ${selectedCount} / ${RANK_EVENTS.length})` : `Events (${selectedCount}/${RANK_EVENTS.length} selected)`}</label>
          <div className="wse-events-bar">
            <button type="button" onClick={selectAll}>{isZh ? '全选活跃项' : 'Active'}</button>
            <button type="button" onClick={clearAll}>{isZh ? '清除' : 'None'}</button>
          </div>
          <WcaEventSelector
            availableEvents={RANK_EVENT_SET}
            selectedEvents={selectedSet}
            onToggle={toggleEvent}
            isZh={isZh}
            onlyAvailable
          />
        </div>
      </div>

      {/* Q1: 指定选手最优项目组合 */}
      <div className="sor-tool">
        <label className="sor-tool-label">{isZh ? '查选手的最优项目组合' : "A cuber's best event combination"}</label>
        <WcaPersonPicker
          value={picked}
          onChange={setPicked}
          isZh={isZh}
          placeholder={isZh ? '搜索选手名 / WCA ID' : 'Search name / WCA ID'}
          className="sor-tool-picker"
        />
        {pbLoading && <div className="sor-tool-hint">{isZh ? '计算中…' : 'Loading…'}</div>}
        {pb && !pbLoading && (
          <div className="sor-pb">
            <div className="sor-pb-head">
              {pb.iso2 && <Flag iso2={pb.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
              <a href={`https://www.worldcubeassociation.org/persons/${pb.wcaId}`} target="_blank" rel="noopener noreferrer">{displayCuberName(pb.name, isZh)}</a>
            </div>
            {(['single', 'average'] as const).every(tk => !pb.best[tk]) ? (
              <div className="sor-tool-hint">{isZh ? '该选手暂无有效成绩' : 'No ranked results'}</div>
            ) : (['single', 'average'] as const).map(tk => {
              const b = pb.best[tk];
              if (!b) return null;
              return (
                <div key={tk} className="sor-pb-row">
                  <span className="sor-pb-type">{tk === 'single' ? (isZh ? '单次' : 'Single') : (isZh ? '平均' : 'Average')}</span>
                  <span className="sor-pb-rank">{isZh ? `世界第 ${b.rank}` : `World #${b.rank}`}</span>
                  <span className="sor-pb-events">{b.events.map(ev => <EventIcon key={ev} event={ev} />)}</span>
                  <button type="button" className="sor-pb-apply" onClick={() => applyCombo(b.events, tk)}>{isZh ? '应用到榜单' : 'Apply'}</button>
                </div>
              );
            })}
            <div className="sor-pb-note">{isZh ? '在所有项目组合里,这个组合让 TA 的名次和排名最靠前(世界口径)' : 'The combination that puts them highest on the world sum-of-ranks board'}</div>
          </div>
        )}
      </div>

      {/* Q2: 名人堂 — 谁当过名次和第一 */}
      <div className="sor-census">
        <button type="button" className="sor-census-toggle" onClick={() => setCensusOpen(o => !o)} aria-expanded={censusOpen}>
          {censusOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {isZh ? '名人堂:谁当过名次和第一?' : 'Hall of fame: who has ever been #1?'}
        </button>
        {censusOpen && (
          <div className="sor-census-body">
            {!census && <div className="sor-tool-hint">{isZh ? '加载中…' : 'Loading…'}</div>}
            {census && (
              <>
                <p className="sor-census-lead">{isZh
                  ? `在全部 ${census.totalSubsets.toLocaleString()} 种项目组合里,共有 ${census.distinct} 名选手当过"名次和第一"(${type === 'average' ? '平均' : '单次'},世界口径)。`
                  : `Across all ${census.totalSubsets.toLocaleString()} combinations, ${census.distinct} cubers have been #1 (${type}, world).`}</p>
                <ol className="sor-census-list">
                  {(censusExpanded ? census.rows : census.rows.slice(0, 12)).map(r => {
                    const share = r.subsetsWon / census.totalSubsets * 100;
                    return (
                      <li key={r.wcaId}>
                        <span className="sor-census-rank">{r.rank}</span>
                        {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                        <a href={`https://www.worldcubeassociation.org/persons/${r.wcaId}`} target="_blank" rel="noopener noreferrer">{displayCuberName(r.name, isZh)}</a>
                        <span className="sor-census-share">{share < 0.1 ? share.toFixed(3) : share.toFixed(1)}%</span>
                      </li>
                    );
                  })}
                </ol>
                {census.rows.length > 12 && (
                  <button type="button" className="sor-census-more" onClick={() => setCensusExpanded(e => !e)}>
                    {censusExpanded ? (isZh ? '收起' : 'Show less') : (isZh ? `展开全部 ${census.distinct} 人` : `Show all ${census.distinct}`)}
                  </button>
                )}
              </>
            )}
          </div>
        )}
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
                  {RANK_EVENTS.map(ev => (
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
                    {RANK_EVENTS.map((ev, j) => {
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

export default function SumOfRanksPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <SumOfRanksPageInner />
    </Suspense>
  );
}
