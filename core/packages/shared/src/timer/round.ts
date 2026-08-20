/**
 * Round simulation — pure WCA round logic over ONE round's attempts.
 * No React, no DOM, no storage.
 *
 * A "round" is a fixed allotment of attempts under one format, optionally
 * gated by a cutoff phase and bounded by a time limit. Every rule below is
 * taken from the WCA Regulations snapshot this repo ships at
 * `app/[lang]/regulation/_data/reg-source.snapshot.md` — line numbers cited.
 *
 *   9f1  (L332) — timed results truncate to hundredths; timed averages and
 *                 means under 10 minutes ROUND to the nearest hundredth.
 *   9f2  (L333) — averages / means over 10 minutes round to the nearest second.
 *   9f5+ (L339) — an attempt the competitor never qualified for (missed
 *                 cutoff) has NO result. It is not a DNS.
 *   9f6  (L342) — "Best of X": X attempts, the best result ranks.
 *   9f7  (L343) — "Best of X": a DNF / DNS is the worst possible result.
 *   9f8  (L344) — "Average of 5": 5 attempts, drop the best and the worst,
 *                 arithmetic mean of the remaining 3.
 *   9f9  (L345) — ao5: exactly ONE DNF/DNS is permitted and counts as the
 *                 worst result; two or more make the average DNF.
 *   9f10 (L346) — "Mean of 3": 3 attempts, arithmetic mean of all 3.
 *   9f11 (L347) — mo3: at least one DNF/DNS makes the mean DNF.
 *   9g   (L359) — Cutoff Round: the competitor is eligible for the remaining
 *                 attempts only if a cutoff-phase attempt is STRICTLY better
 *                 than the cutoff. Cutoff-phase attempts count towards the
 *                 full round format.
 *   A1a1 (L568) — per-attempt time limit.
 *   A1a2 (L569) — cumulative time limit; the limit for one attempt is
 *                 min(per-attempt limit, cumulative limit − time used so far).
 *   A1a2+++++ (L574) — once the cumulative limit is reached, every remaining
 *                 attempt in the round is recorded as DNS.
 *   A1a4 (L578) — an attempt that reaches the time limit is recorded as DNF.
 *   A1a5 (L580) — the time counting towards a limit is the post-penalty result
 *                 when the attempt was not a DNF, else the elapsed solve time.
 *
 * Two deliberate readings that the Regulations do not cover, because they only
 * ever describe a FINISHED round (both are display conveniences, flagged so a
 * reviewer can change them without hunting):
 *
 *   (a) "Live" value — `RoundResult.value` applies the format's rule to the
 *       attempts done so far. For ao5 that means dropping best+worst once ≥ 3
 *       attempts exist; below 3 it is the plain mean of the *finite* attempts
 *       (so a single DNF at 2/5 shows the running mean, not DNF — 9f9 says
 *       that DNF is allowed to become the drop). `RoundResult.official` is the
 *       strict WCA value and is non-null only for a completed allotment.
 *   (b) BPA / WPA and the target plan assume the competitor stays eligible —
 *       they do not model "you get cut and end with no average at all".
 *
 * NOTE (divergence from `_lib/stats.ts`): 9f1 says averages ROUND to the
 * nearest hundredth. `stats.ts` truncates (`truncToCs`), so `roundResult` can
 * read 10 ms above `averageOfN` on the same window. This file follows the
 * Regulation; reconciling the two is a `stats.ts` change, which this file
 * deliberately does not make.
 */

import type { Solve } from './types';
import { effectiveMs } from './types';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

export type RoundFormat = 'bo1' | 'bo2' | 'bo3' | 'bo5' | 'ao5' | 'mo3';

export interface RoundConfig {
  /** Master switch. Nothing here reads it — display sites do. */
  on: boolean;
  format: RoundFormat;
  /** Cutoff requirement in ms. null = no cutoff phase. */
  cutoffMs: number | null;
  /** Length of the cutoff phase in attempts (9g). Clamped to [1, attempts-1]. */
  cutoffAttempts: number;
  /** Time limit in ms. null = no limit. Read together with `cumulative`. */
  limitMs: number | null;
  /** false: `limitMs` is a per-attempt limit (A1a1). true: `limitMs` is the
   *  cumulative limit for the whole round (A1a2). */
  cumulative: boolean;
}

export const DEFAULT_ROUND_CONFIG: RoundConfig = {
  on: false,
  format: 'ao5',
  cutoffMs: null,
  cutoffAttempts: 2,
  limitMs: null,
  cumulative: false,
};

/** Attempts the format allots (9f6 / 9f8 / 9f10). */
export function roundAttempts(format: RoundFormat): number {
  switch (format) {
    case 'bo1': return 1;
    case 'bo2': return 2;
    case 'bo3': return 3;
    case 'bo5': return 5;
    case 'mo3': return 3;
    case 'ao5': return 5;
  }
}

/**
 * Length of the cutoff phase, 0 when no cutoff applies.
 *
 * A cutoff phase shorter than the round is what makes 9g meaningful, so a
 * configured length is clamped into [1, attempts-1] rather than rejected, and
 * a 1-attempt format can never have one.
 */
export function cutoffPhase(config: RoundConfig, attempts: number): number {
  const ms = config.cutoffMs;
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return 0;
  if (attempts <= 1) return 0;
  const n = Math.floor(config.cutoffAttempts);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(n, attempts - 1);
}

/* ------------------------------------------------------------------ */
/* WCA arithmetic                                                      */
/* ------------------------------------------------------------------ */

/**
 * Round an average / mean per 9f1 + 9f2: nearest hundredth of a second below
 * 10 minutes, nearest second at or above it. (The Regulations say "under" and
 * "over" 10 minutes and never name the exact boundary; 10:00.000 is treated as
 * the second-rounding side, which is what every scoretaking tool does.)
 */
function roundAvg(ms: number): number {
  if (!Number.isFinite(ms)) return ms;
  if (ms <= 0) return 0;
  if (ms >= 600_000) return Math.round(ms / 1000) * 1000;
  return Math.round(ms / 10) * 10;
}

/** 9f6 + 9f7 — best attempt; a DNF/DNS (Infinity) is the worst possible. */
function wcaBest(times: number[]): number {
  let best = Infinity;
  for (const t of times) if (t < best) best = t;
  return best;
}

/** 9f10 + 9f11 — arithmetic mean of every attempt; any DNF/DNS ⇒ DNF. */
function wcaMean(times: number[]): number {
  if (times.length === 0) return Infinity;
  if (times.some(t => !Number.isFinite(t))) return Infinity;
  return roundAvg(times.reduce((a, b) => a + b, 0) / times.length);
}

/**
 * 9f8 + 9f9 — drop the single best and single worst, mean the rest; more than
 * one DNF/DNS ⇒ DNF.
 *
 * With fewer than 3 attempts there is nothing to trim, so this returns the
 * plain mean of the finite attempts (see reading (a) in the file header).
 */
function wcaAverage(times: number[]): number {
  const n = times.length;
  if (n === 0) return Infinity;
  const dnf = times.reduce((c, t) => c + (Number.isFinite(t) ? 0 : 1), 0);
  if (dnf > 1) return Infinity;
  if (n >= 3) {
    const sorted = [...times].sort((a, b) => a - b);
    const middle = sorted.slice(1, n - 1);
    return roundAvg(middle.reduce((a, b) => a + b, 0) / middle.length);
  }
  const finite = times.filter(t => Number.isFinite(t));
  if (finite.length === 0) return Infinity;
  return roundAvg(finite.reduce((a, b) => a + b, 0) / finite.length);
}

/** Apply the round's format to a list of effective times. */
function applyFormat(format: RoundFormat, times: number[]): number {
  if (format === 'ao5') return wcaAverage(times);
  if (format === 'mo3') return wcaMean(times);
  return wcaBest(times); // best-of formats — 9f6
}

/* ------------------------------------------------------------------ */
/* Round state                                                         */
/* ------------------------------------------------------------------ */

export type RoundAttemptState =
  /** attempted and counting */
  | 'done'
  /** eligible, not attempted yet */
  | 'pending'
  /** never started because the cumulative limit ran out (A1a2+++++) — counts as DNF */
  | 'dns'
  /** never qualified for, because the cutoff was missed (9g / 9f5+) — no result */
  | 'ineligible';

export interface RoundAttempt {
  /** 0-based position inside the round. */
  index: number;
  /** The solve that filled this slot, when one exists. An `ineligible` slot can
   *  still carry a solve — a practice session does not stop you from cubing. */
  solve: Solve | null;
  /** Effective ms after the round's time limits (Infinity = DNF/DNS).
   *  null when the slot has no result at all (pending / ineligible). */
  ms: number | null;
  state: RoundAttemptState;
  /** The attempt was downgraded to DNF by a time limit (A1a4 / A1a2). */
  overLimit: boolean;
}

export type RoundStatus =
  /** no attempt recorded yet */
  | 'idle'
  /** attempts remain */
  | 'running'
  /** allotment exhausted (or cumulative limit reached) */
  | 'done'
  /** ended early because the cutoff was missed */
  | 'cut';

export interface RoundResult {
  format: RoundFormat;
  /** Attempts the format allots (9f6 / 9f8 / 9f10). */
  attempts: number;
  /** One entry per allotted attempt, in order. */
  list: RoundAttempt[];
  /** Attempts recorded and counting. */
  done: number;
  /** Attempts still available. 0 once the round is over. */
  remaining: number;
  /** Attempts forced to DNS by the cumulative limit (A1a2+++++). */
  dnsCount: number;
  /** Running result over the counted attempts — see reading (a). Infinity =
   *  DNF, null = nothing recorded yet. */
  value: number | null;
  /** The WCA round result. null while the round is unfinished, and also when
   *  a missed cutoff left an ao5/mo3 with fewer attempts than the format needs
   *  (9f5+ — those attempts have no result, so there is no average). */
  official: number | null;
  /** Best single among the counted attempts (9f6). Infinity when all DNF. */
  best: number | null;
  status: RoundStatus;
  /** What closed the round. null while it is still open. */
  endedBy: 'format' | 'cutoff' | 'limit' | null;
  /** A cutoff phase applies to this round. */
  cutoffActive: boolean;
  /** Length of the cutoff phase in attempts (0 when inactive). */
  cutoffPhase: number;
  /** At least one cutoff-phase attempt was strictly better than the cutoff. */
  cutoffMade: boolean;
  /** First ineligible attempt index; -1 when nothing was cut. */
  cutIndex: number;
  /** No further attempt is allowed. */
  complete: boolean;
  /** Time counted towards the cumulative limit so far (A1a5). */
  usedMs: number;
  /** Cumulative budget left, null when no cumulative limit applies. */
  budgetMs: number | null;
  /** The limit that applies to the next attempt (A1a2), null when unlimited. */
  nextLimitMs: number | null;
}

/**
 * Evaluate a round.
 *
 * @param solves the round's attempts, oldest → newest. Pass the slice that
 *   belongs to THIS round, not the whole history. Entries past the format's
 *   allotment are ignored — 9f6/9f8/9f10 allot a fixed number of attempts.
 */
export function roundResult(solves: Solve[], config: RoundConfig): RoundResult {
  const format = config.format;
  const attempts = roundAttempts(format);
  const phase = cutoffPhase(config, attempts);
  const cutoffMs = phase > 0 ? (config.cutoffMs as number) : null;

  const hasLimit = config.limitMs !== null && Number.isFinite(config.limitMs) && config.limitMs > 0;
  const limitMs = hasLimit ? (config.limitMs as number) : null;
  const cumulative = config.cumulative && limitMs !== null;

  const list: RoundAttempt[] = [];
  let used = 0;
  let cutoffMade = false;
  let cutIndex = -1;
  let endedBy: RoundResult['endedBy'] = null;

  for (let i = 0; i < attempts; i++) {
    // Already cut: 9f5+ — the competitor did not qualify, so there is no
    // result for this attempt, even if they kept cubing.
    if (endedBy === 'cutoff') {
      list.push({ index: i, solve: solves[i] ?? null, ms: null, state: 'ineligible', overLimit: false });
      continue;
    }
    // Cumulative budget gone: A1a2+++++ — every remaining attempt is DNS.
    if (endedBy === 'limit') {
      list.push({ index: i, solve: null, ms: Infinity, state: 'dns', overLimit: false });
      continue;
    }

    const s = solves[i];
    if (!s) {
      list.push({ index: i, solve: null, ms: null, state: 'pending', overLimit: false });
      continue;
    }

    // A1a2 — the limit for this attempt is the per-attempt limit or what is
    // left of the cumulative limit, whichever is lower.
    const attemptLimit = cumulative ? (limitMs as number) - used : limitMs;

    let ms = effectiveMs(s);
    let overLimit = false;
    // A1a4 — reaching the limit is a DNF. A1a2++ compares the POST-penalty
    // result, so a 13:59 + 2 = 14:01 busts a 14:00 limit.
    if (attemptLimit !== null && ms >= attemptLimit) {
      ms = Infinity;
      overLimit = true;
    }

    // A1a5 — post-penalty result when it stands, elapsed solve time when the
    // attempt is a DNF. A DNS never started, so it consumes nothing.
    const elapsed = s.penalty === 'DNS' ? 0 : s.timeMs;
    used += Number.isFinite(ms) ? ms : elapsed;

    list.push({ index: i, solve: s, ms, state: 'done', overLimit });

    // 9g — strictly better than the cutoff, in a cutoff-phase attempt.
    if (phase > 0 && i < phase && cutoffMs !== null && ms < cutoffMs) cutoffMade = true;
    if (phase > 0 && !cutoffMade && i === phase - 1) {
      endedBy = 'cutoff';
      cutIndex = phase;
      continue;
    }
    if (cumulative && used >= (limitMs as number) && i < attempts - 1) endedBy = 'limit';
  }

  const counted = list.filter(a => a.state === 'done' || a.state === 'dns');
  const times = counted.map(a => a.ms as number);
  const doneCount = list.reduce((n, a) => n + (a.state === 'done' ? 1 : 0), 0);
  const dnsCount = list.reduce((n, a) => n + (a.state === 'dns' ? 1 : 0), 0);
  const remaining = list.reduce((n, a) => n + (a.state === 'pending' ? 1 : 0), 0);
  const complete = remaining === 0;
  if (complete && endedBy === null) endedBy = 'format';

  const value = times.length > 0 ? applyFormat(format, times) : null;
  // "Best of X" ranks on the best attempt the competitor actually made, so it
  // survives a missed cutoff (9f6). An average/mean needs the full allotment
  // (9f8 / 9f10); a cut competitor simply has no average (9f5+).
  const needsFullAllotment = format === 'ao5' || format === 'mo3';
  const official =
    complete && (!needsFullAllotment || times.length === attempts) ? value : null;

  const status: RoundStatus =
    endedBy === 'cutoff' ? 'cut'
      : complete ? 'done'
        : doneCount === 0 ? 'idle'
          : 'running';

  const budgetMs = cumulative ? Math.max(0, (limitMs as number) - used) : null;
  const nextLimitMs = cumulative ? budgetMs : limitMs;

  return {
    format,
    attempts,
    list,
    done: doneCount,
    remaining,
    dnsCount,
    value,
    official,
    best: times.length > 0 ? wcaBest(times) : null,
    status,
    endedBy,
    cutoffActive: phase > 0,
    cutoffPhase: phase,
    cutoffMade,
    cutIndex,
    complete,
    usedMs: used,
    budgetMs,
    nextLimitMs,
  };
}

/**
 * Did the competitor satisfy the cutoff requirement (9g)?
 *
 * Strictly better than the cutoff, in at least one cutoff-phase attempt —
 * equalling the cutoff is not enough. Returns true when no cutoff applies:
 * there is no requirement to satisfy, so `if (!roundCutoffMade(...)) stop` is
 * the right way to read it.
 */
export function roundCutoffMade(solves: Solve[], config: RoundConfig): boolean {
  const res = roundResult(solves, config);
  return res.cutoffActive ? res.cutoffMade : true;
}

/* ------------------------------------------------------------------ */
/* Projection                                                          */
/* ------------------------------------------------------------------ */

export interface RoundTargetPlan {
  /** The target that was asked about, in ms. */
  ms: number;
  /** Reached no matter what happens on the remaining attempts. */
  achieved: boolean;
  /** Out of reach even with a 0 ms on every remaining attempt. */
  impossible: boolean;
  /** Slowest time allowed on EACH remaining attempt to still reach the target.
   *  null when achieved, impossible, or nothing remains. */
  needMs: number | null;
}

export interface RoundProjection {
  /** Attempts still to come. */
  remaining: number;
  /** Best possible final result — 0 ms substituted for every remaining attempt.
   *  Generalises `stats.bpa`, which only handles exactly one remaining. */
  bpa: number | null;
  /** Worst possible final result — DNF substituted for every remaining attempt.
   *  Generalises `stats.wpa`. */
  wpa: number | null;
  /** null when no target was supplied. */
  target: RoundTargetPlan | null;
}

/**
 * Best / worst possible final result, plus what the remaining attempts have to
 * deliver to reach `targetMs`.
 *
 * With the round over, `bpa` and `wpa` collapse onto the result itself.
 * See reading (b) in the file header for what the projection does not model.
 */
export function roundProjection(
  solves: Solve[],
  config: RoundConfig,
  targetMs: number | null = null,
): RoundProjection {
  const res = roundResult(solves, config);
  const times = res.list
    .filter(a => a.state === 'done' || a.state === 'dns')
    .map(a => a.ms as number);
  const remaining = res.remaining;

  const resultWith = (x: number): number =>
    applyFormat(res.format, [...times, ...new Array<number>(remaining).fill(x)]);

  const empty = times.length === 0 && remaining === 0;
  const bpa = empty ? null : resultWith(0);
  const wpa = empty ? null : resultWith(Infinity);

  let target: RoundTargetPlan | null = null;
  if (targetMs !== null && Number.isFinite(targetMs) && targetMs > 0) {
    if (remaining === 0) {
      const v = res.value;
      const hit = v !== null && v <= targetMs;
      target = { ms: targetMs, achieved: hit, impossible: !hit, needMs: null };
    } else {
      const achieved = wpa !== null && wpa <= targetMs;
      const impossible = bpa === null || bpa > targetMs;
      target = {
        ms: targetMs,
        achieved,
        impossible: !achieved && impossible,
        needMs: achieved || impossible ? null : needForTarget(resultWith, targetMs, times.length + remaining),
      };
    }
  }

  return { remaining, bpa, wpa, target };
}

/**
 * Largest per-attempt time that still reaches `targetMs`.
 *
 * `resultWith` is monotone non-decreasing in x (raising one attempt can only
 * raise a best / a mean / a trimmed mean), so a binary search is exact.
 * `windowSize * targetMs` is a safe upper bound: any mean over `windowSize`
 * non-negative values that includes x is at least x / windowSize.
 */
function needForTarget(
  resultWith: (x: number) => number,
  targetMs: number,
  windowSize: number,
): number | null {
  let lo = 0;
  let hi = Math.ceil(targetMs * Math.max(1, windowSize)) + 1000;
  if (resultWith(lo) > targetMs) return null;
  if (resultWith(hi) <= targetMs) return null;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (resultWith(mid) <= targetMs) lo = mid;
    else hi = mid;
  }
  return lo;
}
