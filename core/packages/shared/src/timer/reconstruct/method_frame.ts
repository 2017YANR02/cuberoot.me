import { METHODS, facesToFacelets, type MethodId } from './methods';
import { conjugateSequence, conjugateToken, facePermFor, normalizeSolve } from './orient';
import { applyScramble } from './state';
import { applyOneToken } from './apply-token';
import type { SolveMove } from './stage_segments';

const rotations = (() => {
  const seen = new Set<string>();
  const queue = [''];
  const out: string[] = [];
  while (queue.length && out.length < 24) {
    const rotation = queue.shift()!;
    const key = JSON.stringify(facePermFor(rotation));
    if (seen.has(key)) continue;
    seen.add(key); out.push(rotation);
    for (const axis of ['x', 'y', 'z']) queue.push(`${rotation} ${axis}`.trim());
  }
  return out;
})();

/** Choose one frame for the whole attempt; never combine stages from different axes. */
export function methodFrame(method: MethodId, scramble: string, moves: SolveMove[], preferredRotation?: string | null) {
  if (method === 'cfop') return normalizeSolve(scramble, moves, { preferredRotation });
  const candidates = [...new Set([...(preferredRotation == null ? [] : [preferredRotation]), ...rotations])];
  let best = { scramble, moves, rotation: '' };
  let first = Infinity;
  for (const rotation of candidates) {
    const perm = facePermFor(rotation);
    const scr = conjugateSequence(scramble, perm);
    const tokens = moves.map(move => conjugateToken(move.m, perm));
    if (scr === null || tokens.some(token => token === null)) continue;
    const framed = moves.map((move, i) => ({ ...move, m: tokens[i]! }));
    if (rotation === candidates[0]) best = { scramble: scr, moves: framed, rotation };
    let state;
    try { state = applyScramble(3, scr); } catch { continue; }
    // A stage already present in the scramble fixes the frame too.
    for (let i = -1; i < framed.length && i < first; i++) {
      if (i >= 0) state = applyOneToken(state, framed[i].m);
      if (!METHODS[method].stages[0].done(state, facesToFacelets(state))) continue;
      first = i;
      best = { scramble: scr, moves: framed, rotation };
      break;
    }
  }
  return best;
}
