/**
 * Per-OLL/PLL case stats from auto-recognized 333 solves.
 *
 * Distinct from CaseStatsPanel (which groups trainer-event solves by their
 * pre-set caseId). This panel reads the post-hoc reconstruction in
 * `solve.stageSegments` — populated by ReconstructModal or the
 * "Reanalyze stage data" migration — and groups full 333 solves by the
 * recognized OLL/PLL case, using the per-stage execution time (`ollMs` /
 * `pllMs`) as the metric.
 *
 * Sort is by avg ascending so the slowest cases sit at the bottom — these
 * are the natural drill candidates. A "Top N slowest" hint surfaces them
 * directly below each table for quick scanning.
 *
 * Renders only for the '333' event for now; other puzzles don't have
 * automatic state recognition wired through stageSegments yet.
 */

import { useState } from 'react';
import type { EventId, Solve } from '../types';
import { formatMs } from '../stats';

interface Props {
  event: EventId;
  solves: Solve[];
  isZh: boolean;
}

interface Row {
  id: string;
  count: number;
  avg: number;
  best: number;
  worst: number;
}

const DEFAULT_CAP = 20;
const SLOWEST_TOP_N = 3;
/** Min count for a row to be considered a credible drill candidate. */
const SLOWEST_MIN_COUNT = 3;

function aggregate(
  solves: Solve[],
  pick: (s: Solve) => { id: string | null; ms: number | null },
): Row[] {
  const groups = new Map<string, number[]>();
  for (const s of solves) {
    if (!s.stageSegments) continue;
    const { id, ms } = pick(s);
    if (!id || ms === null || !Number.isFinite(ms)) continue;
    const arr = groups.get(id);
    if (arr) arr.push(ms); else groups.set(id, [ms]);
  }
  const rows: Row[] = [];
  for (const [id, times] of groups) {
    const n = times.length;
    if (n === 0) continue;
    const sum = times.reduce((a, b) => a + b, 0);
    rows.push({
      id,
      count: n,
      avg: sum / n,
      best: Math.min(...times),
      worst: Math.max(...times),
    });
  }
  // Sort ascending by avg — slowest at bottom = "drill these".
  rows.sort((a, b) => a.avg - b.avg);
  return rows;
}

function CaseTable({
  title, rows, showAll, onToggle, isZh, cap,
}: {
  title: string;
  rows: Row[];
  showAll: boolean;
  onToggle: () => void;
  isZh: boolean;
  cap: number;
}) {
  if (rows.length === 0) return null;
  const visible = showAll ? rows : rows.slice(0, cap);
  const hidden = rows.length - visible.length;

  // Slowest drill candidates: highest avg, with a min count gate so a single
  // unlucky slow solve doesn't dominate.
  const drillCandidates = rows
    .filter(r => r.count >= SLOWEST_MIN_COUNT)
    .slice()
    .sort((a, b) => b.avg - a.avg)
    .slice(0, SLOWEST_TOP_N);

  return (
    <div className="case-stats-panel" style={{ marginTop: 8 }}>
      <h3>{title}</h3>
      <div className="case-stats-scroll">
        <table className="case-stats-table">
          <thead>
            <tr>
              <th>{isZh ? 'Case' : 'Case'}</th>
              <th>{isZh ? '次数' : 'N'}</th>
              <th>{isZh ? '平均' : 'Avg'}</th>
              <th>{isZh ? '最佳' : 'Best'}</th>
              <th>{isZh ? '最差' : 'Worst'}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(r => (
              <tr key={r.id}>
                <td title={r.id}>{r.id}</td>
                <td>{r.count}</td>
                <td>{formatMs(r.avg)}</td>
                <td>{formatMs(r.best)}</td>
                <td>{formatMs(r.worst)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 && (
        <button
          type="button"
          className="hint-btn"
          onClick={onToggle}
          style={{ marginTop: 6 }}
        >
          {isZh
            ? `展开剩余 ${hidden} 项`
            : `Show ${hidden} more`}
        </button>
      )}
      {showAll && rows.length > cap && (
        <button
          type="button"
          className="hint-btn"
          onClick={onToggle}
          style={{ marginTop: 6 }}
        >
          {isZh ? '收起' : 'Collapse'}
        </button>
      )}
      {drillCandidates.length > 0 && (
        <div style={{ marginTop: 6, fontSize: '0.9em', opacity: 0.8 }}>
          <span style={{ marginRight: 6 }}>
            {isZh ? '最慢 Top 3（建议刷）：' : 'Top 3 slowest (drill candidates):'}
          </span>
          {drillCandidates.map((r, i) => (
            <span key={r.id} style={{ marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>
              {i > 0 ? ' · ' : ''}
              {r.id} <span style={{ opacity: 0.7 }}>({formatMs(r.avg)} × {r.count})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CfopCaseStatsPanel({ event, solves, isZh }: Props) {
  // State recognition only flows through stageSegments for 333 right now.
  // Big cubes / OH / etc. either share the same recognizer (OH does) or
  // have no recognizer; gating to '333' is the conservative choice the
  // task asked for.
  const [showAllOll, setShowAllOll] = useState(false);
  const [showAllPll, setShowAllPll] = useState(false);

  if (event !== '333') return null;

  const ollRows = aggregate(solves, s => ({
    id: s.stageSegments?.ollCase ?? null,
    ms: s.stageSegments?.ollMs ?? null,
  }));
  const pllRows = aggregate(solves, s => ({
    id: s.stageSegments?.pllCase ?? null,
    ms: s.stageSegments?.pllMs ?? null,
  }));

  if (ollRows.length === 0 && pllRows.length === 0) {
    return (
      <div className="case-stats-panel">
        <h3>{isZh ? 'OLL / PLL Case 统计' : 'OLL / PLL case stats'}</h3>
        <div className="case-stats-empty">
          {isZh
            ? '尚无重新分析的成绩。请在设置中点击 "重新分析阶段数据"。'
            : "No reanalyzed solves yet. Click 'Reanalyze stage data' in settings."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <CaseTable
        title={isZh ? 'OLL Case 统计' : 'OLL case stats'}
        rows={ollRows}
        showAll={showAllOll}
        onToggle={() => setShowAllOll(v => !v)}
        isZh={isZh}
        cap={DEFAULT_CAP}
      />
      <CaseTable
        title={isZh ? 'PLL Case 统计' : 'PLL case stats'}
        rows={pllRows}
        showAll={showAllPll}
        onToggle={() => setShowAllPll(v => !v)}
        isZh={isZh}
        cap={DEFAULT_CAP}
      />
    </div>
  );
}
