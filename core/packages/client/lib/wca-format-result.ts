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

  if (eventId === '333mbf') {
    const s = String(value).padStart(10, '0');
    const dd = parseInt(s.slice(1, 3), 10);
    const seconds = parseInt(s.slice(3, 8), 10);
    const missed = parseInt(s.slice(8, 10), 10);
    const diff = 99 - dd;
    const solved = diff + missed;
    const attempted = solved + missed;
    return `${solved}/${attempted} ${formatMbldTime(seconds)}`;
  }

  if (eventId === '333mbo') {
    const seconds = value % 100000;
    const rest = Math.floor(value / 100000);
    const attempted = rest % 100;
    const solved = 99 - (Math.floor(rest / 100) % 100);
    return `${solved}/${attempted} ${formatMbldTime(seconds)}`;
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

function formatMbldTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function padSec(s: number): string { return s < 10 ? `0${s.toFixed(2)}` : s.toFixed(2); }
