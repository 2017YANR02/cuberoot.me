/**
 * Per-session cstimer JSON parser → our Solve list.
 *
 * Returns one entry per `sessionN` with its mapped EventId, the session's
 * display name, and parsed Solves. Tolerant: malformed entries are skipped,
 * never thrown.
 *
 * Ported subset of packages/client/src/pages/timer/storage/import_cstimer.ts.
 * Only event ids supported by the Next.js port survive; rest map to '333'.
 */

import type { EventId, Solve } from './timer-db';

interface CstimerSessionMeta {
  name?: string;
  opt?: { scrType?: string };
  rank?: number;
  scrType?: string;
}

const CSTIMER_EVENT_MAP: Record<string, EventId> = {
  '222': '222', '2': '222', '22': '222',
  '333': '333', '3': '333', '33': '333',
  '444': '444', '4': '444', '44': '444',
  '555': '555', '5': '555', '55': '555',
  '666': '666', '6': '666', '66': '666',
  '777': '777', '7': '777', '77': '777',
  '333oh': '333oh', '3oh': '333oh', 'oh': '333oh',
  '333fm': '333fm', '3fm': '333fm', 'fm': '333fm', 'fmc': '333fm',
  'pyram': 'pyra', 'pyra': 'pyra', 'pyraminx': 'pyra',
  'skewb': 'skewb', 'skbso': 'skewb',
  'sq1': 'sq1', 'sqr1': 'sq1', 'square1': 'sq1', 'sq1h': 'sq1', 'sq1a': 'sq1',
  'mega': 'mega', 'megamx': 'mega', 'megaminx': 'mega', 'minx2g': 'mega', 'mgmp': 'mega',
  'clock': 'clock', 'clkwca': 'clock',
};

function normalizeEventKey(raw: unknown): { event: EventId; matched: boolean } {
  if (typeof raw !== 'string') return { event: '333', matched: false };
  const k = raw.toLowerCase().trim().replace(/[\s_-]/g, '');
  if (k in CSTIMER_EVENT_MAP) return { event: CSTIMER_EVENT_MAP[k], matched: true };
  const noX = k.replace(/x/g, '');
  if (noX in CSTIMER_EVENT_MAP) return { event: CSTIMER_EVENT_MAP[noX], matched: true };
  return { event: '333', matched: false };
}

function nameToEvent(name: unknown): { event: EventId; matched: boolean } {
  if (typeof name !== 'string' || !name) return { event: '333', matched: false };
  const direct = normalizeEventKey(name);
  if (direct.matched) return direct;
  const tokens = name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const t of tokens) {
    const tried = normalizeEventKey(t);
    if (tried.matched) return tried;
  }
  return { event: '333', matched: false };
}

export interface CstimerSessionParsed {
  sessionId: string;
  name: string;
  event: EventId;
  matched: boolean;
  solves: Solve[];
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseCstimerExport(jsonText: string): CstimerSessionParsed[] {
  let outer: Record<string, unknown>;
  try {
    outer = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return [];
  }
  if (!outer || typeof outer !== 'object') return [];

  let sessionMeta: Record<string, CstimerSessionMeta> = {};
  const props = outer['properties'];
  if (props && typeof props === 'object') {
    const sd = (props as Record<string, unknown>)['sessionData'];
    if (typeof sd === 'string') {
      try {
        const parsed = JSON.parse(sd) as Record<string, CstimerSessionMeta>;
        if (parsed && typeof parsed === 'object') sessionMeta = parsed;
      } catch { /* ignore */ }
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

  out.sort((a, b) => Number(a.sessionId) - Number(b.sessionId));
  return out;
}
