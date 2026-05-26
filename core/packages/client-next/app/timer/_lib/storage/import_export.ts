/**
 * Round 1E I/O — cstimer JSON import + CSV/TSV/Speedstacks exports.
 *
 * Public API (re-exported from `db.ts` so callers can do
 * `import { importCstimerJson } from './storage/db'`):
 *   - importCstimerJson(text) → Record<EventId, Solve[]> | null
 *   - exportCsv(byEvent)
 *   - exportTsv(byEvent)
 *   - exportSpeedstacks(solves)
 *
 * No external deps; pure TS.
 */

import type { EventId, Solve } from '../types';
import { newId } from './db';

/* ------------------------------------------------------------------ */
/* cstimer event id → our EventId mapping                              */
/* ------------------------------------------------------------------ */
//
// cstimer stores a per-session "scrType" string identifying the puzzle /
// scramble generator. Many synonyms exist across versions, so we normalize
// the input (lowercase, strip 'x' separators) before lookup. Anything we
// don't recognize falls back to '333'.
//
// Examples observed in cstimer exports:
//   "333", "3x3", "3"           → 333
//   "222", "2x2", "2"           → 222
//   "444", "4x4", "4"           → 444 ... up to 7x7
//   "333oh", "3oh", "oh"        → 333oh
//   "333fm", "3fm", "fm"        → 333fm
//   "333bld", "3bld", "bld"     → 333bld
//   "333mbld", "mbld", "3mbld"  → 333mbld
//   "333ni", "3ni", "ni"        → 333ni
//   "444bld", "4bld"            → 444bld
//   "555bld", "5bld"            → 555bld
//   "666bld", "6bld"            → 666bld
//   "777bld", "7bld"            → 777bld
//   "pyram", "pyra", "pyraminx" → pyra
//   "skewb"                     → skewb
//   "sq1", "sqr1", "square1"    → sq1
//   "mega", "megamx", "megaminx"→ mega
//   "clock", "clkwca"           → clock
//   "333mr", "mirror", "mirrorblocks" → 333mr
//   "r3", "234", "23rl", "234relay" → r3
//   "r4", "2345", "2345relay"   → r4
//   "r5", "23456"               → r5
//   "pll", "pllt"               → pll
//   "oll", "ollt"               → oll
//   "coll", "collt"             → coll
//   "cmll"                      → cmll
//   "zbll", "zbllt"             → zbll
//   "eg1"                       → eg1
//   "eg2"                       → eg2
//   "cross"                     → cross
//   "f2l"                       → f2l
//   "ll"                        → ll
//   "magic"                     → magic
//   "mmagic"                    → mmagic

const CSTIMER_EVENT_MAP: Record<string, EventId> = {
  // NxN
  '222': '222', '2': '222', '22': '222',
  '333': '333', '3': '333', '33': '333',
  '444': '444', '4': '444', '44': '444',
  '555': '555', '5': '555', '55': '555',
  '666': '666', '6': '666', '66': '666',
  '777': '777', '7': '777', '77': '777',
  // 3x3 variants
  '333oh': '333oh', '3oh': '333oh', 'oh': '333oh',
  '333fm': '333fm', '3fm': '333fm', 'fm': '333fm', 'fmc': '333fm',
  '333bld': '333bld', '3bld': '333bld', 'bld': '333bld', '333ble': '333bld',
  '333mbld': '333mbld', '3mbld': '333mbld', 'mbld': '333mbld', 'mbo': '333mbld',
  '333ni': '333ni', '3ni': '333ni', 'ni': '333ni',
  '333mr': '333mr', 'mirror': '333mr', 'mirrorblocks': '333mr', 'mirblocks': '333mr',
  // Big BLD
  '444bld': '444bld', '4bld': '444bld', '4ni': '444bld',
  '555bld': '555bld', '5bld': '555bld', '5ni': '555bld',
  '666bld': '666bld', '6bld': '666bld',
  '777bld': '777bld', '7bld': '777bld',
  // Other puzzles
  'pyram': 'pyra', 'pyra': 'pyra', 'pyraminx': 'pyra',
  'skewb': 'skewb', 'skbso': 'skewb',
  'sq1': 'sq1', 'sqr1': 'sq1', 'square1': 'sq1', 'sq1h': 'sq1', 'sq1a': 'sq1',
  'mega': 'mega', 'megamx': 'mega', 'megaminx': 'mega', 'minx2g': 'mega', 'mgmp': 'mega',
  'clock': 'clock', 'clkwca': 'clock',
  // Relays
  'r3': 'r3', '234': 'r3', '23rl': 'r3', '234relay': 'r3', 'relayw': 'r3',
  'r4': 'r4', '2345': 'r4', '2345relay': 'r4',
  'r5': 'r5', '23456': 'r5', '23456relay': 'r5',
  // CFOP steps
  'cross': 'cross', 'crs': 'cross',
  'f2l': 'f2l', 'edges': 'f2l',
  'll': 'll',
  // LL training
  'pll': 'pll', 'pllt': 'pll',
  'oll': 'oll', 'ollt': 'oll',
  'coll': 'coll', 'collt': 'coll',
  'cmll': 'cmll',
  'zbll': 'zbll', 'zbllt': 'zbll',
  'eg1': 'eg1',
  'eg2': 'eg2',
  // Misc
  'magic': 'magic',
  'mmagic': 'mmagic',
};

/** Normalize a cstimer event-type string for lookup. */
function normalizeCstimerEvent(raw: unknown): EventId {
  if (typeof raw !== 'string') return '333';
  const k = raw.toLowerCase().trim().replace(/[\s_-]/g, '');
  if (k in CSTIMER_EVENT_MAP) return CSTIMER_EVENT_MAP[k];
  // Strip leading '3x3' / '4x4' style 'x'
  const noX = k.replace(/x/g, '');
  if (noX in CSTIMER_EVENT_MAP) return CSTIMER_EVENT_MAP[noX];
  return '333';
}

/* ------------------------------------------------------------------ */
/* Import — cstimer JSON                                               */
/* ------------------------------------------------------------------ */

interface CstimerSessionMeta {
  name?: string;
  opt?: { scrType?: string };
  rank?: number;
  scrType?: string; // older schemas
}

/**
 * Parse a cstimer "Local backup → Export" JSON string. Returns solves grouped
 * by our EventId, or `null` if the input doesn't look like cstimer JSON
 * (no `sessionN` keys present, or top-level parse fails).
 *
 * Never throws — malformed inner structures are skipped.
 */
export function importCstimerJson(text: string): Record<string, Solve[]> | null {
  let outer: Record<string, unknown>;
  try {
    outer = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!outer || typeof outer !== 'object') return null;

  // Parse session metadata table.
  let sessionMeta: Record<string, CstimerSessionMeta> = {};
  const props = outer['properties'];
  if (props && typeof props === 'object') {
    const sd = (props as Record<string, unknown>)['sessionData'];
    if (typeof sd === 'string') {
      try {
        const parsed = JSON.parse(sd) as Record<string, CstimerSessionMeta>;
        if (parsed && typeof parsed === 'object') sessionMeta = parsed;
      } catch {
        /* tolerate */
      }
    } else if (sd && typeof sd === 'object') {
      sessionMeta = sd as Record<string, CstimerSessionMeta>;
    }
  }

  const byEvent: Record<string, Solve[]> = {};
  let foundAnySession = false;

  for (const key of Object.keys(outer)) {
    const m = /^session(\d+)$/.exec(key);
    if (!m) continue;
    foundAnySession = true;
    const sid = m[1];
    const raw = outer[key];

    // Each sessionN value is a JSON-encoded string (sometimes already array).
    let entries: unknown[] = [];
    try {
      if (typeof raw === 'string') {
        entries = JSON.parse(raw) as unknown[];
      } else if (Array.isArray(raw)) {
        entries = raw as unknown[];
      }
    } catch {
      continue;
    }
    if (!Array.isArray(entries)) continue;

    const meta = sessionMeta[sid];
    const scrType = meta?.opt?.scrType ?? meta?.scrType;
    const eventId = normalizeCstimerEvent(scrType);

    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 4) continue;
      const time = entry[0];
      const scramble = entry[1];
      const comment = entry[2];
      const dateSec = entry[3];

      if (!Array.isArray(time) || time.length < 2) continue;
      const cs = Number(time[0]);
      const pen = Number(time[1]);
      if (!Number.isFinite(cs) || !Number.isFinite(pen)) continue;

      let penalty: Solve['penalty'];
      let timeMs: number;
      if (pen === -1 || cs === -1) {
        penalty = 'DNF';
        timeMs = cs === -1 ? 0 : cs * 10;
      } else if (pen === 2000) {
        penalty = '+2';
        timeMs = cs * 10;
      } else {
        penalty = 'ok';
        timeMs = cs * 10;
      }

      const ts = Number(dateSec);
      const solve: Solve = {
        id: newId(),
        timeMs,
        penalty,
        scramble: typeof scramble === 'string' ? scramble : '',
        event: eventId,
        ts: Number.isFinite(ts) ? ts * 1000 : Date.now(),
        comment: typeof comment === 'string' && comment.length > 0 ? comment : undefined,
      };

      if (!byEvent[eventId]) byEvent[eventId] = [];
      byEvent[eventId].push(solve);
    }
  }

  if (!foundAnySession) return null;

  // Sort each event's solves chronologically.
  for (const k of Object.keys(byEvent)) {
    byEvent[k].sort((a, b) => a.ts - b.ts);
  }
  return byEvent;
}

/* ------------------------------------------------------------------ */
/* Export — CSV / TSV                                                  */
/* ------------------------------------------------------------------ */

const CSV_HEADER = ['event', 'index', 'time_ms', 'penalty', 'scramble', 'comment', 'date_iso'];

function csvEscape(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

function tsvEscape(field: string): string {
  // No quoting in TSV; just strip tabs/newlines.
  return field.replace(/[\t\r\n]+/g, ' ');
}

function rowsForExport(byEvent: Record<string, Solve[]>): Array<{ s: Solve; index: number; eventId: string }> {
  const rows: Array<{ s: Solve; index: number; eventId: string }> = [];
  // Stable order: event keys alphabetical for reproducibility.
  const eventKeys = Object.keys(byEvent).sort();
  for (const ev of eventKeys) {
    const solves = (byEvent[ev] ?? []).slice().sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < solves.length; i++) {
      rows.push({ s: solves[i], index: i + 1, eventId: ev });
    }
  }
  return rows;
}

function isoOf(ts: number): string {
  if (!Number.isFinite(ts)) return '';
  try {
    return new Date(ts).toISOString();
  } catch {
    return '';
  }
}

/** CSV export. Header included. Returns "" rows after header if no solves. */
export function exportCsv(byEvent: Record<string, Solve[]>): string {
  const out: string[] = [];
  out.push(CSV_HEADER.join(','));
  const rows = rowsForExport(byEvent);
  for (const { s, index, eventId } of rows) {
    out.push([
      csvEscape(eventId),
      String(index),
      String(s.timeMs),
      csvEscape(s.penalty),
      csvEscape(s.scramble ?? ''),
      csvEscape(s.comment ?? ''),
      csvEscape(isoOf(s.ts)),
    ].join(','));
  }
  return out.join('\n') + '\n';
}

/** TSV export. Header included. */
export function exportTsv(byEvent: Record<string, Solve[]>): string {
  const out: string[] = [];
  out.push(CSV_HEADER.join('\t'));
  const rows = rowsForExport(byEvent);
  for (const { s, index, eventId } of rows) {
    out.push([
      tsvEscape(eventId),
      String(index),
      String(s.timeMs),
      tsvEscape(s.penalty),
      tsvEscape(s.scramble ?? ''),
      tsvEscape(s.comment ?? ''),
      tsvEscape(isoOf(s.ts)),
    ].join('\t'));
  }
  return out.join('\n') + '\n';
}

/* ------------------------------------------------------------------ */
/* Export — Speedstacks .txt                                           */
/* ------------------------------------------------------------------ */

function formatMmSsMmm(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const mmm = millis.toString().padStart(3, '0');
  return `${mm}:${ss}.${mmm}`;
}

/**
 * Speedstacks export — one line per solve, sorted by ts ascending.
 * - OK:  MM:SS.mmm
 * - +2:  MM:SS.mmm+   (effective time = raw + 2000)
 * - DNF: DNF
 */
export function exportSpeedstacks(solves: Solve[]): string {
  if (!solves || solves.length === 0) return '';
  const sorted = solves.slice().sort((a, b) => a.ts - b.ts);
  const lines: string[] = [];
  for (const s of sorted) {
    if (s.penalty === 'DNF') {
      lines.push('DNF');
    } else if (s.penalty === '+2') {
      lines.push(formatMmSsMmm(s.timeMs + 2000) + '+');
    } else {
      lines.push(formatMmSsMmm(s.timeMs));
    }
  }
  return lines.join('\n') + '\n';
}
