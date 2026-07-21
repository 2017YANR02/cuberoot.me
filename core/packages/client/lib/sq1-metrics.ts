/**
 * Square-1 move-count metrics. Given a Square-1 sequence in (x,y)/ notation,
 * count it under all three conventions (see /math/god?event=sq1 for the full story):
 *
 *   - twist / "slash":  count only "/" slices; layer turns are free.   God's number 13 (proven).
 *   - WCA 12c4:         non-identity (x,y) + "/" each count 1.          God's number unknown (open).
 *   - face-turn:        (x,0)/(0,y)/"/" = 1, a double (x,y) = 2.        God's number 31 (proven).
 *
 * One invariant across every metric: a "/" slice always counts 1. The only
 * divergence is how layer turns are counted. Hence twist ≤ WCA ≤ face-turn
 * for any given sequence.
 *
 * Built on the shared parser in `sq1-svg.ts` so counts match the rest of the
 * site (scramble / recon / math).
 */
import { parseSq1Tokens, type Sq1Token } from '@cuberoot/shared/sq1-notation';

export interface Sq1MoveCounts {
  twist: number;
  wca: number;
  face: number;
  /** number of "/" slices */
  slices: number;
  /** number of (x,y) layer turns (including any identity (0,0)) */
  turns: number;
  /** non-identity layer turns */
  nonIdentityTurns: number;
  /** layer turns moving both layers (each costs 2 in face-turn) */
  doubleTurns: number;
}

/** Per-token cost under each metric. */
export function sq1TokenCost(tok: Sq1Token): { twist: number; wca: number; face: number } {
  if (tok.kind === 'slice') return { twist: 1, wca: 1, face: 1 };
  const nonId = tok.top !== 0 || tok.bot !== 0;
  return {
    twist: 0, // layer turns are free in the twist metric
    wca: nonId ? 1 : 0,
    face: (tok.top !== 0 ? 1 : 0) + (tok.bot !== 0 ? 1 : 0),
  };
}

/** Count a Square-1 (x,y)/ sequence under all three metrics. */
export function sq1MoveCounts(alg: string): Sq1MoveCounts {
  const toks = parseSq1Tokens(alg);
  let twist = 0, wca = 0, face = 0, slices = 0, turns = 0, nonIdentityTurns = 0, doubleTurns = 0;
  for (const tk of toks) {
    const c = sq1TokenCost(tk);
    twist += c.twist; wca += c.wca; face += c.face;
    if (tk.kind === 'slice') {
      slices++;
    } else {
      turns++;
      if (tk.top !== 0 || tk.bot !== 0) nonIdentityTurns++;
      if (tk.top !== 0 && tk.bot !== 0) doubleTurns++;
    }
  }
  return { twist, wca, face, slices, turns, nonIdentityTurns, doubleTurns };
}
