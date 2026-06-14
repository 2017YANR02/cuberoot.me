'use client';
// 按比赛:每场比赛一组,每行 (项目 / 轮次 / 排名 / 单次 / 平均 / 各次尝试).
// 进步(PB)染色 + regional record 标签.

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { formatDateRangeIso } from '@/lib/wca-date';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { formatWcaResult } from '@/lib/wca-format-result';
import { isAo5Bracketed } from '@/lib/wca-ao5-brackets';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { CompCell } from '@/components/CompCell/CompCell';
import { compLinkProps } from '@/lib/comp-link';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { computePrRank } from '../../logic/progress';
import { ROUND_ORDER, ROUND_HINT_ZH, ROUND_HINT_EN, roundLabel, roundClass } from '@/lib/wca-round-meta';
import { findReconForAttempt } from '@/lib/recon-attempt-lookup';
import { ROUND_VARIANTS } from '@/lib/wca-results-api';
import type { WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import { rowChangeKey, changeOldValue } from '@/lib/result-watch-api';
import { useRowChangeMap } from '../../logic/use-row-change-map';
import { ChangedResultValue } from './ChangedResultValue';
import i18n from "@/i18n/i18n-client";

// hash 形如 #r-{compId}-{eventId}-{round}.按 ROUND_VARIANTS 反查 cutoff 子型 ('d'/'g'/'b' etc).
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

interface Props {
  wcaId: string;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  reconLookup: Map<string, number> | null;
  isZh: boolean;
}

// 轮次显示元数据走 utils/wca_round_meta (ByEventView / 复盘页同场比赛表也用)

export default function ByCompList({ wcaId, results, comps, reconLookup, isZh }: Props) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  const changeMap = useRowChangeMap(wcaId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Next App Router does not surface URL hash via hooks; track via window.
  const [hash, setHash] = useState<string>(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const search = searchParams ? `?${searchParams.toString()}` : '';

  const prRank = useMemo(() =>
    results && comps ? computePrRank(results, comps) : new Map(),
    [results, comps],
  );

  const grouped = useMemo(() => {
    if (!results || !comps) return null;
    const compById = new Map(comps.map((c) => [c.id, c]));
    const byComp = new Map<string, WcaResultRow[]>();
    for (const r of results) {
      const arr = byComp.get(r.competition_id);
      if (arr) arr.push(r);
      else byComp.set(r.competition_id, [r]);
    }
    const compsDesc = comps.slice().sort((a, b) => b.start_date.localeCompare(a.start_date));
    return compsDesc
      .filter((c) => byComp.has(c.id))
      .map((c) => ({
        comp: c,
        rows: byComp.get(c.id)!.slice().sort((a, b) => {
          if (a.event_id !== b.event_id) return a.event_id.localeCompare(b.event_id);
          return (ROUND_ORDER[a.round_type_id] ?? 99) - (ROUND_ORDER[b.round_type_id] ?? 99);
        }),
        compById, // unused but keeps closure happy
      }));
  }, [results, comps]);

  // /wca/regulations 风格的 hash 锚点:#r-{comp}-{event}-{round}
  // 走 lazy import,:target 在 mount 后失效 → 手动 class,持续到 hash 改变.

  useEffect(() => {
    document.querySelectorAll('.wp-row-target').forEach((el) => el.classList.remove('wp-row-target'));
    if (!grouped || !hash) return;
    const el = resolveHashRow(hash);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('wp-row-target');
  }, [grouped, hash]);

  const hashOf = (compId: string, eventId: string, roundType: string) =>
    `#r-${compId}-${eventId}-${roundType}`;
  const buildAnchorHref = (compId: string, eventId: string, roundType: string) =>
    `${pathname}${search}${hashOf(compId, eventId, roundType)}`;

  // 整行点击 → 切 hash (replace 防历史污染);内部 Link/button 走自己 (closest 检查跳过).
  // Next App Router 改 hash 不触发 hashchange,故手动同步 hash state 让高亮立即生效.
  const selectRow = (compId: string, eventId: string, roundType: string) => {
    router.replace(buildAnchorHref(compId, eventId, roundType), { scroll: false });
    setHash(hashOf(compId, eventId, roundType));
  };
  const handleRowClick = (e: React.MouseEvent, compId: string, eventId: string, roundType: string) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    selectRow(compId, eventId, roundType);
  };

  if (!grouped) return <div className="wp-loading-inline">{t('加载中…', 'Loading…', "載入中…")}</div>;
  if (grouped.length === 0) return <div className="wp-empty">{t('暂无成绩', 'No results yet', "暫無成績")}</div>;

  return (
    <div className="wp-bycomp">
      {grouped.map(({ comp, rows }) => {
        // event 内只在第一行显示项目名,视觉分组
        let lastEvent = '';
        return (
          <div key={comp.id} className="wp-bycomp-block">
            <div className="wp-bycomp-header">
              <Link
                {...compLinkProps(comp.id)}
                prefetch={false}
                className="wp-bycomp-name"
              ><CompCell compId={comp.id} compName={comp.name} isZh={isZh} /></Link>
              <span className="wp-bycomp-date">{formatDateRangeIso(comp.start_date, comp.end_date)}</span>
            </div>
            <div className="wp-table-scroll">
              <table className="wp-bycomp-table">
                <thead>
                  <tr>
                    <th>{t('项目', 'Event', "項目")}</th>
                    <th>
                      <span className="wp-th-info">
                        {t('轮次', 'Round', "輪次")}
                        <InfoTooltip content={t(ROUND_HINT_ZH, ROUND_HINT_EN)} />
                      </span>
                    </th>
                    <th className="wp-th-narrow">{t('排名', 'Pos')}</th>
                    <th>{t('单次', 'Single', "單次")}</th>
                    <th>{t('平均', 'Avg')}</th>
                    <th>{t('详细成绩', 'Attempts', "詳細成績")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const rank = prRank.get(r.id);
                    const singleRank = rank?.singleRank ?? null;
                    const averageRank = rank?.averageRank ?? null;
                    const showEvent = r.event_id !== lastEvent;
                    lastEvent = r.event_id;
                    const chg = changeMap.get(rowChangeKey(comp.id, r.event_id, r.round_type_id));
                    const modified = chg?.changeType === 'modified';
                    const oldBest = modified ? changeOldValue(chg, 'best') : null;
                    const oldAvg = modified ? changeOldValue(chg, 'average') : null;
                    return (
                      <tr
                        key={r.id}
                        id={`r-${comp.id}-${r.event_id}-${r.round_type_id}`}
                        className={`wp-row-anchorable ${chg ? 'wp-row-changed' : ''}`}
                        onClick={(e) => handleRowClick(e, comp.id, r.event_id, r.round_type_id)}
                      >
                        <td className="wp-cell-event">
                          {showEvent && <EventIcon event={r.event_id} className="wp-event-icon-sm" />}
                        </td>
                        <td>
                          <Link
                            href={buildAnchorHref(comp.id, r.event_id, r.round_type_id)}
                            replace
                            scroll={false}
                            onClick={() => setHash(hashOf(comp.id, r.event_id, r.round_type_id))}
                            className={`wp-round-tag wp-round-tag-link ${roundClass(r.round_type_id)}`}
                            title={t('复制到链接', 'Copy link to this row', "複製到連結")}
                          >
                            {roundLabel(r.round_type_id)}
                          </Link>
                        </td>
                        <td className={`wp-cell-pos ${r.pos === 1 ? 'wp-pos-first' : ''}`}>
                          {r.pos > 0 ? r.pos : '—'}
                        </td>
                        <td className={`wp-cell-result ${oldBest != null ? 'wp-cell-changed' : ''}`}>
                          <span className="record-num-cell">
                            <ChangedResultValue oldValue={oldBest} eventId={r.event_id} kind="single" />
                            {formatWcaResult(r.best, r.event_id, 'single')}
                            {r.regional_single_record
                              ? <RecordBadge record={r.regional_single_record} variant="inline" />
                              : singleRank
                                ? <RecordBadge record={singleRank === 1 ? 'PR' : `PR${singleRank}`} variant="inline" />
                                : null}
                          </span>
                        </td>
                        <td className={`wp-cell-result ${oldAvg != null ? 'wp-cell-changed' : ''}`}>
                          <span className="record-num-cell">
                            <ChangedResultValue oldValue={oldAvg} eventId={r.event_id} kind="average" />
                            {formatWcaResult(r.average, r.event_id, 'average')}
                            {r.regional_average_record
                              ? <RecordBadge record={r.regional_average_record} variant="inline" />
                              : averageRank
                                ? <RecordBadge record={averageRank === 1 ? 'PR' : `PR${averageRank}`} variant="inline" />
                                : null}
                          </span>
                        </td>
                        <td className="wp-cell-attempts">
                          <AttemptsList
                            attempts={r.attempts}
                            best={r.best}
                            eventId={r.event_id}
                            compId={r.competition_id}
                            roundTypeId={r.round_type_id}
                            reconLookup={reconLookup}
                            isZh={isZh}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 把 attempts 渲染为可折行 inline 列表(支持 H2H 等 5+ 次的格式).
function AttemptsList({ attempts, best, eventId, compId, roundTypeId, reconLookup, isZh }: {
  attempts: number[];
  best: number;
  eventId: string;
  compId: string;
  roundTypeId: string;
  reconLookup: Map<string, number> | null;
  isZh: boolean;
}) {
  if (attempts.length === 0) return <span className="wp-text-mute">—</span>;
  const validNums = attempts.filter((x) => x > 0);
  const minValid = validNums.length > 0 ? Math.min(...validNums) : 0;
  const langQuery = isZh ? '?lang=zh' : '';
  return (
    <span className="wp-attempts-flow">
      {attempts.map((a, i) => {
        if (a === undefined) return null;
        const formatted = formatWcaResult(a, eventId, 'single');
        const isBest = validNums.length > 0 && a > 0 && a === minValid && a === best;
        const cls = `wp-att ${isBest ? 'wp-att-best' : ''} ${isAo5Bracketed(attempts, i) ? 'wp-att-trimmed' : ''}`;
        const reconId = findReconForAttempt(reconLookup, compId, eventId, roundTypeId, i + 1);
        if (reconId) {
          return (
            <Link key={i} href={`/recon/${reconId}${langQuery}`} className={`${cls} wp-att-recon`}>
              {formatted}
            </Link>
          );
        }
        return <span key={i} className={cls}>{formatted}</span>;
      })}
    </span>
  );
}

