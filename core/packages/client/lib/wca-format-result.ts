// Ported from packages/client-vite/src/utils/wca_format_result.ts.
// WCA result-value → display string. Single source of truth.

export type ResultKind = 'single' | 'average';

export interface FormatOptions {
  fmcAverage?: 'decimal' | 'rounded';
  zero?: 'dash' | 'empty';
  failure?: 'dnf' | 'dash';
}

export function formatWcaResult(
  value: number,
  eventId: string,
  kind: ResultKind,
  opts: FormatOptions = {},
): string {
  if (value === -1) return opts.failure === 'dash' ? '—' : 'DNF';
  if (value === -2) return opts.failure === 'dash' ? '—' : 'DNS';
  if (value === 0) return opts.zero === 'empty' ? '' : '—';

  if (eventId === '333fm') {
    if (kind === 'single') return String(value);
    return opts.fmcAverage === 'rounded'
      ? String(Math.round(value / 100))
      : (value / 100).toFixed(2);
  }

  if (eventId === '333mbf' || eventId === '333mbo') {
    return formatMbld(value);
  }

  return formatTimeCs(value);
}

/** 0=single, 1=average */
export function formatWcaResultK(
  value: number,
  eventId: string,
  kindIdx: 0 | 1,
  opts?: FormatOptions,
): string {
  return formatWcaResult(value, eventId, kindIdx === 0 ? 'single' : 'average', opts);
}

function formatTimeCs(cs: number): string {
  const total = cs / 100;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total - h * 3600 - m * 60;
  if (h > 0) return `${h}:${pad2(m)}:${padSec(s)}`;
  if (m > 0) return `${m}:${padSec(s)}`;
  return s.toFixed(2);
}

// WCA MBLD has two value encodings, discriminated by magnitude (old style ≥ 1e9).
// Both 333mbf (new event) and 333mbo (old-style event) can carry either — 333mbo
// notably mixes both across its history — so decode by value, never by event id.
//   old: 1SSAATTTTT → solved = 99 - SS, attempted = AA, time = TTTTT seconds
//   new:  DDTTTTTMM → diff = 99 - DD, missed = MM, solved = diff + missed, attempted = solved + missed
// Mirrors packages/stats-build/src/core/solve_time.ts SolveTime.decode.
function formatMbld(value: number): string {
  let v = value;
  let solved: number;
  let attempted: number;
  let seconds: number;
  if (v >= 1_000_000_000) {
    seconds = v % 100_000;
    v = Math.floor(v / 100_000);
    attempted = v % 100;
    solved = 99 - (Math.floor(v / 100) % 100);
  } else {
    const missed = v % 100;
    v = Math.floor(v / 100);
    seconds = v % 100_000;
    const diff = 99 - (Math.floor(v / 100_000) % 100);
    solved = diff + missed;
    attempted = solved + missed;
  }
  const time = seconds === 99_999 ? '?:??:??' : formatMbldTime(seconds);
  return `${solved}/${attempted} ${time}`;
}

function formatMbldTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function padSec(s: number): string { return s < 10 ? `0${s.toFixed(2)}` : s.toFixed(2); }
