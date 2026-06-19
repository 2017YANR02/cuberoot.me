'use client';
// 选手 PR 表:每个项目 single / average × (世界排名/洲际/地区) + 领奖台计数.
// 切换 当前 / 历史最佳排名 (历史从 server 拉 historical_ranks_snapshot 衍生数据).
// 复选框:显示排名 / 显示领奖台.

import { useEffect, useMemo, useRef, useState } from 'react';
import PillToggle from '@/components/PillToggle/PillToggle';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { formatWcaResult } from '@/lib/wca-format-result';
import { fetchPersonBestRanks, fetchPersonSor, fetchPersonSubset, type WcaPersonProfile, type WcaResultRow, type PersonBestRanksResponse, type PersonSorResponse, type SorMetricCell, type SorMetricBest } from '@/lib/wca-person-api';
import { ClearButton } from '@/components/ClearButton';
import { apiUrl } from '@/lib/api-base';
import { countryName } from '@/lib/country-name';
import { countPodiumByEvent } from '../logic/podium';
import { isMbldEvent, computeMbfMo3 } from '@/lib/mbf-average';
import { UnofficialMark } from '@/components/UnofficialMark';

// WCA 大洲 id(continentId,带前缀 _)→ 本地化短名,供 SoCR 的 scope 标签用.
const CONTINENT_NAME: Record<string, { zh: string; en: string; }> = {
  '_Africa': { zh: '非洲', en: 'Africa' },
  '_Asia': { zh: '亚洲', en: 'Asia' },
  '_Europe': { zh: '欧洲', en: 'Europe' },
  '_North America': { zh: '北美', en: 'N. America' },
  '_Oceania': { zh: '大洋洲', en: 'Oceania' },
  '_South America': { zh: '南美', en: 'S. America' },
};
import i18n from "@/i18n/i18n-client";

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  isZh: boolean;
  /** 「废止项」口径(21 项含废止),状态在 PersonDetailClient,与「最优项目组合」共用 */
  inclCancelled: boolean;
  onInclCancelledChange: (v: boolean) => void;
}

type Mode = 'current' | 'historical';

function rankTier(r: number | null | undefined): string {
  if (!r || r <= 0) return 'wp-rank-tier-mute';
  if (r <= 3) return 'wp-rank-tier-1';
  if (r <= 10) return 'wp-rank-tier-2';
  if (r <= 100) return 'wp-rank-tier-3';
  return 'wp-rank-tier-4';
}

function RankCell({ r }: { r: number | null | undefined }) {
  if (r === null || r === undefined || r <= 0) return <span className="wp-rank wp-rank-tier-mute">—</span>;
  return <span className={`wp-rank ${rankTier(r)}`}>{r}</span>;
}

export default function PersonPRTable({ profile, results, isZh, inclCancelled, onInclCancelledChange }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [mode, setMode] = useState<Mode>('current');
  const [hist, setHist] = useState<PersonBestRanksResponse | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);
  // 自选组合:点击项目行多选,组合三指标落在底部 Σ 块的「自选」行(仅当前模式).
  // 默认选中该选手的「最优项目组合」(单次最优的第一个组合,无单次用平均;player-best 现成接口,
  // 与下方组合卡同 URL 共享浏览器 HTTP 缓存);用户动过选择后不再覆盖.
  const [selEvents, setSelEvents] = useState<ReadonlySet<string>>(new Set());
  const selTouched = useRef(false);
  useEffect(() => { setSelEvents(new Set()); selTouched.current = false; }, [profile.person.wca_id]);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(apiUrl(`/v1/wca/sum-of-ranks/player-best?wcaId=${encodeURIComponent(profile.person.wca_id)}&v=5`), { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || selTouched.current) return;
        // 只取 ≥2 项的组合(单项最优 = 该项自身名次,自选行不显示,预选只剩一行孤绿没意义)
        const pick = (b?: { combos?: string[][] }) => b?.combos?.find(cb => cb.length >= 2);
        const combo = pick(d.best?.single) ?? pick(d.best?.average);
        if (combo) setSelEvents(new Set(combo));
      })
      .catch(() => { /* 不在 sor_player_best:保持空选 */ });
    return () => ctrl.abort();
  }, [profile.person.wca_id]);
  const toggleEvent = (eid: string) => {
    selTouched.current = true;
    setSelEvents(prev => {
      const next = new Set(prev);
      if (next.has(eid)) next.delete(eid); else next.add(eid);
      return next;
    });
  };

  // lazy load 历史最佳排名 数据
  useEffect(() => {
    if (mode !== 'historical' || hist || histLoading) return;
    setHistLoading(true);
    fetchPersonBestRanks(profile.person.wca_id)
      .then((j) => { setHist(j); setHistError(null); })
      .catch((e) => setHistError(String(e?.message ?? e)))
      .finally(() => setHistLoading(false));
  }, [mode, hist, histLoading, profile.person.wca_id]);

  const podium = useMemo(() => results ? countPodiumByEvent(results) : new Map(), [results]);
  const showPodium = mode === 'current'; // 历史最佳排名 模式不显示领奖台

  // MBLD 无官方平均:从全部 333mbf 成绩现算历史最佳非官方 Mo3(无 3 次有效轮 → null)。
  const bestMbfMo3 = useMemo(() => {
    if (!results) return null;
    let best: number | null = null;
    for (const r of results) {
      if (!isMbldEvent(r.event_id)) continue;
      const mo3 = computeMbfMo3(r.attempts);
      if (mo3 > 0 && (best === null || mo3 < best)) best = mo3;
    }
    return best;
  }, [results]);

  // 用哪些项目? 当前模式 = profile.personal_records 有 PR 的项目;历史 = 同集合并 ∪ hist.events.
  const eventIds = useMemo(() => {
    const set = new Set<string>();
    for (const eid of ALL_EVENT_IDS) {
      if (profile.personal_records[eid]) set.add(eid);
    }
    if (mode === 'historical' && hist) {
      for (const eid of Object.keys(hist.events)) set.add(eid);
    }
    return ALL_EVENT_IDS.filter((eid) => set.has(eid));
  }, [profile, hist, mode]);

  if (eventIds.length === 0) {
    return (
      <section className="wp-card">
        <div className="wp-empty">{t('暂无成绩', 'No results yet')}</div>
      </section>
    );
  }

  return (
    <section className="wp-card wp-pr-card">
      <div className="wp-pr-toolbar">
        <div className="wp-toggle-group">
          <button
            className={`wp-toggle-btn ${mode === 'current' ? 'is-active' : ''}`}
            onClick={() => setMode('current')}
          >{t('当前', 'Current')}</button>
          <button
            className={`wp-toggle-btn ${mode === 'historical' ? 'is-active' : ''}`}
            onClick={() => setMode('historical')}
          >{t('历史最佳排名', 'Historical Best')}</button>
        </div>
        {/* 「废止项」口径开关(全页唯一):控制底部 Σ 名次和行 + 下方「最优项目组合」卡.
            历史最佳无 21 口径数据,historical 模式下 Σ 行不受其影响,但开关保留给组合卡用 */}
        <PillToggle
          value={inclCancelled}
          onChange={onInclCancelledChange}
          onLabel={t('废止项', 'Cancelled')}
          offLabel={t('废止项', 'Cancelled')}
        />
      </div>

      {mode === 'historical' && histLoading && (
        <div className="wp-loading-inline">{t('加载历史排名…', 'Loading historical ranks…')}</div>
      )}
      {mode === 'historical' && histError && (
        <div className="wp-error-inline">{t('历史排名加载失败', 'Failed to load historical ranks')}: {histError}</div>
      )}

      <div className="wp-table-scroll">
        <table className="wp-pr-table">
          <thead>
            {/* WCA 风格单行表头:项目 | NR CR WR | 单次 | 平均 | WR CR NR(围绕中线镜像对称) */}
            <tr>
              <th className="wp-th-event">{t('项目', 'Event')}</th>
              <th title={t('地区排名', 'National rank')}>NR</th>
              <th title={t('洲际排名', 'Continental rank')}>CR</th>
              <th title={t('世界排名', 'World rank')}>WR</th>
              <th>{t('单次', 'Single')}</th>
              <th>{t('平均', 'Average')}</th>
              <th title={t('世界排名', 'World rank')}>WR</th>
              <th title={t('洲际排名', 'Continental rank')}>CR</th>
              <th title={t('地区排名', 'National rank')}>NR</th>
              {showPodium && <th className="wp-th-medal" title={t('金牌', 'Gold')}>🥇</th>}
              {showPodium && <th className="wp-th-medal" title={t('银牌', 'Silver')}>🥈</th>}
              {showPodium && <th className="wp-th-medal" title={t('铜牌', 'Bronze')}>🥉</th>}
            </tr>
          </thead>
          <tbody>
            {eventIds.map((eid) => {
              const cur = profile.personal_records[eid];
              const histEv = hist?.events[eid];
              const showHist = mode === 'historical';

              const sRank = showHist
                ? { world: histEv?.single?.world?.rank ?? null, continent: histEv?.single?.continent?.rank ?? null, country: histEv?.single?.country?.rank ?? null }
                : { world: cur?.single?.world_rank ?? null, continent: cur?.single?.continent_rank ?? null, country: cur?.single?.country_rank ?? null };
              const aRank = showHist
                ? { world: histEv?.average?.world?.rank ?? null, continent: histEv?.average?.continent?.rank ?? null, country: histEv?.average?.country?.rank ?? null }
                : { world: cur?.average?.world_rank ?? null, continent: cur?.average?.continent_rank ?? null, country: cur?.average?.country_rank ?? null };

              const sValue = showHist
                ? (histEv?.single?.world?.value ?? histEv?.single?.country?.value ?? null)
                : (cur?.single?.best ?? null);
              let aValue = showHist
                ? (histEv?.average?.world?.value ?? histEv?.average?.country?.value ?? null)
                : (cur?.average?.best ?? null);
              // MBLD 无官方平均,两种模式都用非官方 Mo3 兜底(历史最佳排名口径也无 Mo3 排名)
              const aIsUnofficial = isMbldEvent(eid) && aValue === null && bestMbfMo3 !== null;
              if (aIsUnofficial) aValue = bestMbfMo3;

              const pod = podium.get(eid);

              const selectable = mode === 'current';
              const selected = selEvents.has(eid);
              return (
                <tr
                  key={eid}
                  className={`${selectable ? 'wp-row-selectable' : ''}${selected ? ' wp-row-selected' : ''}`}
                  onClick={selectable ? () => toggleEvent(eid) : undefined}
                  aria-selected={selectable ? selected : undefined}
                >
                  <th scope="row" className="wp-cell-event" title={selectable ? t('点击多选项目,自选组合的名次和落在下方「自选」行', 'Click rows to multi-select events; the combined sum of ranks appears in the Custom row below') : undefined}>
                    <span className="wp-event-inner">
                      <EventIcon event={eid} className="wp-event-icon" />
                    </span>
                  </th>
                  <td><RankCell r={sRank.country} /></td>
                  <td><RankCell r={sRank.continent} /></td>
                  <td><RankCell r={sRank.world} /></td>
                  <td className="wp-cell-result">{sValue === null ? '—' : formatWcaResult(sValue, eid, 'single')}</td>
                  <td className="wp-cell-result">{aValue === null ? '—' : <>{formatWcaResult(aValue, eid, 'average')}{aIsUnofficial && <UnofficialMark />}</>}</td>
                  <td><RankCell r={aRank.world} /></td>
                  <td><RankCell r={aRank.continent} /></td>
                  <td><RankCell r={aRank.country} /></td>
                  {showPodium && <td className="wp-cell-podium-n">{pod?.gold ? pod.gold : <span className="wp-podium-zero">—</span>}</td>}
                  {showPodium && <td className="wp-cell-podium-n">{pod?.silver ? pod.silver : <span className="wp-podium-zero">—</span>}</td>}
                  {showPodium && <td className="wp-cell-podium-n">{pod?.bronze ? pod.bronze : <span className="wp-podium-zero">—</span>}</td>}
                </tr>
              );
            })}
          </tbody>
          <PersonSorSummary wcaId={profile.person.wca_id} isZh={isZh} showPodium={showPodium} countryIso2={profile.person.country_iso2} historical={mode === 'historical'} inclCancelled={inclCancelled} selEvents={selEvents} onClearSel={() => { selTouched.current = true; setSelEvents(new Set()); }} />
        </table>
      </div>
    </section>
  );
}

// 全项目名次和(Sum of Ranks)摘要 — PR 表底部附加 tbody,三个独立指标各一行:
//   SoWR = Σ世界名次(按世界排) / SoCR = Σ洲际名次(按本洲排) / SoNR = Σ国家名次(按本国排).
//   名次落各自 scope 列(与逐项名次对齐),Σ和值落「成绩」列.
//   跟随表头「当前 / 历史最佳排名」toggle:historical=true 时整块显示历史最佳(名次 + 年份),否则显示当前.
//   SoCR 数据未填充(socr=null)时该行显示占位 —,不误显.数据 lazy fetch;整块无数据时不渲染.
function PersonSorSummary({ wcaId, isZh, showPodium, countryIso2, historical, inclCancelled, selEvents, onClearSel }: { wcaId: string; isZh: boolean; showPodium: boolean; countryIso2: string; historical: boolean; inclCancelled: boolean; selEvents: ReadonlySet<string>; onClearSel: () => void }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [sor, setSor] = useState<PersonSorResponse | null>(null);
  // 历史最佳只有 17 口径(sor_historical_best 无废止维度)→ historical 模式忽略开关,免得三行全空
  const effCancelled = inclCancelled && !historical;

  useEffect(() => { setSor(null); }, [wcaId]);  // 换人清空;切口径保留旧值不闪
  useEffect(() => {
    let cancelled = false;
    fetchPersonSor(wcaId, effCancelled)
      .then((j) => { if (!cancelled) setSor(j); })
      .catch(() => { /* 端点未上线 / 选手无 SOR:静默隐藏 */ });
    return () => { cancelled = true; };
  }, [wcaId, effCancelled]);

  // 自选组合(行多选驱动):单次 + 平均两路并发现算,防抖 450ms;三指标(SoWR/SoCR/SoNR)与主行同结构
  type SubsetTriple = { sowr: SorMetricCell | null; socr: SorMetricCell | null; sonr: SorMetricCell | null };
  const [subset, setSubset] = useState<{ single: SubsetTriple | null; average: SubsetTriple | null } | null>(null);
  const [subsetLoading, setSubsetLoading] = useState(false);
  useEffect(() => {
    if (selEvents.size === 0) { setSubset(null); setSubsetLoading(false); return; }
    setSubsetLoading(true);
    const ctrl = new AbortController();
    const events = ALL_EVENT_IDS.filter(e => selEvents.has(e)); // RANK_EVENTS 顺序 → URL 唯一保缓存命中
    const debounce = setTimeout(() => {
      const timer = setTimeout(() => ctrl.abort(), 20000);
      Promise.all([false, true].map(avg =>
        fetchPersonSubset(wcaId, events, avg, ctrl.signal).catch(() => null),
      )).then(([s, a]) => {
        if (ctrl.signal.aborted) return;
        setSubset({
          single: s && s.sowr ? { sowr: s.sowr, socr: s.socr, sonr: s.sonr } : null,
          average: a && a.sowr ? { sowr: a.sowr, socr: a.socr, sonr: a.sonr } : null,
        });
        setSubsetLoading(false);
      }).finally(() => clearTimeout(timer));
    }, 450);
    return () => { clearTimeout(debounce); ctrl.abort(); };
  }, [selEvents, wcaId]);

  // 现算进度(无真实 sub-progress,按经过时间渐近到 95%,结果到了 pending 转 false 自然补满消失)
  const [calc, setCalc] = useState<{ pct: number; secs: number } | null>(null);
  useEffect(() => {
    if (!subsetLoading) { setCalc(null); return; }
    const start = Date.now();
    const tick = () => {
      const t = (Date.now() - start) / 1000;
      setCalc({ pct: Math.min(95, Math.round((1 - Math.exp(-t / 3)) * 100)), secs: t });
    };
    tick();
    const id = setInterval(tick, 120);
    return () => clearInterval(id);
  }, [subsetLoading]);

  if (!sor) return null;
  // 17 口径全空 = 选手无 SOR → 整块隐藏;21 口径空(_21 列未填充)时保留行显示占位,不让开关把块切没
  if (!sor.single && !sor.average && !sor.bestSingle && !sor.bestAverage && !effCancelled) return null;

  const cont = CONTINENT_NAME[sor.continentId];
  const continentLabel = cont ? t(cont.zh, cont.en) : t('本洲', 'Continent');
  const countryLabel = countryIso2 ? countryName(countryIso2, isZh) : t('本国', 'Country');
  // 当前 / 历史最佳 按表头 toggle 二选一:historical → 取该指标历史最佳(含年份),否则取当前.
  // 子排名(continentRank/countryRank)只有当前模式有(历史最佳专表只存自身 scope).
  type Disp = { rank: number; total: number | null; year?: number; continentRank?: number; countryRank?: number };
  const pick = (cur: SorMetricCell | null | undefined, best: SorMetricBest | null | undefined): Disp | null =>
    historical
      ? (best && best.rank > 0 ? { rank: best.rank, total: best.total, year: best.year } : null)
      : (cur ? { rank: cur.rank, total: cur.total, continentRank: cur.continentRank, countryRank: cur.countryRank } : null);

  // 指标行标签后缀挂该 scope 的具体地名(洲/国),让「在哪排名」一目了然;名次本身落对齐列.
  const METRICS: { key: 'sowr' | 'socr' | 'sonr'; abbr: string; label: string }[] = [
    { key: 'sowr', abbr: 'SoWR', label: t('世界名次和', 'Sum of World Ranks') },
    { key: 'socr', abbr: 'SoCR', label: t('洲际名次和', 'Sum of Continent Ranks') + (cont ? ` · ${continentLabel}` : '') },
    { key: 'sonr', abbr: 'SoNR', label: t('国家名次和', 'Sum of National Ranks') + (countryIso2 ? ` · ${countryLabel}` : '') },
  ];
  const scopeCol = (key: 'sowr' | 'socr' | 'sonr') => key === 'sowr' ? 'world' : key === 'socr' ? 'continent' : 'country';

  // 名次格:指标自身 scope 列填名次(SoWR→世界 / SoCR→洲际 / SoNR→地区),比 scope 更窄的列填子排名
  // (同指标值在本洲/本国池子重排;仅当前模式有,历史/旧缓存缺位时留白),其余列空.与上方逐项名次同列对齐.
  const rankTd = (col: 'world' | 'continent' | 'country', key: 'sowr' | 'socr' | 'sonr', d: Disp | null, pending = false) => {
    if (scopeCol(key) !== col) {
      const sub = col === 'continent' ? d?.continentRank : col === 'country' ? d?.countryRank : undefined;
      return sub ? <td className="wp-sor-rcell"><RankCell r={sub} /></td> : <td className="wp-sor-blank" />;
    }
    return (
      <td className="wp-sor-rcell">
        {d ? <RankCell r={d.rank} /> : <span className="wp-rank wp-rank-tier-mute">{pending ? '…' : '—'}</span>}
      </td>
    );
  };
  // 和值格(落「成绩」列,与逐项成绩同列):Σ 值;历史模式下附达到该最佳名次的年份小字.
  const sumTd = (d: Disp | null, pending = false) => (
    <td className="wp-cell-result wp-sor-scell">
      {d && d.total != null ? <span className="wp-sor-sum">{d.total}</span> : <span className="wp-sor-smute">{pending ? '…' : '—'}</span>}
      {historical && d?.year ? <span className="wp-sor-best-sum">{d.year}</span> : null}
    </td>
  );

  return (
    <tbody className="wp-sor-tbody">
      {METRICS.map((m) => {
        const s = pick(sor.single?.[m.key], sor.bestSingle?.[m.key]);
        const a = pick(sor.average?.[m.key], sor.bestAverage?.[m.key]);
        return (
          <tr key={m.key} className="wp-sor-row">
            <th scope="row" className="wp-cell-event wp-sor-rowlabel" title={m.label}>
              <span className="wp-sor-abbr">{m.abbr}</span>
            </th>
            {rankTd('country', m.key, s)}
            {rankTd('continent', m.key, s)}
            {rankTd('world', m.key, s)}
            {sumTd(s)}
            {sumTd(a)}
            {rankTd('world', m.key, a)}
            {rankTd('continent', m.key, a)}
            {rankTd('country', m.key, a)}
            {showPodium && <><td className="wp-sor-blank" /><td className="wp-sor-blank" /><td className="wp-sor-blank" /></>}
          </tr>
        );
      })}
      {!historical && selEvents.size > 1 && (() => {
        // 自选组合三行:与上方主行同构(SoWR/SoCR/SoNR 各一行,列对齐),person-subset 现算;
        // socr 在 ranks_continent 灌数据前为 null(该行留 —,stats 管道跑完自动点亮)
        const pending = subsetLoading || !subset;
        // 重算期间(增删项目)不留旧值原地误导 — 整组回到 … 占位,新结果到了一起换
        const toDisp = (cell: SorMetricCell | null | undefined): Disp | null =>
          !pending && cell ? { rank: cell.rank, total: cell.total, continentRank: cell.continentRank, countryRank: cell.countryRank } : null;
        return METRICS.map((m, mi) => {
          const s = toDisp(subset?.single?.[m.key]);
          const a = toDisp(subset?.average?.[m.key]);
          return (
            <tr key={`sel-${m.key}`} className="wp-sor-row wp-sor-custom">
              {mi === 0 && (
                <th scope="row" rowSpan={3} className="wp-cell-event wp-sor-rowlabel wp-sor-custom-rowlabel" title={t(`自选组合(已选 ${selEvents.size} 项):按所选项目重算的 SoWR/SoCR/SoNR 三行,与上方同列对齐;点上方项目行增删`, `Custom combo (${selEvents.size} events): SoWR/SoCR/SoNR recomputed over the selected events, columns aligned with the rows above; click rows above to edit`)}>
                  <span className="wp-sor-abbr wp-sor-custom-label">
                    {t('自选', 'Custom')}
                    <ClearButton variant="standalone" className="wp-sor-custom-clear" onClick={onClearSel} title={t('清除所选项目', 'Clear selection')} />
                  </span>
                  {pending && calc && (
                    <span className="wp-sor-custom-progress" aria-hidden>
                      <span className="wp-sor-custom-progress-bar" style={{ width: `${calc.pct}%` }} />
                      <span className="wp-sor-custom-progress-secs">{calc.secs.toFixed(1)}s</span>
                    </span>
                  )}
                </th>
              )}
              {rankTd('country', m.key, s, pending)}
              {rankTd('continent', m.key, s, pending)}
              {rankTd('world', m.key, s, pending)}
              {sumTd(s, pending)}
              {sumTd(a, pending)}
              {rankTd('world', m.key, a, pending)}
              {rankTd('continent', m.key, a, pending)}
              {rankTd('country', m.key, a, pending)}
              {showPodium && <><td className="wp-sor-blank" /><td className="wp-sor-blank" /><td className="wp-sor-blank" /></>}
            </tr>
          );
        });
      })()}
    </tbody>
  );
}

