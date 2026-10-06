import { expect, test } from 'vitest';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simulateNxN } from '@cuberoot/shared/nnn-sim';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { cubieToFacelet } from '@cuberoot/shared/cube-facelet';
import { solvedCubie, applySequence, parseMoves } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { hasNoAdjacentColors, isNoBarScramble } from '../src/no_bar';
import { buildNoBar } from '../src/build_no_bar';

const data = JSON.parse(await readFile(new URL('../../../../stats/scramble/no_bar.json', import.meta.url), 'utf8'));

test('adjacency includes centres, excludes diagonals and does not cross face boundaries', () => {
  const checkerboard = Uint8Array.from({ length: 54 }, (_, i) => (i % 9) % 2);
  expect(hasNoAdjacentColors(checkerboard, 3)).toBe(true);
  checkerboard[4] = checkerboard[1];
  expect(hasNoAdjacentColors(checkerboard, 3)).toBe(false);
  expect(isNoBarScramble("R R'", 3)).toBe(false);
  expect(() => isNoBarScramble('R invalid', 3)).toThrow();
  expect(() => isNoBarScramble('', 3)).toThrow();
});

test('all committed 3x3 matches replay with an independent cubie model and original wide moves', () => {
  let total = 0, matches = 0;
  for (const [event, bucket] of Object.entries(data.events) as [string, { total: number; matches: number; examples: { scramble: string }[] }][]) {
    if (event === '222') continue;
    total += bucket.total;
    matches += bucket.matches;
    expect(bucket.examples.length).toBe(bucket.matches);
    for (const { scramble } of bucket.examples) {
      const normalized = normalizeWcaScramble(scramble)!;
      const state = applySequence(solvedCubie(), parseMoves(normalized));
      const facelets = cubieToFacelet(state);
      // Independent explicit edge list, rather than the production grid traversal.
      const pairs = [[0,1],[1,2],[3,4],[4,5],[6,7],[7,8],[0,3],[3,6],[1,4],[4,7],[2,5],[5,8]];
      let equal = 0;
      for (let face = 0; face < 6; face++) for (const [a, b] of pairs) {
        if (facelets[face * 9 + a] === facelets[face * 9 + b]) equal++;
      }
      expect(equal, scramble).toBe(0);
      expect(isNoBarScramble(scramble, 3)).toBe(true);
      // Direct raw wide turns independently check the normalization boundary.
      expect(hasNoAdjacentColors(simulateNxN(3, scramble), 3), scramble).toBe(true);
    }
  }
  expect({ total, matches }).toEqual(data.three);
});

test('existing 2x2 classifier agrees with sticker simulation, including negatives', () => {
  const examples = data.events['222'].examples.map((row: { scramble: string }) => row.scramble);
  for (const scramble of ['R', 'R U F', ...examples]) {
    expect(isNoBarScramble(scramble, 2)).toBe(hasNoAdjacentColors(simulateNxN(2, scramble), 2));
  }
  for (const scramble of examples) expect(isNoBarScramble(scramble, 2)).toBe(true);
  expect(isNoBarScramble('R', 2)).toBe(false);
});

test('export intake counts repeated occurrences, extra scrambles and each multi-blind cube', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'no-bar-'));
  const file = join(dir, 'Scrambles.tsv');
  const match = data.events['333'].examples[0].scramble;
  const header = 'id\tscramble\tcompetition_id\tevent_id\tgroup_id\tis_extra\tround_type_id\tscramble_num\n';
  const row = (id: number, event: string, scramble: string, extra = 0) => `${id}\t${scramble}\tTest2026\t${event}\tA\t${extra}\t1\t1\n`;
  await writeFile(file, header + row(1, '333', match) + row(2, '333', match, 1) + row(3, '333mbf', `R\\n${match}|R`));
  const result = await buildNoBar(file, 'fixture');
  expect(result.three).toEqual({ total: 5, matches: 3 });
  expect(result.events['333'].examples[1].extra).toBe(true);
  expect(result.events['333mbf'].examples[0]).toMatchObject({ id: '3002', cube: 2, scramble: match });
  await writeFile(file, header + row(1, '333', match) + row(1, '333', match));
  await expect(buildNoBar(file, 'fixture')).rejects.toThrow('Duplicate');
  await writeFile(file, header + row(1, '333', 'R invalid'));
  await expect(buildNoBar(file, 'fixture')).rejects.toThrow('Invalid');
});
