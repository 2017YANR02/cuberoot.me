import { describe, it, expect, beforeAll } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { deriveScrambleFromSolution } from '@/lib/scramble-from-solution';
import { cleanForPlayer } from '@/lib/recon-alg-utils';

let kpuzzle: KPuzzle;
let solved: KPattern;
let rotationKeys: Set<string>;

const key = (p: KPattern) => JSON.stringify(p.patternData);

beforeAll(async () => {
  kpuzzle = await cube3x3x3.kpuzzle();
  solved = kpuzzle.defaultPattern();
  // All 24 whole-cube rotation patterns — "solved" means solved up to one of these.
  rotationKeys = new Set([key(solved)]);
  let frontier = [''];
  for (let d = 0; d < 6 && frontier.length; d++) {
    const next: string[] = [];
    for (const seq of frontier) {
      for (const g of ['x', 'y', 'z']) {
        const ns = (seq ? seq + ' ' : '') + g;
        const k = key(solved.applyAlg(new Alg(ns)));
        if (!rotationKeys.has(k)) { rotationKeys.add(k); next.push(ns); }
      }
    }
    frontier = next;
  }
});

/** scramble + cleaned solution should return to solved up to a whole-cube rotation. */
function solvesUpToRotation(scramble: string, solution: string): boolean {
  const cleaned = cleanForPlayer(solution).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const result = solved.applyAlg(new Alg(scramble)).applyAlg(new Alg(cleaned));
  return rotationKeys.has(key(result));
}

const FIXTURES: { name: string; solution: string }[] = [
  {
    name: 'CFOP recon with inspection + mid-solve rotations + wide moves',
    solution: `x' z' // insp
↑ L L' l D L U R' F R' // W xcross
y' U' R U' R' L U2 L' // OG
UD R U' R' D' // BO
R U2' R' U R U' R' // BR (2.718)
U2' R U R' U F' U F U' F2 r U r' F U // ZBLL-H (0.984)`,
  },
  {
    name: 'M-slice heavy (sune + H-perm)',
    solution: `R U R' U' R' F R2 U' R' U' R U R' F' // sune
M2 U M2 U2 M2 U M2 // H perm`,
  },
  {
    name: 'U-perm with M slices',
    solution: `F R U R' U' F' // edges
M2 U M U2 M' U M2 // U perm`,
  },
  {
    name: 'plain face moves, no rotations',
    solution: 'R U R\' U2 R U\' R\' U R U\' R\'',
  },
];

describe('deriveScrambleFromSolution', () => {
  it.each(FIXTURES)('derives a valid scramble: $name', async ({ solution }) => {
    const scramble = await deriveScrambleFromSolution(solution);
    expect(scramble.length).toBeGreaterThan(0);
    // No rotations / slices — a clean WCA-style face-move scramble.
    expect(scramble).not.toMatch(/[xyzMES]/);
    expect(solvesUpToRotation(scramble, solution)).toBe(true);
  });

  it('returns empty for blank / comment-only input', async () => {
    expect(await deriveScrambleFromSolution('')).toBe('');
    expect(await deriveScrambleFromSolution('   \n  ')).toBe('');
    expect(await deriveScrambleFromSolution('// just a comment')).toBe('');
  });

  it('returns empty when the solution nets to solved (identity)', async () => {
    expect(await deriveScrambleFromSolution("R R'")).toBe('');
    expect(await deriveScrambleFromSolution('x y z')).toBe(''); // pure rotation → no scramble
  });
});
