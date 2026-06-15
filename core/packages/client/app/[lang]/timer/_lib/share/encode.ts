/**
 * Encode a Solve into a shareable replay URL.
 *
 * Payload schema (kept intentionally compact — keys are 1 letter):
 *   { e: EventId, s: scramble, m: [[move, msFromFirstMove], ...], t: timeMs }
 *
 * `moves[i].ts` in the source Solve are absolute performance.now() rebased to
 * solve start. We re-rebase to the FIRST move so the URL is shorter (skips
 * the leading idle gap, which can be hundreds of ms). Decode keeps them as
 * deltas from move 0 — sliceReconstruction in ReconstructModal handles that.
 */

import type { Solve } from '../types';

export interface ReplayPayload {
  e: string;
  s: string;
  m: Array<[string, number]>;
  t: number;
}

function base64UrlEncode(input: string): string {
  const bin = unescape(encodeURIComponent(input));
  return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function encodeReplayPayload(solve: Solve): string {
  const moves = solve.moves ?? [];
  const base = moves.length > 0 ? moves[0].ts : 0;
  const compactMoves: Array<[string, number]> = moves.map(({ m, ts }) => [m, Math.round(ts - base)]);
  const payload: ReplayPayload = {
    e: solve.event,
    s: solve.scramble,
    m: compactMoves,
    t: Math.round(solve.timeMs),
  };
  return base64UrlEncode(JSON.stringify(payload));
}

export function encodeReplayUrl(solve: Solve): string {
  const param = encodeReplayPayload(solve);
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?replay=${param}`;
}
