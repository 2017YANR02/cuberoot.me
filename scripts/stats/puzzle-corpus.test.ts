import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { puzzleInputFailures, puzzleScrambleFromTsv, repairPuzzleCorpus } from './puzzle-corpus.js';

test('TSV whitespace is decoded once into one solver record without changing moves', () => {
  const scramble = '(-3,-4) / (-2,4) / (0,-3) / (2,-1) / (0,-3) / (3,0) / (4,0) / (-3,-3) / (-1,0) / (-4,0)';
  assert.equal(puzzleScrambleFromTsv(`${scramble}\\n`), scramble);
  assert.equal(puzzleScrambleFromTsv('R\\tU\\nF\r\n'), 'R U F');
  assert.equal(puzzleScrambleFromTsv("R U' F2"), "R U' F2");
  for (const invalid of ['R\\\\nU', 'R\\qU', 'R\\0U', 'R\0U']) assert.throws(() => puzzleScrambleFromTsv(invalid), /Unsupported/);
});

async function fixture() {
  const root = resolve('.tmp/scratch'); await mkdir(root, { recursive: true });
  return mkdtemp(join(root, 'puzzle-corpus-'));
}

test('an evidenced input repair requeues only its parse error, retaining solved rows and timeout records', async () => {
  const dir = await fixture();
  try {
    const corpus = join(dir, 'scrambles.txt'), result = join(dir, 'sq1_wca_exact.csv');
    await writeFile(corpus, '1,(1,0) /\\n\n2,(0,1) /\n3,(2,0) /\n4,(3,0) /\n');
    await writeFile(result, 'id,wca,solution\n1,-\n2,3,solution\n3,M\n4,-\n');
    await repairPuzzleCorpus(corpus, new Map([['1', { before: '(1,0) /\\n', after: '(1,0) /' }]]), [result]);
    assert.equal(await readFile(corpus, 'utf8'), '1,(1,0) /\n2,(0,1) /\n3,(2,0) /\n4,(3,0) /\n');
    assert.equal(await readFile(result, 'utf8'), 'id,wca,solution\n2,3,solution\n3,M\n4,-\n');
    assert.equal(await puzzleInputFailures(result), 1);
    const audit = JSON.parse((await readFile(`${corpus}.input-repairs.jsonl`, 'utf8')).trim());
    assert.equal(audit.id, '1'); assert.equal(audit.before, '(1,0) /\\n');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('real incremental import repairs an already-known TSV escape and is idempotent', async () => {
  const dir = await fixture();
  try {
    const tsv = join(dir, 'wca_scramble/incremental/tsv'), sq1 = join(dir, 'puzzle/sq1');
    await mkdir(tsv, { recursive: true }); await mkdir(sq1, { recursive: true });
    await writeFile(join(tsv, 'Scrambles.tsv'), 'id\tevent_id\tscramble\n5899243\tsq1\t(-4,0)\\n\n2\tsq1\t(1,0) /\\t(0,1)\n3\tsq1\t(2,0) /\n4\t333\tR U\n');
    await writeFile(join(sq1, 'scrambles.txt'), '5899243,(-4,0)\\n\n3,(2,0) /\n');
    await writeFile(join(sq1, 'sq1_wca_exact.csv'), 'id,wca\n5899243,-\n3,2\n');
    const runner = join(dir, 'run.mts');
    await writeFile(runner, `import { extractCorpus } from ${JSON.stringify(resolve('scripts/stats/puzzles.ts'))}; await extractCorpus(['sq1']);`);
    const run = () => promisify(execFile)(resolve('core/node_modules/.bin/tsx'), [runner], { env: { ...process.env, CUBEROOT_DATA_ROOT: dir, CUBEROOT_WCA_DATA_DIR: join(dir, 'wca_scramble'), CUBEROOT_PUZZLE_DATA_DIR: join(dir, 'puzzle') } });
    await run();
    const expected = '5899243,(-4,0)\n3,(2,0) /\n2,(1,0) / (0,1)\n';
    assert.equal(await readFile(join(sq1, 'scrambles.txt'), 'utf8'), expected);
    assert.equal(await readFile(join(sq1, 'sq1_wca_exact.csv'), 'utf8'), 'id,wca\n3,2\n');
    await run();
    assert.equal(await readFile(join(sq1, 'scrambles.txt'), 'utf8'), expected);
    assert.equal((await readFile(join(sq1, 'scrambles.txt.input-repairs.jsonl'), 'utf8')).trim().split('\n').length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
