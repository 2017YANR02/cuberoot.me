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
};

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

export interface CstimerSessionParsed {
  /** cstimer session id (the digits in "session1"). */
  sessionId: string;
  /** Display name shown in cstimer (or "Session N" fallback). */
  name: string;
  /** Mapped EventId. Falls back to '333' if scrType + name both unknown. */
  event: EventId;
  /** Whether the event mapping was confident (vs '333' fallback). */
  matched: boolean;
  /** Parsed solves, sorted oldest → newest. */
  solves: Solve[];
}

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
      solves.push({
        id: newId(),
        timeMs,
        penalty,
        scramble: typeof scramble === 'string' ? scramble : '',
        event,
        ts: Number.isFinite(ts) ? ts * 1000 : Date.now(),
        comment: typeof comment === 'string' && comment.length > 0 ? comment : undefined,
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

  // Sort sessions by id ascending for stable display.
  out.sort((a, b) => Number(a.sessionId) - Number(b.sessionId));
  return out;
}
