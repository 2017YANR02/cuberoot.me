import { applyMove, cubieEquals, inverseCubie, multiply, parseMoves, solvedCubie, type CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { cubieToFacelet, faceletToCubie, SOLVED_FACELET } from '@cuberoot/shared/cube-facelet';
import { CUBE_ORIENTATIONS, PLL_CASES, type Solve } from '@cuberoot/shared/timer';
import { pllCommentName } from '@cuberoot/shared/recon/alg-case-display';
import { applyScramble, fromFaceletString, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { recognizePllExact } from '@cuberoot/shared/timer/reconstruct/cfop-recognize';

// A slice on a smart cube is reported as outer turns in the core's frame.
// Retain the rotation of the pieces, rather than re-labelling their colours.
function rotationCubie(alg: string): CubieCube {
  const facelets = toFaceletString(applyScramble(3, alg)).split('');
  for (let i = 4; i < 54; i += 9) facelets[i] = SOLVED_FACELET[i];
  return faceletToCubie(facelets.join(''));
}
const ROTATIONS = CUBE_ORIENTATIONS.map(({ value }) => rotationCubie(value));
const FRAMES = ['', 'x', 'x2', "x'", 'z', "z'"].map(alg => {
  const rotation = rotationCubie(alg);
  return { rotation, inverse: inverseCubie(rotation) };
});
const PLL_ID_BY_NAME = new Map(PLL_CASES.flatMap(c => [[c.id, c.id], [pllCommentName(c.id), c.id]]));
/** Library keys stay untouched; explicit shared aliases map to recognition IDs. */
export function pllChainCaseId(name: string): string | null { return PLL_ID_BY_NAME.get(name.trim()) ?? null; }

/** Whole-cube effect, modulo grip and AUF. Never classify only the top stickers. */
export function recognizePllOperation(effect: CubieCube, expected?: string): string | null {
  for (const rotation of ROTATIONS) {
    const aligned = multiply(effect, rotation);
    for (const frame of FRAMES) {
      const canonical = multiply(multiply(frame.inverse, aligned), frame.rotation);
      if (canonical.co.some(value => value !== 0) || canonical.eo.some(value => value !== 0)
        || canonical.cp.some((piece, pos) => pos >= 4 && piece !== pos)
        || canonical.ep.some((piece, pos) => pos >= 4 && piece !== pos)) continue;
      // The recognizer names the case an algorithm SOLVES, not the inverse
      // permutation it leaves on a solved cube (Ua would otherwise become Ub).
      const state = fromFaceletString(cubieToFacelet(inverseCubie(canonical)))!;
      const hit = recognizePllExact(state)?.case;
      if (hit && hit !== 'skip' && (!expected || hit === expected)) return hit;
    }
  }
  return null;
}

/** Recover the pre-turn state when the driver has already published this turn. */
export function pllChainBeforeMove(facelets: string, move: string): string | undefined {
  try {
    const turns = parseMoves(move.replace(/2'$/, '2'));
    if (turns.length !== 1) return undefined;
    const turn = turns[0];
    const inverse = Math.floor(turn / 3) * 3 + (2 - turn % 3);
    return cubieToFacelet(applyMove(faceletToCubie(facelets), inverse));
  } catch { return undefined; }
}

/** Only the recognition boundary. The existing timer owns clocks and move recording. */
export class PllChainAttempt {
  readonly order: readonly string[];
  private effect = solvedCubie();
  private physical: CubieCube | null;
  private boundaries: Array<{ caseId: string; endMove: number }> = [];
  private moveCount = 0;
  private trusted = true;

  constructor(order: readonly string[], initialFacelets?: string) {
    this.order = [...order];
    this.physical = initialFacelets ? faceletToCubie(initialFacelets) : null;
  }
  get completed(): number { return this.boundaries.length; }
  get verified(): boolean { return this.trusted; }
  get done(): boolean { return this.completed === this.order.length; }
  interrupt(): void { this.trusted = false; }

  move(move: string, facelets?: string | null): boolean {
    if (this.done || !this.trusted) return false;
    let parsed: number[];
    try { parsed = parseMoves(move.replace(/2'$/, '2')); }
    catch { this.interrupt(); return false; }
    if (parsed.length !== 1) { this.interrupt(); return false; }
    const nextPhysical = this.physical ? applyMove(this.physical, parsed[0]) : null;
    if (facelets && nextPhysical) {
      try {
        if (!cubieEquals(nextPhysical, faceletToCubie(facelets))) { this.interrupt(); return false; }
      } catch { this.interrupt(); return false; }
    }
    this.physical = nextPhysical;
    this.moveCount++;
    this.effect = applyMove(this.effect, parsed[0]);
    const expected = this.order[this.completed];
    if (!expected || recognizePllOperation(this.effect, expected) !== expected) return false;
    this.boundaries.push({ caseId: expected, endMove: this.moveCount });
    this.effect = solvedCubie();
    return true;
  }

  /** Split times come from the same calibrated stream saved on the normal Solve. */
  result(moves: NonNullable<Solve['moves']>): NonNullable<Solve['pllChain']> {
    return {
      order: [...this.order], verified: this.trusted && this.done,
      splits: this.boundaries.map(boundary => ({ ...boundary, elapsedMs: moves[boundary.endMove - 1]?.ts ?? 0 })),
    };
  }
}
