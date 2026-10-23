/** One bounded PLL study, following the successful five-case Opt9 run.
 * Consumed/stopped scopes never restart; preserved results are postprocessed separately. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { observeStatsResources } from './stats-resume-review.mts';
import { collectZbllMultisolutionEvidence, validateZbllMultisolutionInput, zbllMultisolutionPaths } from './zbll-multisolution-policy.mts';

const root = resolve(import.meta.dirname, '../../..'), GiB = 2 ** 30;
export const pllDir = resolve(root, '.tmp/pll-21-20261023');
export const pllLabel = 'pll-21-20261023-opt9';
const tableBytes = 15_565_455_360;
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function read(p: string) { assert(lstatSync(p).isFile() && lstatSync(p).size < 16 * 2 ** 20); return readFileSync(p); }
export function pllRequest() {
  return { label: pllLabel, executable: zbllMultisolutionPaths.executable,
    args: ['solve', zbllMultisolutionPaths.small, zbllMultisolutionPaths.table, '8', '20', '1000000'],
    env: { CUBEOPT_PLL_REVIEW: resolve(pllDir, 'session.json'), CUBEOPT_BACKEND: 'opt', CUBEOPT_VARIANT: '9',
      CUBEOPT_SOLVE_THREADS: '1', CUBEOPT_SEARCH_THREADS: '1', CUBEOPT_MEASURE_RSS: '1' } };
}
export function pllPolicy(r: { label: string; executable: string; args: string[]; env: NodeJS.ProcessEnv }) {
  const expected = pllRequest();
  assert.equal(r.label, expected.label); assert.equal(r.executable, expected.executable); assert.deepEqual(r.args, expected.args);
  assert.deepEqual(Object.fromEntries(Object.entries(r.env).filter(([k]) => k.startsWith('CUBEOPT_'))), expected.env);
  assert.equal(r.env.NODE_OPTIONS, undefined); assert.equal(r.env.NODE_PATH, undefined);
  assert.equal(process.platform, 'darwin'); assert.equal(process.arch, 'arm64');
  return { entry: 'native', mode: 'solve', backend: 'opt', variant: 9, h: null, tablePath: null,
    tableBytes, rssLimit: tableBytes + GiB, measureNativeRss: true, deadlineMs: 600000,
    openBenchmark: true as const, pllSample: true as const, scopeStopPath: resolve(pllDir, 'stop.json') };
}
function evidence() {
  const old = collectZbllMultisolutionEvidence();
  const donePath = resolve(root, '.tmp/1lll-five-20261023/retry-1/completed.json');
  const doneBytes = read(donePath), done = JSON.parse(doneBytes.toString());
  assert.equal(done.solvedInputs, 500); assert.equal(done.swapoutsBefore, 16); assert.equal(done.swapoutsAfter, 16);
  for (const [path, digest] of Object.entries(done.hashes)) assert.equal(hash(read(resolve(root, path))), digest, `Predecessor changed: ${path}`);
  const priorPath = resolve(root, '.tmp/cubeopt-reverse/1lll-five-20261023-opt9-retry1-resources.json');
  const prior = JSON.parse(read(priorPath).toString());
  assert.equal(prior.stopped, ''); assert.equal(prior.pressure, 1); assert.equal(prior.swapouts, 16);
  assert.equal(prior.openBenchmarkReceipt.before.swapouts, 16); assert.equal(prior.boot, old.setupFailure.boot);
  const info = validateZbllMultisolutionInput(read(resolve(pllDir, 'input.tsv')));
  assert.equal(info.rows, 2100);
  const q = JSON.parse(read(resolve(pllDir, 'queries.json')).toString());
  assert.equal(q.cases.length, 21); assert.equal(new Set(q.cases.map((c: any) => c.id)).size, 21);
  assert.equal(q.queries.length, 2100);
  for (const c of q.cases) assert.equal(q.queries.filter((x: any) => x.caseId === c.id).length, 100);
  assert.equal(read(resolve(pllDir, 'input.tsv')).toString(), q.queries.map((x: any) => `${x.id}\t${x.scramble}\n`).join(''));
  return { boot: prior.boot, swapouts: prior.swapouts, old, input: info, predecessorSha256: hash(doneBytes),
    queriesSha256: hash(read(resolve(pllDir, 'queries.json'))), sourceSha256: hash(read(resolve(pllDir, 'source.json'))),
    sources: Object.fromEntries(['guard.mts', 'pll-sample-policy.mts', 'pll-sample.mts'].map(f => [f, hash(read(resolve(import.meta.dirname, f)))])) };
}
export function validatePllSession(s: any, e: any, n: any, used = false, stopped = false) {
  assert(!used && !stopped, 'PLL scope consumed/stopped; do not restart or reset its baseline');
  assert.equal(s.schema, 'cuberoot.pll-21.session.v1'); assert.deepEqual(s.request, pllRequest()); assert.deepEqual(s.evidence, e);
  assert.equal(s.boot, e.boot); assert.equal(s.swapouts, e.swapouts);
  assert.equal(n.boot, e.boot); assert.equal(n.swapouts, e.swapouts); assert.equal(n.pressure, 1);
  assert(n.available >= tableBytes + 4 * GiB, 'Insufficient Opt9 startup headroom');
  assert(Date.now() - Date.parse(s.preparedAt) >= 0 && Date.now() - Date.parse(s.preparedAt) < 86400000);
}
export function validatePllReview(r: Parameters<typeof pllPolicy>[0], n: any) {
  pllPolicy(r);
  const bytes = read(resolve(pllDir, 'session.json')), s = JSON.parse(bytes.toString()), e = evidence();
  const used = existsSync(resolve(pllDir, 'receipt.json')) || existsSync(resolve(root, `.tmp/cubeopt-reverse/${pllLabel}-resources.json`));
  validatePllSession(s, e, n, used, existsSync(resolve(pllDir, 'stop.json')));
  return { input: read(resolve(pllDir, 'input.tsv')), receiptPath: resolve(pllDir, 'receipt.json'),
    receipt: { schema: 'cuberoot.pll-21.receipt.v1', request: pllRequest(), reviewSha256: hash(bytes), before: n, consumedAt: new Date().toISOString() } };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  assert.deepEqual(process.argv.slice(2), ['prepare']); assert(!existsSync(resolve(pllDir, 'session.json')));
  const n = observeStatsResources(); assert(!n.computeRunning && !n.lockExists);
  const e = evidence();
  const s = { schema: 'cuberoot.pll-21.session.v1', authorization: '那你先从PLL试试吧 总共21个PLL',
    request: pllRequest(), evidence: e, preparedAt: new Date().toISOString(), boot: n.boot, swapouts: n.swapouts };
  validatePllSession(s, e, n);
  writeFileSync(resolve(pllDir, 'session.json'), JSON.stringify(s, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ prepared: true, ...n, request: pllRequest() }));
}
