/**
 * Decode a replay URL parameter back into the bits ReconstructModal needs.
 *
 * The encoder emits 1-letter keys + delta-from-first-move move timestamps.
 * We validate the decoded shape strictly and return null on any malformed
 * input (caller logs a warning).
 */

import type { EventId } from '../types';
import { EVENTS } from '../types';

export interface DecodedReplay {
  event: EventId;
  scramble: string;
  moves: Array<{ m: string; ts: number }>;
  totalMs: number;
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const full = pad === 0 ? padded : padded + '='.repeat(4 - pad);
  const bin = atob(full);
  // Reverse the unescape(encodeURIComponent(...)) trick from the encoder so
  // unicode round-trips correctly.
  return decodeURIComponent(escape(bin));
}

const VALID_EVENTS = new Set<string>(EVENTS.map(e => e.id));

export function decodeReplayParam(param: string): DecodedReplay | null {
  if (!param || typeof param !== 'string') return null;
  let json: string;
  try {
    json = base64UrlDecode(param);
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const e = obj.e;
  const s = obj.s;
  const m = obj.m;
  const t = obj.t;
  if (typeof e !== 'string' || !VALID_EVENTS.has(e)) return null;
  if (typeof s !== 'string') return null;
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) return null;
  if (!Array.isArray(m)) return null;
  const moves: Array<{ m: string; ts: number }> = [];
  for (const entry of m) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [mv, ts] = entry as [unknown, unknown];
    if (typeof mv !== 'string' || typeof ts !== 'number' || !Number.isFinite(ts)) return null;
    moves.push({ m: mv, ts });
  }
  return {
    event: e as EventId,
    scramble: s,
    moves,
    totalMs: t,
  };
}
