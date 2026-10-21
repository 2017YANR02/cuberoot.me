import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { loadOptimal333, loadOptimal333ByText } from '../src/optimal333.mts';
import { parseSolvedSamples, PUZZLE_BINARIES } from '../build_length_opt.mjs';

it('reuses completed solves by canonical text, including a later solved ID for the same text', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'length-opt-'));
  try {
    const corpus = join(dir, 'corpus.txt');
    const csv = join(dir, 'out.csv');
    await writeFile(corpus, "unsolved,R1 U3\nsolved,R U'\nduplicate-text,R U'\nhalf,R2 U2\nunwanted,F\n");
    // This sequence solves R U'; the displayed equivalent scramble is its inverse.
    await writeFile(csv, "unwanted,1,F'\nsolved,2,U R'\nduplicate-text,2,U R'\nhalf,2,U2 R2\n");
    const texts = ["R U'", ' R1  U3 ', 'R2 U2', 'L'];
    expect(await loadOptimal333ByText(corpus, csv, texts)).toEqual(new Map([
      ["R U'", "R U'"], [' R1  U3 ', "R U'"], ['R2 U2', 'R2 U2'],
    ]));
    expect(await loadOptimal333(csv, new Set(['solved']))).toEqual(new Map([
      ['solved', { htm: 2, scr: "R U'" }],
    ]));
    expect(await loadOptimal333ByText(join(dir, 'absent'), csv, texts)).toEqual(new Map());
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('rejects truncated, duplicate or inconsistent completed solve records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'length-opt-invalid-'));
  try {
    const csv = join(dir, 'out.csv');
    for (const body of ["a,1,R'", "a,1,R'\na,1,R'\n", "a,2,R'\n", 'a,1,-\n']) {
      await writeFile(csv, body);
      await expect(loadOptimal333(csv, new Set(['a']))).rejects.toThrow();
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('uses the real 222 executable and requires complete native CSV results, including zero moves and tips', () => {
  expect(PUZZLE_BINARIES['222']).toBe('cube222_analyzer');
  expect(parseSolvedSamples("id,222,soln\n1,0,\n0,2,U' R'\n", ['R U', "R R'"], '222'))
    .toEqual(new Map([["R R'", ''], ['R U', 'R U']]));
  expect(parseSolvedSamples("id,pyraminx,soln\n0,2,r' U'\n", ['U r'], 'pyraminx'))
    .toEqual(new Map([['U r', 'U r']]));
  expect(parseSolvedSamples("0,2,U' R'\n", ['R U'])).toEqual(new Map([['R U', 'R U']]));
  expect(parseSolvedSamples('id,222,soln\n0,2,U2 R2\n', ['R2 U2'], '222'))
    .toEqual(new Map([['R2 U2', 'R2 U2']]));
  for (const body of [
    'id,222\n0,2\n', 'id,222,soln\n', "id,222,soln\n0,2,R'\n",
    "id,222,soln\n0,1,R'", "id,222,soln\n0,1,R'\n0,1,R'\n",
    'id,222,soln\n0,-,\n', "id,222,soln\n1,1,R'\n",
  ]) expect(() => parseSolvedSamples(body, ['R'], '222')).toThrow();
});
