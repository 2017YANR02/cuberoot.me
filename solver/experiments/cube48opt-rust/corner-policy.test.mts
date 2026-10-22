// Pure protocol checks only: no table, process or resource observation.
import assert from 'node:assert/strict';
import test from 'node:test';
import {resolve} from 'node:path';
import {cornerDirectory, cornerExecutable, cornerResearchPolicy} from './corner-policy.mts';
import {validateCornerSession} from './corner-session.mts';
import {blockedCompute} from '../../../.codex/hooks/block-unprotected-memory-compute.mts';

const env = {CUBEOPT_BACKEND: 'corner'};
const artifact = (name: string) => resolve(cornerDirectory, name);
const policy = (args: string[], overrides: NodeJS.ProcessEnv = {}) =>
  cornerResearchPolicy('corner96-unit-policy', cornerExecutable, args, {...env, ...overrides});

test('a corner session never accepts a changed boot, swap counter, history or protected stop', () => {
  const now = {boot: 'test-boot', swapouts: 0, pressure: 1};
  const history = {'old-stop.json': 'retained'};
  const session = {schema: 'cuberoot.corner96-session.v1', authorization: '现在要做什么？你可以跑计算的',
    preparedAt: '2026-10-22T00:00:00Z', ...now, history};
  assert.equal(validateCornerSession(session, now, history, false), session);
  for (const changed of [{...now, boot: 'other'}, {...now, swapouts: 1}, {...now, pressure: 2}])
    assert.throws(() => validateCornerSession(session, changed, history, false));
  assert.throws(() => validateCornerSession(session, now, {}, false));
  assert.throws(() => validateCornerSession(session, now, history, true));
});

test('corner compute is rejected outside the actual guard, including chained commands', () => {
  const guard = resolve(import.meta.dirname, 'guard.mts');
  const direct = `${cornerExecutable} verify-small`;
  assert(blockedCompute(direct));
  assert(blockedCompute('cargo run --release --bin=corner-research -- verify-small'));
  assert.equal(blockedCompute(`${cornerExecutable} --help`), undefined);
  assert.equal(blockedCompute(`CUBEOPT_BACKEND=corner node ${guard} corner96-check ${direct}`), undefined);
  assert(blockedCompute(`node ${guard} corner96-check ${direct}; ${direct}`));
});

test('corner builders use explicit bounded budgets and distinct artifact paths', () => {
  assert.equal(policy(['build-u', artifact('u.dat'), artifact('u.chk'), 'exact']).rssLimit, 512 * 2 ** 20);
  assert.equal(policy(['build96', artifact('c.dat'), artifact('c.chk')]).rssLimit, 2 ** 30);
  assert.throws(() => policy(['build-u', artifact('u.dat'), artifact('u.dat'), '13']));
  for (const cap of ['0', '255', '01', 'NaN'])
    assert.throws(() => policy(['build-u', artifact('u.dat'), artifact('u.chk'), cap]));
  assert.throws(() => policy(['build96', '/tmp/out', artifact('c.chk')]));
});

test('corner research cannot borrow another backend review or a parent guard token', () => {
  for (const overrides of [{CUBEOPT_BACKEND: 'h48'}, {CUBEOPT_H: '11'},
    {CUBEOPT_OPT10_REVIEW: '/tmp/review'}, {CUBEOPT_SEARCH_THREADS: '2'},
    {CUBEOPT_CORNER_GUARDED: '1'}, {CUBEOPT_VARIANT: '8'}])
    assert.throws(() => policy(['verify-small'], overrides));
  assert.throws(() => cornerResearchPolicy('unrelated', cornerExecutable, ['verify-small'], env));
  assert.throws(() => cornerResearchPolicy('corner96-test', '/tmp/other', ['verify-small'], env));
});

test('full-cube research searches always have a finite node budget and bounded cache', () => {
  const args = ['solve-distance', artifact('c.dat'), '10', '1000000', '100000'];
  assert.equal(policy(args).backend, 'corner');
  assert.throws(() => policy([...args.slice(0, 3), '0', '100000']));
  assert.throws(() => policy([...args.slice(0, 4), '1000001']));
  assert.throws(() => policy(['solve-u', artifact('u.dat'), '10', '1000', '4']));
  assert.throws(() => policy(['verify-search', artifact('u.dat'), '4']));
});

test('Opt strengthening budgets the existing main table and does not expose generation', () => {
  const p = policy(['solve-opt', artifact('u.dat'), '8', '/tmp/small.bin', '/tmp/opt8.dat', '20', '1000000']);
  assert.equal(p.tableBytes, 30_401_280 * 2 ** 8);
  assert.equal(p.rssLimit, p.tableBytes + 2 ** 30);
  assert.throws(() => policy(['generate-opt10', artifact('u.dat')]));
  assert.throws(() => policy(['solve-opt', artifact('u.dat'), '10', '/tmp/small.bin', '/tmp/opt10.dat', '20', '1000']));
  const comparison = ['compare-opt8', artifact('u.dat'), artifact('c.dat'), '/tmp/small.bin', '/tmp/opt8.dat', '1000000000'];
  assert.equal(policy(comparison).rssLimit, 30_401_280 * 2 ** 8 + 918_604 + 4_673_930 + 2 ** 30);
  assert.throws(() => policy([...comparison.slice(0, 5), '0']));
  assert.throws(() => policy([...comparison.slice(0, 5), '1000000001']));
});

test('dense and distance-gated routes retain path, context and finite-budget restrictions', () => {
  assert.equal(policy(['verify-dense', artifact('c.dat')]).rssLimit, 2 ** 30);
  assert.equal(policy(['query96-dense', artifact('c.dat')]).tableBytes, 4_673_930);
  for (const command of ['solve-u-distance', 'solve-u-distance-sparse']) {
    const args = [command, artifact('u.dat'), artifact('c.dat'), '10', '1000', '8'];
    assert.equal(policy(args).rssLimit, 2 ** 30);
    assert.throws(() => policy([...args.slice(0, 4), '0', '8']));
    assert.throws(() => policy([...args.slice(0, 5), '4']));
    assert.throws(() => policy([command, artifact('u.dat'), '/tmp/c.dat', '10', '1000']));
  }
  assert.throws(() => policy(['solve-distance-dense', artifact('c.dat'), '10', '1000', '1000001']));
  const args = ['solve-opt-distance', artifact('u.dat'), artifact('c.dat'), '8',
    '/tmp/small.bin', '/tmp/opt8.dat', '20', '1000000'];
  assert.equal(policy(args).tableBytes, 30_401_280 * 2 ** 8 + 918_604 + 4_673_930);
  assert.throws(() => policy([...args.slice(0, 3), '10', ...args.slice(4)]));
});
