// Port from packages/client-vite/src/utils/recon_utils.ts.
import { ISO2_TO_CONTINENT } from './continent';

// ── Time formatting ──

export function formatTime(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || seconds < 0) return 'DNF';
  if (seconds === 0) return '0.00';
  const cs = Math.floor(seconds * 100);
  const truncated = cs / 100;
  if (truncated >= 60) {
    const mins = Math.floor(truncated / 60);
    const secs = truncated - mins * 60;
    return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
  }
  return truncated.toFixed(2);
}

export function formatResult(val: number | undefined | null): string {
  if (val == null) return '';
  if (val >= 9999) return 'DNF';
  if (typeof val !== 'number') return String(val);
  return val.toFixed(3);
}

export function formatAvg(val: number | string | undefined | null): string {
  if (val == null) return '';
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(n)) return String(val);
  if (n >= 9999) return 'DNF';
  if (n >= 60) {
    const m = Math.floor(n / 60);
    const s = (n % 60).toFixed(2);
    return m + ':' + (parseFloat(s) < 10 ? '0' : '') + s;
  }
  return n.toFixed(2);
}

export function formatAoXR(aoType: string | undefined): string {
  if (!aoType) return '';
  const m = aoType.match(/^([\d.]+)\s+Ao(\d)R$/);
  if (m) return m[1] + '(' + m[2] + ')';
  const m2 = aoType.match(/^Ao(\d)R$/);
  if (m2) return '(' + m2[1] + ')';
  return aoType;
}

export function formatRound(round: string | undefined, solveNum: number | undefined): string {
  if (!round) return '';
  const display = /^\d+$/.test(round) ? `R${round}`
    : round === 'f' ? 'Fi'
      : round;
  return display + (solveNum ? '#' + solveNum : '');
}

export function localizeRound(round: string | undefined, t: (k: string, opts?: Record<string, unknown>) => string): string {
  if (!round) return '';
  if (round === 'f') return t('recon.roundOption.final');
  if (round === '1' || round === '2' || round === '3') return t(`recon.roundOption.r${round}`);
  return t('recon.roundOption.numbered', { n: round });
}

// ── Event → puzzle id ──
const PUZZLE_MAP: Record<string, string> = {
  '3x3': '3x3x3', '2x2': '2x2x2', '4x4': '4x4x4', '5x5': '5x5x5',
  '6x6': '6x6x6', '7x7': '7x7x7', '3bld': '3x3x3', '4bld': '4x4x4',
  '5bld': '5x5x5', oh: '3x3x3', sq1: 'square1',
  pyra: 'pyraminx', mega: 'megaminx', clock: 'clock', skewb: 'skewb',
};

export function getPuzzleId(event: string): string {
  return PUZZLE_MAP[event] ?? '3x3x3';
}

// ── Record class ──
export function getRecordClass(val: string): string {
  const v = val.toUpperCase();
  // Personal-best labels incl. average variants (timer: "PB", "PB AO5", "PB AO12").
  // Treat the whole PB/PR family as a personal record so they share one badge color.
  if (/^P[RB](\s|$)/.test(v)) return 'pr';
  if (/^[FXU]?W[RB]$|^1STWR$|^RWR$|^YTW[RB]$|^XWR$/.test(v)) return 'wr';
  if (v === 'WCR') return 'wcr';
  if (v === 'CR') return 'cr';
  if (/(?:AS|E)[RB]$/.test(v) || /^(?:F|YT|X|U)?(?:SAR|SAB|NAR|NAB|OCR|OCB|AFR|AFB|ANR|ANB|ASR|ASB)$/.test(v)) return 'cr';
  if (/^[FXU]?N[RB]$|^NWR$|^ANR$|^YTN[RB]$/.test(v)) return 'nr';
  if (/[PU]?[RB]$/.test(v) && (v.endsWith('PR') || v.endsWith('PB')
    || v === 'YTPR' || v === 'YTPB' || v === 'UPR' || v === 'UPB')) return 'pr';
  return 'other';
}

const CONTINENT_TO_RECORD: Record<string, string> = {
  AF: 'AfR', AS: 'AsR', EU: 'ER', NA: 'NAR', SA: 'SAR', OC: 'OcR',
};

export function expandContinentRecord(val: string | undefined | null, iso2: string | undefined | null): string {
  if (!val) return '';
  if (!iso2) return val;
  if (!/\bCR\b/.test(val)) return val;
  const cont = ISO2_TO_CONTINENT[iso2.toUpperCase()];
  const code = cont && CONTINENT_TO_RECORD[cont];
  if (!code) return val;
  return val.replace(/\bCR\b/, code);
}

export function formatRecord(val: string | undefined): { text: string; className: string } | null {
  if (!val) return null;
  const s = String(val);
  const cancelled = /\bcancell?ed?\b|取消/i.test(s);
  const recordType = cancelled
    ? s.replace(/\s*\bcancell?ed?\b\s*|\s*取消\s*/gi, '').trim()
    : s;
  const cls = cancelled ? 'cancelled' : getRecordClass(recordType);
  return { text: recordType, className: `record-badge record-${cls}` };
}

export function wcaPersonUrl(personId: string): string {
  return `https://www.worldcubeassociation.org/persons/${personId}`;
}

// ── helpers ported from packages/client-vite/src/utils/recon_utils.ts ──

export function formatTimeInput(seconds: number | undefined | null): string {
  if (seconds == null || isNaN(seconds) || seconds < 0) return '';
  const ms = Math.round(seconds * 1000);
  if (ms >= 60000) {
    const m = Math.floor(ms / 60000);
    const s = (ms % 60000) / 1000;
    const sStr = s < 10 ? '0' + String(s) : String(s);
    return `${m}:${sStr}`;
  }
  return String(ms / 1000);
}

export function parseTimeInput(raw: string): number {
  if (!raw || !raw.trim()) return NaN;
  const s = raw.trim();
  const colonMatch = s.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (colonMatch) {
    return parseInt(colonMatch[1]) * 60 + parseFloat(colonMatch[2]);
  }
  const n = parseFloat(s);
  if (isNaN(n)) return NaN;
  if (Number.isInteger(n) && n >= 100 && !s.includes('.')) {
    return n / 100;
  }
  return n;
}

export function isBldEvent(event: string): boolean {
  return ['3bld', '4bld', '5bld', 'mbld'].includes(event);
}

export function attemptsPerRound(event: string): number {
  if (event === 'mbld') return 1;
  if (['6x6', '7x7', '3bld', '4bld', '5bld', 'fmc'].includes(event)) return 3;
  return 5;
}

// ── External links ──

const CUBEDB_PUZZLE_MAP: Record<string, string> = {
  '3x3': '3x3x3', '2x2': '2x2x2', '4x4': '4x4x4', '5x5': '5x5x5',
  '6x6': '6x6x6', '7x7': '7x7x7', '3bld': '3x3x3', '4bld': '4x4x4',
  '5bld': '5x5x5', oh: '3x3x3', sq1: 'sq1',
  pyra: 'pyraminx', mega: 'megaminx', clock: 'clock', skewb: 'skewb',
};

export function getCubedbPuzzle(event: string): string {
  return CUBEDB_PUZZLE_MAP[event] ?? '3x3x3';
}

export function buildExternalLinks(
  event: string,
  scramble: string,
  alg: string,
): { algUrl: string; algSiteName: string; cubedbUrl: string } {
  const puzzle = getPuzzleId(event);
  const setupStr = encodeURIComponent(scramble);
  const algStr = encodeURIComponent(alg);
  const isCube = /^\d+x\d+x\d+$/.test(puzzle);
  const algUrl = isCube
    ? `https://alg.cubing.net/?setup=${setupStr}&alg=${algStr}&puzzle=${puzzle}`
    : `https://alpha.twizzle.net/edit/?puzzle=${puzzle}&setup-alg=${setupStr}&alg=${algStr}`;
  const algSiteName = isCube ? 'alg.cubing.net' : 'twizzle.net';
  const cubedbPuzzle = getCubedbPuzzle(event);
  const cubedbUrl = `https://cubedb.net/?puzzle=${cubedbPuzzle}&scramble=${setupStr}&alg=${algStr}`;
  return { algUrl, algSiteName, cubedbUrl };
}

export const FACE_COLORS: Record<string, string> = {
  W: '#e8e8e8',
  Y: '#facc15',
  R: '#ef4444',
  O: '#f97316',
  G: '#22c55e',
  B: '#3b82f6',
};

// ── Record dropdown options ──

/** 纪录下拉选项 — 大洲精确到 AsR/AfR/ER/NAR/OcR/SAR(WCA API 原值)。含 cancelled 前缀 */
export const RECORD_OPTIONS: string[] = (() => {
  const types = ['WR', 'AsR', 'AfR', 'ER', 'NAR', 'OcR', 'SAR', 'NR', 'PR'];
  const prefixes = ['', 'cancelled '];
  const out: string[] = [];
  for (const p of prefixes) for (const t of types) out.push(p + t);
  return out;
})();

const RECORD_TO_CONTINENT: Record<string, string> = {
  AfR: 'AF', AsR: 'AS', ER: 'EU', NAR: 'NA', SAR: 'SA', OcR: 'OC',
};

/**
 * 给定选手国籍 iso2,该 record code 是否合法(不属于该选手大洲的洲际记录应禁用)。
 * 不传 iso2 时一律允许。WR/NR/PR 永远允许。
 */
export function isRecordCodeAllowedFor(code: string, personIso2: string | null | undefined): boolean {
  if (!code) return true;
  const core = code.replace(/^cancell?ed?\s+/i, '').trim();
  const cont = RECORD_TO_CONTINENT[core];
  if (!cont) return true;
  if (!personIso2) return true;
  return ISO2_TO_CONTINENT[personIso2.toUpperCase()] === cont;
}

export function computeWcaAverage(attempts: (number | null)[], event: string): number | null {
  const expected = attemptsPerRound(event);
  if (expected === 1) return null;
  const slice = attempts.slice(0, expected);
  if (slice.length < expected || slice.some(v => v == null)) return null;
  const norm = slice.map(v => (v! < 0 ? Infinity : v!));
  const dnfs = norm.filter(v => v === Infinity).length;
  if (expected === 3) {
    if (dnfs > 0) return null;
    return Math.round((norm[0] + norm[1] + norm[2]) / 3 * 100) / 100;
  }
  if (dnfs >= 2) return null;
  const sorted = [...norm].sort((a, b) => a - b);
  return Math.round((sorted[1] + sorted[2] + sorted[3]) / 3 * 100) / 100;
}
