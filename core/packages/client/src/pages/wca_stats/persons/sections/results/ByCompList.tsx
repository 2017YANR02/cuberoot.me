// 按比赛:每场比赛一组,每行 (项目 / 轮次 / 排名 / 单次 / 平均 / 各次尝试).
// 进步(PB)染色 + regional record 标签.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDateRangeIso } from '../../../../../utils/date_range';
import { InfoTooltip } from '../../../../../components/InfoTooltip/InfoTooltip';
import { formatWcaResult } from '../../../../../utils/wca_format_result';
import { isAo5Bracketed } from '../../../../../utils/wca_ao5_brackets';
import { EventIcon } from '../../../../../components/EventIcon';
import { CompCell } from '../../../../../components/CompCell/CompCell';
import { compLinkProps } from '../../../../../utils/comp_link';
import { RecordBadge } from '../../../../../components/RecordBadge';
import { computePrRank } from '../../logic/progress';
import type { WcaResultRow, WcaCompetition } from '../../wca_api';

interface Props {
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  isZh: boolean;
}

const ROUND_ORDER: Record<string, number> = {
  // 决赛在最上(展示按 round 倒序更直觉,与 cubing.pro 一致)
  'f': 0, 'c': 1, 'b': 2,
  '3': 3,        // semifinal
  '2': 4, 'g': 4,// quarter / combined-quarter
  '1': 5, 'd': 5,// first / combined-first
  'h': 6,
};

// 表头 round 列 tooltip 文本 (中英),解释 R1/R2/R3/Fi/C-*/h 等缩写
const ROUND_HINT_ZH = `轮次缩写:
R1 / R2 / R3 — 初赛 / 复赛 / 半决赛 (打满 5 把)
Fi — 决赛
C- 前缀 (组合赛制) — 带 cutoff,前几把过线才能继续打完整 Ao5
h — head-to-head 1v1 淘汰 (非 WCA 项目)`;
const ROUND_HINT_EN = `Round abbreviations:
R1 / R2 / R3 — First / Second / Third Round (full attempts)
Fi — Final
C- prefix (Combined) — cutoff format; must beat cutoff in first attempts to continue full Ao5
h — Head-to-head (1v1 elimination, non-WCA)`;

function roundLabel(rt: string, _isZh: boolean): string {
  // 用 Fi / R3 / R2 / R1 缩写,中英文一致
  const map: Record<string, string> = {
    'f': 'Fi', 'c': 'C-Fi', 'b': 'B-Fi',
    '3': 'R3',
    '2': 'R2', 'g': 'C-R2',
    '1': 'R1', 'd': 'C-R1',
    'h': 'R1',
  };
  return map[rt] ?? rt;
}

function roundClass(rt: string): string {
  if (rt === 'f' || rt === 'c' || rt === 'b') return 'wp-round-final';
  if (rt === '3') return 'wp-round-semi';
  if (rt === '2' || rt === 'g') return 'wp-round-quarter';
  return 'wp-round-first';
}

export default function ByCompList({ results, comps, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

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

  if (!grouped) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;
  if (grouped.length === 0) return <div className="wp-empty">{t('暂无成绩', 'No results yet')}</div>;

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
                    return (
                      <tr key={r.id}>
                        <td className="wp-cell-event">
                          {showEvent && <>
                            <EventIcon event={r.event_id} className="wp-event-icon-sm" />
                            <span className="wp-event-name">{r.event_id}</span>
                          </>}
                        </td>
                        <td>
                          <span className={`wp-round-tag ${roundClass(r.round_type_id)}`}>
                            {roundLabel(r.round_type_id, isZh)}
                          </span>
                        </td>
                        <td className={`wp-cell-pos ${r.pos === 1 ? 'wp-pos-first' : ''}`}>
                          {r.pos > 0 ? r.pos : '—'}
                        </td>
                        <td className="wp-cell-result">
                          <span className="record-num-cell">
                            {formatWcaResult(r.best, r.event_id, 'single')}
                            {r.regional_single_record
                              ? <RecordBadge record={r.regional_single_record} variant="inline" />
                              : singleRank
                                ? <RecordBadge record={singleRank === 1 ? 'PR' : `PR${singleRank}`} variant="inline" />
                                : null}
                          </span>
                        </td>
                        <td className="wp-cell-result">
                          <span className="record-num-cell">
                            {formatWcaResult(r.average, r.event_id, 'average')}
                            {r.regional_average_record
                              ? <RecordBadge record={r.regional_average_record} variant="inline" />
                              : averageRank
                                ? <RecordBadge record={averageRank === 1 ? 'PR' : `PR${averageRank}`} variant="inline" />
                                : null}
                          </span>
                        </td>
                        <td className="wp-cell-attempts">
                          <AttemptsList attempts={r.attempts} best={r.best} eventId={r.event_id} />
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
function AttemptsList({ attempts, best, eventId }: { attempts: number[]; best: number; eventId: string }) {
  if (attempts.length === 0) return <span className="wp-text-mute">—</span>;
  const validNums = attempts.filter((x) => x > 0);
  const minValid = validNums.length > 0 ? Math.min(...validNums) : 0;
  return (
    <span className="wp-attempts-flow">
      {attempts.map((a, i) => {
        if (a === undefined) return null;
        const formatted = formatWcaResult(a, eventId, 'single');
        const isBest = validNums.length > 0 && a > 0 && a === minValid && a === best;
        return (
          <span key={i} className={`wp-att ${isBest ? 'wp-att-best' : ''} ${isAo5Bracketed(attempts, i) ? 'wp-att-trimmed' : ''}`}>
            {formatted}
          </span>
        );
      })}
    </span>
  );
}

