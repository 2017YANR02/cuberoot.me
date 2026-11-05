import { Alg } from 'cubing/alg';
import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { LBL_STEPS } from './content';

const examples = LBL_STEPS.find(step => step.id === 'yellow-cross')!.examples;
const topTurns = ['', 'U', 'U2', "U'"];
const edgeIndices = [1, 3, 5, 7];
const expand = (alg: string) => new Alg(alg).expand().toString();
const movesOf = (alg: string) => expand(alg).split(/\s+/).filter(Boolean);

function cubeAfter(alg: string) {
  const cube = new CubeData(3, Object.fromEntries(AllFaces.map(face => [face, Array(9).fill(face)])));
  for (const turn of parseAlgorithm(expand(alg))) cube.turn(turn);
  return cube;
}

/** Only the four U edges determine this lesson's case, regardless of corners. */
export function yellowCrossPattern(alg: string): string {
  const cube = cubeAfter(alg);
  return edgeIndices.map(i => cube.faces[Face.U][i] === Face.U ? '1' : '0').join('');
}

/** Home IDs of the yellow stickers currently visible in the top cross. */
export function yellowCrossRecognitionStickers(alg: string): string[] {
  const cube = new CubeData(3, Object.fromEntries(AllFaces.map(face =>
    [face, Array.from({ length: 9 }, (_, index) => `${Face[face]}${index}`)])));
  for (const turn of parseAlgorithm(expand(alg))) cube.turn(turn);
  return [1, 3, 4, 5, 7].map(index => cube.faces[Face.U][index]).filter(id => id.startsWith('U'));
}

// Keep two distinct orientations of each two-edge case.
const allSetups = [...new Map(examples.flatMap(example => {
  const setup = resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false);
  return topTurns.map(turn => {
    const alg = expand(`${setup} ${turn}`);
    return [yellowCrossPattern(alg), alg] as const;
  });
})).values()];
const isLine = (pattern: string) => pattern === '1001' || pattern === '0110';
let elbows = 0;
const selectedSetups = allSetups.filter(setup => {
  const pattern = yellowCrossPattern(setup);
  return pattern === '0000' || isLine(pattern) || elbows++ < 2;
});
// A second legal dot state takes the line algorithm first instead of the L-shape algorithm.
const LINE_FIRST_DOT_SETUP = expand(`${allSetups.find(setup => yellowCrossPattern(setup) === '0000')!} U`);
export const YELLOW_CROSS_DEMO_SETUPS = [...selectedSetups, LINE_FIRST_DOT_SETUP];

export type YellowCrossCase = 'dot' | 'line' | 'elbow';
export type YellowCrossPhase = {
  kind: YellowCrossCase;
  actionKind: 'line' | 'elbow';
  alignment: boolean;
  start: number;
  end: number;
  alg: string;
};

export function buildYellowCrossDemo(setup: string) {
  const phases: YellowCrossPhase[] = [];
  const moves: string[] = [];
  // Removing the existing examples' leading U leaves their taught action.
  const actions = examples.map((example, i) => movesOf(example.alg).slice(i < 2 ? 1 : 0).join(' '));
  const expected = actions.map(action => yellowCrossPattern(new Alg(action).invert().toString()));
  let pattern = yellowCrossPattern(setup);
  for (let round = 0; pattern !== '1111' && round < 2; round++) {
    const yellow = edgeIndices.filter((_, i) => pattern[i] === '1');
    const kind: YellowCrossCase = yellow.length === 0 ? 'dot'
      : yellow.length === 2 && yellow[0] + yellow[1] === 8 ? 'line' : 'elbow';
    const index = kind === 'dot' ? (expand(setup) === LINE_FIRST_DOT_SETUP ? 0 : 1) : kind === 'line' ? 0 : 1;
    const turn = kind === 'dot' ? '' : topTurns.find(turn =>
      yellowCrossPattern(`${setup} ${moves.join(' ')} ${turn}`) === expected[index]);
    if (turn === undefined) throw new Error('Invalid yellow-cross demonstration state');
    const append = (alg: string, alignment: boolean) => {
      const start = moves.length;
      moves.push(...movesOf(alg));
      phases.push({ kind, actionKind: index === 0 ? 'line' : 'elbow', alignment, start, end: moves.length, alg });
    };
    if (turn) append(turn, true);
    append(actions[index], false);
    pattern = yellowCrossPattern(`${setup} ${moves.join(' ')}`);
  }
  if (pattern !== '1111') throw new Error('Yellow-cross demonstration did not reach its goal');
  return { setup, alg: moves.join(' '), phases };
}
