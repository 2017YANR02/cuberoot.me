/**
 * cubedb-style URL encoding for sharing recon scramble + solution.
 * Ported from packages/client/src/utils/cubedb_url.ts.
 *
 * URL params (independent, all optional):
 *   ?scramble=<wcaScramble>&optimal=<optimalScramble>&alg=<solution>
 *
 * Encode: spaces → `_`, `'` → `-` (so the URL is `+`/`%27`-free and readable).
 *
 * Decode for `-`: in the move portion of each line (before `//`), aggressively
 * convert `<move>-` → `<move>'`. In comments after `//`, dashes are left alone
 * so `// ZBLL-T` survives a round-trip.
 */

const ZERO_WIDTH = /[​‌‍﻿]/g;
const MOVE_DASH = /([A-Za-z][wW]?[2]?)-/g;

export function encodeUrlAlg(s: string): string {
  if (!s) return '';
  return s.replace(/'/g, '-').replace(/ /g, '_');
}

export function decodeUrlAlg(raw: string): string {
  if (!raw) return '';
  const stripped = raw.replace(ZERO_WIDTH, '').replace(/_/g, ' ');
  return stripped.split('\n').map(line => {
    const idx = line.indexOf('//');
    if (idx < 0) return line.replace(MOVE_DASH, "$1'");
    return line.slice(0, idx).replace(MOVE_DASH, "$1'") + line.slice(idx);
  }).join('\n');
}
