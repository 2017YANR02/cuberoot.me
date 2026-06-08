'use client';

/**
 * Per-case stats — for OLL/PLL/COLL/CMLL/ZBLL/EG1/EG2 trainer events only.
 * Groups solves by `caseId`, shows count / best / mean per case, sorted by
 * count descending. Renders nothing for non-trainer events.
 */

import type { EventId, Solve } from '../_lib/types';
import { effectiveMs } from '../_lib/types';
import { formatMs } from '../_lib/stats';
import { OLL_CASES } from '../_lib/scramble/algs/oll_cases';
import { PLL_CASES } from '../_lib/scramble/algs/pll_cases';
import { tr } from '@/i18n/tr';

interface Props {
  event: EventId;
  solves: Solve[];
  isZh: boolean;
}

const TRAINER_EVENTS = new Set<EventId>(['oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2']);

const ollNameById = new Map(OLL_CASES.map(c => [c.id, c.name]));
const pllNameById = new Map(PLL_CASES.map(c => [c.id, c.name]));

function caseLabel(event: EventId, id: string): string {
  if (event === 'oll') return ollNameById.get(id) ?? id;
  if (event === 'pll') return pllNameById.get(id) ?? id;
  // Other trainers: id is the alg string — truncate for display.
  if (id.length > 20) return id.slice(0, 20) + '...';
  return id;
}

interface Row {
  id: string;
  count: number;
  best: number;
  mean: number;
}

function aggregate(solves: Solve[]): Row[] {
  const groups = new Map<string, number[]>();
  for (const s of solves) {
    if (!s.caseId) continue;
    const arr = groups.get(s.caseId);
    const t = effectiveMs(s);
    if (arr) arr.push(t); else groups.set(s.caseId, [t]);
  }
  const rows: Row[] = [];
  for (const [id, times] of groups) {
    const finite = times.filter(t => Number.isFinite(t));
    const best = finite.length > 0 ? Math.min(...finite) : Infinity;
    const mean = finite.length > 0
      ? finite.reduce((a, b) => a + b, 0) / finite.length
      : Infinity;
    rows.push({ id, count: times.length, best, mean });
  }
  rows.sort((a, b) => b.count - a.count);
  return rows;
}

export default function CaseStatsPanel({ event, solves, isZh }: Props) {
  if (!TRAINER_EVENTS.has(event)) return null;
  const rows = aggregate(solves);
  return (
    <div className="case-stats-panel">
      <h3>{tr({ zh: '每 Case 统计', en: 'Per-case stats',
          zhHant: "每 Case 統計"
    })}</h3>
      {rows.length === 0 ? (
        <div className="case-stats-empty">{tr({ zh: '尚无记录', en: 'No solves yet',
            zhHant: "尚無記錄"
        })}</div>
      ) : (
        <div className="case-stats-scroll">
          <table className="case-stats-table">
            <thead>
              <tr>
                <th>{isZh ? 'Case' : 'Case'}</th>
                <th>{tr({ zh: '次数', en: 'N',
                    zhHant: "次數"
                })}</th>
                <th>{tr({ zh: '最佳', en: 'Best' })}</th>
                <th>{tr({ zh: '平均', en: 'Mean' })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td title={r.id}>{caseLabel(event, r.id)}</td>
                  <td>{r.count}</td>
                  <td>{Number.isFinite(r.best) ? formatMs(r.best) : '—'}</td>
                  <td>{Number.isFinite(r.mean) ? formatMs(r.mean) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
