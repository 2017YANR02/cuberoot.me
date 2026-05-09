/**
 * WCA-spec scrambles via `cubing/scramble`. cubing.js's scramblers are
 * maintained by the same author as tnoodle (Lucas Garron) and produce the
 * same official WCA-compliant output for all 17 events — exposed here as a
 * single async entry point. Accepts either short keys ('3x3', 'pyra', 'mega'…)
 * or WCA ids ('333', 'pyram', 'minx'…).
 */
import { randomScrambleForEvent } from 'cubing/scramble';
import { toWcaEventId } from './wca_events';

export const TNOODLE_WCA_EVENTS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '444bf', '555bf',
  '333fm', '333oh', '333mbf',
  'clock', 'minx', 'pyram', 'skewb', 'sq1',
] as const;

const SUPPORTED = new Set<string>(TNOODLE_WCA_EVENTS);

export function isTnoodleSupportedEvent(event: string): boolean {
  return SUPPORTED.has(toWcaEventId(event));
}

export async function tnoodleRandomScramble(event: string): Promise<string | null> {
  const wcaId = toWcaEventId(event);
  if (!SUPPORTED.has(wcaId)) return null;
  const alg = await randomScrambleForEvent(wcaId);
  return alg.toString();
}
