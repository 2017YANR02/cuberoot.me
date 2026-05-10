// 按比赛:每场比赛一组,每行 (项目 / 轮次 / 排名 / 单次 / 平均 / 各次尝试).
// 进步(PB)染色 + regional record 标签.

import { useMemo } from 'react';
import { formatDateRangeIso } from '../../../../../utils/date_range';
import { formatWcaResult } from '../../../../../utils/wca_format_result';
import { EventIcon } from '../../../../../components/EventIcon';
import { CompCell } from '../../../../../components/CompCell/CompCell';
import { computeProgress } from '../../logic/progress';
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

function recordClass(t: string): string {
  if (t === 'WR') return 'wp-rec-wr';
  if (t === 'NR') return 'wp-rec-nr';
  return 'wp-rec-cr';
}

export default function ByCompList({ results, comps, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const progress = useMemo(() =>
    results && comps ? computeProgress(results, comps) : new Map(),
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
              <a
                href={`https://www.worldcubeassociation.org/competitions/${comp.id}`}
                target="_blank" rel="noopener noreferrer"
                className="wp-bycomp-name"
              ><CompCell compId={comp.id} compName={comp.name} isZh={isZh} /></a>
              <span className="wp-bycomp-date">{formatDateRangeIso(comp.start_date, comp.end_date)}</span>
            </div>
            <div className="wp-table-scroll">
              <table className="wp-bycomp-table">
                <thead>
                  <tr>
                    <th>{t('项目', 'Event')}</th>
                    <th>{t('轮次', 'Round')}</th>
                    <th className="wp-th-narrow">{t('排名', 'Pos')}</th>
                    <th>{t('单次', 'Single')}</th>
                    <th>{t('平均', 'Avg')}</th>
                    <th>{t('详细成绩', 'Attempts')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const pf = progress.get(r.id);
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
                        <td className={`wp-cell-result ${pf?.bestIsPb ? 'wp-result-pb' : ''}`}>
                          {formatWcaResult(r.best, r.event_id, 'single')}
                          {r.regional_single_record && (
                            <span className={`wp-rec-tag ${recordClass(r.regional_single_record)}`}>{r.regional_single_record}</span>
                          )}
                        </td>
                        <td className={`wp-cell-result ${pf?.averageIsPb ? 'wp-result-pb' : ''}`}>
                          {formatWcaResult(r.average, r.event_id, 'average')}
                          {r.regional_average_record && (
                            <span className={`wp-rec-tag ${recordClass(r.regional_average_record)}`}>{r.regional_average_record}</span>
                          )}
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
          <span key={i} className={`wp-att ${isBest ? 'wp-att-best' : ''}`}>
            {isBracketed(attempts, i) ? `(${formatted})` : formatted}
          </span>
        );
      })}
    </span>
  );
}

// WCA 平均 5 次 (Ao5):去掉一最佳一最差.该函数判断该 attempt 是否在括号内显示.
// 这里复用结构:5 次成绩里,best 与 worst 两个值用 () 包起来.DNF/DNS 优先视为 worst.
function isBracketed(att: number[], idx: number): boolean {
  if (att.length !== 5) return false;
  const valid = att.map((v, i) => ({ v, i })).filter(({ v }) => v > 0);
  if (valid.length === 0) return false;
  // worst = DNF/DNS first, else max value
  const fail = att.findIndex((v) => v === -1 || v === -2);
  let worstIdx: number;
  if (fail >= 0) worstIdx = fail;
  else worstIdx = att.indexOf(Math.max(...valid.map((x) => x.v)));
  // best = min positive; if all positive same, take first
  const bestIdx = att.indexOf(Math.min(...valid.map((x) => x.v)));
  return idx === worstIdx || idx === bestIdx;
}
