import { Alg } from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';

let kpuzzlePromise: Promise<KPuzzle> | null = null;
const getCube3 = (): Promise<KPuzzle> => {
  kpuzzlePromise ??= import('cubing/puzzles').then((module) => module.cube3x3x3.kpuzzle());
  return kpuzzlePromise;
};

const loadSolver = () => import('cubing/search')
  .then((module) => module.experimentalSolve3x3x3IgnoringCenters);

let rotationsPromise: Promise<string[]> | null = null;
function rotationAlgs(kpuzzle: KPuzzle): Promise<string[]> {
  rotationsPromise ??= Promise.resolve().then(() => {
    const solved = kpuzzle.defaultPattern();
    const key = (pattern: KPattern) => JSON.stringify(pattern.patternData);
    const seen = new Set<string>([key(solved)]);
    const rotations = [''];
    let frontier = [''];
    for (let depth = 0; depth < 6 && frontier.length; depth++) {
      const next: string[] = [];
      for (const sequence of frontier) {
        for (const rotation of ['x', 'y', 'z']) {
          const candidate = `${sequence} ${rotation}`.trim();
          const patternKey = key(solved.applyAlg(new Alg(candidate)));
          if (seen.has(patternKey)) continue;
          seen.add(patternKey);
          rotations.push(candidate);
          next.push(candidate);
        }
      }
      frontier = next;
    }
    return rotations;
  });
  return rotationsPromise;
}

/** Convert a 3x3 setup containing rotations, wide turns, or slices to equivalent plain HTM. */
export async function equivalentClean333Scramble(setupAlg: string): Promise<string> {
  const kpuzzle = await getCube3();
  const solved = kpuzzle.defaultPattern();
  let alg: Alg;
  try {
    alg = new Alg(setupAlg);
  } catch {
    return '';
  }

  const centersKey = (pattern: KPattern) => JSON.stringify(pattern.patternData.CENTERS);
  const solvedCentersKey = centersKey(solved);
  let oriented: KPattern | null = null;
  for (const rotation of await rotationAlgs(kpuzzle)) {
    const base = rotation ? solved.applyAlg(new Alg(rotation)) : solved;
    const candidate = base.applyAlg(alg);
    if (centersKey(candidate) === solvedCentersKey) {
      oriented = candidate;
      break;
    }
  }
  if (!oriented || oriented.isIdentical(solved)) return '';

  const solve = await loadSolver();
  return (await solve(oriented)).invert().toString().replace(/2'/g, '2');
}
