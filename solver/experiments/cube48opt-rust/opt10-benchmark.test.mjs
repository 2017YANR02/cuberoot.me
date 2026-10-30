// Protocol fixtures only. No process, table payload, or solver is started.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import test from 'node:test';
import { opt10ReviewSources } from './guard.mts';
import { parseOpt10BenchmarkArguments, opt10BenchmarkPlan } from './opt10-benchmark.mjs';
import { opt10BenchmarkPaths as paths, parseCompleteJsonl, readSuccessfulTiming,
  opt10BenchmarkSourceHashes, validateOpt10Launch, validateOpt10SolveReceipt,
  validateOpt10SnapshotBinding } from './report-opt10-wca100.mjs';
import { readWca100 } from './wasm-benchmark.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const corpus = readWca100();
const input = corpus.cases.map(item => `${item.id}\t${item.scramble}\n`).join('');
const digest = 'a'.repeat(64);
function fixture() {
  const plan = opt10BenchmarkPlan(resolve(paths.base, 'fixture-opt10-review.json'));
  const sourceSha256 = Object.fromEntries(['src/opt10_generate.rs', 'src/opt10.rs',
    'src/opt10_table.rs', 'src/eo_table.rs', 'src/coord.rs', 'src/cube.rs'].map(path => [path, digest]));
  const launch = { schema: 'cuberoot.rust-opt10.wca100-launch.v1', preparedAt: '2026-10-13T00:00:00.000Z',
    corpusSha256: corpus.corpusSha256, cases: 100, measuredPasses: 1, warmupCases: 0, threads: 1, contexts: 8,
    binary: { path: paths.binary, sha256: digest }, input: { path: paths.input, sha256: hash(input), bytes: Buffer.byteLength(input) },
    small: { path: paths.small, bytes: 818_008, sha256: digest }, generationMetadataSha256: digest,
    review: { path: plan.env.CUBEOPT_OPT10_REVIEW, sha256: digest }, sourceSha256,
    command: { program: plan.program, args: plan.args, cwd: plan.cwd, env: plan.env } };
  const args = plan.args.slice(4);
  const receipt = { schema: 'cuberoot.opt10.resource-review-consumption.v1', scope: 'opt10-rebuild-v2-single100',
    stage: 'solve-opt10', label: 'wca100-rust-opt10-single', executable: paths.binary, executableSha256: digest,
    args, commandSha256: hash(JSON.stringify([paths.binary, ...args])),
    reviewPath: launch.review.path, reviewSha256: digest, inputSha256: hash(input), corpusSha256: corpus.corpusSha256,
    snapshotSha256: digest,
    before: { boot: 'fixture-boot', swapouts: 0 }, sourceSha256 };
  return { launch, receipt, resource: { boot: 'fixture-boot', swapouts: 0 } };
}

test('Opt10 helper only prepares or reports a fixed single pass; it has no run mode', () => {
  for (const mode of ['--plan', '--prepare', '--report']) assert.equal(parseOpt10BenchmarkArguments([mode]), mode);
  for (const args of [[], ['--run'], ['--prepare', '--warmup'], ['--report', '--repeat', '3']])
    assert.throws(() => parseOpt10BenchmarkArguments(args));
  const plan = opt10BenchmarkPlan();
  assert.equal(plan.measuredPasses, 1); assert.equal(plan.warmupCases, 0);
  assert.deepEqual(plan.args.slice(4), ['solve-opt10', paths.small, paths.table, '8', '20', '0']);
  assert.equal(paths.table, resolve(paths.base, 'opt10-generated-v2/cuberoot-opt10.dat'));
  assert.equal(plan.stdin, resolve(paths.base, 'wca100-single.tsv'));
});

test('Launch manifest binds every original WCA100 row and rejects extra/reordered passes', () => {
  const { launch } = fixture();
  assert.equal(corpus.cases.length, 100); assert.equal(corpus.cases[0].id, '22001');
  assert.equal(corpus.cases[99].id, '273001');
  validateOpt10Launch(launch, corpus, input);
  assert.throws(() => validateOpt10Launch({ ...launch, warmupCases: 100 }, corpus, input));
  assert.throws(() => validateOpt10Launch({ ...launch, measuredPasses: 3 }, corpus, input));
  assert.throws(() => validateOpt10Launch(launch, corpus, input + input));
  const reordered = [...corpus.cases].reverse().map(item => `${item.id}\t${item.scramble}\n`).join('');
  assert.throws(() => validateOpt10Launch(launch, corpus, reordered));
  const wrong = structuredClone(launch); wrong.command.args[4] = 'solve-h10';
  assert.throws(() => validateOpt10Launch(wrong, corpus, input));
});

test('Report binds the consumed Opt10 review, binary, input, and original resource baseline', () => {
  const { launch, receipt, resource } = fixture();
  validateOpt10SolveReceipt(receipt, launch, resource);
  for (const changed of [
    { ...receipt, inputSha256: 'b'.repeat(64) },
    { ...receipt, executableSha256: 'b'.repeat(64) },
    { ...receipt, snapshotSha256: 'b'.repeat(64) },
    { ...receipt, stage: 'generate-opt10' },
    { ...receipt, sourceSha256: {} },
    { ...receipt, before: { boot: 'fixture-boot', swapouts: 1 } },
  ]) assert.throws(() => validateOpt10SolveReceipt(changed, launch, resource));
});

test('Opt10 snapshot binding uses the real 1024-byte header and optional metadata evidence', () => {
  const header = Buffer.alloc(1024);
  Buffer.from(digest, 'hex').copy(header, 72);
  validateOpt10SnapshotBinding(header, digest, {});
  validateOpt10SnapshotBinding(header, digest, { snapshotSha256: digest, table: { snapshotSha256: digest } });
  assert.throws(() => validateOpt10SnapshotBinding(header, 'b'.repeat(64), {}));
  assert.throws(() => validateOpt10SnapshotBinding(header, digest, { snapshot: { sha256: 'b'.repeat(64) } }));
  assert.throws(() => validateOpt10SnapshotBinding(header.subarray(0, 1023), digest, {}));
  header[72] ^= 1;
  assert.throws(() => validateOpt10SnapshotBinding(header, digest, {}));
});

test('Benchmark manifest covers every real guard receipt source including its generation example', () => {
  const { launch, receipt, resource } = fixture();
  launch.sourceSha256 = opt10BenchmarkSourceHashes();
  for (const source of opt10ReviewSources)
    assert.match(launch.sourceSha256[source] ?? '', /^[a-f0-9]{64}$/, `Missing guard source: ${source}`);
  receipt.sourceSha256 = Object.fromEntries(opt10ReviewSources.map(source => [source, launch.sourceSha256[source]]));
  validateOpt10SolveReceipt(receipt, launch, resource);
  for (const source of opt10ReviewSources) {
    const changed = structuredClone(receipt);
    changed.sourceSha256[source] = 'b'.repeat(64);
    assert.throws(() => validateOpt10SolveReceipt(changed, launch, resource), `Receipt field not checked: ${source}`);
  }
  const missingExample = structuredClone(launch);
  delete missingExample.sourceSha256['examples/verify_opt10_generation.rs'];
  assert.throws(() => validateOpt10SolveReceipt(receipt, missingExample, resource));
});

test('Partial, duplicated or cancelled output cannot become a completed report', () => {
  const text = corpus.cases.map(row => JSON.stringify({ id: row.id })).join('\n') + '\n';
  assert.equal(parseCompleteJsonl(text, 100).length, 100);
  for (const changed of [text.slice(0, -1), text + '\n', text + text])
    assert.throws(() => parseCompleteJsonl(changed, 100));
  const stderr = ' 12.34 real 10.00 user 1.00 sys\n 31140000000 maximum resident set size\n';
  const completion = { exitCode: 0, signal: null, finishedAt: '2026-10-13T00:01:00.000Z' };
  assert.equal(readSuccessfulTiming(stderr, completion).peakRssBytes, 31_140_000_000);
  assert.throws(() => readSuccessfulTiming(stderr, { ...completion, exitCode: 1 }));
  assert.throws(() => readSuccessfulTiming(stderr, { ...completion, signal: 'SIGTERM' }));
  assert.throws(() => readSuccessfulTiming(stderr + stderr, completion));
});
