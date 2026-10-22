/** Prepare or verify evidence only. Solver execution must use guard.mts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readWca100 } from './wasm-benchmark.mjs';
import { replay } from './remote/verify-native-service-benchmark.mjs';
import { cornerDirectory, cornerExecutable } from './corner-policy.mts';

const here = import.meta.dirname, root = resolve(here, '../../..');
const directory = resolve(cornerDirectory, 'opt8-wca100-v1');
const reference = resolve(root, '.tmp/cubeopt-reverse/opt10-official-wca1000-mt16-20261022/results.jsonl');
const modes = ['baseline', 'u', 'distance', 'combined'];
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const save = (name: string, value: unknown) => writeFileSync(resolve(directory, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const rows = (bytes: Buffer) => {
  assert(bytes.toString().endsWith('\n'), 'Incomplete final result');
  return bytes.toString().trimEnd().split('\n').map(line => JSON.parse(line));
};

const [command] = process.argv.slice(2);
assert.equal(process.argv.length, 3, 'Use prepare or report');
if (command === 'prepare') {
  assert(!existsSync(directory), 'Keep the previous comparison and its single-pass evidence');
  const corpus = readWca100();
  const input = corpus.cases.flatMap((item: {id: string; scramble: string}, index: number) =>
    modes.map((_, offset) => `${modes[(index + offset) % modes.length]}:${item.id}\t${item.scramble}\n`)).join('');
  mkdirSync(directory, {recursive: true});
  writeFileSync(resolve(directory, 'input.tsv'), input, {flag: 'wx'});
  cpSync(resolve(here, 'src'), resolve(directory, 'source/src'), {recursive: true, errorOnExist: true});
  for (const name of ['Cargo.toml', 'Cargo.lock', 'guard.mts', 'corner-policy.mts', 'corner-session.mts', 'corner-benchmark.mts'])
    cpSync(resolve(here, name), resolve(directory, 'source', name), {errorOnExist: true});
  cpSync(cornerExecutable, resolve(directory, 'corner-research'), {errorOnExist: true});
  const resources = ['u-exact.dat', 'full96.dat'].map(name => {
    const path = resolve(cornerDirectory, name), bytes = readFileSync(path);
    return {name, bytes: bytes.length, sha256: sha(bytes)};
  });
  save('input.json', {schema: 'cuberoot.corner96-comparison-input.v1', preparedAt: new Date().toISOString(),
    corpus, modes, threads: 1, contexts: 8, measuredPasses: 1, warmupCases: 0,
    order: 'rotate mode order by case; preserve corpus order within every mode',
    inputSha256: sha(Buffer.from(input)), binarySha256: sha(readFileSync(cornerExecutable)),
    reference, referenceSha256: sha(readFileSync(reference)), resources,
    features: ['corner-research','opt8-native-search','opt8-native-quarter','opt9-native-fixed-contexts','opt8-native-prefetch'],
    note: 'One resident main table; no extra warmup. This is not a cold-cache or production-server benchmark.'});
  console.log(JSON.stringify({directory, cases: 100, modes, passesPerMode: 1}));
} else if (command === 'report') {
  const input = JSON.parse(readFileSync(resolve(directory, 'input.json'), 'utf8'));
  const outputBytes = readFileSync(resolve(directory, 'results.jsonl'));
  const [ready, ...results] = rows(outputBytes);
  assert.equal(ready.kind, 'comparison-ready');
  assert.equal(ready.threads, input.threads); assert.equal(ready.contexts, input.contexts);
  assert.equal(results.length, 400);
  assert.equal(sha(readFileSync(reference)), input.referenceSha256);
  assert.equal(sha(readFileSync(resolve(directory, 'corner-research'))), input.binarySha256);
  assert.equal(sha(readFileSync(resolve(directory, 'input.tsv'))), input.inputSha256);
  for (const resource of input.resources) {
    const bytes = readFileSync(resolve(cornerDirectory, resource.name));
    assert.equal(bytes.length, resource.bytes); assert.equal(sha(bytes), resource.sha256);
  }
  const started = JSON.parse(readFileSync(resolve(root, '.tmp/cubeopt-reverse/corner96-opt8-compare-v1-20261022-started.json'), 'utf8'));
  assert.equal(started.executableSha256, input.binarySha256);
  assert.equal(started.args[0], 'compare-opt8');
  const historical = rows(readFileSync(reference));
  const {cube3x3x3} = await import(pathToFileURL(resolve(root, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  const puzzle = await cube3x3x3.kpuzzle();
  const summaries: Record<string, any> = {};
  for (const mode of modes) {
    const selected = results.filter(row => row.mode === mode);
    assert.equal(selected.length, 100);
    for (const [index, row] of selected.entries()) {
      const item = input.corpus.cases[index], expected = historical[index];
      assert.equal(row.id, `${mode}:${item.id}`); assert.equal(row.case, item.id);
      assert.equal(expected.id, item.id); assert.equal(expected.cancelled, false);
      assert.equal(expected.completed_depth, expected.length > 0 ? expected.length - 1 : null);
      assert.equal(row.pid, ready.pid); assert(Number.isFinite(row.seconds) && row.seconds > 0);
      if (mode === 'baseline') replay(puzzle, item, expected, expected.length);
      replay(puzzle, item, row, expected.length);
    }
    summaries[mode] = {cases: selected.length, seconds: selected.reduce((n, row) => n + row.seconds, 0),
      nodes: selected.reduce((n, row) => n + row.nodes, 0), probes: selected.reduce((n, row) => n + row.probes, 0)};
  }
  for (const value of Object.values(summaries)) {
    value.speedup = summaries.baseline.seconds / value.seconds;
    value.timeChangePercent = 100 * (value.seconds / summaries.baseline.seconds - 1);
    value.nodeChangePercent = 100 * (value.nodes / summaries.baseline.nodes - 1);
  }
  const resources = JSON.parse(readFileSync(resolve(root, '.tmp/cubeopt-reverse/corner96-opt8-compare-v1-20261022-resources.json'), 'utf8'));
  assert.equal(resources.stopped, ''); assert.equal(resources.trigger, null);
  assert.equal(resources.swapouts, 0); assert.equal(resources.pressure, 1);
  assert.equal(resources.childPid, ready.pid);
  assert.equal(resources.guardPid, started.guardPid);
  assert.equal(resources.sessionSha256, started.sessionSha256);
  assert(resources.minimumHeadroom >= 2 * 2 ** 30 && resources.peakRss <= resources.rssLimit);
  const report = {schema: 'cuberoot.corner96-comparison-report.v1', verifiedAt: new Date().toISOString(),
    machine: {platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model,
      logicalCpus: cpus().length, memoryBytes: totalmem()},
    casesPerMode: 100, verifiedSolutions: 400, independentlyReplayedReferences: 100,
    threads: 1, contexts: 8, passesPerMode: 1, warmupCases: 0,
    persistentPid: ready.pid, loadSeconds: ready.load_seconds, modes: summaries,
    binarySha256: input.binarySha256, resultsSha256: sha(outputBytes),
    verifierSha256: sha(readFileSync(fileURLToPath(import.meta.url))),
    resources, probesIncludeAuxiliary: false, note: input.note};
  save('report.json', report);
  console.log(JSON.stringify(report, null, 2));
} else throw Error('Use prepare or report');
