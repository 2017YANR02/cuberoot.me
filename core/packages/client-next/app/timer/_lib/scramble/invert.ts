/**
 * Algorithm inverter — reverses move order and inverts each token.
 *
 * Used by training generators (OLL/PLL/COLL/CMLL/ZBLL/EG) to turn a solving
 * algorithm into a setup scramble that produces the case to practice.
 *
 * Token rules:
 *   X     -> X'
 *   X'    -> X
 *   X2    -> X2 (self-inverse)
 *   Xw    -> Xw'
 *   Xw'   -> Xw
 *   Xw2   -> Xw2
 *   2Xw'  -> 2Xw
 *   (...) — parens are stripped first
 *
 * Anything we don't recognize is passed through with a single ' appended /
 * removed; this keeps unusual notation (e.g. M, S, E, x, y, z, r, l, u, d) valid.
 */

export function invertToken(tok: string): string {
  if (!tok) return tok;
  // Self-inverse if ends with '2'
  if (tok.endsWith('2')) return tok;
  if (tok.endsWith("'")) return tok.slice(0, -1);
  return tok + "'";
}

export function invertAlg(alg: string): string {
  // Strip parens / brackets, collapse whitespace.
  const cleaned = alg.replace(/[[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const tokens = cleaned.split(' ');
  const inverted: string[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (!t) continue;
    inverted.push(invertToken(t));
  }
  return inverted.join(' ');
}
