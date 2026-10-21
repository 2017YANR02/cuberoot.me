import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { loadOptimalFaceResults, loadOptimalFaceResultsByText } from '../src/optimal-face-results.mts';
import { buildLengthOpt, parseSolvedSamples, PUZZLE_BINARIES } from '../build_length_opt.mjs';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn(() => { throw new Error('Solver must not start in cached-only fixtures'); }) }));

it('reuses completed solves by canonical text, including a later solved ID for the same text', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'length-opt-'));
  try {
    const corpus = join(dir, 'corpus.txt');
    const csv = join(dir, 'out.csv');
    await writeFile(corpus, "unsolved,R1 U3\nsolved,R U'\nduplicate-text,R U'\nhalf,R2 U2\nunwanted,F\n");
    // This sequence solves R U'; the displayed equivalent scramble is its inverse.
    await writeFile(csv, "unwanted,1,F'\nsolved,2,U R'\nduplicate-text,2,U R'\nhalf,2,U2 R2\n");
    const texts = ["R U'", ' R1  U3 ', 'R2 U2', 'L'];
    expect(await loadOptimalFaceResultsByText(corpus, csv, texts)).toEqual(new Map([
      ["R U'", "R U'"], [' R1  U3 ', "R U'"], ['R2 U2', 'R2 U2'],
    ]));
    expect(await loadOptimalFaceResults(csv, new Set(['solved']))).toEqual(new Map([
      ['solved', { htm: 2, scr: "R U'" }],
    ]));
    expect(await loadOptimalFaceResultsByText(join(dir, 'absent'), csv, texts)).toEqual(new Map());
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('rejects truncated, duplicate or inconsistent completed solve records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'length-opt-invalid-'));
  try {
    const csv = join(dir, 'out.csv');
    for (const body of ["a,1,R'", "a,1,R'\na,1,R'\n", "a,2,R'\n", 'a,1,-\n']) {
      await writeFile(csv, body);
      await expect(loadOptimalFaceResults(csv, new Set(['a']))).rejects.toThrow();
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('cached-only joins 222 CSV without starting a solver and preserves the old overlay on any missing sample', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'length-opt-cached-'));
  try {
    const options = { cachedOnly: true, examplesFile: join(dir, 'examples.json'), outputFile: join(dir, 'overlay.json'),
      faceCorpus: join(dir, 'corpus.txt'), faceResults: join(dir, 'out.csv'), puzzleRoot: dir };
    const sample = (text: string) => ['Test2026', 'f', 'A', 1, text];
    await mkdir(join(dir, '222'));
    await writeFile(join(dir, '222/scrambles.txt'), 'unsolved,R1 U2\nsolved,R U2\n');
    await writeFile(join(dir, '222/222.csv'), "id,222,soln\nsolved,2,U2 R'\n");
    await writeFile(options.faceCorpus, 'face,F2\n');
    await writeFile(options.faceResults, 'face,1,F2\n');
    const old = JSON.stringify({ meta: { generated_at: 'before' }, byText: { 'B U': 'B U' } });
    await writeFile(options.outputFile, old);
    await writeFile(options.examplesFile, JSON.stringify({ events: { '222': { 2: [sample('R U2')] }, '333': { 2: [sample('B U')] } } }));
    await buildLengthOpt(options);
    expect(JSON.parse(await readFile(options.outputFile, 'utf8')).byText).toEqual({ 'B U': 'B U', 'R U2': 'R U2' });
    expect(spawnSync).not.toHaveBeenCalled();

    for (const event of ['333', '222', 'pyram', 'skewb']) {
      await writeFile(options.outputFile, old);
      // F2 can be merged in memory first; a later missing puzzle must still
      // leave the complete previous file byte-for-byte unchanged.
      const events: Record<string, object> = { '333': { 1: [sample('F2')] } };
      events[event] = { 1: [sample('L')] };
      await writeFile(options.examplesFile, JSON.stringify({ events }));
      await expect(buildLengthOpt(options)).rejects.toThrow('cached-only');
      expect(await readFile(options.outputFile, 'utf8')).toBe(old);
      expect(spawnSync).not.toHaveBeenCalled();
    }
    await writeFile(join(dir, '222/222.csv'), "id,222\nsolved,2\n");
    await expect(loadOptimalFaceResults(join(dir, '222/222.csv'), new Set(['solved']), '222')).rejects.toThrow('header');
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
