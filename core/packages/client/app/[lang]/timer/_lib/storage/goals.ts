/**
 * Daily-goal helpers — count solves landing in today's local-tz window
 * and detect a consecutive streak of days that hit a given goal.
 *
 * Pure: no React, no DOM, no localStorage.
 */

import type { Solve } from '../types';

/** Local-tz YYYY-MM-DD key for a unix-ms timestamp. */
function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function todayKey(): string {
  return dayKey(Date.now());
}

/**
 * How many solves were recorded today (local timezone).
 * All solves count — no penalty filtering.
 */
export function countSolvesToday(solves: Solve[]): number {
  if (solves.length === 0) return 0;
  const tk = todayKey();
  let n = 0;
  for (const s of solves) {
    if (dayKey(s.ts) === tk) n += 1;
  }
  return n;
}

/**
 * How many consecutive local-tz days (ending today) the user has met
 * the daily solve goal. Returns 0 if today's count is below the goal.
 *
 * goal <= 0 → 0 (treat as disabled).
 */
export function consecutiveGoalDays(solves: Solve[], goal: number): number {
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  if (solves.length === 0) return 0;
  // Bucket solve count per day key.
  const byDay = new Map<string, number>();
  for (const s of solves) {
    const k = dayKey(s.ts);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  // Walk backwards from today; stop at the first day that misses the goal.
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;
  while (true) {
    const k = dayKey(cursor.getTime());
    const n = byDay.get(k) ?? 0;
    if (n < goal) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
