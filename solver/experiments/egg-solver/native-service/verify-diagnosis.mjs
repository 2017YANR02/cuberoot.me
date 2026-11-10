// Independent replay of diagnostic runs; reads small evidence only, never tables.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {cube3x3x3} from '../../../../core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js';
import {replay} from '../../cube48opt-rust/remote/verify-native-service-benchmark.mjs';
import {readCorpus} from '../../cube48opt-rust/remote/native-service-benchmark.mjs';

const [directory, kind] = process.argv.slice(2);
assert(directory?.startsWith('/') && ['mac', 'cli'].includes(kind));
const root = resolve(import.meta.dirname, '../../../..');
const read = path => JSON.parse(readFileSync(path));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const rows = path => readFileSync(path, 'utf8').trimEnd().split('\n').map(JSON.parse);
const old = resolve(root, '.local-data/egg-h8-aliyun-20261109');
const acceptance = read(resolve(old, 'plan100.json'));
const baselinePath = resolve(old, 'baseline-reused/r1-baseline/results.jsonl');
assert.equal(hash(baselinePath), acceptance.baselineResultsSha256);
const baseline = new Map(rows(baselinePath).map(row => [row.id, row]));
const {corpus} = readCorpus(resolve(root, 'solver/testdata/benchmarks/wca-first100.json'));
const puzzle = await cube3x3x3.kpuzzle();
const result = {kind, verifiedAt: new Date().toISOString(), cases: 100, baselineSha256: hash(baselinePath), engines: {}};
for (const name of kind === 'mac' ? ['egg-cli', 'egg-adapter', 'opt8'] : ['cli']) {
  const file = resolve(directory, kind === 'mac' ? `${name}.results.jsonl` : 'results.jsonl');
  const answers = rows(file); assert.equal(answers.length, 100);
  for (const [i, item] of corpus.cases.entries()) {
    const answer = answers[i]; assert.equal(String(answer.id), String(item.id));
    replay(puzzle, item, answer, baseline.get(item.id).length);
  }
  result.engines[name] = {verifiedSolutions: 100, optimalLengthsMatched: 100, resultsSha256: hash(file)};
}
if (kind === 'mac') {
  const plan = read(resolve(directory, 'plan.json')), report = read(resolve(directory, 'report.json'));
  assert.equal(report.planSha256, hash(resolve(directory, 'plan.json')));
  const resources = read(resolve(root, '.local-data/cubeopt-reverse/egg-h8-mac-wca100-20261109-resources.json'));
  assert.equal(resources.stopped, ''); assert.equal(resources.swapouts, plan.baseline.swapouts);
  assert.equal(resources.boot, plan.baseline.boot); assert.equal(resources.pressure, 1);
  assert(resources.peakRss <= resources.rssLimit && resources.minimumHeadroom >= 2 * 2 ** 30);
  result.memory = {peakRssBytes: resources.peakRss, minimumHeadroomBytes: resources.minimumHeadroom, swapoutsDelta: 0};
  result.speedRatios = {
    originalEggOverOpt8: report.engines.opt8.totalWallSeconds / report.engines['egg-cli'].totalWallSeconds,
    adapterEggOverOpt8: report.engines.opt8.totalWallSeconds / report.engines['egg-adapter'].totalWallSeconds,
    adapterTimeOverOriginal: report.engines['egg-adapter'].totalWallSeconds / report.engines['egg-cli'].totalWallSeconds,
  };
}
result.reportSha256 = hash(resolve(directory, 'report.json'));
writeFileSync(resolve(directory, 'diagnosis-verification.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(result, null, 2));
