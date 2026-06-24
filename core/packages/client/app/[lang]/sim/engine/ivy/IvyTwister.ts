/**
 * IvyTwister — IvyCube's animation orchestrator. The queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Ivy only
 * supplies its parser and (constant 120°) tween length.
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type IvyCube from './IvyCube';
import type { IvyMove } from './IvyCube';

const AXIS_LETTER = 'RLDB';
const TOKEN_RE = /^([RLDB])('?)$/i;

/** Parse an Ivy scramble (R L D B with ') into moves, in the /sim's STANDARD
 *  notation: a bare letter = ONE 120° twist (times 1), a primed letter = its
 *  inverse (times 2 = the base turn twice). This is the natural cube convention,
 *  so a dragged single twist records + replays as "R" (not "R'"). NOTE: this is
 *  intentionally the OPPOSITE of lib/ivy-solver's cstimer notation (bare = the base
 *  turn applied twice), which /scramble must keep for cstimer scramble
 *  compatibility — the /sim is a self-contained world (its own random scramble +
 *  drags, no solveIvy), so it uses the intuitive convention. Keep in sync with
 *  IvyCube.pickMove's naming. Strict (throws on a bad token); the live /sim boxes
 *  gate on `classifyIvyTokens` first so a stray token never reaches here. */
export function parseIvyMoves(scramble: string): IvyMove[] {
  const out: IvyMove[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = TOKEN_RE.exec(tok);
    if (!m) throw new Error(`bad: ${tok}`);
    const axis = AXIS_LETTER.indexOf(m[1].toUpperCase());
    const primed = !!m[2];
    out.push({ axis, times: primed ? 2 : 1, name: AXIS_LETTER[axis] + (primed ? "'" : '') });
  }
  return out;
}

export default class IvyTwister extends TweenTwister<IvyMove> {
  constructor(cube: IvyCube) { super(cube); }
  protected parse(scramble: string): IvyMove[] { return parseIvyMoves(scramble); }
  // Every Ivy corner twist is 120° ≈ 4/3 of a 90° turn.
  protected framesFor(): number { return tweenDuration(4 / 3); }
}
