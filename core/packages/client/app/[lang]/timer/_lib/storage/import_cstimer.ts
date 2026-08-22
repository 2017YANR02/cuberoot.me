/**
 * Per-session csTimer JSON parser.
 *
 * Returns one entry per detected `sessionN` with its mapped EventId, the
 * session's display name, and parsed Solves. Different from
 * `importCstimerJson` (in `import_export.ts`) which collapses everything into
 * a single `byEvent` map; this preserves session boundaries so the UI can
 * offer per-session Append/Replace.
 *
 * Tolerant: malformed entries are skipped, never thrown.
 */

import type { EventId, Solve } from '../types';
import { newId } from './db';
import type { TimerImportSession } from './import_timer';

interface CstimerSessionMeta {
  name?: string;
  opt?: { scrType?: string };
  rank?: number;
  scrType?: string; // older schemas
}

/** cstimer scrType → our EventId. Synonyms collapsed; unknown → '333'. */
const CSTIMER_EVENT_MAP: Record<string, EventId> = {
  '222': '222', '2': '222', '22': '222',
  '333': '333', '3': '333', '33': '333',
  '444': '444', '4': '444', '44': '444',
  '555': '555', '5': '555', '55': '555',
  '666': '666', '6': '666', '66': '666',
  '777': '777', '7': '777', '77': '777',
  '333oh': '333oh', '3oh': '333oh', 'oh': '333oh',
  '333fm': '333fm', '3fm': '333fm', 'fm': '333fm', 'fmc': '333fm',
  '333bld': '333bld', '3bld': '333bld', 'bld': '333bld',
  '333mbld': '333mbld', '3mbld': '333mbld', 'mbld': '333mbld', 'mbo': '333mbld',
  '333ni': '333ni', '3ni': '333ni', 'ni': '333ni',
  '333mr': '333mr', 'mirror': '333mr', 'mirrorblocks': '333mr', 'mirblocks': '333mr',
  '444bld': '444bld', '4bld': '444bld',
  '555bld': '555bld', '5bld': '555bld',
  '666bld': '666bld', '6bld': '666bld',
  '777bld': '777bld', '7bld': '777bld',
  'pyram': 'pyra', 'pyra': 'pyra', 'pyraminx': 'pyra',
  'skewb': 'skewb', 'skbso': 'skewb',
  'sq1': 'sq1', 'sqr1': 'sq1', 'square1': 'sq1', 'sq1h': 'sq1', 'sq1a': 'sq1',
  'mega': 'mega', 'megamx': 'mega', 'megaminx': 'mega', 'minx2g': 'mega', 'mgmp': 'mega',
  'clock': 'clock', 'clkwca': 'clock',
  'r3': 'r3', '234': 'r3', '23rl': 'r3', '234relay': 'r3', 'relayw': 'r3',
  'r4': 'r4', '2345': 'r4', '2345relay': 'r4',
  'r5': 'r5', '23456': 'r5', '23456relay': 'r5',
  'cross': 'cross', 'crs': 'cross',
  'f2l': 'f2l', 'edges': 'f2l',
  'll': 'll',
  'pll': 'pll', 'pllt': 'pll',
  'oll': 'oll', 'ollt': 'oll',
  'coll': 'coll', 'collt': 'coll',
  'cmll': 'cmll',
  'zbll': 'zbll', 'zbllt': 'zbll',
  'eg1': 'eg1',
  'eg2': 'eg2',
  'magic': 'magic',
  'mmagic': 'mmagic',
  // Non-WCA puzzles — inverse of EVENT_TO_CSTIMER_SCRTYPE in export_cstimer.ts,
  // plus the plain ids so a hand-named session ("FTO") still resolves.
  'fto': 'fto', 'ftoso': 'fto',
  'kilominx': 'kilominx', 'klmso': 'kilominx', 'kilo': 'kilominx',
  'gear': 'gear', 'gearso': 'gear', 'gearo': 'gear',
  'ivy': 'ivy', 'ivyso': 'ivy', 'ivyo': 'ivy',
  'redi': 'redi', 'rediso': 'redi',
  'mpyram': 'mpyram', 'mpyrso': 'mpyram', 'mpyr': 'mpyram',
};

/* ------------------------------------------------------------------ */
/* DNS <-> csTimer codec                                               */
/* ------------------------------------------------------------------ */
//
// csTimer has no "Did Not Start" code — its penalty field is only
// 0 / 2000 / -1. We therefore write a DNS as a DNF (-1) and mark it by
// prefixing the comment with "DNS ", then sniff that prefix back off on
// import. Real csTimer degrades it to "a DNF with a note", which is the
// correct behaviour: DNS scores identically to DNF.
//
// Only consulted when the penalty is -1, so an ordinary comment that happens
// to start with "DNS" on a *successful* solve is never misread.

/** Matches "DNS", "DNS " and "DNS <rest>" — the shapes `encodeDnsComment` emits. */
export const CSTIMER_DNS_RE = /^DNS(?:\s+|$)/;

/** Attach the DNS marker to a comment for csTimer export. */
export function encodeDnsComment(comment: string | undefined): string {
  const rest = (comment ?? '').trim();
  return rest ? `DNS ${rest}` : 'DNS';
}

/** Strip the DNS marker. Returns null when the comment isn't DNS-marked. */
export function decodeDnsComment(comment: string): string | null {
  if (!CSTIMER_DNS_RE.test(comment)) return null;
  return comment.replace(CSTIMER_DNS_RE, '');
}

/**
 * Resolve the penalty + comment of an imported csTimer solve, promoting a
 * DNS-marked DNF back to a real DNS. Shared by both importers.
 */
export function applyDnsSniff(
  penalty: Solve['penalty'],
  rawComment: unknown,
): { penalty: Solve['penalty']; comment: string | undefined } {
  const text = typeof rawComment === 'string' ? rawComment : '';
  if (penalty === 'DNF') {
    const stripped = decodeDnsComment(text);
    if (stripped !== null) {
      return { penalty: 'DNS', comment: stripped.length > 0 ? stripped : undefined };
    }
  }
  return { penalty, comment: text.length > 0 ? text : undefined };
}

function normalizeEventKey(raw: unknown): { event: EventId; matched: boolean } {
  if (typeof raw !== 'string') return { event: '333', matched: false };
  const k = raw.toLowerCase().trim().replace(/[\s_-]/g, '');
  if (k in CSTIMER_EVENT_MAP) return { event: CSTIMER_EVENT_MAP[k], matched: true };
  const noX = k.replace(/x/g, '');
  if (noX in CSTIMER_EVENT_MAP) return { event: CSTIMER_EVENT_MAP[noX], matched: true };
  return { event: '333', matched: false };
}

/** Map a session display name (e.g. "OH", "3x3") to an EventId — used as a
 *  fallback when scrType is missing. */
function nameToEvent(name: unknown): { event: EventId; matched: boolean } {
  if (typeof name !== 'string' || !name) return { event: '333', matched: false };
  // Try the raw token first, then strip common adornments.
  const direct = normalizeEventKey(name);
  if (direct.matched) return direct;
  // Common naming patterns: "3x3 OH", "Session: 4x4", etc — extract a likely tag.
  const tokens = name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const t of tokens) {
    const tried = normalizeEventKey(t);
    if (tried.matched) return tried;
  }
  return { event: '333', matched: false };
}

export type CstimerSessionParsed = TimerImportSession;

/**
 * Parse a cstimer "Local backup → Export" JSON string into per-session entries.
 * Returns [] if the input does not look like cstimer JSON.
 */
export function parseCstimerExport(jsonText: string): CstimerSessionParsed[] {
  let outer: Record<string, unknown>;
  try {
    outer = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return [];
  }
  if (!outer || typeof outer !== 'object') return [];

  // Pull metadata table from `properties.sessionData` (string-encoded JSON).
  let sessionMeta: Record<string, CstimerSessionMeta> = {};
  const props = outer['properties'];
  if (props && typeof props === 'object') {
    const sd = (props as Record<string, unknown>)['sessionData'];
    if (typeof sd === 'string') {
      try {
        const parsed = JSON.parse(sd) as Record<string, CstimerSessionMeta>;
        if (parsed && typeof parsed === 'object') sessionMeta = parsed;
      } catch { /* tolerate */ }
    } else if (sd && typeof sd === 'object') {
      sessionMeta = sd as Record<string, CstimerSessionMeta>;
    }
  }

  const out: CstimerSessionParsed[] = [];

  for (const key of Object.keys(outer)) {
    const m = /^session(\d+)$/.exec(key);
    if (!m) continue;
    const sid = m[1];
    const raw = outer[key];

    let entries: unknown[] = [];
    try {
      if (typeof raw === 'string') {
        entries = JSON.parse(raw) as unknown[];
      } else if (Array.isArray(raw)) {
        entries = raw as unknown[];
      }
    } catch { continue; }
    if (!Array.isArray(entries)) continue;

    const meta = sessionMeta[sid];
    const scrType = meta?.opt?.scrType ?? meta?.scrType;
    let { event, matched } = normalizeEventKey(scrType);
    if (!matched) {
      const fromName = nameToEvent(meta?.name);
      if (fromName.matched) { event = fromName.event; matched = true; }
    }
    if (!matched) {
      console.warn(`[cstimer-import] session${sid} (${meta?.name ?? '?'}, scrType=${String(scrType)}) unmapped; defaulting to 333`);
    }

    const solves: Solve[] = [];
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 4) continue;
      const time = entry[0];
      const scramble = entry[1];
      const comment = entry[2];
      const dateSec = entry[3];
      if (!Array.isArray(time) || time.length < 2) continue;
      // csTimer's per-solve time array is [penalty, totalMs, ...phaseSplits]:
      //   time[0] penalty — 0 = none, 2000 = +2, -1 = DNF
      //   time[1] recorded time in MILLISECONDS, before the penalty is added
      // Verified against upstream: lib/tdconverter.js:112-126 writes the tuple,
      // and stats/stats.js:1288 / stats/hugestat.js:27 / tools/onlinecomp.js:294
      // all read the final time as time[0] + time[1].
      const pen = Number(time[0]);
      const totalMs = Number(time[1]);
      if (!Number.isFinite(pen) || !Number.isFinite(totalMs)) continue;

      let penalty: Solve['penalty'];
      if (pen === -1) penalty = 'DNF';
      else if (pen === 2000) penalty = '+2';
      else penalty = 'ok';
      // A DNF whose comment starts with "DNS" is one of our own DNS exports.
      const sniffed = applyDnsSniff(penalty, comment);
      penalty = sniffed.penalty;
      // csTimer keeps the real recorded time on a DNF, so we preserve it too.
      const timeMs = Math.max(0, totalMs);

      // Multi-phase solves carry cumulative splits after the total, ordered
      // back-to-front (tdconverter.js:124 fills `time[len-j]` descending, so
      // time[1] is the total and the highest index is the first phase). Our
      // `stages` field models exactly csTimer's default 4-phase 3x3 split, so
      // we only map that shape and ignore any other phase count.
      let stages: Solve['stages'];
      if (time.length === 5) {
        const cross = Number(time[4]);
        const f2l = Number(time[3]);
        const oll = Number(time[2]);
        if ([cross, f2l, oll].every(v => Number.isFinite(v) && v >= 0)) {
          stages = { cross, f2l, oll, pll: timeMs };
        }
      }

      const ts = Number(dateSec);
      solves.push({
        id: newId(),
        timeMs,
        penalty,
        scramble: typeof scramble === 'string' ? scramble : '',
        event,
        ts: Number.isFinite(ts) ? ts * 1000 : Date.now(),
        comment: sniffed.comment,
        ...(stages ? { stages } : {}),
      });
    }
    solves.sort((a, b) => a.ts - b.ts);

    out.push({
      sessionId: sid,
      name: typeof meta?.name === 'string' && meta.name ? meta.name : `Session ${sid}`,
      event,
      matched,
      solves,
    });
  }

  // csTimer lets users reorder groups without renumbering sessionN. Its own
  // importer and session picker use metadata.rank, so preserve that visible
  // order and only fall back to the numeric id for older exports.
  const sourceRank = (session: CstimerSessionParsed): number => {
    const rank = sessionMeta[session.sessionId]?.rank;
    return typeof rank === 'number' && Number.isFinite(rank)
      ? rank
      : Number(session.sessionId);
  };
  out.sort((a, b) => sourceRank(a) - sourceRank(b) || Number(a.sessionId) - Number(b.sessionId));
  return out;
}
