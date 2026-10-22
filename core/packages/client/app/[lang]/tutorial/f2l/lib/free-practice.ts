import { Alg } from 'cubing/alg';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { FM_IGNORED, FM_REGULAR } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { buildFaceletMap } from '@/components/sim-embed/faceletMap';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import { F2L_CASES } from '../data/basic-cases';
import { f2lCatalogCases, f2lTeachingPaths } from './curriculum';

export const FREE_CORNER_POSITIONS = [26, 24, 6, 8, 20] as const;
export const FREE_EDGE_POSITIONS = [25, 15, 7, 17, 23] as const;
export interface FreePlacement {
  corner: { position: number; orientation: number };
  edge: { position: number; orientation: number };
}
export interface FreePracticeCase {
  name: string | null;
  setup: string;
  alg: string;
  placement: FreePlacement;
}

const facelets = buildFaceletMap(3);
export const SOLVED_FREE_PLACEMENT: FreePlacement = {
  corner: { position: 20, orientation: 2 },
  edge: { position: 23, orientation: 1 },
};
export const freePlacementKey = ({ corner, edge }: FreePlacement) =>
  `${corner.position}.${corner.orientation}/${edge.position}.${edge.orientation}`;

/** Positions are geometric cubelet indices; orientations follow URFDLB sticker order. */
export function readFreePlacement(cube: Cube): FreePlacement {
  const state = cube.serialize();
  const piece = (identity: number, primary: string) => {
    const shown = cube.serializeStickering(initial => initial === identity ? FM_REGULAR : FM_IGNORED);
    const indices = [...shown].flatMap((value, index) => value === FM_REGULAR ? [index] : []);
    const orientation = indices.findIndex(index => state[index] === primary);
    if (orientation < 0) throw new Error('Missing F2L target sticker');
    return { position: facelets[indices[0]].cube, orientation };
  };
  return { corner: piece(20, 'D'), edge: piece(23, 'F') };
}

/** Invalid slots and fixed centers/cross edges do nothing. */
export function placeFreePiece(current: FreePlacement, position: number): FreePlacement {
  const kind = FREE_CORNER_POSITIONS.some(index => index === position) ? 'corner'
    : FREE_EDGE_POSITIONS.some(index => index === position) ? 'edge' : null;
  if (!kind) return current;
  const count = kind === 'corner' ? 3 : 2;
  return { ...current, [kind]: {
    position,
    orientation: current[kind].position === position ? (current[kind].orientation + 1) % count : 0,
  } };
}

/**
 * Tutorial-specific table: only the teacher's frozen FR algorithms, never the
 * recon lookup's live DB alternatives or advanced/non-FR solutions.
 * Hidden pieces come from a real captured setup rather than hand-painted stickers.
 */
export function buildFreePracticeCases(): Map<string, FreePracticeCase> {
  const table = new Map<string, FreePracticeCase>();
  const cube = new Cube(3);
  try {
    const add = (name: string | null, setup: string, alg: string) => {
      cube.twister.setup(setup);
      const placement = readFreePlacement(cube);
      const key = freePlacementKey(placement);
      if (table.has(key)) return;
      // Reverse the teaching solution itself, rather than making the learner
      // execute the snapshot's original (possibly wide-move) reference setup.
      // Leading regrips compensate solutions that finish in a rotated frame.
      let scramble = '';
      if (alg) {
        const inverse = new Alg(alg).invert().expand().toString();
        const prefix = CUBE_ORIENTATIONS.find(orientation => {
          cube.twister.setup([orientation.value, inverse].filter(Boolean).join(' '));
          const state = cube.serialize();
          return [4, 13, 22, 31, 40, 49].map(index => state[index]).join('') === 'URFDLB'
            && freePlacementKey(readFreePlacement(cube)) === key;
        });
        if (!prefix) throw new Error(`Could not build the FR practice scramble for ${name}`);
        scramble = [prefix.value, inverse].filter(Boolean).join(' ');
      }
      table.set(key, { name, setup: scramble, alg, placement });
    };
    add(null, '', '');
    const sources = [
      ...F2L_CASES.map(c => ({ name: c.name, setup: new Alg(c.alg).invert().expand().toString(), alg: `(${new Alg(c.alg).expand()})` })),
      ...f2lTeachingPaths(f2lCatalogCases()),
    ];
    for (const source of sources) for (const adjustment of ['', 'U', 'U2', "U'"]) {
      const undo = new Alg(adjustment).invert().toString();
      add(source.name, [source.setup, adjustment].filter(Boolean).join(' '),
        [undo ? `(${undo})` : '', source.alg].filter(Boolean).join(' '));
    }
  } finally { cube.dispose(); }
  return table;
}
