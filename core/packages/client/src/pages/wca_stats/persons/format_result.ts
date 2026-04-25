// Format WCA-encoded results into human-readable strings.
// WCA encodes most events as centiseconds; FMC and MBLD have special encodings.

const FMC_EVENTS = new Set(['333fm']);
const MBLD_EVENTS = new Set(['333mbf', '333mbo']);

export function formatResult(value: number, eventId: string, type: 'single' | 'average'): string {
  if (value === 0) return '—';
  if (value === -1) return 'DNF';
  if (value === -2) return 'DNS';

  if (FMC_EVENTS.has(eventId)) {
    // single = move count (int); average = move count × 100 (e.g. 2433 → 24.33)
    if (type === 'average') return (value / 100).toFixed(2);
    return String(value);
  }

  if (MBLD_EVENTS.has(eventId)) {
    return formatMbld(value);
  }

  return formatTimeCs(value);
}

export function formatTimeCs(cs: number): string {
  const total = cs / 100;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total - h * 3600 - m * 60;
  if (h > 0) return `${h}:${pad2(m)}:${padSec(s)}`;
  if (m > 0) return `${m}:${padSec(s)}`;
  return s.toFixed(2);
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function padSec(s: number): string {
  return s < 10 ? `0${s.toFixed(2)}` : s.toFixed(2);
}

// MBLD result encoding (modern, post-2008):
// DDDTTTTTMM where:
//   DD = 99 - solved + missed   (so solved - missed = 99 - DD)
//   wait actually it's: 1XXYYYYYZZ where XX = 99-(solved-missed), YYYYY = time(s), ZZ = missed
// Reference: https://www.worldcubeassociation.org/regulations/#9f12
function formatMbld(value: number): string {
  const v = String(value).padStart(10, '0');
  const dd = parseInt(v.slice(0, 2), 10);    // 99 - (solved - missed)
  const ttttt = parseInt(v.slice(2, 7), 10); // seconds
  const mm = parseInt(v.slice(7, 9), 10);    // missed
  const diff = 99 - dd;                       // solved - missed
  const solved = diff + mm;
  const attempted = solved + mm;
  const min = Math.floor(ttttt / 60);
  const sec = ttttt % 60;
  const time = min > 0 ? `${min}:${pad2(sec)}` : `${sec}s`;
  return `${solved}/${attempted} ${time}`;
}
