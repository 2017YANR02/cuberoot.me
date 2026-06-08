'use client';

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
 *
 * Hover features:
 *   - Cell tooltip: "YYYY-MM-DD · N solves · best M.MM"
 *   - Week label tooltip (row 0, the column header strip): summary of that week
 *   - Month label tooltip: summary of that month
 *   - Inline streak badge in the header (consecutive days ending today)
 */

import { useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import type { Solve } from '../../_lib/types';
import { formatMs } from '../../_lib/stats';
import './practice_heatmap.css';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

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

/** Effective time after penalty; null if DNF. */
function validMs(s: Solve): number | null {
  if (s.penalty === 'DNF') return null;
  return s.penalty === '+2' ? s.timeMs + 2000 : s.timeMs;
}

interface DayAgg {
  count: number;
  best: number | null;       // ms, null if no valid solve
  validSum: number;
  validCount: number;
}

interface CellInfo {
  date: Date;
  inYear: boolean;
  agg: DayAgg;
  col: number;
  row: number;
}

const EMPTY_AGG: DayAgg = { count: 0, best: null, validSum: 0, validCount: 0 };

/** Compute current consecutive-day streak ending today (local tz). */
function computeStreak(solves: Solve[]): number {
  if (solves.length === 0) return 0;
  const days = new Set<string>();
  for (const s of solves) days.add(dayKey(s.ts));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = fmtDate(today);
  if (!days.has(todayKey)) return 0;
  let streak = 0;
  const cursor = new Date(today);
  while (days.has(fmtDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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
  // Sparse-mode: <7 total solves → only the streak line is shown by default.
  // The user can still expand the calendar via "Show calendar".
  const [calendarExpanded, setCalendarExpanded] = useState<boolean>(false);
  const sparse = solves.length < 7;

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

  // Streak is global (all years), based on local-tz day boundaries.
  const streak = useMemo(() => computeStreak(solves), [solves]);

  const { cells, columnCount, monthLabels, total, weekAggs, monthAggs } = useMemo(() => {
    // Bucket solves by local-tz day key — count, best (valid), sum/count for avg.
    const byDay = new Map<string, DayAgg>();
    for (const s of solves) {
      const d = new Date(s.ts);
      if (d.getFullYear() !== targetYear) continue;
      const key = dayKey(s.ts);
      let agg = byDay.get(key);
      if (!agg) {
        agg = { count: 0, best: null, validSum: 0, validCount: 0 };
        byDay.set(key, agg);
      }
      agg.count += 1;
      const v = validMs(s);
      if (v !== null) {
        if (agg.best === null || v < agg.best) agg.best = v;
        agg.validSum += v;
        agg.validCount += 1;
      }
    }
    let totalSolves = 0;
    for (const v of byDay.values()) totalSolves += v.count;

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

    // Build all cells and per-week / per-month aggregates.
    const out: CellInfo[] = [];
    const monthFirstCol = new Map<number, number>(); // month idx (0..11) -> col it first appears
    const weekAggsInner: Array<DayAgg & { startDate: Date; endDate: Date }> = [];
    const monthAggsInner = new Map<number, DayAgg & { firstDate: Date; lastDate: Date }>();

    for (let col = 0; col < cols; col++) {
      const wk: DayAgg & { startDate: Date; endDate: Date } = {
        count: 0,
        best: null,
        validSum: 0,
        validCount: 0,
        startDate: new Date(firstColDate),
        endDate: new Date(firstColDate),
      };
      wk.startDate.setDate(firstColDate.getDate() + col * ROWS);
      wk.endDate.setDate(firstColDate.getDate() + col * ROWS + 6);
      weekAggsInner.push(wk);
    }

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(firstColDate);
      d.setDate(firstColDate.getDate() + i);
      const col = Math.floor(i / ROWS);
      const row = i % ROWS;
      const inYear = d.getFullYear() === targetYear;
      const agg = inYear ? (byDay.get(fmtDate(d)) ?? EMPTY_AGG) : EMPTY_AGG;
      out.push({ date: d, inYear, agg, col, row });

      if (inYear && agg.count > 0) {
        // Roll into week aggregate.
        const wk = weekAggsInner[col];
        wk.count += agg.count;
        wk.validSum += agg.validSum;
        wk.validCount += agg.validCount;
        if (agg.best !== null && (wk.best === null || agg.best < wk.best)) {
          wk.best = agg.best;
        }

        // Roll into month aggregate.
        const m = d.getMonth();
        let mAgg = monthAggsInner.get(m);
        if (!mAgg) {
          mAgg = { count: 0, best: null, validSum: 0, validCount: 0, firstDate: d, lastDate: d };
          monthAggsInner.set(m, mAgg);
        }
        mAgg.count += agg.count;
        mAgg.validSum += agg.validSum;
        mAgg.validCount += agg.validCount;
        if (agg.best !== null && (mAgg.best === null || agg.best < mAgg.best)) {
          mAgg.best = agg.best;
        }
        if (d < mAgg.firstDate) mAgg.firstDate = d;
        if (d > mAgg.lastDate) mAgg.lastDate = d;
      }

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
      weekAggs: weekAggsInner,
      monthAggs: monthAggsInner,
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

  const totalLabel = i18n.language === 'zh-Hant' ? (`${total} 次於 ${targetYear}`) : (isZh
      ? `${total} 次于 ${targetYear}`
      : `${total} ${total === 1 ? 'solve' : 'solves'} in ${targetYear}`);
  const emptyLabel = tr({ zh: '还没有成绩。', en: 'No solves yet.',
      zhHant: "還沒有成績。"
});

  const prevLabel = tr({ zh: '上一年', en: 'Previous year' });
  const nextLabel = tr({ zh: '下一年', en: 'Next year' });

  // ---- Streak badge text -----------------------------------------------
  let streakText: string;
  const streakActive = streak > 0;
  if (streak > 0) {
    streakText = i18n.language === 'zh-Hant' ? (`${streak} 天連續`) : (isZh
          ? `${streak} 天连续`
          : `${streak} day${streak === 1 ? '' : 's'} streak`);
  } else {
    streakText = tr({ zh: '今日未练', en: 'no streak today',
        zhHant: "今日未練"
    });
  }
  const streakTitle = tr({ zh: '连续每日至少完成一次还原', en: 'Consecutive days with at least one solve',
      zhHant: "連續每日至少完成一次還原"
});

  // ---- Per-cell tooltip -------------------------------------------------
  const cellTooltip = (date: Date, agg: DayAgg): string => {
    const dateStr = fmtDate(date);
    if (agg.count === 0) {
      return i18n.language === 'zh-Hant' ? (`${dateStr} — 無`) : (isZh ? `${dateStr} — 无` : `${dateStr} — none`);
    }
    const solvesPart = isZh
      ? `${agg.count} 次`
      : `${agg.count} ${agg.count === 1 ? 'solve' : 'solves'}`;
    if (agg.best === null) {
      const noBest = tr({ zh: '无有效成绩', en: 'all DNF',
          zhHant: "無有效成績"
    });
      return `${dateStr} · ${solvesPart} · ${noBest}`;
    }
    const bestPart = (tr({ zh: '最佳 ', en: 'best ' })) + formatMs(agg.best);
    return `${dateStr} · ${solvesPart} · ${bestPart}`;
  };

  // ---- Week / month summary tooltip -------------------------------------
  const summaryTooltip = (
    label: string,
    agg: DayAgg,
  ): string => {
    if (agg.count === 0) {
      return i18n.language === 'zh-Hant' ? (`${label} — 無`) : (isZh ? `${label} — 无` : `${label} — none`);
    }
    const solvesPart = isZh
      ? `${agg.count} 次`
      : `${agg.count} ${agg.count === 1 ? 'solve' : 'solves'}`;
    const bestPart =
      agg.best === null
        ? (tr({ zh: '最佳 -', en: 'best -' }))
        : (tr({ zh: '最佳 ', en: 'best ' })) + formatMs(agg.best);
    const avgPart =
      agg.validCount === 0
        ? (tr({ zh: '平均 -', en: 'avg -' }))
        : (tr({ zh: '平均 ', en: 'avg ' })) + formatMs(agg.validSum / agg.validCount);
    return `${label} · ${solvesPart} · ${bestPart} · ${avgPart}`;
  };

  const showCalendar = !sparse || calendarExpanded;

  return (
    <div className={`tc-heatmap ${className ?? ''}`.trim()}>
      <div className="tc-heatmap-header">
        <div className="tc-heatmap-header-left">
          <span className="tc-heatmap-total">{totalLabel}</span>
          <span
            className={`tc-heatmap-streak${streakActive ? '' : ' tc-heatmap-streak-muted'}`}
            title={streakTitle}
          >
            <Flame size={11} aria-hidden />
            <span>{streakText}</span>
          </span>
          {sparse && (
            <button
              type="button"
              className="tc-heatmap-expand-btn"
              onClick={() => setCalendarExpanded(v => !v)}
            >
              {calendarExpanded
                ? (tr({ zh: '收起日历', en: 'Hide calendar',
                    zhHant: "收起日曆"
                }))
                : (tr({ zh: '展开日历', en: 'Show calendar',
                    zhHant: "展開日曆"
                }))}
            </button>
          )}
        </div>
        {showCalendar && (
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
        )}
      </div>
      {!showCalendar ? null : total === 0 ? (
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
          {/* Invisible per-week hover strips (rendered first, so month-label
              <text> drawn after sits on top and catches its own hover). The
              strips fill the band above the grid so users can hover just
              above any column to see that week's summary. */}
          {weekAggs.map((wk, col) => {
            const wkLabel = `${fmtDate(wk.startDate)} ~ ${fmtDate(wk.endDate)}`;
            const tip = summaryTooltip(wkLabel, wk);
            return (
              <rect
                key={`wk${col}`}
                className="tc-heatmap-week-strip"
                x={labelLeft + col * cellStep}
                y={0}
                width={cellStep}
                height={labelTop - 2}
              >
                <title>{tip}</title>
              </rect>
            );
          })}

          {/* Month labels (hover for month summary) */}
          {monthLabels.map(({ month, col }) => {
            const m = monthAggs.get(month);
            const monthLabelTxt = `${targetYear}-${String(month + 1).padStart(2, '0')}`;
            const tip = summaryTooltip(monthLabelTxt, m ?? EMPTY_AGG);
            return (
              <text
                key={`m${month}`}
                className="tc-heatmap-month tc-heatmap-month-hover"
                x={labelLeft + col * cellStep}
                y={labelTop - 4}
              >
                {months[month]}
                <title>{tip}</title>
              </text>
            );
          })}

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
            const fill = bucketColor(c.agg.count);
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
                <title>{cellTooltip(c.date, c.agg)}</title>
              </rect>
            );
          })}
        </svg>
      )}
    </div>
  );
}
