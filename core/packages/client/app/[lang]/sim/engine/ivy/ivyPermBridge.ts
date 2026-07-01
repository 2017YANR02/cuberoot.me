/**
 * ivyPermBridge — group-theory kernel for the Ivy cube via the permutation backbone.
 * The PG polytope compiler can't represent it (only 4 of the 8 corners turn — tetrahedral,
 * not a symmetric cube cut), so the group is lifted straight from the /sim IvyCube discrete
 * state model (pivotAtFace[6] + cornerTwist[4]): |G| = 6!/2 · 3^4 = 29,160.
 *
 * Notation follows the /sim STANDARD convention (bare letter = ONE base 120° twist, primed =
 * its inverse = the base turn twice) — intentionally the OPPOSITE of lib/ivy-solver's cstimer
 * notation. Kept in sync with IvyTwister.parseIvyMoves / IvyCube.pickMove.
 */
import { MOVE_CENTERS } from '@/lib/ivy-solver';
import { permFromLayout, type PermBridge, type PermOrbit } from '../permBridge';

export interface IvyMove { axis: number; times: number; name: string; }

const AXIS_LETTER = 'RLDB';
const TOKEN_RE = /^([RLDB])('?)$/i;

const orbits: PermOrbit[] = [
  { name: 'CENTERS', pieces: 6, oriMod: 1 },
  { name: 'CORNERS', pieces: 4, oriMod: 3, permutes: false },
];

/** Generator = ONE base 120° turn of an axis, read off a fresh solved model. */
function baseTurnPerm(axis: number): number[] {
  const pivotAtFace = [0, 1, 2, 3, 4, 5];
  const cornerTwist = [0, 0, 0, 0];
  const [fa, fb, fd] = MOVE_CENTERS[axis];
  const oa = pivotAtFace[fa], ob = pivotAtFace[fb], od = pivotAtFace[fd];
  pivotAtFace[fb] = oa; pivotAtFace[fd] = ob; pivotAtFace[fa] = od;
  cornerTwist[axis] = (cornerTwist[axis] + 1) % 3;
  return permFromLayout(orbits, (k) =>
    k === 0 ? { slotPiece: pivotAtFace } : { slotPiece: [0, 1, 2, 3], slotOri: cornerTwist });
}

export const ivyPermBridge: PermBridge<IvyMove> = {
  key: 'ivy',
  orbits,
  moveNames: ['R', 'L', 'D', 'B'],
  genPerms: () => [0, 1, 2, 3].map(baseTurnPerm),
  moveToStep: (m) => ({ gi: m.axis, inv: m.times === 2 }),
  stepToMove: (s) => ({ axis: s.gi, times: s.inv ? 2 : 1, name: AXIS_LETTER[s.gi] + (s.inv ? "'" : '') }),
  parse(text) {
    const out: IvyMove[] = [];
    for (const tok of text.trim().split(/\s+/)) {
      if (!tok) continue;
      const m = TOKEN_RE.exec(tok);
      if (!m) throw new Error(`bad: ${tok}`);
      const axis = AXIS_LETTER.indexOf(m[1].toUpperCase());
      const primed = !!m[2];
      out.push({ axis, times: primed ? 2 : 1, name: AXIS_LETTER[axis] + (primed ? "'" : '') });
    }
    return out;
  },
  toString: (moves) => moves.map((m) => m.name).join(' '),
  solvable: true,
};
