'use client';
// 按项目:单项目详情.三块:
//   1. 成绩 (按比赛倒序的轮次表,attempts 列)
//   2. 趋势 (成绩趋势折线 + 排名历史曲线,两图叠放)
//   3. 分布 动态分布可视化 (DistributionViz)

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from '@/components/AppLink';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
// echarts-for-react needs to be client-only.
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
// 「动态分布」可视化 —— 重引擎(canvas + zustand),只在该子 tab 激活时按需加载。
const DistributionViz = dynamic(() => import('@/components/distribution-viz/DistributionViz'), { ssr: false });
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { formatWcaResult } from '@/lib/wca-format-result';
import { localizeCompName } from '@/lib/comp-localize';
import { formatDateRangeIso } from '@/lib/wca-date';
import { CompCell } from '@/components/CompCell/CompCell';
import { compLinkProps } from '@/lib/comp-link';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { computePrRank } from '../../logic/progress';
import { ROUND_ORDER, ROUND_HINT_ZH, ROUND_HINT_EN, roundLabel, roundClass } from '@/lib/wca-round-meta';
import { AttemptsList } from './AttemptsList';
import { AverageValueCell } from './AverageValueCell';
import { EditModeToggle } from './EditModeToggle';
import { AttemptRanksToggle } from './AttemptRanksToggle';
import { ROUND_VARIANTS } from '@/lib/wca-results-api';
import { fetchPersonRankHistory, type PersonRankHistoryResponse, type WcaPersonProfile, type WcaResultRow, type WcaCompetition } from '@/lib/wca-person-api';
import { isMbldEvent, computeMbfMo3 } from '@/lib/mbf-average';
import { UnofficialMark } from '@/components/UnofficialMark';
import { rowChangeKey, changeChainOldValues, effectiveFieldValue, effectiveAttempts, attemptOldValues, effectiveAttemptPenalties, recordAttemptEdit, recordAttemptOriginal, recordAttemptPenalty, splitChainByStatus } from '@/lib/result-watch-api';
import { useRowChangeMap } from '../../logic/use-row-change-map';
import { useLivePrRanks } from '../../logic/use-live-pr-ranks';
import { ResultChangeChain } from './ChangedResultValue';
import { PendingProposals } from './PendingProposals';
import { ResultChangeEditor, type ResultChangeTarget } from './ResultChangeEditor';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { useAuthStore } from '@/lib/auth-store';
import { Pencil, ArrowUp, ArrowDown } from 'lucide-react';
import { tr } from '@/i18n/tr';

// MBLD 无官方平均 → 用非官方 Mo3(从该轮 attempts 现算);其它项目用官方 average。
function effectiveAverage(r: WcaResultRow, eventId: string): number {
  if (r.average && r.average !== 0) return r.average;
  if (isMbldEvent(eventId)) return computeMbfMo3(r.attempts);
  return r.average;
}

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  reconLookup: Map<string, number> | null;
  eventId: string;
  isZh: boolean;
  editMode?: boolean;
  onToggleEditMode?: () => void;
  showAttemptRanks?: boolean;
  onToggleAttemptRanks?: () => void;
}

type SubSub = 'all' | 'trend' | 'distviz';

export default function ByEventView({ profile, results, comps, reconLookup, eventId, isZh, editMode, onToggleEditMode, showAttemptRanks = true, onToggleAttemptRanks }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const myWcaId = useAuthStore((s) => s.user?.wcaId);
  const admin = isAdminWcaId(myWcaId);
  const canEdit = !!myWcaId;  // 任何登录用户都能编辑 / 提议(管理员即时,其余待审核)
  // 3 选一:成绩(轮次表)/ 趋势(成绩+排名两图)/ 分布。
  // 默认落「成绩」—— 打开项目即见结果表,且 #r- 深链锚点所在的表默认已挂载。
  const [view, setView] = useState<SubSub>('all');
  const [hist, setHist] = useState<PersonRankHistoryResponse | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    setHist(null);
    setHistLoading(true);
    fetchPersonRankHistory(profile.person.wca_id, eventId)
      .then((j) => setHist(j))
      .catch(() => { /* server endpoint may not exist yet — chart will simply hide */ })
      .finally(() => setHistLoading(false));
  }, [profile.person.wca_id, eventId]);

  if (!results || !comps) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;

  const compById = new Map(comps.map((c) => [c.id, c]));
  const eventResults = results
    .filter((r) => r.event_id === eventId)
    .slice()
    .sort((a, b) => {
      const da = compById.get(a.competition_id)?.start_date ?? '';
      const db = compById.get(b.competition_id)?.start_date ?? '';
      return da.localeCompare(db) || a.id - b.id;
    });

  return (
    <div className="wp-byevent">
      <div className="wp-subsubtab-bar">
        <button
          className={`wp-subsubtab-btn ${view === 'all' ? 'is-active' : ''}`}
          onClick={() => setView('all')}
        >{t('成绩', 'Results')}</button>
        {view === 'all' && (
          <span className="wp-section-h-tools">
            {onToggleAttemptRanks && <AttemptRanksToggle active={showAttemptRanks} onToggle={onToggleAttemptRanks} />}
            {canEdit && onToggleEditMode && <EditModeToggle active={!!editMode} onToggle={onToggleEditMode} propose={!admin} />}
          </span>
        )}
        <button
          className={`wp-subsubtab-btn ${view === 'trend' ? 'is-active' : ''}`}
          onClick={() => setView('trend')}
        >{t('趋势', 'Trend')}</button>
        <button
          className={`wp-subsubtab-btn ${view === 'distviz' ? 'is-active' : ''}`}
          onClick={() => setView('distviz')}
        >{t('分布', 'Distribution')}</button>
      </div>

      {view === 'trend' && (
        <>
          <div className="wp-trend-block">
            <div className="wp-trend-h">{t('成绩趋势', 'Times Trend')}</div>
            <BestChart
              eventId={eventId}
              rows={eventResults}
              compById={compById}
              isZh={isZh}
            />
          </div>
          <div className="wp-trend-block">
            <div className="wp-trend-h">{t('排名趋势', 'Rank Trend')}</div>
            {histLoading && <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>}
            {!histLoading && hist && hist.rows.length > 0 && (
              <RankChart hist={hist} isZh={isZh} />
            )}
            {!histLoading && hist && hist.rows.length === 0 && (
              <div className="wp-empty">{t('暂无年度排名数据', 'No yearly rank data')}</div>
            )}
            {!histLoading && !hist && (
              <div className="wp-empty wp-text-mute">{t('排名数据暂未生成(服务端 stats-build 数据未就绪)', 'Rank history not yet built on server')}</div>
            )}
          </div>
        </>
      )}
      {view === 'distviz' && (
        <DistributionViz wcaId={profile.person.wca_id} eventId={eventId} />
      )}
      {view === 'all' && (
        <EventRoundsList
          wcaId={profile.person.wca_id}
          personName={profile.person.name}
          personCountry={profile.person.country_iso2}
          rows={eventResults}
          compById={compById}
          results={results}
          comps={comps}
          eventId={eventId}
          reconLookup={reconLookup}
          isZh={isZh}
          editMode={editMode}
          showAttemptRanks={showAttemptRanks}
        />
      )}
    </div>
  );
}

// hash 形如 #r-{compId}-{eventId}-{round}.如果 round 是 recon 端 ('1'/'2'/'3'/'f'),
// 实际 WCA 行 id 可能是 'd'/'g'/'b'/'c' 等 cutoff 子型.按 ROUND_VARIANTS 反查.
function resolveHashRow(hash: string): HTMLElement | null {
  if (!hash) return null;
  const slug = hash.slice(1);
  const direct = document.getElementById(slug);
  if (direct) return direct;
  const m = slug.match(/^(.+)-([^-]+)$/);
  if (!m) return null;
  const prefix = m[1];
  const round = m[2];
  const variants = ROUND_VARIANTS[round] ?? [round];
  for (const v of variants) {
    if (v === round) continue;
    const el = document.getElementById(`${prefix}-${v}`);
    if (el) return el;
  }
  return null;
}

// ─── 全部成绩 (按比赛倒序的轮次表) ───────────────────────────────────────
// 轮次显示元数据已抽到 utils/wca_round_meta.ts 共用 (ByCompList / 复盘页同场比赛表也用)

function EventRoundsList({
  wcaId, personName, personCountry, rows, compById, results, comps, eventId, reconLookup, isZh, editMode, showAttemptRanks = true,
}: {
  wcaId: string;
  personName?: string | null;
  personCountry?: string;
  rows: WcaResultRow[];
  compById: Map<string, WcaCompetition>;
  results: WcaResultRow[];
  comps: WcaCompetition[];
  eventId: string;
  reconLookup: Map<string, number> | null;
  isZh: boolean;
  editMode?: boolean;
  showAttemptRanks?: boolean;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const { map: changeMap, refresh: refreshChanges } = useRowChangeMap(wcaId);
  const myWcaId = useAuthStore((s) => s.user?.wcaId);
  const admin = isAdminWcaId(myWcaId);
  const isOwner = !!myWcaId && myWcaId === wcaId;
  const loggedIn = !!myWcaId;
  const [editTarget, setEditTarget] = useState<ResultChangeTarget | null>(null);
  // 排序:点列头(单次/平均/第 N 把)切 升序→降序→取消;无效成绩(DNF/DNS/空位)永远垫底。
  // key=null → 默认按比赛日期倒序分组;key 非空 → 拉平本项目所有轮次重排,逐行显示比赛名。
  const [sort, setSort] = useState<{ key: string | null; dir: 'asc' | 'desc' }>({ key: null, dir: 'asc' });
  const toggleSort = useCallback((key: string) => {
    setSort(prev => prev.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' });
  }, []);
  // 切项目时重置排序(不同项目把数 / 量纲不同)。
  useEffect(() => { setSort({ key: null, dir: 'asc' }); }, [eventId]);
  // 排序把序号只给前 5 把(head-to-head 等可能有 1~23 把,但只关心前 5).
  const maxAttempts = useMemo(() => Math.min(5, rows.reduce((m, r) => Math.max(m, r.attempts?.length ?? 0), 0)), [rows]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams ? `?${searchParams.toString()}` : '';
  const [hash, setHash] = useState<string>(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // PR / 名次染色只算官方成绩:直播(非官方)行不参与
  const prRank = useMemo(() => computePrRank(results.filter((r) => !r.live), comps), [results, comps]);
  // 直播行另算一份「官方 + 直播」的时间序名次,使直播行的单次/平均/逐把 PR 与官方行同一 dense-rank
  // 口径且彼此自洽(最好那把 == 单次列)。只取直播行用,不读官方行 → 不污染官方 PR 标记。
  const prRankLive = useMemo(() =>
    results.some((r) => r.live) ? computePrRank(results, comps) : null,
    [results, comps],
  );
  // 直播行的区域纪录标志(WR/CR/NR)单独从 cubing-live 源取(与 /wca/comp 领奖台同口径);
  // 名次数字优先用本地 prRankLive,cubing pS/pA 仅作兜底(本地无效时)。
  const livePrRanks = useLivePrRanks(rows, wcaId);

  // /wca/regulations 风格的 hash 锚点:#r-{comp}-{event}-{round}
  useEffect(() => {
    document.querySelectorAll('.wp-row-target').forEach((el) => el.classList.remove('wp-row-target'));
    if (!hash) return;
    const el = resolveHashRow(hash);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('wp-row-target');
  }, [hash, rows]);

  const hashOf = (compId: string, roundType: string) =>
    `#r-${compId}-${eventId}-${roundType}`;
  const buildAnchorHref = (compId: string, roundType: string) =>
    `${pathname}${search}${hashOf(compId, roundType)}`;

  // 整行点击 → 切 hash,只是点 td 空白处生效;内部 Link/button 走自己 (closest 'a, button' 时跳过).
  // Next App Router 改 hash 不触发 hashchange,故手动同步 hash state 让高亮立即生效.
  const selectRow = (compId: string, roundType: string) => {
    router.replace(buildAnchorHref(compId, roundType), { scroll: false });
    setHash(hashOf(compId, roundType));
  };
  const handleRowClick = (e: React.MouseEvent, compId: string, roundType: string) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    selectRow(compId, roundType);
  };

  // 按比赛日期倒序,组内按 round_type 顺序(决赛在上).
  const baseSorted = useMemo(() => {
    return rows.slice().sort((a, b) => {
      const ca = compById.get(a.competition_id);
      const cb = compById.get(b.competition_id);
      const da = ca?.start_date ?? '';
      const db = cb?.start_date ?? '';
      if (da !== db) return db.localeCompare(da);
      if (a.competition_id !== b.competition_id) return a.competition_id.localeCompare(b.competition_id);
      return (ROUND_ORDER[a.round_type_id] ?? 99) - (ROUND_ORDER[b.round_type_id] ?? 99);
    });
  }, [rows, compById]);

  // 排序后的展示顺序:key=null 用默认分组序;否则拉平按所选键升/降排,无效(≤0)恒垫底,
  // 平手 / 双无效保持 baseSorted 的时间序(Array.sort 在 V8 稳定).
  const displayRows = useMemo(() => {
    if (!sort.key) return baseSorted;
    const key = sort.key, dir = sort.dir;
    const valOf = (r: WcaResultRow): number => {
      if (key === 'pos') return r.pos;            // 名次:数字越小越好,与单次/平均同向(≤0 垫底)
      if (key === 'single') return r.best;
      if (key === 'average') return effectiveAverage(r, eventId);
      return r.attempts?.[Number(key.slice(3))] ?? 0;
    };
    return baseSorted.slice().sort((a, b) => {
      const va = valOf(a), vb = valOf(b);
      const ia = !(va > 0), ib = !(vb > 0);   // DNF/DNS/空位 = 无效
      if (ia && ib) return 0;
      if (ia) return 1;
      if (ib) return -1;
      return dir === 'asc' ? va - vb : vb - va;
    });
  }, [baseSorted, sort, eventId]);

  if (displayRows.length === 0) return <div className="wp-empty">{t('暂无成绩', 'No results yet')}</div>;

  const grouped = !sort.key;
  // 分组视图:同一比赛只在首行展示比赛名 + 日期;排序视图:逐行都展示(已打散).
  let lastCompId = '';
  // 列头排序按钮的方向箭头.
  const sortArrow = (key: string) =>
    sort.key === key ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null;

  return (
    // sticky 列头吸顶:复用全站共用工具(sticky-scroll + sticky-thead,见 components/sticky-table.css)。
    <div className="sticky-scroll">
      <table className="wp-bycomp-table sticky-thead">
        <thead>
          <tr>
            <th>{t('比赛', 'Competition')}</th>
            <th>
              <span className="wp-th-info">
                {t('轮次', 'Round')}
                <InfoTooltip content={t(ROUND_HINT_ZH, ROUND_HINT_EN)} />
              </span>
            </th>
            <th className="wp-th-narrow">
              <button type="button" className={`wp-sort-th ${sort.key === 'pos' ? 'is-active' : ''}`}
                onClick={() => toggleSort('pos')} title={t('按排名排序', 'Sort by placement')}>
                {t('排名', 'Pos')}{sortArrow('pos')}
              </button>
            </th>
            <th>
              <button type="button" className={`wp-sort-th ${sort.key === 'single' ? 'is-active' : ''}`}
                onClick={() => toggleSort('single')} title={t('按单次排序', 'Sort by single')}>
                {t('单次', 'Single')}{sortArrow('single')}
              </button>
            </th>
            <th>
              <button type="button" className={`wp-sort-th ${sort.key === 'average' ? 'is-active' : ''}`}
                onClick={() => toggleSort('average')} title={t('按平均排序', 'Sort by average')}>
                {t('平均', 'Avg')}{isMbldEvent(eventId) && <UnofficialMark />}{sortArrow('average')}
              </button>
            </th>
            <th className="wp-th-attempts">
              <span className="wp-att-head">
                {maxAttempts > 0 && (
                  <span className="wp-att-sort">
                    {Array.from({ length: maxAttempts }, (_, i) => (
                      <button key={i} type="button"
                        className={`wp-att-sort-i ${sort.key === `att${i}` ? 'is-active' : ''}`}
                        onClick={() => toggleSort(`att${i}`)}
                        title={t(`按第 ${i + 1} 把排序`, `Sort by attempt ${i + 1}`)}>
                        {i + 1}{sort.key === `att${i}` ? (sort.dir === 'asc' ? <ArrowUp size={9} /> : <ArrowDown size={9} />) : null}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r) => {
            const cmp = compById.get(r.competition_id);
            const rank = r.live ? prRankLive?.get(r.id) : prRank.get(r.id);
            const liveRank = r.live ? livePrRanks.get(r.id) : null;
            const singleRank = rank?.singleRank ?? liveRank?.pS ?? null;
            const averageRank = rank?.averageRank ?? liveRank?.pA ?? null;
            // 直播行的区域纪录(NR/WR/CR)与 /wca/comp 结果表同口径,优先于 PR 标志。
            const singleRecord = r.regional_single_record || (liveRank?.singleTag || null);
            const averageRecord = r.regional_average_record || (liveRank?.averageTag || null);
            const showComp = !grouped || r.competition_id !== lastCompId;
            lastCompId = r.competition_id;
            // 拆 status:approved 进有效值显示;pending 仅作「待审核」标记(不改官方值)。
            const { approved: chain, pending } = splitChainByStatus(changeMap.get(rowChangeKey(r.competition_id, eventId, r.round_type_id)));
            const oldBest = changeChainOldValues(chain, 'best');
            const oldAvg = changeChainOldValues(chain, 'average');
            const hasChange = chain.length > 0;
            // 当前有效值 = WCA 值叠加变更链最新(行内改某次后即时反映)
            const effBest = effectiveFieldValue(chain, 'best', r.best);
            const effAvg = effectiveFieldValue(chain, 'average', effectiveAverage(r, eventId));
            const effAttempts = effectiveAttempts(chain, r.attempts);
            return (
              <tr
                key={r.id}
                id={`r-${r.competition_id}-${eventId}-${r.round_type_id}`}
                className={`wp-row-anchorable ${showComp ? 'wp-row-comp-first' : ''} ${hasChange ? 'wp-row-changed' : ''} ${r.live ? 'wp-row-live' : ''}`}
                onClick={(e) => handleRowClick(e, r.competition_id, r.round_type_id)}
              >
                <td className="wp-cell-comp">
                  {showComp && cmp && (
                    <>
                      <Link
                        {...compLinkProps(cmp.id, { event: eventId, round: r.round_type_id, view: 'result' })}
                        className="wp-bycomp-name"
                      ><CompCell compId={cmp.id} compName={cmp.name} isZh={isZh} /></Link>
                      <div className="wp-cell-comp-date">{formatDateRangeIso(cmp.start_date, cmp.end_date)}</div>
                    </>
                  )}
                  {showComp && !cmp && r.competition_id}
                  {admin && editMode && (
                    <button
                      type="button"
                      className="wp-change-edit"
                      title={tr({ zh: '编辑成绩变更', en: 'Edit result changes' })}
                      onClick={() => setEditTarget({
                        wcaId,
                        competitionId: r.competition_id,
                        eventId,
                        roundTypeId: r.round_type_id,
                        resultId: r.id ?? null,
                        currentAttempts: effAttempts,
                        currentBest: effBest,
                        currentAverage: effAvg,
                        currentSingleRecord: r.regional_single_record ?? null,
                        currentAverageRecord: r.regional_average_record ?? null,
                        personName: personName ?? null,
                        compName: cmp?.name ?? null,
                      })}
                    ><Pencil size={13} /></button>
                  )}
                </td>
                <td>
                  <Link
                    href={buildAnchorHref(r.competition_id, r.round_type_id)}
                    replace
                    scroll={false}
                    onClick={() => setHash(hashOf(r.competition_id, r.round_type_id))}
                    className={`wp-round-tag wp-round-tag-link ${roundClass(r.round_type_id)}`}
                    title={t('复制到链接', 'Copy link to this row')}
                  >
                    {roundLabel(r.round_type_id)}
                  </Link>
                  {r.live && (
                    <span className="wp-live-chip" title={t('直播成绩,非官方,待 WCA 官方确认', 'Live result — unofficial, pending WCA')}>
                      {t('直播', 'LIVE')}
                    </span>
                  )}
                  <PendingProposals pending={pending} eventId={eventId} isAdmin={admin} onModerated={refreshChanges} />
                </td>
                <td className={`wp-cell-pos ${r.pos === 1 ? 'wp-pos-first' : ''}`}>
                  {r.pos > 0 ? r.pos : '—'}
                </td>
                <td className={`wp-cell-result ${oldBest.length > 0 ? 'wp-cell-changed' : ''}`}>
                  <span className="record-num-cell">
                    <ResultChangeChain oldValues={oldBest} eventId={eventId} kind="single" note={chain?.[chain.length - 1]?.note} />
                    {formatWcaResult(effBest, eventId, 'single')}
                    {singleRecord
                      ? <RecordBadge record={singleRecord} variant="inline" />
                      : singleRank
                        ? <RecordBadge record={singleRank === 1 ? 'PR' : `PR${singleRank}`} variant="inline" />
                        : null}
                  </span>
                </td>
                <td className={`wp-cell-result ${oldAvg.length > 0 ? 'wp-cell-changed' : ''}`}>
                  <AverageValueCell
                    effAvg={effAvg}
                    attempts={effAttempts}
                    eventId={eventId}
                    averageRecord={averageRecord}
                    averageRank={averageRank}
                    oldValues={oldAvg}
                    note={chain?.[chain.length - 1]?.note}
                  />
                </td>
                <td className={`wp-cell-attempts ${showAttemptRanks ? '' : 'wp-cell-attempts--center'}`}>
                  <AttemptsList
                    attempts={effAttempts}
                    best={effBest}
                    eventId={eventId}
                    compId={r.competition_id}
                    roundTypeId={r.round_type_id}
                    reconLookup={reconLookup}
                    isZh={isZh}
                    admin={admin}
                    isOwner={isOwner}
                    canEdit={loggedIn}
                    editMode={editMode}
                    personId={wcaId}
                    personName={personName ?? ''}
                    personCountry={personCountry}
                    compName={cmp?.name ?? ''}
                    compCountry={cmp?.country_iso2}
                    compDate={cmp?.start_date}
                    attemptOlds={effAttempts.map((_, i) => attemptOldValues(chain, i))}
                    penalties={effectiveAttemptPenalties(chain)}
                    attemptRanks={showAttemptRanks ? (rank?.attemptRanks ?? null) : null}
                    singleRecord={showAttemptRanks ? singleRecord : null}
                    onEdit={(index, newValue, note) =>
                      recordAttemptEdit({
                        target: { wcaId, competitionId: r.competition_id, eventId, roundTypeId: r.round_type_id, resultId: r.id ?? null },
                        currentAttempts: effAttempts, currentBest: effBest, currentAverage: effAvg,
                        index, newValue, note,
                      }).then(refreshChanges)
                    }
                    onSetOriginal={(index, originalValue, note) =>
                      recordAttemptOriginal({
                        target: { wcaId, competitionId: r.competition_id, eventId, roundTypeId: r.round_type_id, resultId: r.id ?? null },
                        currentAttempts: effAttempts, currentBest: effBest, currentAverage: effAvg,
                        index, originalValue, note, existingChain: chain, propose: !admin,
                      }).then(refreshChanges)
                    }
                    onSetPenalty={(index, penaltyCs, note) =>
                      recordAttemptPenalty({
                        target: { wcaId, competitionId: r.competition_id, eventId, roundTypeId: r.round_type_id, resultId: r.id ?? null },
                        currentAttempts: effAttempts,
                        index, penaltyCs, note, existingChain: chain, propose: !admin && !isOwner,
                      }).then(refreshChanges)
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {editTarget && (
        <ResultChangeEditor
          target={editTarget}
          existingChanges={changeMap.get(rowChangeKey(editTarget.competitionId, editTarget.eventId, editTarget.roundTypeId)) ?? []}
          onClose={() => setEditTarget(null)}
          onSaved={() => refreshChanges()}
        />
      )}
    </div>
  );
}

// ─── 最佳成绩 折线图 ─────────────────────────────────────────────────
function BestChart({
  eventId, rows, compById, isZh,
}: {
  eventId: string;
  rows: WcaResultRow[];
  compById: Map<string, WcaCompetition>;
  isZh: boolean;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const isMbld = eventId === '333mbf';
  const isFmc  = eventId === '333fm';

  // PR 检测 + axis 值映射(toAxisValue 把 FMC moves / MBLD score 转成统一刻度)
  let bestSingle = Infinity;
  let bestAvg = Infinity;
  const points = rows.map((r) => {
    const sAxis = r.best > 0 ? toAxisValue(r.best, eventId, 'single') : null;
    const avgVal = effectiveAverage(r, eventId); // MBLD 用非官方 Mo3
    const aAxis = avgVal > 0 ? toAxisValue(avgVal, eventId, 'average') : null;
    let prS = false, prA = false;
    if (sAxis !== null && sAxis < bestSingle) { prS = true; bestSingle = sAxis; }
    if (aAxis !== null && aAxis < bestAvg)    { prA = true; bestAvg = aAxis; }
    return { r, sAxis, aAxis, prS, prA };
  }).filter((p) => p.sAxis !== null || p.aAxis !== null);

  if (points.length === 0) return <div className="wp-empty">{t('暂无成绩', 'No data')}</div>;

  const xData = points.map((_, i) => String(i + 1));
  const interval = points.length > 12 ? Math.ceil(points.length / 10) : 0;
  const singleLabel = t('单次', 'Single');
  // MBLD 平均为非官方 Mo3,图例直接标明,省去图内额外标记
  const avgLabel    = isMbld ? t('平均(非官方 Mo3)', 'Avg (unofficial Mo3)') : t('平均', 'Avg');

  const PR_RED = '#ef4444';
  const SINGLE_COLOR = '#3b82f6';
  const AVG_COLOR    = '#22c55e';
  // 用 markPoint 单独叠加 PR 红 dot — echarts 在 data 多时自动隐藏 line symbol
  const mkPRMarks = (key: 'sAxis' | 'aAxis', prKey: 'prS' | 'prA') =>
    points.flatMap((p, i) => {
      const v = p[key];
      return p[prKey] && v !== null ? [{ coord: [i, v] }] : [];
    });

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ dataIndex: number }>) => {
        if (!params || params.length === 0) return '';
        const p = points[params[0]!.dataIndex];
        if (!p) return '';
        const cmp = compById.get(p.r.competition_id);
        let tip = cmp ? `<strong>${localizeCompName(cmp.id, cmp.name, isZh)}</strong><br/>` : '';
        if (p.sAxis !== null) {
          const pr = p.prS ? ` <span style="color:${PR_RED}">PR</span>` : '';
          tip += `<span style="display:inline-block;width:10px;height:10px;background:${SINGLE_COLOR};border-radius:50%;margin-right:6px;vertical-align:middle"></span>${singleLabel}: ${formatWcaResult(p.r.best, eventId, 'single')}${pr}<br/>`;
        }
        if (p.aAxis !== null) {
          const pr = p.prA ? ` <span style="color:${PR_RED}">PR</span>` : '';
          tip += `<span style="display:inline-block;width:10px;height:10px;background:${AVG_COLOR};border-radius:50%;margin-right:6px;vertical-align:middle"></span>${avgLabel}: ${formatWcaResult(effectiveAverage(p.r, eventId), eventId, 'average')}${pr}<br/>`;
        }
        return tip;
      },
    },
    legend: { data: [singleLabel, avgLabel], top: 0 },
    grid: { left: '3%', right: '4%', bottom: 70, top: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { interval, show: false }, // 比赛序号意义不大
    },
    yAxis: {
      type: 'value',
      splitLine: { show: false }, // 去掉横向网格白线
      axisLabel: {
        formatter: (val: number) => {
          if (isFmc || isMbld) return String(val.toFixed(0));
          return formatTime(val);
        },
      },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
      { type: 'slider', xAxisIndex: 0, height: 20, bottom: 20, start: 0, end: 100 },
    ],
    series: [
      {
        name: singleLabel,
        type: 'line', smooth: true,
        showSymbol: false,
        itemStyle: { color: SINGLE_COLOR },
        lineStyle: { color: SINGLE_COLOR },
        data: points.map((p) => p.sAxis),
        connectNulls: false,
        // single PR: 实心红圆
        markPoint: {
          symbol: 'circle', symbolSize: 9,
          itemStyle: { color: PR_RED, borderColor: '#fff', borderWidth: 1.5 },
          label: { show: false },
          data: mkPRMarks('sAxis', 'prS'),
        },
      },
      {
        name: avgLabel,
        type: 'line', smooth: true,
        showSymbol: false,
        itemStyle: { color: AVG_COLOR },
        lineStyle: { color: AVG_COLOR },
        data: points.map((p) => p.aAxis),
        connectNulls: false,
        // avg PR: 红色钻石,跟 single 圆形区分,即使位置重叠也认得出
        markPoint: {
          symbol: 'diamond', symbolSize: 11,
          itemStyle: { color: PR_RED, borderColor: '#fff', borderWidth: 1.5 },
          label: { show: false },
          data: mkPRMarks('aAxis', 'prA'),
        },
      },
    ],
  };

  return (
    <div style={{ height: 400 }}>
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
    </div>
  );
}

// 把 raw 值映射到 chart Y 轴(秒为主).
// FMC single = 步数;FMC avg = moves×100 → 步数;MBLD = points (越高越好,反向).
function toAxisValue(v: number, eventId: string, kind: 'single' | 'average'): number {
  if (eventId === '333fm') {
    if (kind === 'single') return v;
    return v / 100;
  }
  if (eventId === '333mbf') {
    // 0DDTTTTTMM: diff = 99 - DD, score = solved - missed = diff
    const s = String(v).padStart(10, '0');
    const dd = parseInt(s.slice(1, 3), 10);
    const diff = 99 - dd;
    // chart Y 轴用"被减分"作为时间替代:轴反向时不爽 — 直接 100 - score 让"越往下越好"
    return 100 - diff;
  }
  return v / 100; // centiseconds → seconds
}

function formatTime(sec: number): string {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return `${m}:${s.toFixed(2).padStart(5, '0')}`;
  }
  return sec.toFixed(2);
}

// ─── 历史成绩排名 折线图 ──────────────────────────────────────────────
// echarts 版,直接 fork 自 cubing.pro `ResultWIthEventRankingTimers.tsx` (GPL-3.0)
// 6 条 series (NR/CR/WR × single/avg) + dataZoom slider + 触摸 + tooltip
function RankChart({ hist, isZh }: { hist: PersonRankHistoryResponse; isZh: boolean }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const rows = hist.rows.slice().sort(
    (a, b) => (a.year * 12 + (a.month ?? 0)) - (b.year * 12 + (b.month ?? 0))
  );
  if (rows.length === 0) return null;

  const xData = rows.map((r) =>
    r.month !== undefined ? `${r.year}-${String(r.month).padStart(2, '0')}` : String(r.year)
  );

  const series = [
    { key: 'singleCountryRank',   label: t('单次-NR', 'Single-NR'), color: '#1f3f78' },
    { key: 'singleContinentRank', label: t('单次-CR', 'Single-CR'), color: '#6ab15a' },
    { key: 'singleWorldRank',     label: t('单次-WR', 'Single-WR'), color: '#c39316' },
    { key: 'avgCountryRank',      label: t('平均-NR', 'Avg-NR'),    color: '#b71234' },
    { key: 'avgContinentRank',    label: t('平均-CR', 'Avg-CR'),    color: '#5fa3c7' },
    { key: 'avgWorldRank',        label: t('平均-WR', 'Avg-WR'),    color: '#2c7a4b' },
  ] as const;
  type RankKey = typeof series[number]['key'];

  const seriesData = (key: RankKey) =>
    rows.map((r) => {
      const v = r[key];
      return v !== null && v > 0 ? v : null;
    });

  const interval = rows.length > 12 ? Math.ceil(rows.length / 10) : 0;

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ dataIndex: number; name: string }>) => {
        if (!params || params.length === 0) return '';
        const idx = params[0]!.dataIndex;
        const getPrev = (key: RankKey, currIdx: number): number | null => {
          for (let i = currIdx - 1; i >= 0; i--) {
            const v = rows[i]![key];
            if (v !== null && v > 0) return v;
          }
          return null;
        };
        let tip = `<strong>${params[0]!.name}</strong><br/>`;
        for (const s of series) {
          const v = rows[idx]![s.key];
          if (v === null || v <= 0) continue;
          const prev = getPrev(s.key, idx);
          let change = '';
          if (prev !== null) {
            const diff = prev - v;
            if (diff > 0)      change = ` <span style="color:#22c55e">↑${diff}</span>`;
            else if (diff < 0) change = ` <span style="color:#ef4444">↓${-diff}</span>`;
          }
          tip += `<span style="display:inline-block;width:10px;height:10px;background:${s.color};border-radius:50%;margin-right:6px;vertical-align:middle"></span>${s.label}: ${v}${change}<br/>`;
        }
        return tip;
      },
    },
    legend: {
      data: series.map((s) => s.label),
      top: 0,
      type: 'scroll',
    },
    grid: { left: '3%', right: '4%', bottom: 70, top: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { rotate: -45, interval },
    },
    yAxis: {
      type: 'value',
      name: t('排名', 'Rank'),
      inverse: false, // 0 在底,大数在顶 — 同 cubing.pro
      min: 0,
      max: (val: { max: number }) => Math.ceil(val.max * 1.1),
      splitLine: { show: false }, // 去掉横向网格白线
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
      { type: 'slider', xAxisIndex: 0, height: 20, bottom: 20, start: 0, end: 100 },
    ],
    series: series.map((s) => ({
      name: s.label,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      itemStyle: { color: s.color },
      lineStyle: { color: s.color },
      data: seriesData(s.key),
      connectNulls: false,
    })),
  };

  return (
    <div style={{ height: 400 }}>
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
    </div>
  );
}
