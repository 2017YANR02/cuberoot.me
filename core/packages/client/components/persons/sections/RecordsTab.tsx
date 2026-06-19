'use client';
// 纪录 tab:历史世界纪录 / 历史洲际纪录 / 历史国家纪录。
// 全部从已拉取的 results + comps 客户端算(复刻 cubingchina / WCA 官网 records 视图):
//   某条成绩进某档 = 它的 regional_single_record 或 regional_average_record 落在该档的标记集合。
//   单次列仅当该成绩的单次标记属于本档才显示;平均列同理。按项目分组,组内按比赛日期倒序。

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
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';

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

export default function RecordsTab({ results, comps, isZh }: Props) {
  const t = useT();

  const compById = useMemo(
    () => new Map((comps ?? []).map((c) => [c.id, c])),
    [comps],
  );
  // 只看官方成绩(直播行不声称区域纪录)。
  const official = useMemo(() => (results ?? []).filter((r) => !r.live), [results]);

  const tiers = [
    { key: 'wr', title: t('历史世界纪录', 'History of World Records'), types: WORLD_TYPES },
    { key: 'cr', title: t('历史洲际纪录', 'History of Continental Records'), types: CONTINENT_TYPES },
    { key: 'nr', title: t('历史国家纪录', 'History of National Records'), types: NATIONAL_TYPES },
  ];

  if (!results || !comps) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;

  const sections = tiers
    .map((tier) => ({ tier, rows: rowsForTier(official, tier.types) }))
    .filter((s) => s.rows.length > 0);

  if (sections.length === 0) {
    return <div className="wp-empty">{t('暂无区域纪录', 'No regional records')}</div>;
  }

  return (
    <div className="wp-records">
      {sections.map(({ tier, rows }) => (
        <RecordSection
          key={tier.key}
          title={tier.title}
          types={tier.types}
          rows={rows}
          compById={compById}
          isZh={isZh}
        />
      ))}
    </div>
  );
}

// 取该档下的成绩:单次或平均标记命中即入。
function rowsForTier(results: WcaResultRow[], types: string[]): WcaResultRow[] {
  const set = new Set(types);
  return results.filter((r) =>
    (r.regional_single_record && set.has(r.regional_single_record)) ||
    (r.regional_average_record && set.has(r.regional_average_record)),
  );
}

function RecordSection({
  title, types, rows, compById, isZh,
}: {
  title: string;
  types: string[];
  rows: WcaResultRow[];
  compById: Map<string, WcaCompetition>;
  isZh: boolean;
}) {
  const t = useT();
  const typeSet = new Set(types);

  // 项目(WCA 顺序)→ 比赛日期倒序 → 决赛在上。
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
    <section className="wp-records-sec">
      <h3 className="wp-section-h">{title}</h3>
      <div className="wp-table-scroll">
        <table className="wp-bycomp-table wp-records-table">
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
            {sorted.map((r) => {
              const cmp = compById.get(r.competition_id);
              const showEvent = r.event_id !== lastEvent;
              lastEvent = r.event_id;
              const singleHit = !!r.regional_single_record && typeSet.has(r.regional_single_record);
              const averageHit = !!r.regional_average_record && typeSet.has(r.regional_average_record);
              return (
                <tr key={r.id} className={showEvent ? 'wp-rec-event-first' : ''}>
                  <th scope="row" className="wp-cell-event">
                    {showEvent && (
                      <span className="wp-rec-event">
                        <EventIcon event={r.event_id} className="wp-event-icon" />
                        <span className="wp-rec-event-name">{eventDisplayName(r.event_id, isZh)}</span>
                      </span>
                    )}
                  </th>
                  <td className="wp-cell-result">
                    {singleHit && (
                      <span className="record-num-cell">
                        {formatWcaResult(r.best, r.event_id, 'single')}
                        <RecordBadge record={r.regional_single_record} variant="inline" />
                      </span>
                    )}
                  </td>
                  <td className="wp-cell-result">
                    {averageHit && r.average > 0 && (
                      <span className="record-num-cell">
                        {formatWcaResult(r.average, r.event_id, 'average')}
                        <RecordBadge record={r.regional_average_record} variant="inline" />
                      </span>
                    )}
                  </td>
                  <td className="wp-cell-comp">
                    {cmp ? (
                      <Link {...compLinkProps(cmp.id, { event: r.event_id, round: r.round_type_id, view: 'result' })} className="wp-bycomp-name">
                        <CompCell compId={cmp.id} compName={cmp.name} isZh={isZh} />
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
          </tbody>
        </table>
      </div>
    </section>
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
