#!/usr/bin/env node
// Full H10 search validation. Run only through guard.mts, backend=h10.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { shallowCorpus, replay } from './validate.mjs';
import { loadCases } from './benchmark.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
async function main() {
  assert.equal(process.env.CUBEOPT_BACKEND, 'h10');
  assert.equal(process.argv.length, 6, 'validate-h10.mjs NATIVE C_NATIVE H10 NEW_OUT');
  const [native, reference, table, out] = process.argv.slice(2).map(p => path.resolve(p));
  assert(!existsSync(out), 'output already exists; retain previous evidence');
  assert.equal(statSync(table).size, 30336314216);
  mkdirSync(out, { recursive: true });
  const { cube3x3x3 } = await import(pathToFileURL(path.join(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  const puzzle = await cube3x3x3.kpuzzle();
  const { cases: shallow, counts } = shallowCorpus(puzzle);
  const historical = loadCases(null, true);
  const cases = [...shallow, ...historical];
  save(path.join(out, 'input.json'), { native, reference, table, nativeSha256: hash(native), referenceSha256: hash(reference), tableStat: statSync(table), cases, bfsCounts: counts });
  const results = [];
  for (const [engine, contexts] of [['rust', 1], ['rust', 8], ['original-c', 1]]) {
    const binary = engine === 'rust' ? native : reference;
    const args = engine === 'rust' ? ['solve-h10', table, String(contexts), '20', '0'] : ['--benchmark', table, 'unused', '1'];
    const name = `${engine}-${contexts}`;
    const input = cases.map(c => `${c.id}${engine === 'rust' ? '\t' : ','}${c.scramble}\n`).join('');
    const started = performance.now();
    // Direct file descriptors retain complete lines even if the outer guard
    // must terminate both this validator and its current solver together.
    const outputPath = path.join(out, name + '.jsonl');
    const errorPath = path.join(out, name + '.stderr');
    const outputFd = openSync(outputPath, 'wx'), errorFd = openSync(errorPath, 'wx');
    let run;
    try {
      run = spawnSync(binary, args, { input, encoding: 'utf8', stdio: ['pipe', outputFd, errorFd], timeout: 15 * 60_000 });
    } finally { closeSync(outputFd); closeSync(errorFd); }
    assert(!run.error, run.error?.message);
    assert.equal(run.signal, null);
    assert.equal(run.status, 0, readFileSync(errorPath, 'utf8'));
    const rows = readFileSync(outputPath, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(rows.length, cases.length);
    for (let i = 0; i < cases.length; i++) {
      assert.equal(rows[i].id, cases[i].id);
      if (engine === 'rust') {
        assert.equal(rows[i].cancelled, false);
        assert.equal(rows[i].contexts, contexts);
      } else {
        assert.equal(rows[i].mode, 'original');
        assert.equal(rows[i].run, 0);
        assert.equal(rows[i].verified, true);
      }
      replay(puzzle, cases[i], rows[i]);
    }
    results.push({ engine, contexts, count: rows.length, secondsIncludingStartup: (performance.now() - started) / 1000, searchSeconds: rows.reduce((n, row) => n + row.seconds, 0) });
    console.log(JSON.stringify(results.at(-1)));
  }
  const report = { schema: 'cuberoot.rust-h10.validation.v1', bfsCounts: counts, historical: historical.length, verifiedSolutions: cases.length * 3, results, limitations: ['Known finite cases, not a proof over the complete cube group.', 'Validation timing includes loading and is not the benchmark.', 'No global node-counter equivalence is assumed.'] };
  save(path.join(out, 'report.json'), report);
  return report;
}
main().then(value => console.log(JSON.stringify(value)), error => { console.error(error); process.exitCode = 1; });
