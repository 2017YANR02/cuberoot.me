'use client';
// 纪录 tab:历史世界 / 洲际 / 国家 / 个人纪录,合并为单表 —— 列头只出现一次且 sticky 悬浮顶部,
// 四档标题(世界/洲际/国家/个人)作为表内分组行。
// 区域档由 regional markers 判定；个人档复用与顶部 PR 计数相同的 computePrRank。
// 单次、平均分别命中才显示；按项目分组，组内按比赛日期倒序。

import { useMemo } from 'react';
import Link from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { CompCell } from '@/components/CompCell/CompCell';
import { compLinkProps } from '@/lib/comp-link';
import { formatWcaResult } from '@/lib/wca-format-result';
import { formatDateRangeIso } from '@/lib/wca-date';
import { eventDisplayName } from '@/lib/wca-events';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { isAo5Bracketed } from '@/lib/wca-ao5-brackets';
import { ROUND_ORDER, roundLabel, roundClass } from '@/lib/wca-round-meta';
import { useT } from '@/hooks/useT';
import { wcaResultRowKey, type WcaPersonProfile, type WcaResultRow, type WcaCompetition } from '@/lib/wca-person-api';
import { computePrRank, type RankFlag } from '../logic/progress';

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  isZh: boolean;
}

// WCA 区域纪录标记(MARKERS)分三档。洲际用各洲专码(ER/NAR/SAR/AsR/OcR/AfR),无泛用 CR。
const WORLD_TYPES = ['WR'];
const CONTINENT_TYPES = ['ER', 'NAR', 'SAR', 'AsR', 'OcR', 'AfR'];
const NATIONAL_TYPES = ['NR'];

// 取该档下的成绩:单次或平均标记命中即入。
function rowsForTier(results: WcaResultRow[], types: string[]): WcaResultRow[] {
  const set = new Set(types);
  return results.filter((r) =>
    (r.regional_single_record && set.has(r.regional_single_record)) ||
    (r.regional_average_record && set.has(r.regional_average_record)),
  );
}

export default function RecordsTab({ results, comps, isZh }: Props) {
  const t = useT();

  const compById = useMemo(
    () => new Map((comps ?? []).map((c) => [c.id, c])),
    [comps],
  );
  // 只看官方成绩(直播行不声称区域纪录)。
  const official = useMemo(() => (results ?? []).filter((r) => !r.live), [results]);
  const prRanks = useMemo(() => comps ? computePrRank(official, comps) : new Map<string, RankFlag>(), [official, comps]);

  const tiers = [
    { key: 'wr', title: t('历史世界纪录', 'History of World Records'), types: WORLD_TYPES },
    { key: 'cr', title: t('历史洲际纪录', 'History of Continental Records'), types: CONTINENT_TYPES },
    { key: 'nr', title: t('历史国家纪录', 'History of National Records'), types: NATIONAL_TYPES },
    { key: 'pr', title: t('历史个人纪录', 'History of Personal Records'), types: null },
  ];

  if (!results || !comps) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;

  const sections = tiers
    .map((tier) => ({
      tier,
      rows: tier.types
        ? rowsForTier(official, tier.types)
        : official.filter((r) => {
            const rank = prRanks.get(wcaResultRowKey(r));
            return rank?.singleRank === 1 || rank?.averageRank === 1;
          }),
    }))
    .filter((s) => s.rows.length > 0);

  if (sections.length === 0) {
    return <div className="wp-empty">{t('暂无区域纪录', 'No regional records')}</div>;
  }

  return (
    <div className="wp-records sticky-scroll">
      <table className="wp-bycomp-table wp-records-table sticky-thead">
        <thead>
          <tr>
            <th>{t('项目', 'Event')}</th>
            <th>{t('单次', 'Single')}</th>
            <th>{t('平均', 'Average')}</th>
            <th>{t('赛事', 'Competition')}</th>
            <th>{t('轮次', 'Round')}</th>
            <th className="wp-th-attempts">{t('详细成绩', 'Solves')}</th>
          </tr>
        </thead>
        <tbody>
          {sections.map(({ tier, rows }) => (
            <TierRows
              key={tier.key}
              title={tier.title}
              types={tier.types}
              rows={rows}
              prRanks={prRanks}
              compById={compById}
              isZh={isZh}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 某一档：一行分组标题 + 该档成绩行。项目(WCA 顺序)→ 比赛日期倒序 → 决赛在上。
function TierRows({
  title, types, rows, prRanks, compById, isZh,
}: {
  title: string;
  types: string[] | null;
  rows: WcaResultRow[];
  prRanks: Map<string, RankFlag>;
  compById: Map<string, WcaCompetition>;
  isZh: boolean;
}) {
  const typeSet = new Set(types ?? []);

  const sorted = rows.slice().sort((a, b) => {
    const ea = ALL_EVENT_IDS.indexOf(a.event_id);
    const eb = ALL_EVENT_IDS.indexOf(b.event_id);
    if (ea !== eb) return ea - eb;
    const da = compById.get(a.competition_id)?.start_date ?? '';
    const db = compById.get(b.competition_id)?.start_date ?? '';
    if (da !== db) return db.localeCompare(da);
    return (ROUND_ORDER[a.round_type_id] ?? 99) - (ROUND_ORDER[b.round_type_id] ?? 99);
  });

  let lastEvent = '';
  return (
    <>
      <tr className="wp-records-group-row">
        <th colSpan={6} scope="colgroup">{title}</th>
      </tr>
      {sorted.map((r, i) => {
        const cmp = compById.get(r.competition_id);
        const showEvent = r.event_id !== lastEvent;
        lastEvent = r.event_id;
        const rank = prRanks.get(wcaResultRowKey(r));
        const singleHit = types ? !!r.regional_single_record && typeSet.has(r.regional_single_record) : rank?.singleRank === 1;
        const averageHit = types ? !!r.regional_average_record && typeSet.has(r.regional_average_record) : rank?.averageRank === 1;
        const singleRecord = types ? r.regional_single_record : 'PR';
        const averageRecord = types ? r.regional_average_record : 'PR';
        return (
          <tr key={wcaResultRowKey(r)} className={showEvent && i !== 0 ? 'wp-rec-event-first' : ''}>
            <th scope="row" className="wp-cell-event">
              {showEvent && (
                <span className="wp-rec-event">
                  <EventIcon event={r.event_id} className="wp-event-icon" title={eventDisplayName(r.event_id, isZh)} />
                </span>
              )}
            </th>
            <td className="wp-cell-result">
              {singleHit && (
                <span className="record-num-cell">
                  {formatWcaResult(r.best, r.event_id, 'single')}
                  <RecordBadge record={singleRecord} variant="inline" />
                </span>
              )}
            </td>
            <td className="wp-cell-result">
              {averageHit && r.average > 0 && (
                <span className="record-num-cell">
                  {formatWcaResult(r.average, r.event_id, 'average')}
                  <RecordBadge record={averageRecord} variant="inline" />
                </span>
              )}
            </td>
            <td className="wp-cell-comp">
              {cmp ? (
                <Link {...compLinkProps(cmp.id, { event: r.event_id, round: r.round_type_id, view: 'result' })} className="wp-bycomp-name">
                  <CompCell compId={cmp.id} compName={cmp.name} isZh={isZh} date={cmp.start_date} />
                </Link>
              ) : r.competition_id}
              {cmp && <div className="wp-cell-comp-date">{formatDateRangeIso(cmp.start_date, cmp.end_date)}</div>}
            </td>
            <td>
              <span className={`wp-round-tag ${roundClass(r.round_type_id)}`}>{roundLabel(r.round_type_id)}</span>
            </td>
            <td className="wp-cell-attempts">
              <AttemptsInline attempts={r.attempts} best={r.best} eventId={r.event_id} />
            </td>
          </tr>
        );
      })}
    </>
  );
}

// 极简只读的 5 把成绩展示(无复盘 / 编辑入口),纪录 / 领奖台表的详情列共用。
export function AttemptsInline({ attempts, best, eventId }: { attempts: number[]; best: number; eventId: string }) {
  if (!attempts || attempts.length === 0) return <span className="wp-text-mute">—</span>;
  const valid = attempts.filter((x) => x > 0);
  const minValid = valid.length > 0 ? Math.min(...valid) : 0;
  return (
    <span className="wp-attempts-flow">
      {attempts.map((a, i) => {
        if (a === undefined) return null;
        const isBest = a > 0 && a === minValid && a === best;
        const trimmed = isAo5Bracketed(attempts, i);
        return (
          <span key={i} className={`wp-att ${isBest ? 'wp-att-best' : ''} ${trimmed ? 'wp-att-trimmed' : ''}`}>
            {formatWcaResult(a, eventId, 'single')}
          </span>
        );
      })}
    </span>
  );
}
