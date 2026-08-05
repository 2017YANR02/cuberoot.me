/**
 * Decode a replay URL parameter back into the bits ReconstructModal needs.
 *
 * The encoder emits 1-letter keys + delta-from-first-move move timestamps.
 * We validate the decoded shape strictly and return null on any malformed
 * input (caller logs a warning).
 */

import type { EventId, Solve } from '../types';
import { EVENTS } from '../types';
import { findVerifiedReconstruction } from './verified_reconstruction';

export interface DecodedReplay {
  event: EventId;
  scramble: string;
  moves: Array<{ m: string; ts: number }>;
  totalMs: number;
  gyro?: string;
  device?: { model: string; name: string };
  reconstruction?: string[];
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
  const g = obj.g;
  const d = obj.d;
  const r = obj.r;
  if (typeof e !== 'string' || !VALID_EVENTS.has(e)) return null;
  if (typeof s !== 'string') return null;
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) return null;
  if (!Array.isArray(m)) return null;
  if (g !== undefined && (typeof g !== 'string' || g.length === 0)) return null;
  if (d !== undefined && (
    !Array.isArray(d) || d.length !== 2
    || typeof d[0] !== 'string' || d[0].length === 0
    || typeof d[1] !== 'string'
  )) return null;
  if (r !== undefined && (
    !Array.isArray(r) || r.length === 0 || r.length > 64
    || r.some(line => typeof line !== 'string' || line.length === 0 || line.length > 1000)
  )) return null;
  const moves: Array<{ m: string; ts: number }> = [];
  for (const entry of m) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [mv, ts] = entry as [unknown, unknown];
    if (typeof mv !== 'string' || typeof ts !== 'number' || !Number.isFinite(ts)) return null;
    moves.push({ m: mv, ts });
  }
  const decoded: DecodedReplay = {
    event: e as EventId,
    scramble: s,
    moves,
    totalMs: t,
  };
  if (g !== undefined) decoded.gyro = g;
  if (d !== undefined) decoded.device = { model: d[0], name: d[1] };
  if (r !== undefined) decoded.reconstruction = r as string[];
  return decoded;
}

/**
 * Turn a decoded link into the ephemeral Solve shown by the report.
 *
 * Legacy replay links did not carry gyro/device data. When the link is opened
 * in the browser that recorded it, recover those fields from the matching
 * local solve. Matching includes the entire rebased move stream; scramble +
 * rounded time alone is not enough to attach somebody else's orientation.
 */
export function solveFromReplay(
  decoded: DecodedReplay,
  candidates: readonly Solve[] = [],
  now = Date.now(),
): Solve {
  const sameMoves = (solve: Solve): boolean => {
    const source = solve.moves ?? [];
    if (source.length !== decoded.moves.length) return false;
    const base = source.length > 0 ? source[0].ts : 0;
    return source.every((mv, i) => (
      mv.m === decoded.moves[i].m
      && Math.round(mv.ts - base) === decoded.moves[i].ts
    ));
  };
  const local = candidates.find(s => (
    s.event === decoded.event
    && s.scramble === decoded.scramble
    && Math.round(s.timeMs) === Math.round(decoded.totalMs)
    && sameMoves(s)
  ));
  const gyro = decoded.gyro ?? local?.gyro;
  const device = decoded.device ?? local?.device;
  const reconstruction = decoded.reconstruction
    ?? local?.reconstruction
    ?? findVerifiedReconstruction(decoded);
  return {
    id: `replay-${now}`,
    timeMs: decoded.totalMs,
    penalty: 'ok',
    scramble: decoded.scramble,
    event: decoded.event,
    ts: now,
    moves: decoded.moves.length > 0 ? decoded.moves : undefined,
    ...(gyro ? { gyro } : {}),
    ...(device ? { device } : {}),
    ...(reconstruction ? { reconstruction } : {}),
  };
}
