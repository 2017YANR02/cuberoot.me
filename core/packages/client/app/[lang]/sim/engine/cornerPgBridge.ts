/**
 * Shared PG move-bridge factory for the corner-turning puzzles (Dino, Skewb).
 *
 * Both drive 8 corner grips with a ±120° twist (`CornerMove`), and both map onto the
 * vendored puzzle-geometry the same way: PG names a cube's vertex-cut moves by the 3
 * faces meeting at the corner (e.g. `DRF`, plus a two-layer `2DRF`), so the engine's
 * single-corner cap = the PG move whose face-letter SET matches the engine corner name
 * and has NO leading layer digit (the shallow cap, not the `2X` slice). That letter-set
 * match is a cube symmetry relabelling, hence faithful; the chirality was pinned by the
 * closed-loop probe to the same convention as the pyraminx (engine dir +1 = PG inverse).
 *
 * PG's group for these is the *fixed-in-space* count (12× the speedcuber figure, the
 * whole-cube reorientations — same as the pyraminx's 906M vs 75M); it is *richer* than
 * the engine's, so a BSGS solve to PG-identity always solves the engine.
 */
import type { MoveBridge } from './pgBinding';
import type { PGOrbitsDef, PGTransform, PuzzleName } from '@/lib/puzzle-geometry';
import type { CornerMove } from './cornerNotation';

const lettersKey = (name: string): string =>
  [...name].filter((c) => c >= 'A' && c <= 'Z').sort().join('');

/** Collapse consecutive same-corner ±120° twists (mod 3) — shortens the BSGS word and
 *  its displayed step count. Order-3: +1≡1, −1≡2; net 0 cancels, 1→+1, 2→−1. */
export function reduceCornerMoves<M extends CornerMove>(moves: M[]): M[] {
  const r = (d: 1 | -1): number => (d === 1 ? 1 : 2);
  const out: M[] = [];
  for (const m of moves) {
    const top = out[out.length - 1];
    if (top && top.corner === m.corner) {
      const net = (r(top.dir) + r(m.dir)) % 3;
      out.pop();
      if (net !== 0) out.push({ ...m, dir: net === 1 ? 1 : -1 });
    } else {
      out.push({ ...m });
    }
  }
  return out;
}

export function makeCornerPgBridge<M extends CornerMove>(opts: {
  pgName: PuzzleName;
  cornerNames: readonly string[];
  parse: (text: string) => M[];
  toString: (moves: M[]) => string;
}): MoveBridge<M> {
  return {
    pgName: opts.pgName,
    engineGens(od: PGOrbitsDef): PGTransform[] {
      // Index PG's shallow single-corner caps by face-letter set (skip the `2X` slices).
      const byKey = new Map<string, PGTransform>();
      od.movenames.forEach((n, i) => {
        if (!/^\d/.test(n)) byKey.set(lettersKey(n), od.moveops[i]);
      });
      return opts.cornerNames.map((name) => {
        const op = byKey.get(lettersKey(name));
        if (!op) throw new Error(`cornerPgBridge: no PG cap for ${opts.pgName} corner ${name}`);
        return op;
      });
    },
    moveToStep: (m) => ({ gi: m.corner, inv: m.dir === 1 }),
    stepToMove: (s) => ({ corner: s.gi, dir: s.inv ? 1 : -1 } as M),
    parse: opts.parse,
    toString: opts.toString,
    reduce: (text) => opts.toString(reduceCornerMoves(opts.parse(text))),
  };
}
