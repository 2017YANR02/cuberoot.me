'use client';

import { useMemo, useState } from 'react';
import type { Solve, EventId } from '../_lib/types';
import {
  subXBreakdown,
  bestSingle,
  bestMbldSolve,
  formatMbldResult,
  worstSingle,
  meanOfAll,
  meanOfN,
  bestMeanOfN,
  bestOfN,
  bestBestOfN,
  stdDev,
  coefficientOfVariation,
  formatPct,
  bpa,
  wpa,
  formatMs,
  formatEventMs,
  formatSolveResult,
} from '../_lib/stats';
import { useSettings } from '../_lib/settings';
import {
  parseRollingStatKey,
  rollingStatBest,
  rollingStatCurrent,
  sanitizeRollingStatColumns,
  type RollingStatKey,
} from '../_lib/rolling_stats';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { tr } from '@/i18n/tr';
import RollingStatsPicker from './RollingStatsPicker';

interface Props {
  solves: Solve[];
  /** Optional — the table layout is event-agnostic, but the *values* are not:
   *  pass it and FMC renders move counts instead of times. */
  event?: EventId;
}

/** A formatted value counts as "empty" when it's a dash placeholder. */
function isEmptyVal(v: string): boolean {
  return v === '-' || v === '—';
}

export default function StatsPanel({ solves, event }: Props) {
  /** Event-aware value formatter — FMC values are move counts, not times. */
  const f = (ms: number | null) => (event ? formatEventMs(event, ms) : formatMs(ms));
  const settings = useSettings();
  const [expanded, setExpanded] = useState(false);

  const columns = useMemo(
    () => sanitizeRollingStatColumns(settings.statsRollingColumns),
    [settings.statsRollingColumns],
  );

  // ── cstimer-style current/best rows: time (single) + configured rolling stats ──
  const table = useMemo(() => {
    const last = solves.length ? solves[solves.length - 1] : null;
    const rows: { key: string; label: string; cur: string; best: string; stat?: RollingStatKey }[] = [
      {
        key: 'time',
        label: tr({ zh: '单次', en: 'time'
        }),
        // Whole-solve render so a DNS row reads "DNS", not "DNF"/a number.
        cur: last ? formatSolveResult(last) : '-',
        // MBLD ranks by points before time (WCA 9f12c), so the "best" cell
        // has to pick the highest-scoring attempt, not the fastest one.
        best: event === '333mbld'
          ? (() => { const b = bestMbldSolve(solves); return b ? formatMbldResult(b) : '—'; })()
          : f(bestSingle(solves, event)),
      },
    ];
    for (const key of columns) {
      rows.push({
        key,
        label: key,
        cur: f(rollingStatCurrent(solves, key)),
        best: f(rollingStatBest(solves, key)),
        stat: key,
      });
    }
    return rows;
  }, [solves, columns, event]);

  // ── footer + extras ──
  const count = solves.length;
  const sd = stdDev(solves);
  const cv = coefficientOfVariation(solves);
  const subX = useMemo(() => subXBreakdown(solves), [solves]);

  const extras = useMemo(() => {
    const rows: { lbl: string; val: string }[] = [
      { lbl: tr({ zh: '平均', en: 'mean' }),  val: f(meanOfAll(solves)) },
      { lbl: tr({ zh: '最差', en: 'worst' }), val: f(worstSingle(solves)) },
      { lbl: 'mo3',  val: f(meanOfN(solves, 3)) },
      { lbl: tr({ zh: 'mo3 最佳', en: 'best mo3' }), val: f(bestMeanOfN(solves, 3)) },
      { lbl: 'bo3',  val: f(bestOfN(solves, 3)) },
      { lbl: tr({ zh: 'bo3 最佳', en: 'best bo3' }), val: f(bestBestOfN(solves, 3)) },
    ];
    // Live BPA/WPA for any window that is one solve away from completing.
    for (const key of columns) {
      const definition = parseRollingStatKey(key);
      if (definition?.kind === 'average' && solves.length === definition.size - 1) {
        rows.push({
          lbl: `BPA/WPA(${definition.size})`,
          val: `${f(bpa(solves, definition.size))} / ${f(wpa(solves, definition.size))}`,
        });
      }
    }
    return rows;
  }, [solves, columns, event]);

  return (
    <div className="stats-panel">
      <div className="stats-table">
        <div className="stats-table-head">
          <span className="st-label" />
          <span className="st-col">{tr({ zh: '当前', en: 'current'
        })}</span>
          <span className="st-col">{tr({ zh: '最佳', en: 'best' })}</span>
        </div>
        {table.map(r => (
          <div className="stats-row" key={r.key}>
            <div className="st-label">
              {r.stat
                ? <RollingStatsPicker triggerColumns={[r.stat]} variant="row" />
                : r.label}
            </div>
            <span className={`st-cur ${isEmptyVal(r.cur) ? 'muted' : ''}`}>{r.cur}</span>
            <span className={`st-best ${isEmptyVal(r.best) ? 'muted' : ''}`}>
              {r.best}
              {/* 当前值=历史最佳 → 这把/这个窗口刚刷新或追平了个人最佳,标 PR。 */}
              {!isEmptyVal(r.best) && r.cur === r.best && <RecordBadge record="PR" variant="inline" />}
            </span>
          </div>
        ))}
      </div>

      {/* Footer: σ / CV / count */}
      <div className="stats-foot">
        <span>σ {sd === null ? '—' : f(Math.round(sd))}</span>
        <span>CV {formatPct(cv)}</span>
        <span>{tr({ zh: '总数', en: 'count'
        })} {count}</span>
      </div>

      {expanded && (
        <div className="stats-grid">
          {extras.map(r => (
            <div className="row" key={r.lbl}>
              <span className="lbl">{r.lbl}</span>
              <span className={`val ${isEmptyVal(r.val) ? 'muted' : ''}`}>{r.val}</span>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="stats-expand-toggle" onClick={() => setExpanded(e => !e)}>
        {expanded ? tr({ zh: '收起', en: 'Hide extras' }) : tr({ zh: '显示全部统计', en: 'Show all stats'
                      })}
      </button>

      {subX.length > 0 && (
        <>
          <h3 style={{ marginTop: 12 }}>{tr({ zh: '阈值占比', en: 'Sub-X'
        })}</h3>
          <div className="subx-list">
            {subX.map(x => (
              <div className="subx-row" key={x.threshold}>
                <span className="subx-lbl">{x.label}</span>
                <div className="subx-bar">
                  <div className="subx-fill" style={{ width: `${x.pct}%` }} />
                </div>
                <span className="subx-pct">{x.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
