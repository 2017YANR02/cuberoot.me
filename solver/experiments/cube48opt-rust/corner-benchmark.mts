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
const [command, version = 'v1'] = process.argv.slice(2);
assert(['v1', 'scheduled'].includes(version) && process.argv.length <= 4,
  'Use prepare/report [scheduled], prepare-layouts/report-layouts, or prepare-profile/report-profile');
const layouts = command === 'prepare-layouts' || command === 'report-layouts';
const diagnostic = command === 'prepare-profile' || command === 'report-profile';
const scheduled = version === 'scheduled';
assert(!(layouts || diagnostic) || !scheduled, 'Layout/profile evidence has no search variant');
const directory = resolve(cornerDirectory, diagnostic ? 'opt8-profile-v1' : layouts ? 'layouts-v2' : scheduled ? 'opt8-wca100-v2' : 'opt8-wca100-v1');
const label = diagnostic ? 'corner96-opt8-profile-v1-20261022' : layouts ? 'corner96-layouts-v2-20261022' : scheduled ? 'corner96-opt8-compare-v2-20261022' : 'corner96-opt8-compare-v1-20261022';
const reference = resolve(root, '.tmp/cubeopt-reverse/opt10-official-wca1000-mt16-20261022/results.jsonl');
const modes = scheduled ? ['u-deferred', 'distance-late', 'combined-late'] : ['baseline', 'u', 'distance', 'combined'];
const baselineReport = resolve(cornerDirectory, 'opt8-wca100-v1/report.json');
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const save = (name: string, value: unknown) => writeFileSync(resolve(directory, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const rows = (bytes: Buffer) => {
  assert(bytes.toString().endsWith('\n'), 'Incomplete final result');
  return bytes.toString().trimEnd().split('\n').map(line => JSON.parse(line));
};

function freeze() {
  assert(!existsSync(directory), 'Keep the previous comparison and its single-pass evidence');
  mkdirSync(directory, {recursive: true});
  cpSync(resolve(here, 'src'), resolve(directory, 'source/src'), {recursive: true, errorOnExist: true});
  for (const name of ['Cargo.toml', 'Cargo.lock', 'guard.mts', 'corner-policy.mts', 'corner-session.mts', 'corner-benchmark.mts'])
    cpSync(resolve(here, name), resolve(directory, 'source', name), {errorOnExist: true});
  cpSync(cornerExecutable, resolve(directory, 'corner-research'), {errorOnExist: true});
}

function evidence() {
  const input = JSON.parse(readFileSync(resolve(directory, 'input.json'), 'utf8'));
  const started = JSON.parse(readFileSync(resolve(root, `.tmp/cubeopt-reverse/${label}-started.json`), 'utf8'));
  const resources = JSON.parse(readFileSync(resolve(root, `.tmp/cubeopt-reverse/${label}-resources.json`), 'utf8'));
  assert.equal(sha(readFileSync(resolve(directory, 'corner-research'))), input.binarySha256);
  assert.equal(started.executableSha256, input.binarySha256);
  assert.equal(resources.guardPid, started.guardPid);
  assert.equal(resources.sessionSha256, started.sessionSha256);
  assert.equal(resources.stopped, ''); assert.equal(resources.trigger, null);
  assert.equal(resources.swapouts, 0); assert.equal(resources.pressure, 1);
  assert(resources.minimumHeadroom >= 2 * 2 ** 30 && resources.peakRss <= resources.rssLimit);
  return {input, started, resources};
}

if (command === 'prepare-profile') {
  const source = resolve(cornerDirectory, 'opt8-wca100-v2');
  const priorInputBytes = readFileSync(resolve(source, 'input.json'));
  const prior = JSON.parse(priorInputBytes.toString());
  const cases = prior.corpus.cases.slice(0, 20);
  const input = cases.map((item: {id: string; scramble: string}) => `distance-late:${item.id}\t${item.scramble}\n`).join('');
  freeze();
  writeFileSync(resolve(directory, 'input.tsv'), input, {flag: 'wx'});
  save('input.json', {preparedAt: new Date().toISOString(), source, priorInputSha256: sha(priorInputBytes),
    priorResultsSha256: sha(readFileSync(resolve(source, 'results.jsonl'))), cases,
    inputSha256: sha(Buffer.from(input)), binarySha256: sha(readFileSync(cornerExecutable)),
    resources: prior.resources, features: [...prior.features, 'opt10-native-profile'],
    command: 'profile-opt8', threads: 1, contexts: 8, passes: 1,
    note: 'Diagnostic only, fixed first 20 of the previous WCA100; no extra warmup. Instrumented timings are not performance rankings.'});
  console.log(JSON.stringify({directory, label, cases: cases.length}));
} else if (command === 'report-profile') {
  const {input, started, resources} = evidence();
  assert.equal(started.args[0], 'profile-opt8');
  assert.equal(sha(readFileSync(resolve(input.source, 'input.json'))), input.priorInputSha256);
  assert.equal(sha(readFileSync(resolve(input.source, 'results.jsonl'))), input.priorResultsSha256);
  assert.equal(sha(readFileSync(resolve(directory, 'input.tsv'))), input.inputSha256);
  for (const resource of input.resources) {
    const bytes = readFileSync(resolve(cornerDirectory, resource.name));
    assert.equal(bytes.length, resource.bytes); assert.equal(sha(bytes), resource.sha256);
  }
  const outputBytes = readFileSync(resolve(directory, 'results.jsonl'));
  const [ready, ...results] = rows(outputBytes);
  assert.equal(ready.kind, 'comparison-ready'); assert.equal(ready.threads, 1); assert.equal(ready.contexts, 8);
  assert.equal(resources.childPid, ready.pid); assert.equal(results.length, 20);
  const prior = rows(readFileSync(resolve(input.source, 'results.jsonl'))).slice(1);
  const {cube3x3x3} = await import(pathToFileURL(resolve(root, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  const puzzle = await cube3x3x3.kpuzzle();
  const totals: Record<string, any> = {};
  let nodes = 0, probes = 0, instrumentedSeconds = 0;
  for (const [index, row] of results.entries()) {
    const item = input.cases[index];
    const expected = prior.find(candidate => candidate.id === `distance-late:${item.id}`);
    assert(expected); assert.equal(row.id, expected.id); assert.equal(row.pid, ready.pid);
    for (const key of ['length', 'solution', 'nodes', 'probes']) assert.equal(row[key], expected[key]);
    replay(puzzle, item, row, expected.length);
    const p = row.profile;
    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
    assert.equal(sum(p.visited) + p.root_nodes, row.nodes);
    assert.equal(sum(p.inverse_probes) + sum(p.normal_probes) + p.root_inverse_probes + p.root_normal_probes, row.probes);
    for (let r = 0; r <= 20; r++) {
      assert.equal(p.visited[r], p.inverse_rejected[r] + p.normal_rejected[r] + p.distance_rejected[r]
        + p.survived[r] + p.pending[r] + p.leaf_solved[r] + p.leaf_rejected[r]);
      assert(p.distance_rejected[r] <= p.distance_queries[r] && p.distance_queries[r] <= p.distance_attempts[r]);
      if (r >= 11) assert.equal(p.distance_queries[r], 0);
    }
    for (const [key, value] of Object.entries(p)) {
      if (Array.isArray(value)) totals[key] = (totals[key] ?? Array(21).fill(0)).map((n: number, r: number) => n + value[r]);
      else totals[key] = (totals[key] ?? 0) + Number(value);
    }
    nodes += row.nodes; probes += row.probes; instrumentedSeconds += row.seconds;
  }
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const queryCount = sum(totals.distance_queries), rejected = sum(totals.distance_rejected);
  const sampledHookSeconds = totals.distance_queries.reduce((seconds: number, count: number, r: number) =>
    seconds + (totals.distance_samples[r] ? count * totals.distance_sample_ns[r] / totals.distance_samples[r] / 1e9 : 0), 0);
  const report = {verifiedAt: new Date().toISOString(), cases: 20, threads: 1, contexts: 8, passes: 1,
    verifiedSolutions: 20, nodesAndProbesMatchUninstrumented: true, persistentPid: ready.pid,
    nodes, probes, instrumentedSeconds, totals, queryCount, rejected,
    queryFractionOfNodes: queryCount / nodes, rejectionFractionOfQueries: rejected / queryCount,
    visitedWithBudgetAtLeast11: sum(totals.visited.slice(11)), sampledHookSeconds,
    timingCaveat: 'Sparse hook samples include clock overhead and instrumentation. They estimate this diagnostic only, not original CPU time or end-to-end speedup.',
    binarySha256: input.binarySha256, resultsSha256: sha(outputBytes), resources, note: input.note};
  save('report.json', report); console.log(JSON.stringify(report, null, 2));
} else if (command === 'prepare-layouts') {
  freeze();
  save('input.json', {preparedAt: new Date().toISOString(), binarySha256: sha(readFileSync(cornerExecutable)),
    tableSha256: sha(readFileSync(resolve(cornerDirectory, 'full96.dat'))), command: 'compare-layouts',
    fullStates: 88_179_840, lookupQueriesPerLayout: 4_194_304, measuredPasses: 1});
  console.log(JSON.stringify({directory, label}));
} else if (command === 'report-layouts') {
  const {input, started, resources} = evidence();
  assert.equal(started.args[0], 'compare-layouts');
  assert.equal(sha(readFileSync(resolve(cornerDirectory, 'full96.dat'))), input.tableSha256);
  const bytes = readFileSync(resolve(directory, 'results.jsonl'));
  const output = rows(bytes), storage = output[0];
  assert.equal(storage.kind, 'corner-layouts');
  let end = 0;
  for (const range of output.filter(row => row.kind === 'layout-equality-range')) {
    assert.equal(range.start, end); assert.equal(range.passed, true); assert(range.end > end); end = range.end;
  }
  assert.equal(end, input.fullStates);
  const [complete] = output.filter(row => row.kind === 'layout-equality-complete');
  assert.equal(complete.states, end);
  assert.equal(complete.histogram.reduce((n: number, count: number) => n + count, 0), end);
  const queries = output.filter(row => row.kind === 'layout-query-benchmark');
  assert.deepEqual(queries.map(row => row.layout), ['dense48', 'dense96', 'prepared48', 'prepared96']);
  for (const query of queries) {
    assert.equal(query.queries, input.lookupQueriesPerLayout); assert.equal(query.passes, 1);
    assert.equal(query.checksum, queries[0].checksum); assert(query.seconds > 0);
    query.nanosecondsPerQuery = query.seconds * 1e9 / query.queries;
  }
  const report = {verifiedAt: new Date().toISOString(), storage, verifiedStates: end,
    histogram: complete.histogram, queries, resources, binarySha256: input.binarySha256,
    resultsSha256: sha(bytes), dense96To48Bytes: storage.dense96_bytes / storage.dense48_bytes,
    prepared96To48Bytes: storage.prepared96_bytes / storage.prepared48_bytes,
    prepared96ToOriginal96Bytes: storage.prepared96_bytes / storage.dense96_bytes,
    note: 'Equal distances at every corner state imply equal nodes for the same deterministic search. Query microbenchmark is not end-to-end search performance.'};
  save('report.json', report); console.log(JSON.stringify(report, null, 2));
} else if (command === 'prepare') {
  const corpus = readWca100();
  const input = corpus.cases.flatMap((item: {id: string; scramble: string}, index: number) =>
    modes.map((_, offset) => `${modes[(index + offset) % modes.length]}:${item.id}\t${item.scramble}\n`)).join('');
  freeze();
  writeFileSync(resolve(directory, 'input.tsv'), input, {flag: 'wx'});
  const resources = ['u-exact.dat', 'full96.dat'].map(name => {
    const path = resolve(cornerDirectory, name), bytes = readFileSync(path);
    return {name, bytes: bytes.length, sha256: sha(bytes)};
  });
  save('input.json', {schema: 'cuberoot.corner96-comparison-input.v1', preparedAt: new Date().toISOString(),
    corpus, modes, threads: 1, contexts: 8, measuredPasses: 1, warmupCases: 0,
    order: 'rotate mode order by case; preserve corpus order within every mode',
    inputSha256: sha(Buffer.from(input)), binarySha256: sha(readFileSync(cornerExecutable)),
    reference, referenceSha256: sha(readFileSync(reference)), resources,
    ...(scheduled ? {baselineReport, baselineReportSha256: sha(readFileSync(baselineReport))} : {}),
    features: ['corner-research','opt8-native-search','opt8-native-quarter','opt9-native-fixed-contexts','opt8-native-prefetch'],
    note: 'One resident main table; no extra warmup. This is not a cold-cache or production-server benchmark.'
      + (scheduled ? ' Baseline reuses the preserved v1 pass, measured at a different time; it was not rerun.' : '')});
  console.log(JSON.stringify({directory, cases: 100, modes, passesPerMode: 1}));
} else if (command === 'report') {
  const input = JSON.parse(readFileSync(resolve(directory, 'input.json'), 'utf8'));
  const outputBytes = readFileSync(resolve(directory, 'results.jsonl'));
  const [ready, ...results] = rows(outputBytes);
  assert.equal(ready.kind, 'comparison-ready');
  assert.equal(ready.threads, input.threads); assert.equal(ready.contexts, input.contexts);
  assert.equal(results.length, modes.length * 100);
  assert.equal(sha(readFileSync(reference)), input.referenceSha256);
  assert.equal(sha(readFileSync(resolve(directory, 'corner-research'))), input.binarySha256);
  assert.equal(sha(readFileSync(resolve(directory, 'input.tsv'))), input.inputSha256);
  for (const resource of input.resources) {
    const bytes = readFileSync(resolve(cornerDirectory, resource.name));
    assert.equal(bytes.length, resource.bytes); assert.equal(sha(bytes), resource.sha256);
  }
  const started = JSON.parse(readFileSync(resolve(root, `.tmp/cubeopt-reverse/${label}-started.json`), 'utf8'));
  assert.equal(started.executableSha256, input.binarySha256);
  assert.equal(started.args[0], scheduled ? 'compare-opt8-scheduled' : 'compare-opt8');
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
      if (mode === modes[0]) replay(puzzle, item, expected, expected.length);
      replay(puzzle, item, row, expected.length);
    }
    summaries[mode] = {cases: selected.length, seconds: selected.reduce((n, row) => n + row.seconds, 0),
      nodes: selected.reduce((n, row) => n + row.nodes, 0), probes: selected.reduce((n, row) => n + row.probes, 0)};
  }
  let baseline = summaries.baseline;
  if (scheduled) {
    assert.equal(sha(readFileSync(baselineReport)), input.baselineReportSha256);
    baseline = JSON.parse(readFileSync(baselineReport, 'utf8')).modes.baseline;
  }
  for (const value of Object.values(summaries)) {
    value.speedup = baseline.seconds / value.seconds;
    value.timeChangePercent = 100 * (value.seconds / baseline.seconds - 1);
    value.nodeChangePercent = 100 * (value.nodes / baseline.nodes - 1);
  }
  if (scheduled) for (const [mode, value] of Object.entries(summaries)) {
    assert.equal(ready.main_table_bytes, 7_782_727_680);
    assert(Number.isSafeInteger(ready.auxiliary_bytes[mode]) && ready.auxiliary_bytes[mode] > 0);
    value.auxiliaryTableBytes = ready.auxiliary_bytes[mode];
    value.tableBytes = ready.main_table_bytes + value.auxiliaryTableBytes;
    value.relativeTableTimesNodes = (value.tableBytes / ready.main_table_bytes) * (value.nodes / baseline.nodes);
  }
  const resources = JSON.parse(readFileSync(resolve(root, `.tmp/cubeopt-reverse/${label}-resources.json`), 'utf8'));
  assert.equal(resources.stopped, ''); assert.equal(resources.trigger, null);
  assert.equal(resources.swapouts, 0); assert.equal(resources.pressure, 1);
  assert.equal(resources.childPid, ready.pid);
  assert.equal(resources.guardPid, started.guardPid);
  assert.equal(resources.sessionSha256, started.sessionSha256);
  assert(resources.minimumHeadroom >= 2 * 2 ** 30 && resources.peakRss <= resources.rssLimit);
  const report = {schema: 'cuberoot.corner96-comparison-report.v1', verifiedAt: new Date().toISOString(),
    machine: {platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model,
      logicalCpus: cpus().length, memoryBytes: totalmem()},
    casesPerMode: 100, verifiedSolutions: results.length, independentlyReplayedReferences: 100,
    threads: 1, contexts: 8, passesPerMode: 1, warmupCases: 0,
    persistentPid: ready.pid, loadSeconds: ready.load_seconds, modes: summaries,
    ...(scheduled ? {baselineReport, baselineReportSha256: input.baselineReportSha256, baseline} : {}),
    binarySha256: input.binarySha256, resultsSha256: sha(outputBytes),
    verifierSha256: sha(readFileSync(fileURLToPath(import.meta.url))),
    resources, probesIncludeAuxiliary: false, note: input.note};
  save('report.json', report);
  console.log(JSON.stringify(report, null, 2));
} else throw Error('Use prepare or report');
