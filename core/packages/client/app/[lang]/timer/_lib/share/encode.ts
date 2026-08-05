/**
 * Encode a Solve into a shareable replay URL.
 *
 * Payload schema (kept intentionally compact — keys are 1 letter):
 *   { e: EventId, s: scramble, m: [[move, msFromFirstMove], ...], t: timeMs,
 *     g?: packedGyroTrack, d?: [deviceModel, deviceName], r?: verifiedLines }
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
  /** Optional orientation track. Without it, x/y/z rotations are not
   * recoverable from a smart cube's face-turn notifications. */
  g?: string;
  /** The gyro axis basis is protocol-specific, so the model travels with g. */
  d?: [string, string];
  /** Optional user-verified notation, one display line per step. */
  r?: string[];
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
  if (solve.gyro) payload.g = solve.gyro;
  if (solve.device) payload.d = [solve.device.model, solve.device.name];
  if (solve.reconstruction?.length) payload.r = solve.reconstruction;
  return base64UrlEncode(JSON.stringify(payload));
}

export function encodeReplayUrl(solve: Solve): string {
  const param = encodeReplayPayload(solve);
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?replay=${param}`;
}
