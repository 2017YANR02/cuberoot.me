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
  let bestScore = [Infinity, Infinity, Infinity];
  for (const rotation of candidates) {
    const perm = facePermFor(rotation);
    const scr = conjugateSequence(scramble, perm);
    const tokens = moves.map(move => conjugateToken(move.m, perm));
    if (scr === null || tokens.some(token => token === null)) continue;
    const framed = moves.map((move, i) => ({ ...move, m: tokens[i]! }));
    if (rotation === candidates[0]) best = { scramble: scr, moves: framed, rotation };
    let state;
    try { state = applyScramble(3, scr); } catch { continue; }
    // An incidental block in the scramble must not lock the entire report to
    // the wrong axis. Prefer the frame completing both blocks first, then its
    // first milestone. The same frame is used for detection and presentation.
    const blockStage = method === 'roux' ? 1 : 2;
    let first = Infinity, second = Infinity, blocks = Infinity;
    for (let i = -1; i < framed.length; i++) {
      if (i >= 0) state = applyOneToken(state, framed[i].m);
      const facelets = facesToFacelets(state);
      if (first === Infinity && METHODS[method].stages[0].done(state, facelets)) first = i;
      if (second === Infinity && METHODS[method].stages[1].done(state, facelets)) second = i;
      if (!METHODS[method].stages[blockStage].done(state, facelets)) continue;
      blocks = i;
      break;
    }
    if (blocks < bestScore[0] || blocks === bestScore[0] && (first < bestScore[1]
      || first === bestScore[1] && second < bestScore[2])) {
      bestScore = [blocks, first, second];
      best = { scramble: scr, moves: framed, rotation };
    }
  }
  return best;
}
