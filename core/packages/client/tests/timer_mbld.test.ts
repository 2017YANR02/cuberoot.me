/**
 * 3x3x3 Multi-Blind — WCA Regulation 9f12c.
 *
 * The clause this file implements, verbatim (from the bundled regulation data,
 * `app/[lang]/regulation/_data/reg-clauses/_full.json`, id "9f12c"):
 *
 *   "For 3x3x3 Multi-Blind, rankings are assessed based on the number of
 *    puzzles solved minus the number of puzzles not solved, where a greater
 *    difference is better. If the difference is less than 0, or if only 1
 *    puzzle is solved, the attempt is considered unsolved (DNF). If competitors
 *    achieve the same result, rankings are assessed based on total time, where
 *    the shorter recorded time is better. If competitors achieve the same
 *    result and the same time, rankings are assessed based on the number of
 *    puzzles the competitors failed to solve, where fewer unsolved puzzles are
 *    better."
 *
 * THE DNF BOUNDARY IS `points < 0`, NOT `points < 1`. A 2/4 attempt scores
 * exactly 0 points and is a VALID result. Verified against the local WCA
 * developer dump (`wca_developer_database`), decoding `result_attempts.value`
 * as the modern `0DDTTTTTMM` form (difference = 99 - floor(value / 1e7),
 * missed = value % 100):
 *   - difference 0 with 2+ solved is still recorded today — 131 such results in
 *     2025 and 39 in 2026, so `points === 0` must NOT be a DNF.
 *   - difference 0 with exactly 1 solved (a 1/2 attempt) last appeared in
 *     2013 (869 results, none since) — the "only 1 puzzle solved" clause.
 * Those two facts together pin the rule to `points < 0 || solved < 2`.
 *
 * `timeMs` stays a real millisecond duration — the WCA's packed DDDTTTTTMM
 * integer is deliberately NOT stored, so charts/averages/sorts are untouched
 * and only ranking + labelling special-case MBLD.
 */

import { describe, it, expect } from 'vitest';
import type { Penalty, Solve } from '@/app/[lang]/timer/_lib/types';
import { effectiveMs } from '@/app/[lang]/timer/_lib/types';
import {
  bestMbldSolve,
  bestSingle,
  checkMbldEntry,
  compareMbld,
  eventDefaultFormat,
  formatBestPrimary,
  formatMbldResult,
  formatPrimary,
  formatSolveResult,
  isMbldDnf,
  mbldPoints,
  pbSingleIndex,
  summarize,
} from '@/app/[lang]/timer/_lib/stats';

let seq = 0;
/** An MBLD solve. `min`/`sec` build the attempt duration. */
function mbld(
  solved: number,
  attempted: number,
  min: number,
  sec = 0,
  penalty: Penalty = 'ok',
): Solve {
  seq++;
  return {
    id: 'm' + seq,
    timeMs: (min * 60 + sec) * 1000,
    penalty,
    scramble: "R U R' U'",
    event: '333mbld',
    ts: 1_700_000_000_000 + seq * 1000,
    mbld: { solved, attempted },
  };
}

/** A plain 3x3 solve — MBLD helpers must leave these alone. */
function plain(timeMs: number, penalty: Penalty = 'ok'): Solve {
  seq++;
  return {
    id: 'p' + seq,
    timeMs,
    penalty,
    scramble: "R U R' U'",
    event: '333',
    ts: 1_700_000_000_000 + seq * 1000,
  };
}

/* ------------------------------------------------------------------ */
/* Points arithmetic                                                   */
/* ------------------------------------------------------------------ */

describe('mbldPoints', () => {
  it('is solved minus unsolved, not solved', () => {
    expect(mbldPoints(mbld(11, 13, 58, 2))).toBe(9); // 11 - 2
    expect(mbldPoints(mbld(13, 13, 58, 2))).toBe(13); // a clean sweep scores full
    expect(mbldPoints(mbld(0, 5, 30))).toBe(-5);
    expect(mbldPoints(mbld(3, 6, 40))).toBe(0);
  });

  it('is null for a solve carrying no MBLD payload', () => {
    expect(mbldPoints(plain(12_340))).toBeNull();
  });

  it('does not change with the recorded time', () => {
    expect(mbldPoints(mbld(11, 13, 58, 2))).toBe(mbldPoints(mbld(11, 13, 12, 0)));
  });
});

/* ------------------------------------------------------------------ */
/* The 9f12c DNF rule, at its exact boundaries                         */
/* ------------------------------------------------------------------ */

describe('isMbldDnf — the "difference is less than 0" boundary', () => {
  it('accepts exactly 0 points (2/4) — this is the boundary the rule turns on', () => {
    expect(mbldPoints(mbld(2, 4, 20))).toBe(0);
    expect(isMbldDnf(mbld(2, 4, 20))).toBe(false);
  });

  it('rejects one point below it (2/5 = -1)', () => {
    expect(mbldPoints(mbld(2, 5, 20))).toBe(-1);
    expect(isMbldDnf(mbld(2, 5, 20))).toBe(true);
  });

  it('accepts one point above it (3/5 = +1)', () => {
    expect(mbldPoints(mbld(3, 5, 20))).toBe(1);
    expect(isMbldDnf(mbld(3, 5, 20))).toBe(false);
  });

  it('holds at larger counts too — 5/10 scores 0 and stands', () => {
    expect(mbldPoints(mbld(5, 10, 55))).toBe(0);
    expect(isMbldDnf(mbld(5, 10, 55))).toBe(false);
    expect(isMbldDnf(mbld(5, 11, 55))).toBe(true); // -1
  });
});

describe('isMbldDnf — the "only 1 puzzle is solved" boundary', () => {
  it('rejects 1/2 even though its difference is 0', () => {
    // The case that proves the rule needs BOTH clauses: points === 0 here, so
    // the difference test alone would let it through.
    expect(mbldPoints(mbld(1, 2, 10))).toBe(0);
    expect(isMbldDnf(mbld(1, 2, 10))).toBe(true);
  });

  it('rejects 1/1 (points +1) — a single solved cube is never a result', () => {
    expect(mbldPoints(mbld(1, 1, 5))).toBe(1);
    expect(isMbldDnf(mbld(1, 1, 5))).toBe(true);
  });

  it('accepts 2/2, the smallest valid attempt', () => {
    expect(isMbldDnf(mbld(2, 2, 5))).toBe(false);
  });

  it('rejects 0 solved outright', () => {
    expect(isMbldDnf(mbld(0, 2, 10))).toBe(true);
    expect(isMbldDnf(mbld(0, 0, 10))).toBe(true);
  });

  it('is false for a non-MBLD solve — it answers only the 9f12c question', () => {
    expect(isMbldDnf(plain(12_340))).toBe(false);
    expect(isMbldDnf(plain(12_340, 'DNF'))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Result string                                                       */
/* ------------------------------------------------------------------ */

describe('formatMbldResult', () => {
  it('renders solved/attempted plus the time truncated to whole seconds', () => {
    expect(formatMbldResult(mbld(11, 13, 58, 2))).toBe('11/13 58:02');
    expect(formatMbldResult(mbld(2, 2, 4, 9))).toBe('2/2 4:09');
  });

  it('drops sub-second precision rather than rounding up', () => {
    const s = mbld(11, 13, 58, 2);
    s.timeMs += 999;
    expect(formatMbldResult(s)).toBe('11/13 58:02');
  });

  it('shows hours for a full-hour attempt', () => {
    expect(formatMbldResult(mbld(30, 30, 60, 0))).toBe('30/30 1:00:00');
  });

  it('keeps the numbers visible on a 9f12c DNF', () => {
    expect(formatMbldResult(mbld(1, 5, 10))).toBe('DNF (1/5 10:00)');
    expect(formatMbldResult(mbld(2, 5, 20))).toBe('DNF (2/5 20:00)');
  });

  it('honours an explicit DNF penalty on an otherwise valid attempt', () => {
    expect(formatMbldResult(mbld(11, 13, 58, 2, 'DNF'))).toBe('DNF (11/13 58:02)');
  });

  it('renders DNS as DNS', () => {
    expect(formatMbldResult(mbld(11, 13, 58, 2, 'DNS'))).toBe('DNS');
  });

  it('adds the +2 before formatting', () => {
    expect(formatMbldResult(mbld(11, 13, 58, 2, '+2'))).toBe('11/13 58:04');
  });
});

describe('formatSolveResult composes MBLD in', () => {
  it('renders an MBLD solve as its WCA result string, not a bare time', () => {
    expect(formatSolveResult(mbld(11, 13, 58, 2))).toBe('11/13 58:02');
  });

  it('leaves every other event exactly as it was', () => {
    expect(formatSolveResult(plain(12_340))).toBe('12.34');
    expect(formatSolveResult(plain(12_340, 'DNS'))).toBe('DNS');
    expect(formatSolveResult(plain(12_340, 'DNF'))).toBe('DNF');
    expect(formatSolveResult(plain(12_340, '+2'))).toBe('14.34');
  });
});

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

describe('compareMbld', () => {
  it('ranks more points first, regardless of time', () => {
    // 9 points in 58 min beats 5 points in 10 min.
    expect(compareMbld(mbld(11, 13, 58), mbld(5, 5, 10))).toBeLessThan(0);
    expect(compareMbld(mbld(5, 5, 10), mbld(11, 13, 58))).toBeGreaterThan(0);
  });

  it('breaks a points tie on the shorter time', () => {
    const fast = mbld(10, 12, 30);
    const slow = mbld(10, 12, 45);
    expect(mbldPoints(fast)).toBe(mbldPoints(slow));
    expect(compareMbld(fast, slow)).toBeLessThan(0);
    expect(compareMbld(slow, fast)).toBeGreaterThan(0);
  });

  it('breaks a points+time tie on fewer unsolved puzzles', () => {
    const fewerMisses = mbld(11, 13, 40); // 9 points, 2 unsolved
    const moreMisses = mbld(12, 15, 40); // 9 points, 3 unsolved
    expect(mbldPoints(fewerMisses)).toBe(mbldPoints(moreMisses));
    expect(compareMbld(fewerMisses, moreMisses)).toBeLessThan(0);
    expect(compareMbld(moreMisses, fewerMisses)).toBeGreaterThan(0);
  });

  it('returns 0 for two attempts equal on all three keys', () => {
    expect(compareMbld(mbld(11, 13, 40), mbld(11, 13, 40))).toBe(0);
  });

  it('ranks any DNF after every valid attempt, even a much worse-scoring one', () => {
    const weakButValid = mbld(2, 2, 59); // 2 points, nearly an hour
    const strongButDnf = mbld(1, 1, 1); // would be 1 point, but only 1 solved
    expect(compareMbld(weakButValid, strongButDnf)).toBeLessThan(0);
    expect(compareMbld(strongButDnf, weakButValid)).toBeGreaterThan(0);
  });

  it('treats an explicit DNF and a DNS as unranked too', () => {
    const valid = mbld(2, 2, 59);
    expect(compareMbld(valid, mbld(11, 13, 10, 0, 'DNF'))).toBeLessThan(0);
    expect(compareMbld(valid, mbld(11, 13, 10, 0, 'DNS'))).toBeLessThan(0);
  });

  it('ties two DNFs at 0 — they are not ordered against each other', () => {
    expect(compareMbld(mbld(1, 5, 10), mbld(0, 9, 60))).toBe(0);
  });

  it('sorts a field best-first', () => {
    const field = [
      mbld(5, 6, 30), // 4 pts
      mbld(1, 5, 20), // DNF
      mbld(11, 13, 58), // 9 pts
      mbld(9, 10, 50), // 8 pts
      mbld(11, 13, 42), // 9 pts, faster
    ];
    const ranked = [...field].sort(compareMbld).map(formatMbldResult);
    expect(ranked).toEqual([
      '11/13 42:00',
      '11/13 58:00',
      '9/10 50:00',
      '5/6 30:00',
      'DNF (1/5 20:00)',
    ]);
  });
});

describe('bestMbldSolve / bestSingle', () => {
  it('picks the highest-scoring attempt, not the fastest', () => {
    const solves = [mbld(5, 5, 10), mbld(11, 13, 58), mbld(6, 7, 12)];
    expect(formatMbldResult(bestMbldSolve(solves)!)).toBe('11/13 58:00');
  });

  it('returns null when every attempt is a DNF', () => {
    expect(bestMbldSolve([mbld(1, 5, 10), mbld(0, 3, 20)])).toBeNull();
  });

  it('bestSingle(event) returns the winning attempt duration, not the shortest', () => {
    const solves = [mbld(5, 5, 10), mbld(11, 13, 58), mbld(6, 7, 12)];
    expect(bestSingle(solves, '333mbld')).toBe(58 * 60_000);
    // Without the event it degrades to the old shortest-time meaning.
    expect(bestSingle(solves)).toBe(10 * 60_000);
  });

  it('bestSingle(event) is Infinity when nothing ranks', () => {
    expect(bestSingle([mbld(1, 5, 10)], '333mbld')).toBe(Infinity);
  });

  it('leaves non-MBLD events on the shortest-time path', () => {
    const solves = [plain(12_340), plain(9_870), plain(15_020, 'DNF')];
    expect(bestSingle(solves)).toBe(9_870);
    expect(bestSingle(solves, '333')).toBe(9_870);
  });
});

describe('pbSingleIndex', () => {
  it('marks the highest-scoring attempt, not the fastest, for MBLD', () => {
    const solves = [mbld(5, 5, 10), mbld(11, 13, 58), mbld(6, 7, 12)];
    expect(pbSingleIndex(solves, '333mbld')).toBe(1);
    // Without the event it still picks the fastest — the old meaning.
    expect(pbSingleIndex(solves)).toBe(0);
  });

  it('skips DNF attempts and returns -1 when none rank', () => {
    expect(pbSingleIndex([mbld(1, 5, 10), mbld(9, 10, 40), mbld(0, 3, 5)], '333mbld')).toBe(1);
    expect(pbSingleIndex([mbld(1, 5, 10)], '333mbld')).toBe(-1);
  });

  it('is unchanged for other events', () => {
    expect(pbSingleIndex([plain(12_340), plain(9_870), plain(1_000, 'DNF')])).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Formatting entry points used by the panels                          */
/* ------------------------------------------------------------------ */

describe('formatPrimary / formatBestPrimary / summarize', () => {
  const fmt = eventDefaultFormat('333mbld');

  it("MBLD's default format is a single", () => {
    expect(fmt).toEqual({ kind: 'single', n: 1 });
  });

  it('formatPrimary shows the latest attempt as a result string', () => {
    const solves = [mbld(5, 5, 10), mbld(11, 13, 58, 2)];
    expect(formatPrimary(solves, fmt, '333mbld')).toBe('11/13 58:02');
  });

  it('formatBestPrimary shows the highest-scoring attempt, not the fastest', () => {
    const solves = [mbld(5, 5, 10), mbld(11, 13, 58, 2), mbld(6, 7, 12)];
    expect(formatBestPrimary(solves, fmt, '333mbld')).toBe('11/13 58:02');
  });

  it('formatBestPrimary is DNF when no attempt ranks', () => {
    expect(formatBestPrimary([mbld(1, 5, 10)], fmt, '333mbld')).toBe('DNF');
  });

  it('summarize().best is the WCA result string for MBLD', () => {
    const solves = [mbld(5, 5, 10), mbld(11, 13, 58, 2)];
    expect(summarize(solves, '333mbld').best).toBe('11/13 58:02');
  });

  it('summarize() is untouched for other events', () => {
    expect(summarize([plain(12_340), plain(9_870)], '333').best).toBe('9.87');
  });
});

/* ------------------------------------------------------------------ */
/* Manual-entry validation edges                                       */
/* ------------------------------------------------------------------ */

describe('checkMbldEntry — attempted', () => {
  it('rejects fewer than 2 attempted', () => {
    // Every 1-cube outcome is a DNF under 9f12c, so the row is meaningless.
    expect(checkMbldEntry(1, 1, 60_000)).toEqual({ ok: false, reason: 'attempted' });
    expect(checkMbldEntry(0, 0, 60_000)).toEqual({ ok: false, reason: 'attempted' });
  });

  it('accepts exactly 2 attempted — the boundary', () => {
    expect(checkMbldEntry(2, 2, 60_000)).toEqual({ ok: true, solved: 2, attempted: 2, ms: 60_000 });
  });

  it('rejects unreadable / negative / fractional attempted', () => {
    expect(checkMbldEntry(2, null, 60_000)).toEqual({ ok: false, reason: 'attempted' });
    expect(checkMbldEntry(2, -3, 60_000)).toEqual({ ok: false, reason: 'attempted' });
    expect(checkMbldEntry(2, 4.5, 60_000)).toEqual({ ok: false, reason: 'attempted' });
    expect(checkMbldEntry(2, NaN, 60_000)).toEqual({ ok: false, reason: 'attempted' });
  });
});

describe('checkMbldEntry — solved', () => {
  it('rejects solved greater than attempted', () => {
    expect(checkMbldEntry(6, 5, 60_000)).toEqual({ ok: false, reason: 'solved-exceeds-attempted' });
  });

  it('accepts solved equal to attempted — the boundary', () => {
    expect(checkMbldEntry(5, 5, 60_000)).toEqual({ ok: true, solved: 5, attempted: 5, ms: 60_000 });
  });

  it('accepts 0 solved — impossible input is refused, a bad result is not', () => {
    // 0/5 is a real (DNF) attempt the user may want on record; the DNF is
    // derived later by isMbldDnf, not refused here.
    expect(checkMbldEntry(0, 5, 60_000)).toEqual({ ok: true, solved: 0, attempted: 5, ms: 60_000 });
  });

  it('rejects unreadable / negative / fractional solved', () => {
    expect(checkMbldEntry(null, 5, 60_000)).toEqual({ ok: false, reason: 'solved' });
    expect(checkMbldEntry(-1, 5, 60_000)).toEqual({ ok: false, reason: 'solved' });
    expect(checkMbldEntry(2.5, 5, 60_000)).toEqual({ ok: false, reason: 'solved' });
  });
});

describe('checkMbldEntry — time', () => {
  it('rejects zero time', () => {
    expect(checkMbldEntry(3, 5, 0)).toEqual({ ok: false, reason: 'time' });
  });

  it('rejects negative / unreadable / non-finite time', () => {
    expect(checkMbldEntry(3, 5, -1)).toEqual({ ok: false, reason: 'time' });
    expect(checkMbldEntry(3, 5, null)).toEqual({ ok: false, reason: 'time' });
    expect(checkMbldEntry(3, 5, Infinity)).toEqual({ ok: false, reason: 'time' });
  });

  it('accepts 1 ms — the boundary is > 0, not some minimum plausible time', () => {
    expect(checkMbldEntry(3, 5, 1)).toEqual({ ok: true, solved: 3, attempted: 5, ms: 1 });
  });

  it('checks attempted before solved before time', () => {
    // All three are bad; the reported reason is the first one in rule order,
    // so the user fixes the box that actually blocks them.
    expect(checkMbldEntry(9, 1, 0)).toEqual({ ok: false, reason: 'attempted' });
    expect(checkMbldEntry(9, 5, 0)).toEqual({ ok: false, reason: 'solved-exceeds-attempted' });
  });
});

/* ------------------------------------------------------------------ */
/* The design promise: timeMs stays a real duration                    */
/* ------------------------------------------------------------------ */

describe('timeMs is not a packed WCA integer', () => {
  it('effectiveMs on a valid MBLD attempt is its real duration', () => {
    expect(effectiveMs(mbld(11, 13, 58, 2))).toBe(3_482_000);
    expect(effectiveMs(mbld(11, 13, 58, 2, '+2'))).toBe(3_484_000);
  });

  it('a 9f12c DNF still carries its real duration for the tiebreaker', () => {
    // isMbldDnf is what makes it unranked; timeMs is untouched so the
    // "shorter recorded time" tiebreak and the charts still have a number.
    const s = mbld(1, 5, 10);
    expect(isMbldDnf(s)).toBe(true);
    expect(s.timeMs).toBe(600_000);
  });
});
