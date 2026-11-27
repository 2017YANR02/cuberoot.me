import { AllFaces } from '@cuberoot/visualcube';
import { orientationForBottomFace, orientedFaceColors } from '@cuberoot/shared/timer';
import type { Cube222TimerHintLine } from '@cuberoot/puzzle-solvers/cube222';
import { simplifyAlg } from '@cuberoot/shared/recon/cube3';
import { twoByTwoState } from '../lib/2x2-state';
import { EG_RECOGNITION_CASES, egBottomRows, egMoves, egTopKey, invertEg, type EgCase, type EgSet } from './lesson-data';

export const EG_SCRAMBLE_ORIENTATION = ''; // White up, green front.
const faceNames = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const topTurns = ['', 'U', 'U2', "U'"];
const bodyTurns = ['', 'y', 'y2', "y'"];

export type EgWalkthrough = {
  start: string;
  face: string;
  hold: string;
  regrip: string;
  align: string;
  finish: string;
  entry: EgCase;
};

/** Relabel the fixed scramble frame for the case catalog, where the selected bottom is white. */
export function inTeachingColors(moves: string, orientation: string) {
  return egMoves(invertEg(orientation), moves);
}

function buildEgWalkthrough(start: string, face: string, orientation: string): EgWalkthrough {
  const afterFace = inTeachingColors(egMoves(start, face), orientation);
  const state = twoByTwoState(afterFace);
  const white = AllFaces.find(side => state[side].every(sticker => sticker === 'W'));
  if (white === undefined) throw new Error('EG walkthrough: missing white face');
  const hold = orientationForBottomFace(faceNames[white]);
  const bottom = egMoves(afterFace, hold);
  const countBars = egBottomRows(bottom).filter(row => row[0] === row[1]).length;
  const set: EgSet = countBars === 4 ? 'cll' : countBars === 1 ? 'eg1' : 'eg2';
  const regrip = set === 'eg1' ? bodyTurns.find(turn => {
    const back = egBottomRows(egMoves(bottom, turn))[2];
    return back[0] === back[1];
  })! : '';

  const entries = new Map(EG_RECOGNITION_CASES.filter(entry => entry.set === set)
    .map(entry => [egTopKey(entry.setup), entry]));
  let best: EgWalkthrough | undefined;
  let fewestAdjustments = Infinity;
  for (const align of topTurns) {
    const aligned = egMoves(bottom, regrip, align);
    const entry = entries.get(egTopKey(aligned));
    if (!entry) continue;
    const finish = topTurns.find(turn => {
      const final = twoByTwoState(egMoves(aligned, entry.alg, turn));
      return AllFaces.every(side => final[side].every(sticker => sticker === final[side][0]));
    });
    if (finish === undefined) continue;
    const adjustments = Number(Boolean(align)) + Number(Boolean(finish));
    if (adjustments < fewestAdjustments) {
      best = { start, face, hold, regrip, align, finish, entry };
      fewestAdjustments = adjustments;
    }
  }
  if (!best) throw new Error('EG walkthrough: no matching finish');
  return best;
}

type EgWalkthroughScramble = { start: string; faces: readonly Cube222TimerHintLine[] };

// Keep the first render deterministic and supply the default white route before loading the solver.
export const EG_WALKTHROUGH: EgWalkthroughScramble = {
  start: "U2 R U' F U' R2 U' R2 F2 R U'",
  faces: [{ face: 'U', moves: ['U', "R'", 'F2', 'U'] }],
};

export function planEgWalkthrough({ start, faces }: EgWalkthroughScramble, orientation: string) {
  const target = orientedFaceColors(orientation).D;
  const hint = faces.find(({ face }) => face === target);
  return hint ? buildEgWalkthrough(start, simplifyAlg(hint.moves.join(' ')), orientation) : null;
}

export async function loadEgWalkthrough(start: string): Promise<EgWalkthroughScramble> {
  const { solve222TimerHints } = await import('@cuberoot/puzzle-solvers/cube222');
  return { start, faces: solve222TimerHints(start).faces };
}

export async function randomEgWalkthrough(previous: string, rng = Math.random) {
  const { wcaPocketScramble } = await import('@/lib/pocket-scramble');
  let start = wcaPocketScramble(rng);
  if (start === previous) start = wcaPocketScramble(rng);
  return loadEgWalkthrough(start);
}
