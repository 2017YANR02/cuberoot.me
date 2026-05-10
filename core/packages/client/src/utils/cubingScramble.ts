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
  let str = alg.toString();
  // Megaminx: WCA-spec scrambles are 7 face cycles (~11 moves each) ending
  // with U or U'. Tnoodle prints one cycle per line. cubing.js's toString()
  // joins them with spaces, so we inject '\n' after each U-prefixed token to
  // restore the canonical layout. PDF + screen renderers honor '\n'.
  if (wcaId === 'minx' && !str.includes('\n')) {
    const tokens = str.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur: string[] = [];
    for (const tok of tokens) {
      cur.push(tok);
      if (/^U['+]?$/.test(tok)) {
        lines.push(cur.join(' '));
        cur = [];
      }
    }
    if (cur.length) lines.push(cur.join(' '));
    str = lines.join('\n');
  }
  return str;
}
