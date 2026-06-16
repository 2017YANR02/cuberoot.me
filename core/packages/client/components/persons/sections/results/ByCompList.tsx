'use client';
// 按比赛:每场比赛一组,每行 (项目 / 轮次 / 排名 / 单次 / 平均 / 各次尝试).
// 进步(PB)染色 + regional record 标签.

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { formatDateRangeIso } from '@/lib/wca-date';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { formatWcaResult } from '@/lib/wca-format-result';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { CompCell } from '@/components/CompCell/CompCell';
import { compLinkProps } from '@/lib/comp-link';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { computePrRank } from '../../logic/progress';
import { ROUND_ORDER, ROUND_HINT_ZH, ROUND_HINT_EN, roundLabel, roundClass } from '@/lib/wca-round-meta';
import { AttemptsList } from './AttemptsList';
import { EditModeToggle } from './EditModeToggle';
import { ROUND_VARIANTS } from '@/lib/wca-results-api';
import type { WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import { rowChangeKey, changeChainOldValues, effectiveFieldValue, effectiveAttempts, attemptOldValues, effectiveAttemptPenalties, recordAttemptEdit, recordAttemptOriginal, recordAttemptPenalty } from '@/lib/result-watch-api';
import { useRowChangeMap } from '../../logic/use-row-change-map';
import { ResultChangeChain } from './ChangedResultValue';
import { ResultChangeEditor, type ResultChangeTarget } from './ResultChangeEditor';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { useAuthStore } from '@/lib/auth-store';
import { Pencil } from 'lucide-react';
import i18n from "@/i18n/i18n-client";
import { tr } from '@/i18n/tr';

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
  personName?: string | null;
  personCountry?: string;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  reconLookup: Map<string, number> | null;
  isZh: boolean;
  editMode?: boolean;
  onToggleEditMode?: () => void;
}

// 轮次显示元数据走 utils/wca_round_meta (ByEventView / 复盘页同场比赛表也用)

export default function ByCompList({ wcaId, personName, personCountry, results, comps, reconLookup, isZh, editMode, onToggleEditMode }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const { map: changeMap, refresh: refreshChanges } = useRowChangeMap(wcaId);
  const admin = useAuthStore((s) => isAdminWcaId(s.user?.wcaId));
  const [editTarget, setEditTarget] = useState<ResultChangeTarget | null>(null);
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

  // PR / 名次染色只算官方成绩:直播(非官方)行不参与,也不挤掉官方 PR 标记
  const prRank = useMemo(() =>
    results && comps ? computePrRank(results.filter((r) => !r.live), comps) : new Map(),
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

  if (!grouped) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;
  if (grouped.length === 0) return <div className="wp-empty">{t('暂无成绩', 'No results yet')}</div>;

  return (
    <div className="wp-bycomp">
      {admin && onToggleEditMode && (
        <div className="wp-section-h-row wp-section-h-row-bare">
          <EditModeToggle active={!!editMode} onToggle={onToggleEditMode} />
        </div>
      )}
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
                    <th>{t('项目', 'Event')}</th>
                    <th>
                      <span className="wp-th-info">
                        {t('轮次', 'Round')}
                        <InfoTooltip content={t(ROUND_HINT_ZH, ROUND_HINT_EN)} />
                      </span>
                    </th>
                    <th className="wp-th-narrow">{t('排名', 'Pos')}</th>
                    <th>{t('单次', 'Single')}</th>
                    <th>{t('平均', 'Avg')}</th>
                    <th>{t('详细成绩', 'Attempts')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const rank = prRank.get(r.id);
                    const singleRank = rank?.singleRank ?? null;
                    const averageRank = rank?.averageRank ?? null;
                    const showEvent = r.event_id !== lastEvent;
                    lastEvent = r.event_id;
                    const chain = changeMap.get(rowChangeKey(comp.id, r.event_id, r.round_type_id));
                    const oldBest = changeChainOldValues(chain, 'best');
                    const oldAvg = changeChainOldValues(chain, 'average');
                    const hasChange = !!chain && chain.length > 0;
                    // 当前有效值 = WCA 值叠加变更链最新(行内改某次后即时反映)
                    const effBest = effectiveFieldValue(chain, 'best', r.best);
                    const effAvg = effectiveFieldValue(chain, 'average', r.average);
                    const effAttempts = effectiveAttempts(chain, r.attempts);
                    return (
                      <tr
                        key={r.id}
                        id={`r-${comp.id}-${r.event_id}-${r.round_type_id}`}
                        className={`wp-row-anchorable ${hasChange ? 'wp-row-changed' : ''} ${r.live ? 'wp-row-live' : ''}`}
                        onClick={(e) => handleRowClick(e, comp.id, r.event_id, r.round_type_id)}
                      >
                        <td className="wp-cell-event">
                          {showEvent && <EventIcon event={r.event_id} className="wp-event-icon-sm" />}
                          {admin && editMode && (
                            <button
                              type="button"
                              className="wp-change-edit"
                              title={tr({ zh: '编辑成绩变更', en: 'Edit result changes' })}
                              onClick={() => setEditTarget({
                                wcaId,
                                competitionId: comp.id,
                                eventId: r.event_id,
                                roundTypeId: r.round_type_id,
                                resultId: r.id ?? null,
                                currentAttempts: effAttempts,
                                currentBest: effBest,
                                currentAverage: effAvg,
                                currentSingleRecord: r.regional_single_record ?? null,
                                currentAverageRecord: r.regional_average_record ?? null,
                                personName: personName ?? null,
                                compName: comp.name ?? null,
                              })}
                            ><Pencil size={13} /></button>
                          )}
                        </td>
                        <td>
                          <Link
                            href={buildAnchorHref(comp.id, r.event_id, r.round_type_id)}
                            replace
                            scroll={false}
                            onClick={() => setHash(hashOf(comp.id, r.event_id, r.round_type_id))}
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
                        </td>
                        <td className={`wp-cell-pos ${r.pos === 1 ? 'wp-pos-first' : ''}`}>
                          {r.pos > 0 ? r.pos : '—'}
                        </td>
                        <td className={`wp-cell-result ${oldBest.length > 0 ? 'wp-cell-changed' : ''}`}>
                          <span className="record-num-cell">
                            <ResultChangeChain oldValues={oldBest} eventId={r.event_id} kind="single" note={chain?.[chain.length - 1]?.note} />
                            {formatWcaResult(effBest, r.event_id, 'single')}
                            {r.regional_single_record
                              ? <RecordBadge record={r.regional_single_record} variant="inline" />
                              : singleRank
                                ? <RecordBadge record={singleRank === 1 ? 'PR' : `PR${singleRank}`} variant="inline" />
                                : null}
                          </span>
                        </td>
                        <td className={`wp-cell-result ${oldAvg.length > 0 ? 'wp-cell-changed' : ''}`}>
                          <span className="record-num-cell">
                            <ResultChangeChain oldValues={oldAvg} eventId={r.event_id} kind="average" note={chain?.[chain.length - 1]?.note} />
                            {formatWcaResult(effAvg, r.event_id, 'average')}
                            {r.regional_average_record
                              ? <RecordBadge record={r.regional_average_record} variant="inline" />
                              : averageRank
                                ? <RecordBadge record={averageRank === 1 ? 'PR' : `PR${averageRank}`} variant="inline" />
                                : null}
                          </span>
                        </td>
                        <td className="wp-cell-attempts">
                          <AttemptsList
                            attempts={effAttempts}
                            best={effBest}
                            eventId={r.event_id}
                            compId={r.competition_id}
                            roundTypeId={r.round_type_id}
                            reconLookup={reconLookup}
                            isZh={isZh}
                            admin={admin}
                            editMode={editMode}
                            personId={wcaId}
                            personName={personName ?? ''}
                            personCountry={personCountry}
                            compName={comp.name}
                            compCountry={comp.country_iso2}
                            compDate={comp.start_date}
                            attemptOlds={effAttempts.map((_, i) => attemptOldValues(chain, i))}
                            penalties={effectiveAttemptPenalties(chain)}
                            onEdit={(index, newValue, note) =>
                              recordAttemptEdit({
                                target: { wcaId, competitionId: comp.id, eventId: r.event_id, roundTypeId: r.round_type_id, resultId: r.id ?? null },
                                currentAttempts: effAttempts, currentBest: effBest, currentAverage: effAvg,
                                index, newValue, note,
                              }).then(refreshChanges)
                            }
                            onSetOriginal={(index, originalValue, note) =>
                              recordAttemptOriginal({
                                target: { wcaId, competitionId: comp.id, eventId: r.event_id, roundTypeId: r.round_type_id, resultId: r.id ?? null },
                                currentAttempts: effAttempts, currentBest: effBest, currentAverage: effAvg,
                                index, originalValue, note, existingChain: chain,
                              }).then(refreshChanges)
                            }
                            onSetPenalty={(index, penaltyCs, note) =>
                              recordAttemptPenalty({
                                target: { wcaId, competitionId: comp.id, eventId: r.event_id, roundTypeId: r.round_type_id, resultId: r.id ?? null },
                                currentAttempts: effAttempts,
                                index, penaltyCs, note, existingChain: chain,
                              }).then(refreshChanges)
                            }
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


