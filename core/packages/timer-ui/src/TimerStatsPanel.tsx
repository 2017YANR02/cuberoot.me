'use client';

import {
  bestBestOfN,
  bestMbldSolve,
  bestMeanOfN,
  bestOfN,
  bestSingle,
  bpa,
  formatEventMs,
  formatMbldResult,
  formatMs,
  formatSolveResult,
  meanOfAll,
  meanOfN,
  parseRollingStatKey,
  rollingStatBest,
  rollingStatCurrent,
  sanitizeRollingStatColumns,
  stdDev,
  subXBreakdown,
  worstSingle,
  wpa,
  type EventId,
  type RollingStatKey,
  type Solve,
} from '@cuberoot/shared/timer';
import { useMemo, useState, type ReactNode } from 'react';

import {
  TimerRollingStatsPicker,
  type TimerRollingStatsPickerLabels,
} from './TimerRollingStatsPicker';

export interface TimerStatsPanelLabels {
  best: string;
  bestBo3: string;
  bestMo3: string;
  count: string;
  current: string;
  hideExtras: string;
  mean: string;
  rollingPicker: TimerRollingStatsPickerLabels;
  showAllStats: string;
  single: string;
  subX: string;
  worst: string;
}

export interface TimerStatsPrBadgeContext {
  best: string;
  current: string;
  rowKey: string;
}

export interface TimerStatsPanelProps {
  className?: string;
  defaultExpanded?: boolean;
  event?: EventId;
  labels: TimerStatsPanelLabels;
  onRollingColumnsChange: (columns: RollingStatKey[]) => void;
  renderPrBadge?: (context: TimerStatsPrBadgeContext) => ReactNode;
  rollingColumns: readonly RollingStatKey[];
  solves: Solve[];
  viewportBottomInset?: number;
}

interface StatsTableRow {
  key: string;
  label: string;
  current: string;
  best: string;
  stat?: RollingStatKey;
}

function isEmptyValue(value: string): boolean {
  return value === '-' || value === '—';
}

/**
 * Compact current/best statistics panel shared by the Web and Mobile hosts.
 * Statistics and rolling-column rules come from @cuberoot/shared; hosts only
 * inject translated copy, persistence, and their platform PR badge.
 */
export function TimerStatsPanel({
  className,
  defaultExpanded = false,
  event,
  labels,
  onRollingColumnsChange,
  renderPrBadge,
  rollingColumns,
  solves,
  viewportBottomInset = 0,
}: TimerStatsPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const columns = useMemo(
    () => sanitizeRollingStatColumns(rollingColumns),
    [rollingColumns],
  );

  const table = useMemo<StatsTableRow[]>(() => {
    const format = (ms: number | null) => (event ? formatEventMs(event, ms) : formatMs(ms));
    const last = solves.length ? solves[solves.length - 1] : null;
    const rows: StatsTableRow[] = [{
      key: 'time',
      label: labels.single,
      current: last ? formatSolveResult(last) : '-',
      best: event === '333mbld'
        ? (() => {
          const best = bestMbldSolve(solves);
          return best ? formatMbldResult(best) : '—';
        })()
        : format(bestSingle(solves, event)),
    }];
    for (const key of columns) {
      rows.push({
        key,
        label: key,
        current: format(rollingStatCurrent(solves, key)),
        best: format(rollingStatBest(solves, key)),
        stat: key,
      });
    }
    return rows;
  }, [columns, event, labels.single, solves]);

  const sd = stdDev(solves);
  const subX = useMemo(() => subXBreakdown(solves), [solves]);
  const extras = useMemo(() => {
    const format = (ms: number | null) => (event ? formatEventMs(event, ms) : formatMs(ms));
    const rows: Array<{ label: string; value: string }> = [
      { label: labels.mean, value: format(meanOfAll(solves)) },
      { label: labels.worst, value: format(worstSingle(solves)) },
      { label: 'mo3', value: format(meanOfN(solves, 3)) },
      { label: labels.bestMo3, value: format(bestMeanOfN(solves, 3)) },
      { label: 'bo3', value: format(bestOfN(solves, 3)) },
      { label: labels.bestBo3, value: format(bestBestOfN(solves, 3)) },
    ];
    for (const key of columns) {
      const definition = parseRollingStatKey(key);
      if (definition?.kind === 'average' && solves.length === definition.size - 1) {
        rows.push({
          label: `BPA/WPA(${definition.size})`,
          value: `${format(bpa(solves, definition.size))} / ${format(wpa(solves, definition.size))}`,
        });
      }
    }
    return rows;
  }, [columns, event, labels.bestBo3, labels.bestMo3, labels.mean, labels.worst, solves]);

  return (
    <div className={['stats-panel', className].filter(Boolean).join(' ')}>
      <div className="stats-table">
        <div className="stats-table-head">
          <span className="st-label" />
          <span className="st-col">{labels.current}</span>
          <span className="st-col">{labels.best}</span>
        </div>
        {table.map(row => (
          <div className="stats-row" key={row.key} data-stat-row={row.key}>
            <div className="st-label">
              {row.stat
                ? (
                  <TimerRollingStatsPicker
                    columns={columns}
                    labels={labels.rollingPicker}
                    onColumnsChange={onRollingColumnsChange}
                    triggerColumns={[row.stat]}
                    variant="row"
                    viewportBottomInset={viewportBottomInset}
                  />
                )
                : row.label}
            </div>
            <span className={`st-cur ${isEmptyValue(row.current) ? 'muted' : ''}`}>{row.current}</span>
            <span className={`st-best ${isEmptyValue(row.best) ? 'muted' : ''}`}>
              {row.best}
              {!isEmptyValue(row.best) && row.current === row.best
                ? renderPrBadge?.({ best: row.best, current: row.current, rowKey: row.key })
                : null}
            </span>
          </div>
        ))}
      </div>

      <div className="stats-foot">
        <span>σ {sd === null ? '—' : (event ? formatEventMs(event, Math.round(sd)) : formatMs(Math.round(sd)))}</span>
        <span>{labels.count} {solves.length}</span>
      </div>

      {expanded && (
        <div className="stats-grid">
          {extras.map(row => (
            <div className="row" key={row.label}>
              <span className="lbl">{row.label}</span>
              <span className={`val ${isEmptyValue(row.value) ? 'muted' : ''}`}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className="stats-expand-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded(current => !current)}
      >
        {expanded ? labels.hideExtras : labels.showAllStats}
      </button>

      {subX.length > 0 && (
        <section className="subx-section">
          <h3>{labels.subX}</h3>
          <div className="subx-list">
            {subX.map(item => (
              <div className="subx-row" key={item.threshold}>
                <span className="subx-lbl">{item.label}</span>
                <div className="subx-bar">
                  <div className="subx-fill" style={{ width: `${item.pct}%` }} />
                </div>
                <span className="subx-pct">{item.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
