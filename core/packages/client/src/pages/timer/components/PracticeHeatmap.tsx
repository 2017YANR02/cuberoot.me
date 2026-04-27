/**
 * PracticeHeatmap — GitHub-style yearly contributions heatmap of solve counts.
 *
 * Layout: 7 rows (Mon..Sun) × ~53 columns (one column per ISO week). The
 * first column is the Monday of the week containing Jan 1 of the target
 * year (so for years where Jan 1 isn't a Monday, the first column has
 * leading "out-of-year" cells which are rendered transparent).
 *
 * Color buckets (single-hue ramp on the timer dark theme):
 *   0      → empty (subtle background)
 *   1..5   → light
 *   6..15  → mid
 *   16..50 → dark
 *   51+    → darkest
 */

import { useMemo, useState } from 'react';
import type { Solve } from '../types';
import './practice_heatmap.css';

interface PracticeHeatmapProps {
  /** All solves across all events (or already-filtered by event — caller's choice). */
  solves: Solve[];
  isZh: boolean;
  /** Year to show. Default = current year. */
  year?: number;
  /** Pixel size of one cell. Default 11. */
  cellSize?: number;
  className?: string;
}

const DAY_MS = 86_400_000;
const ROWS = 7;

/** Local-tz date key (YYYY-MM-DD) for a unix-ms timestamp. */
function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

/** Format a Date as YYYY-MM-DD using local components. */
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

/** Day-of-week with Monday=0 ... Sunday=6 (ISO). */
function isoDow(d: Date): number {
  const js = d.getDay(); // 0=Sun..6=Sat
  return (js + 6) % 7;
}

/** Color for a count, in the timer.css blue/teal accent family. */
function bucketColor(count: number): string {
  if (count <= 0) return '#1a1a1d';
  if (count <= 5) return '#1f3a55';
  if (count <= 15) return '#2f5d87';
  if (count <= 50) return '#5b9dd9';
  return '#8bbde8';
}

interface CellInfo {
  date: Date;
  inYear: boolean;
  count: number;
  col: number;
  row: number;
}

export default function PracticeHeatmap({
  solves,
  isZh,
  year,
  cellSize = 11,
  className,
}: PracticeHeatmapProps) {
  const nowYear = new Date().getFullYear();
  const [targetYear, setTargetYear] = useState<number>(year ?? nowYear);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const s of solves) set.add(new Date(s.ts).getFullYear());
    if (set.size === 0) set.add(nowYear);
    else set.add(nowYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [solves, nowYear]);

  const yearIdx = availableYears.indexOf(targetYear);
  const safeIdx = yearIdx === -1 ? 0 : yearIdx;
  // Note: availableYears sorted DESC. idx 0 = newest, last = oldest.
  // ▶ goes to a more recent year (idx - 1); ◀ goes to an older year (idx + 1).
  const canNewer = safeIdx > 0;
  const canOlder = safeIdx < availableYears.length - 1;
  const goNewer = () => {
    if (canNewer) setTargetYear(availableYears[safeIdx - 1]);
  };
  const goOlder = () => {
    if (canOlder) setTargetYear(availableYears[safeIdx + 1]);
  };

  const { cells, columnCount, monthLabels, total } = useMemo(() => {
    // Bucket solves by local-tz day key.
    const byDay = new Map<string, number>();
    for (const s of solves) {
      const d = new Date(s.ts);
      if (d.getFullYear() !== targetYear) continue;
      const key = dayKey(s.ts);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    let totalSolves = 0;
    for (const v of byDay.values()) totalSolves += v;

    // First column = Monday of the week containing Jan 1.
    const jan1 = new Date(targetYear, 0, 1);
    const firstColDate = new Date(jan1);
    firstColDate.setDate(jan1.getDate() - isoDow(jan1));

    // Last column = Sunday of the week containing Dec 31.
    const dec31 = new Date(targetYear, 11, 31);
    const lastColDate = new Date(dec31);
    lastColDate.setDate(dec31.getDate() + (6 - isoDow(dec31)));

    const totalDays =
      Math.round((lastColDate.getTime() - firstColDate.getTime()) / DAY_MS) + 1;
    const cols = Math.ceil(totalDays / ROWS);

    // Build all cells.
    const out: CellInfo[] = [];
    const monthFirstCol = new Map<number, number>(); // month idx (0..11) -> col it first appears
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(firstColDate);
      d.setDate(firstColDate.getDate() + i);
      const col = Math.floor(i / ROWS);
      const row = i % ROWS;
      const inYear = d.getFullYear() === targetYear;
      const count = inYear ? (byDay.get(fmtDate(d)) ?? 0) : 0;
      out.push({ date: d, inYear, count, col, row });
      if (inYear) {
        const m = d.getMonth();
        if (!monthFirstCol.has(m)) monthFirstCol.set(m, col);
      }
    }

    // Month label list for the strip above the grid.
    const labels: { month: number; col: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const c = monthFirstCol.get(m);
      if (c !== undefined) labels.push({ month: m, col: c });
    }

    return {
      cells: out,
      columnCount: cols,
      monthLabels: labels,
      total: totalSolves,
    };
  }, [solves, targetYear]);

  // Layout
  const cellGap = 2;
  const cellStep = cellSize + cellGap;
  const labelLeft = 28; // space for "Mon/Wed/Fri"
  const labelTop = 16;  // space for month names
  const gridW = columnCount * cellStep;
  const gridH = ROWS * cellStep;
  const svgW = labelLeft + gridW + 4;
  const svgH = labelTop + gridH + 4;

  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsZh = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const months = isZh ? monthsZh : monthsEn;

  const dowLabelsEn = ['Mon', '', 'Wed', '', 'Fri', '', ''];
  const dowLabelsZh = ['周一', '', '周三', '', '周五', '', ''];
  const dowLabels = isZh ? dowLabelsZh : dowLabelsEn;

  const totalLabel = isZh
    ? `${total} 次于 ${targetYear}`
    : `${total} ${total === 1 ? 'solve' : 'solves'} in ${targetYear}`;
  const emptyLabel = isZh ? '还没有成绩。' : 'No solves yet.';

  const prevLabel = isZh ? '上一年' : 'Previous year';
  const nextLabel = isZh ? '下一年' : 'Next year';

  return (
    <div className={`tc-heatmap ${className ?? ''}`.trim()}>
      <div className="tc-heatmap-header">
        <span className="tc-heatmap-total">{totalLabel}</span>
        <div className="tc-heatmap-year-nav">
          <button
            type="button"
            className="tc-heatmap-year-btn"
            onClick={goOlder}
            disabled={!canOlder}
            aria-label={prevLabel}
            title={prevLabel}
          >
            ◀
          </button>
          <span className="tc-heatmap-year-label">{targetYear}</span>
          <button
            type="button"
            className="tc-heatmap-year-btn"
            onClick={goNewer}
            disabled={!canNewer}
            aria-label={nextLabel}
            title={nextLabel}
          >
            ▶
          </button>
        </div>
      </div>
      {total === 0 ? (
        <div className="tc-heatmap-empty">{emptyLabel}</div>
      ) : (
        <svg
          className="tc-heatmap-svg"
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          role="img"
          aria-label={totalLabel}
        >
          {/* Month labels */}
          {monthLabels.map(({ month, col }) => (
            <text
              key={`m${month}`}
              className="tc-heatmap-month"
              x={labelLeft + col * cellStep}
              y={labelTop - 4}
            >
              {months[month]}
            </text>
          ))}

          {/* Day-of-week labels */}
          {dowLabels.map((lbl, row) =>
            lbl ? (
              <text
                key={`d${row}`}
                className="tc-heatmap-dow"
                x={labelLeft - 4}
                y={labelTop + row * cellStep + cellSize - 1}
                textAnchor="end"
              >
                {lbl}
              </text>
            ) : null,
          )}

          {/* Cells */}
          {cells.map((c, i) => {
            const x = labelLeft + c.col * cellStep;
            const y = labelTop + c.row * cellStep;
            if (!c.inYear) {
              return (
                <rect
                  key={i}
                  className="tc-heatmap-cell tc-heatmap-cell-out"
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={2}
                />
              );
            }
            const fill = bucketColor(c.count);
            const dateStr = fmtDate(c.date);
            const tooltip = isZh
              ? `${dateStr} — ${c.count} 次`
              : `${dateStr} — ${c.count} ${c.count === 1 ? 'solve' : 'solves'}`;
            return (
              <rect
                key={i}
                className="tc-heatmap-cell"
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={fill}
              >
                <title>{tooltip}</title>
              </rect>
            );
          })}
        </svg>
      )}
    </div>
  );
}
