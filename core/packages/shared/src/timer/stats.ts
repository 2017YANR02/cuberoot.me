/**
 * Stats engine — pure functions over Solve[].
 *
 * Conventions: time values are post-penalty effective ms; DNF = Infinity.
 * "Last N" means the most recent N solves in chronological order (so the array
 * passed in must already be ordered oldest → newest).
 */

import type { Solve, EventId, Penalty } from './types';
import { effectiveMs } from './types';

/** WCA trim count: ceil(n/20), but at least 1 for n in [3,20]. */
function trimCount(n: number): number {
  if (n < 3) return 0;
  return Math.max(1, Math.ceil(n / 20));
}

/**
 * Per WCA Regulations 9f9: average is invalid (DNF) if more than ONE solve in
 * the window is DNF for ao5/ao12. For larger windows we use a more lenient
 * "trim count" cap consistent with most timers (cstimer / DCTimer behavior).
 */
function maxDnfsAllowed(n: number): number {
  return n <= 12 ? 1 : trimCount(n);
}

/** Trimmed mean over an array of effective-ms numbers (Infinity = DNF). */
function trimmedMean(times: number[]): number {
  const n = times.length;
  if (n < 3) return mean(times);
  const trim = trimCount(n);
  const sorted = [...times].sort((a, b) => a - b);
  const dnfCount = sorted.filter(t => t === Infinity).length;
  if (dnfCount > maxDnfsAllowed(n)) return Infinity;
  const middle = sorted.slice(trim, n - trim);
  return mean(middle);
}

function mean(times: number[]): number {
  if (times.length === 0) return NaN;
  if (times.some(t => t === Infinity)) return Infinity;
  return times.reduce((a, b) => a + b, 0) / times.length;
}

/**
 * Truncate to centiseconds (10ms) — WCA standard for averages and means
 * (Regulations 9f3 / 9f7). Single-time values are reported as-is (no trunc).
 */
function truncToCs(ms: number): number {
  if (!Number.isFinite(ms)) return ms;
  if (ms <= 0) return 0;
  return Math.floor(ms / 10) * 10;
}

/**
 * Average of N over the last N solves. Returns null when fewer than N exist.
 *
 * For N = 3, 5, 12, 25, 50, 100, ... uses the WCA "average" definition: drop
 * top and bottom 5% (rounded up to at least 1), mean the rest. For N = 1 we
 * return the single time. We treat "mean of N" the same as average for our
 * purposes — single-DNF tolerance only.
 */
export function averageOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const last = solves.slice(-n).map(effectiveMs);
  if (n === 1) return last[0];
  return truncToCs(trimmedMean(last));
}

/**
 * Best Possible Average — when exactly one more solve is needed to complete an
 * aoN window, returns the trimmed mean assuming that final solve = 0 ms.
 *
 * Returns null when not "live" (solves.length !== n - 1) or n < 3.
 * Returns Infinity when even the best-case substitution yields > maxDnfsAllowed
 * (i.e. existing DNFs already exceed the cap, since a 0 ms substitute can't
 * reduce the DNF count).
 */
export function bpa(solves: Solve[], n: number): number | null {
  if (n < 3) return null;
  if (solves.length !== n - 1) return null;
  const last = solves.slice(-(n - 1)).map(effectiveMs);
  const window = [...last, 0];
  return truncToCs(trimmedMean(window));
}

/**
 * Worst Possible Average — same "live" contract as `bpa`, but assumes the
 * final solve = DNF (Infinity). Returns Infinity when the resulting DNF count
 * exceeds maxDnfsAllowed for n.
 */
export function wpa(solves: Solve[], n: number): number | null {
  if (n < 3) return null;
  if (solves.length !== n - 1) return null;
  const last = solves.slice(-(n - 1)).map(effectiveMs);
  const window = [...last, Infinity];
  return truncToCs(trimmedMean(window));
}

/** Best avg of N across the entire solve history. */
export function bestAverageOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  let best = Infinity;
  for (let i = 0; i + n <= solves.length; i++) {
    const window = solves.slice(i, i + n).map(effectiveMs);
    const avg = n === 1 ? window[0] : trimmedMean(window);
    if (avg < best) best = avg;
  }
  return Number.isFinite(best) ? truncToCs(best) : best;
}

/**
 * FMC stores a move count as `moves * 1000` ms. Its mean is ROUNDED to two
 * decimals of a move (WCA A7c / 9f8) rather than truncated to centiseconds
 * like a time mean (9f7) — and 0.01 move == 10 ms in our encoding, so the two
 * rules differ only in floor-vs-round. Applied only when the whole window is
 * FMC; a mixed window is nonsense and falls back to the time rule.
 */
function isFmcWindow(window: Solve[]): boolean {
  return window.length > 0 && window.every(s => s.event === '333fm');
}

function roundMeanFor(window: Solve[], raw: number): number {
  if (!Number.isFinite(raw)) return raw;
  return isFmcWindow(window) ? Math.round(raw / 10) * 10 : truncToCs(raw);
}

/**
 * Mean of N over the last N solves — no trim, all solves count.
 * Any DNF/DNS in the window → Infinity. Per WCA 9f7 the mean is truncated to
 * cs; the FMC mean is rounded to 2 dp instead (see `roundMeanFor`).
 */
export function meanOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const window = solves.slice(-n);
  const last = window.map(effectiveMs);
  if (last.some(t => t === Infinity)) return Infinity;
  return roundMeanFor(window, last.reduce((a, b) => a + b, 0) / n);
}

/**
 * Best of N — fastest valid solve in the most recent N. If every solve in the
 * window is DNF, returns Infinity.
 */
export function bestOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const last = solves.slice(-n).map(effectiveMs);
  let best = Infinity;
  for (const t of last) if (t < best) best = t;
  return best;
}

/** Best mean-of-N across the entire solve history. */
export function bestMeanOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  let best = Infinity;
  let bestWindow: Solve[] = [];
  for (let i = 0; i + n <= solves.length; i++) {
    const slice = solves.slice(i, i + n);
    const window = slice.map(effectiveMs);
    if (window.some(t => t === Infinity)) continue;
    const m = window.reduce((a, b) => a + b, 0) / n;
    if (m < best) { best = m; bestWindow = slice; }
  }
  // Same FMC round-vs-truncate rule as `meanOfN` so "best mo3" agrees with the
  // live mo3 when they land on the same window.
  return Number.isFinite(best) ? roundMeanFor(bestWindow, best) : best;
}

/** Best best-of-N across the entire solve history. */
export function bestBestOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  let best = Infinity;
  for (let i = 0; i + n <= solves.length; i++) {
    for (const s of solves.slice(i, i + n)) {
      const t = effectiveMs(s);
      if (t < best) best = t;
    }
  }
  return best;
}

/** WCA per-event default average format. */
export type EventFormat = { kind: 'ao5' | 'mo3' | 'bo3' | 'single'; n: number };
export function eventDefaultFormat(event: EventId): EventFormat {
  if (event === '333fm') return { kind: 'mo3', n: 3 };
  if (event === '333mbld') return { kind: 'single', n: 1 };
  if (event === '444bld' || event === '555bld' || event === '666bld' || event === '777bld') {
    return { kind: 'bo3', n: 3 };
  }
  // 3BLD ('333bld') is ao5 since 2023+; 3BLD-NI also ao5 here.
  return { kind: 'ao5', n: 5 };
}

/** Compute primary average per event format over the most recent solves.
 *  Pass `event` to format FMC as move counts. MBLD needs no branch here: its
 *  `eventDefaultFormat` is 'single', and the single branch already delegates to
 *  `formatSolveResult`, which renders the full "11/13 58:02" result. */
export function formatPrimary(solves: Solve[], fmt: EventFormat, event?: EventId): string {
  const f = (ms: number | null) => (event ? formatEventMs(event, ms) : formatMs(ms));
  if (solves.length < fmt.n) return '-';
  if (fmt.kind === 'ao5')    return f(averageOfN(solves, fmt.n));
  if (fmt.kind === 'mo3')    return f(meanOfN(solves, fmt.n));
  if (fmt.kind === 'bo3')    return f(bestOfN(solves, fmt.n));
  // single
  const last = solves[solves.length - 1];
  return event ? formatSolveResult(last) : formatMs(effectiveMs(last));
}

/** Best historical primary across all solves for the given format. */
export function formatBestPrimary(solves: Solve[], fmt: EventFormat, event?: EventId): string {
  const f = (ms: number | null) => (event ? formatEventMs(event, ms) : formatMs(ms));
  if (solves.length < fmt.n) return '-';
  // MBLD ranks on points, so its "best" is a whole attempt rather than a
  // number — resolve the attempt and print its WCA result string.
  if (event === '333mbld') {
    const best = bestMbldSolve(solves);
    return best === null ? 'DNF' : formatMbldResult(best);
  }
  if (fmt.kind === 'ao5')    return f(bestAverageOfN(solves, fmt.n));
  if (fmt.kind === 'mo3')    return f(bestMeanOfN(solves, fmt.n));
  if (fmt.kind === 'bo3')    return f(bestBestOfN(solves, fmt.n));
  return f(bestSingle(solves, event));
}

/**
 * Best single (lowest effective time, ignoring DNFs unless all are DNF).
 *
 * @param event optional. Pass '333mbld' and "best" switches to the WCA ranking
 *   (most points, then shortest time — `compareMbld`) instead of the shortest
 *   time; the returned number is then that winning attempt's duration, which is
 *   the only number a caller can meaningfully plot for it. Callers wanting the
 *   attempt itself (to render "11/13 58:02") should use `bestMbldSolve`.
 */
export function bestSingle(solves: Solve[], event?: EventId): number | null {
  if (solves.length === 0) return null;
  if (event === '333mbld') {
    const best = bestMbldSolve(solves);
    return best === null ? Infinity : effectiveMs(best);
  }
  let best = Infinity;
  for (const s of solves) {
    const e = effectiveMs(s);
    if (e < best) best = e;
  }
  return best === Infinity ? Infinity : best;
}

/** Worst single (highest effective time, treating DNF as worst). */
export function worstSingle(solves: Solve[]): number | null {
  if (solves.length === 0) return null;
  let worst = -1;
  for (const s of solves) {
    const e = effectiveMs(s);
    if (e === Infinity) return Infinity;
    if (e > worst) worst = e;
  }
  return worst;
}

/** Mean of all times (Infinity if any DNF). */
export function meanOfAll(solves: Solve[]): number | null {
  if (solves.length === 0) return null;
  const times = solves.map(effectiveMs);
  if (times.some(t => t === Infinity)) return Infinity;
  return truncToCs(times.reduce((a, b) => a + b, 0) / times.length);
}

/** Number of solves (incl. DNF). */
export function countAll(solves: Solve[]): number {
  return solves.length;
}

/** Format ms with international h:mm:ss / m:ss / s notation:
 *  "12.345" / "1:23.456" / "1:05:30.456" / "12" (precision 0). DNF/Infinity → "DNF". */
export function formatMs(ms: number | null, precision: 0 | 1 | 2 | 3 = 2): string {
  if (ms === null) return '-';
  if (!Number.isFinite(ms)) return 'DNF';
  if (ms < 0) ms = 0;
  const totalMs = Math.round(ms);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  // precision 位小数;0 = 只到整数秒(无小数点)。millis(0..999) 截到对应位数。
  const frac = precision > 0
    ? '.' + Math.floor(millis / 10 ** (3 - precision)).toString().padStart(precision, '0')
    : '';
  const p2 = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) return `${hours}:${p2(minutes)}:${p2(seconds)}${frac}`;
  if (minutes > 0) return `${minutes}:${p2(seconds)}${frac}`;
  return `${seconds}${frac}`;
}

/**
 * Short display token for a penalty. Exists so display sites can tell DNS
 * apart from DNF — `formatMs` only sees the effective time (Infinity for
 * both) and has ~122 call sites, so it deliberately stays penalty-blind.
 */
export function penaltyLabel(p: Penalty): string {
  if (p === 'ok') return 'OK';
  return p; // '+2' | 'DNF' | 'DNS'
}

/**
 * Format a value for an event, honouring FMC's move-count encoding
 * (`moves * 1000` ms). A whole number of moves renders as an integer ("27");
 * a fractional value — i.e. an FMC mean — renders at 2 dp ("26.33"), per WCA.
 * Every other event falls through to `formatMs`.
 */
export function formatEventMs(event: EventId, ms: number | null, precision: 0 | 1 | 2 | 3 = 2): string {
  if (event !== '333fm') return formatMs(ms, precision);
  if (ms === null) return '-';
  if (!Number.isFinite(ms)) return 'DNF';
  const moves = Math.max(0, ms) / 1000;
  return Number.isInteger(moves) ? String(moves) : moves.toFixed(2);
}

/* ------------------------------------------------------------------ */
/* 3x3x3 Multi-Blind — WCA Regulation 9f12c                            */
/* ------------------------------------------------------------------ */

/**
 * Post-penalty attempt duration in ms. Unlike `effectiveMs` this never
 * collapses to Infinity: an MBLD DNF still HAS a recorded time (it is the
 * 9f12c tiebreaker, and we show it to the user), so the DNF-ness is carried by
 * `isMbldDnf` / `penalty` instead of by the number.
 */
function mbldTimeMs(s: Solve): number {
  return s.penalty === '+2' ? s.timeMs + 2000 : s.timeMs;
}

/**
 * WCA net score: puzzles solved minus puzzles NOT solved. Returns null for a
 * solve carrying no MBLD payload (i.e. every non-MBLD event).
 */
export function mbldPoints(s: Solve): number | null {
  const m = s.mbld;
  if (!m) return null;
  return m.solved - (m.attempted - m.solved);
}

/**
 * Does this attempt score DNF under WCA Regulation 9f12c?
 *
 * 9f12c, verbatim:
 *   "For 3x3x3 Multi-Blind, rankings are assessed based on the number of
 *    puzzles solved minus the number of puzzles not solved, where a greater
 *    difference is better. If the difference is less than 0, or if only 1
 *    puzzle is solved, the attempt is considered unsolved (DNF). ..."
 *
 * So the boundary is `points < 0`, NOT `points < 1`. A 2/4 attempt scores
 * exactly 0 points and is a perfectly valid result — the WCA still records
 * them today. A 1/2 attempt is a DNF because only 1 puzzle was solved, even
 * though its difference is also 0. Those two cases are why the rule needs both
 * clauses; collapsing them into `points < 1` would wrongly void every 2/4.
 *
 * Does NOT consider `penalty` — a caller wanting "is this row a DNF for any
 * reason" should check `penalty` too. This function answers only the 9f12c
 * question, so the entry point can *derive* the penalty from it.
 */
export function isMbldDnf(s: Solve): boolean {
  const m = s.mbld;
  if (!m) return false;
  if (m.solved < 2) return true;
  return m.solved - (m.attempted - m.solved) < 0;
}

/**
 * WCA result string: "11/13 58:02" — solved/attempted plus the attempt time
 * truncated to whole seconds (the WCA records MBLD times in seconds).
 *
 * A DNS reads "DNS". An attempt that fails 9f12c — or that the user explicitly
 * marked DNF — reads "DNF (1/5 10:00)": the numbers are kept because this is a
 * practice timer and the user still wants to see what they got.
 */
export function formatMbldResult(s: Solve): string {
  const m = s.mbld;
  if (!m) return formatSolveResult(s);
  if (s.penalty === 'DNS') return 'DNS';
  const body = `${m.solved}/${m.attempted} ${formatMs(mbldTimeMs(s), 0)}`;
  return s.penalty === 'DNF' || isMbldDnf(s) ? `DNF (${body})` : body;
}

/** Is this attempt a DNF for ANY reason (9f12c, an explicit DNF, or a DNS)? */
function mbldIsUnranked(s: Solve): boolean {
  return !s.mbld || s.penalty === 'DNF' || s.penalty === 'DNS' || isMbldDnf(s);
}

/**
 * Rank two MBLD attempts per 9f12c: more points first, ties broken by shorter
 * time, remaining ties by fewer unsolved puzzles (11/13 beats 12/15 — same 9
 * points, but fewer misses). Any DNF ranks after every valid attempt.
 *
 * Returns < 0 when `a` ranks ahead of `b`, so `[...solves].sort(compareMbld)`
 * yields best-first.
 */
export function compareMbld(a: Solve, b: Solve): number {
  const aDnf = mbldIsUnranked(a);
  const bDnf = mbldIsUnranked(b);
  if (aDnf !== bDnf) return aDnf ? 1 : -1;
  if (aDnf) return 0;
  const pa = mbldPoints(a)!;
  const pb = mbldPoints(b)!;
  if (pa !== pb) return pb - pa;
  const ta = mbldTimeMs(a);
  const tb = mbldTimeMs(b);
  if (ta !== tb) return ta - tb;
  const ua = a.mbld!.attempted - a.mbld!.solved;
  const ub = b.mbld!.attempted - b.mbld!.solved;
  return ua - ub;
}

/**
 * Why a typed MBLD attempt was rejected. A machine-readable reason so the rule
 * lives here (testable, no React) while the wording stays at the UI edge.
 */
export type MbldEntryError =
  /** attempted is missing / not a whole number / < 2 */
  | 'attempted'
  /** solved is missing / not a whole number / negative */
  | 'solved'
  /** solved > attempted */
  | 'solved-exceeds-attempted'
  /** time is missing / not positive */
  | 'time';

export type MbldEntryCheck =
  | { ok: true; solved: number; attempted: number; ms: number }
  | { ok: false; reason: MbldEntryError };

/**
 * Validate one manually-entered MBLD attempt. Inputs are already-parsed
 * numbers; pass null for anything the caller could not read.
 *
 * Boundaries, checked in this order:
 *   attempted  whole number ≥ 2. There is no 1-cube attempt: solving it is
 *              "only 1 puzzle solved" and failing it is −1 point, so 9f12c
 *              makes every possible outcome a DNF.
 *   solved     whole number, 0 ≤ solved ≤ attempted.
 *   ms         > 0.
 *
 * A valid-but-DNF attempt (2/6, or 1/2) is accepted, not rejected — it is a
 * real result the user may want on record. Only *impossible* input is refused;
 * the DNF itself is derived later via `isMbldDnf`.
 */
export function checkMbldEntry(
  solved: number | null,
  attempted: number | null,
  ms: number | null,
): MbldEntryCheck {
  if (attempted === null || !Number.isSafeInteger(attempted) || attempted < 2) {
    return { ok: false, reason: 'attempted' };
  }
  if (solved === null || !Number.isSafeInteger(solved) || solved < 0) {
    return { ok: false, reason: 'solved' };
  }
  if (solved > attempted) {
    return { ok: false, reason: 'solved-exceeds-attempted' };
  }
  if (ms === null || !Number.isFinite(ms) || ms <= 0) {
    return { ok: false, reason: 'time' };
  }
  return { ok: true, solved, attempted, ms };
}

/** Highest-ranked MBLD attempt per `compareMbld`, or null if none is valid. */
export function bestMbldSolve(solves: Solve[]): Solve | null {
  let best: Solve | null = null;
  for (const s of solves) {
    if (mbldIsUnranked(s)) continue;
    if (best === null || compareMbld(s, best) < 0) best = s;
  }
  return best;
}

/* ------------------------------------------------------------------ */

/**
 * Format one solve's own result for a row / detail view: DNS reads "DNS"
 * rather than collapsing into "DNF", FMC reads as a move count, and an MBLD
 * attempt reads as its full WCA result string ("11/13 58:02") rather than a
 * bare time.
 */
export function formatSolveResult(s: Solve, precision: 0 | 1 | 2 | 3 = 2): string {
  // MBLD owns its whole display (points + time + the 9f12c DNF rule), so it
  // short-circuits before the time formatters.
  if (s.mbld) return formatMbldResult(s);
  if (s.penalty === 'DNS') return 'DNS';
  return formatEventMs(s.event, effectiveMs(s), precision);
}

/** Standard deviation (ms) of an array of effective times — null if < 2 valid. */
function sdOfTimes(times: number[]): number | null {
  const valid = times.filter(t => Number.isFinite(t));
  if (valid.length < 2) return null;
  const m = valid.reduce((a, b) => a + b, 0) / valid.length;
  let sq = 0;
  for (const t of valid) sq += (t - m) * (t - m);
  return Math.sqrt(sq / valid.length);
}

/** Standard deviation of all *valid* (non-DNF) effective times. */
export function stdDev(solves: Solve[]): number | null {
  return sdOfTimes(solves.map(effectiveMs));
}

/** σ (ms) of the valid times in the most recent N solves. null if < 2 valid. */
export function sdOfLastN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  return sdOfTimes(solves.slice(-n).map(effectiveMs));
}

/** σ (ms) of the window that yields the best aoN (the same window bestAverageOfN picks). */
export function sdOfBestAoN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  let best = Infinity;
  let bestStart = -1;
  for (let i = 0; i + n <= solves.length; i++) {
    const window = solves.slice(i, i + n).map(effectiveMs);
    const avg = n === 1 ? window[0] : trimmedMean(window);
    if (avg < best) { best = avg; bestStart = i; }
  }
  if (bestStart < 0) return null;
  return sdOfTimes(solves.slice(bestStart, bestStart + n).map(effectiveMs));
}

/** Coefficient of variation (σ / μ) as a percentage (0..100+). */
export function coefficientOfVariation(solves: Solve[]): number | null {
  const valid = solves.map(effectiveMs).filter(t => Number.isFinite(t));
  if (valid.length < 2) return null;
  const m = valid.reduce((a, b) => a + b, 0) / valid.length;
  const sd = stdDev(solves);
  if (m <= 0 || sd === null) return null;
  return (sd / m) * 100;
}

/** Format a percentage with one decimal place, "—" for null. */
export function formatPct(p: number | null): string {
  if (p === null) return '—';
  return p.toFixed(1) + '%';
}

/**
 * Sub-X breakdown — what fraction of (valid, non-DNF) solves come in under
 * a few "interesting" thresholds. Thresholds are auto-picked from the
 * solve distribution: mean, mean - σ, mean + σ, with rounding to a "nice"
 * value at the appropriate scale.
 *
 * Returns up to 4 entries. Each entry has the threshold (ms), label, and
 * percentage (0..100) of solves under that threshold.
 */
export function subXBreakdown(solves: Solve[]): Array<{ threshold: number; label: string; pct: number }> {
  const valid = solves.map(effectiveMs).filter(t => Number.isFinite(t));
  if (valid.length < 5) return [];
  const m = valid.reduce((a, b) => a + b, 0) / valid.length;
  let sq = 0;
  for (const t of valid) sq += (t - m) * (t - m);
  const sd = Math.sqrt(sq / valid.length);

  const candidates = [m - sd, m - sd * 0.5, m, m + sd * 0.5, m + sd];
  const seen = new Set<number>();
  const out: Array<{ threshold: number; label: string; pct: number }> = [];
  for (const c of candidates) {
    if (c <= 0) continue;
    let nice: number;
    if (c >= 60000)      nice = Math.round(c / 10000) * 10000;
    else if (c >= 10000) nice = Math.round(c / 5000) * 5000;
    else if (c >= 5000)  nice = Math.round(c / 1000) * 1000;
    else                 nice = Math.round(c / 500) * 500;
    if (nice <= 0 || seen.has(nice)) continue;
    seen.add(nice);
    const count = valid.filter(t => t < nice).length;
    const pct = (count / valid.length) * 100;
    if (pct <= 0 || pct >= 100) continue;
    out.push({ threshold: nice, label: 'sub-' + formatMs(nice), pct });
  }
  return out.sort((a, b) => a.threshold - b.threshold).slice(0, 4);
}

/**
 * Identify which solve is currently the PB (best single, ignoring DNFs).
 * Returns the index in the original `solves` array, or -1 if all DNF / empty.
 *
 * @param event optional. Pass '333mbld' and the PB is chosen by the WCA
 *   ranking (`compareMbld`) instead of by shortest time — a slower attempt
 *   that solved more cubes IS the better result.
 */
export function pbSingleIndex(solves: Solve[], event?: EventId): number {
  let idx = -1;
  if (event === '333mbld') {
    for (let i = 0; i < solves.length; i++) {
      if (mbldIsUnranked(solves[i])) continue;
      if (idx < 0 || compareMbld(solves[i], solves[idx]) < 0) idx = i;
    }
    return idx;
  }
  let best = Infinity;
  for (let i = 0; i < solves.length; i++) {
    const t = effectiveMs(solves[i]);
    if (t < best) { best = t; idx = i; }
  }
  return idx;
}

/** Compute a row of stats. Returns formatted strings ready for display. */
export interface StatsSummary {
  count: number;
  /** Successful solves — DNF *and* DNS both count as unsolved. Numerator in
   *  the success/total ratio. */
  solved: number;
  best: string;
  worst: string;
  mean: string;
  ao5: string;
  ao12: string;
  ao50: string;
  ao100: string;
  ao1000: string;
  mo3: string;
  bo3: string;
  bestAo5: string;
  bestAo12: string;
  bestAo50: string;
  bestAo100: string;
  bestAo1000: string;
  bestMo3: string;
  bestBo3: string;
  sd: string;
  cv: string;
  bpa5: string;
  wpa5: string;
  bpa12: string;
  wpa12: string;
}

/**
 * @param event optional — pass it and every value is formatted for that event
 *   (FMC renders move counts instead of times). Omitted = plain time strings,
 *   which is what non-event-scoped callers want.
 */
export function summarize(solves: Solve[], event?: EventId): StatsSummary {
  const f = (ms: number | null) => (event ? formatEventMs(event, ms) : formatMs(ms));
  // MBLD's best is ranked on points, not time, and prints as a result string.
  // Every other row below is a time statistic and stays event-agnostic.
  const bestMbld = event === '333mbld' ? bestMbldSolve(solves) : null;
  const bestStr = event === '333mbld'
    ? (bestMbld === null ? 'DNF' : formatMbldResult(bestMbld))
    : f(bestSingle(solves, event));
  return {
    count: solves.length,
    solved: solves.reduce((n, s) => n + (s.penalty === 'DNF' || s.penalty === 'DNS' ? 0 : 1), 0),
    best: bestStr,
    worst: f(worstSingle(solves)),
    mean: f(meanOfAll(solves)),
    ao5: f(averageOfN(solves, 5)),
    ao12: f(averageOfN(solves, 12)),
    ao50: f(averageOfN(solves, 50)),
    ao100: f(averageOfN(solves, 100)),
    ao1000: f(averageOfN(solves, 1000)),
    mo3: f(meanOfN(solves, 3)),
    bo3: f(bestOfN(solves, 3)),
    bestAo5: f(bestAverageOfN(solves, 5)),
    bestAo12: f(bestAverageOfN(solves, 12)),
    bestAo50: f(bestAverageOfN(solves, 50)),
    bestAo100: f(bestAverageOfN(solves, 100)),
    bestAo1000: f(bestAverageOfN(solves, 1000)),
    bestMo3: f(bestMeanOfN(solves, 3)),
    bestBo3: f(bestBestOfN(solves, 3)),
    sd: stdDev(solves) === null ? '—' : f(Math.round(stdDev(solves)!)),
    cv: formatPct(coefficientOfVariation(solves)),
    bpa5: f(bpa(solves, 5)),
    wpa5: f(wpa(solves, 5)),
    bpa12: f(bpa(solves, 12)),
    wpa12: f(wpa(solves, 12)),
  };
}
