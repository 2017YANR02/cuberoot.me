// Node-only regression checks. --engine also exercises the installed official gem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicJson, calendarRows, commitRows, createEngine, dailyCommits, ENGINE_VERSION, METADATA,
  OUTPUT, planHistory, prepareState, runHistory, sourceChanged, type Day, type Engine, type Row } from './build-code-history.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const scratch = join(root, '.tmp/scratch');
const sampleSource = 'export const n: number = 1;\n';
const sampleBytes = Buffer.byteLength(sampleSource);
mkdirSync(scratch, { recursive: true });
function invoke(command: string, args: string[], cwd = root, env = process.env) {
  return execFileSync(command, args, { cwd, env, encoding: 'utf8', timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function fixture(t: { after(fn: () => void): void }) {
  const dir = mkdtempSync(join(scratch, 'code-history-check-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args: string[]) => invoke('git', args, dir);
  git('init', '-b', 'main'); git('config', 'user.name', 'History regression'); git('config', 'user.email', 'test@example.invalid');
  const commit = (date: string, contents: string, path = 'source.ts') => {
    mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), contents);
    git('add', '--', `:(literal)${path}`);
    invoke('git', ['-c', 'commit.gpgSign=false', 'commit', '-m', 'Publish chart'], dir,
      { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
    return git('rev-parse', 'HEAD');
  };
  const a = commit('2026-11-14T12:00:00-08:00', sampleSource);
  const b = commit('2026-11-16T12:00:00-08:00', sampleSource.replace('1', '2'));
  const output = join(dir, OUTPUT), checkpoint = join(dir, '.local-data/code-language-history/checkpoint.json');
  return { dir, git, commit, a, b, output, checkpoint };
}
const rows: Row[] = [
  { date: '2026-11-14', sha: 'a', languages: { Ruby: 4 } },
  { date: '2026-11-16', sha: 'b', languages: { Ruby: 5 } },
];
const expected: Day[] = rows.map(row => [row.date, row.sha]);
const future: Day[] = [...expected, ['2026-11-17', 'c']];
const cachedState = { rows, sha: 'b', cache: { 'example.rb': ['Ruby', 5] } };
const noAncestor = () => false;
const quiet = () => {};
const fakeEngine = (): Engine => ({
  async analyze(sha) { return { languages: { TypeScript: sampleBytes }, cache: { 'source.ts': [sha, sampleBytes] } }; },
  async close() {},
});

test('reuse complete days, cold-cache prefix and valid official per-file cache', () => {
  assert.deepEqual(prepareState(expected, { rows }, noAncestor), { rows, cached: false, pending: [], bootstrap: false });
  assert.deepEqual(prepareState(future, { rows }, noAncestor), { rows, cached: false, pending: [future[2]], bootstrap: true });
  assert.equal(prepareState(future, cachedState, noAncestor).cached, true);
  assert.equal(prepareState(future, { ...cachedState, sha: 'wrong' }, noAncestor).bootstrap, true);
});
test('only an appended final-day commit can replace saved history', () => {
  const updated = prepareState([expected[0], ['2026-11-16', 'b2']], cachedState, (old, next) => old === 'b' && next === 'b2');
  assert.deepEqual(updated, { rows: [rows[0]], cached: true, pending: [['2026-11-16', 'b2']], bootstrap: false });
  for (const changed of [[[expected[0][0], 'rewritten'], expected[1]], [expected[0], ['2026-11-16', 'unrelated']], expected.slice(0, 1)] as Day[][]) {
    assert.throws(() => prepareState(changed, cachedState, noAncestor), /Saved history changed/);
  }
  assert.equal(prepareState(expected, { rows: [] }, noAncestor).bootstrap, false);
});
test('Los Angeles dates include midnight and DST boundaries, with the newest commit per day', () => {
  const log = [
    ['2026-11-02T07:59:59Z', 'newest'], ['2026-11-01T09:30:00Z', 'after-fallback'],
    ['2026-11-01T08:30:00Z', 'before-fallback'], ['2026-11-01T06:59:59Z', 'previous-day'],
  ].map(([date, sha]) => `${Date.parse(date) / 1000} ${sha}`).join('\n');
  assert.deepEqual(dailyCommits(log), [['2026-10-31', 'previous-day'], ['2026-11-01', 'newest']]);
  const filled = calendarRows(rows);
  assert.deepEqual(filled[1], { ...rows[0], date: '2026-11-15' });
  assert.deepEqual(commitRows(filled), rows);
});
test('atomic publication preserves unchanged bytes and mtime', t => {
  const { output } = fixture(t);
  atomicJson(output, { rows }); utimesSync(output, 0, 0);
  const bytes = readFileSync(output, 'utf8'), mtime = statSync(output).mtimeMs;
  atomicJson(output, { rows });
  assert.equal(readFileSync(output, 'utf8'), bytes); assert.equal(statSync(output).mtimeMs, mtime);
  atomicJson(output, { rows: calendarRows(rows) });
  assert.equal(existsSync(`${output}.next`), false);
});
test('snapshot-only publication is not a source change; identical bot subjects cannot hide real edits', t => {
  const f = fixture(t);
  f.commit('2026-11-16T13:00:00-08:00', '{}', OUTPUT);
  assert.equal(sourceChanged(f.dir, f.b, 'HEAD'), false);
  f.commit('2026-11-16T14:00:00-08:00', 'export const n = 3;');
  assert.equal(sourceChanged(f.dir, f.b, 'HEAD'), true);
});
test('unchanged rerun never starts Ruby and same-day refresh reuses the prior cache', async t => {
  const f = fixture(t);
  await runHistory({ root: f.dir, log: quiet, engineFactory: fakeEngine });
  const bytes = readFileSync(f.output, 'utf8');
  await runHistory({ root: f.dir, log: quiet, engineFactory: () => { throw new Error('must not start'); } });
  assert.equal(readFileSync(f.output, 'utf8'), bytes);
  const latest = f.commit('2026-11-16T14:00:00-08:00', 'export const n = 3;');
  let calls = 0;
  await runHistory({ root: f.dir, log: quiet, engineFactory: () => ({
    async analyze(sha, previous, cache) {
      calls++; assert.equal(sha, latest); assert.equal(previous, f.b); assert.ok(cache);
      return { languages: { TypeScript: 19 }, cache: {} };
    }, async close() {},
  }) });
  assert.equal(calls, 1);
  assert.equal(JSON.parse(readFileSync(f.checkpoint, 'utf8')).rows.length, 2);
});
test('failure preserves the old public chart and resumes from each completed day', async t => {
  const f = fixture(t);
  await assert.rejects(runHistory({ root: f.dir, log: quiet, engineFactory: () => ({
    async analyze(sha) { if (sha === f.b) throw new Error('engine failure'); return fakeEngine().analyze(sha); }, async close() {},
  }) }), /engine failure/);
  assert.equal(existsSync(f.output), false);
  assert.equal(JSON.parse(readFileSync(f.checkpoint, 'utf8')).sha, f.a);
  let resumed = 0;
  await runHistory({ root: f.dir, log: quiet, engineFactory: () => ({
    async analyze(sha, previous) { resumed++; assert.equal(sha, f.b); assert.equal(previous, f.a); return fakeEngine().analyze(sha); }, async close() {},
  }) });
  assert.equal(resumed, 1);
  const before = readFileSync(f.output, 'utf8');
  f.commit('2026-11-17T12:00:00-08:00', 'export const n = 3;');
  await assert.rejects(runHistory({ root: f.dir, log: quiet, engineFactory: () => ({
    async analyze() { throw new Error('unavailable'); }, async close() {},
  }) }), /unavailable/);
  assert.equal(readFileSync(f.output, 'utf8'), before);
});
test('cold-cache bootstrap verifies the last saved commit; mismatch never publishes', async t => {
  const f = fixture(t);
  const published = { ...METADATA, rows: [{ date: '2026-11-14', sha: f.a, languages: { TypeScript: sampleBytes } }] };
  atomicJson(f.output, published);
  assert.equal(planHistory(f.dir).plan.cacheBootstrap, true);
  await assert.rejects(runHistory({ root: f.dir, log: quiet, engineFactory: () => ({
    async analyze() { return { languages: { TypeScript: 999 }, cache: {} }; }, async close() {},
  }) }), /baseline differs/);
  assert.equal(readFileSync(f.output, 'utf8'), JSON.stringify(published));
  assert.equal(existsSync(f.checkpoint), false);
  const analyzed: string[] = [];
  await runHistory({ root: f.dir, log: quiet, engineFactory: () => ({
    async analyze(sha) { analyzed.push(sha); return fakeEngine().analyze(sha); }, async close() {},
  }) });
  assert.deepEqual(analyzed, [f.a, f.b]);
});
test('old Ruby checkpoint and legacy Git-directory cache retain their schema and provenance', async t => {
  const f = fixture(t);
  const legacy = join(f.dir, '.git/code-language-history.json');
  const state = { rows: [{ date: '2026-11-14', sha: f.a, languages: { TypeScript: sampleBytes } }], sha: f.a, cache: { 'source.ts': ['TypeScript', sampleBytes] } };
  atomicJson(legacy, state);
  await runHistory({ root: f.dir, log: quiet, engineFactory: fakeEngine });
  assert.equal(readFileSync(legacy, 'utf8'), JSON.stringify(state));
  assert.equal(planHistory(f.dir).plan.analyzedDays, 0);
  atomicJson(f.checkpoint, { ...METADATA, ...state, engine: 'unsupported engine' });
  assert.throws(() => planHistory(f.dir), /Incompatible language history metadata/);
});
test('overlapping writers fail without stealing the shared lock', async t => {
  const f = fixture(t);
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const first = runHistory({ root: f.dir, log: quiet, engineFactory: () => ({
    async analyze(sha) { await blocked; return fakeEngine().analyze(sha); }, async close() {},
  }) });
  await assert.rejects(runHistory({ root: f.dir, log: quiet, engineFactory: fakeEngine }), /Another data operation/);
  release(); await first;
  assert.equal(existsSync(`${f.checkpoint}.writer.lock`), false);
});
test('missing Ruby executable fails and exits cleanly', async t => {
  const f = fixture(t), engine = createEngine(f.dir, join(f.dir, 'missing-ruby'));
  await assert.rejects(engine.analyze(f.a));
  await assert.rejects(engine.close());
});
test('CLI engine version and read-only plan work without Ruby', () => {
  const script = fileURLToPath(new URL('./build-code-history.ts', import.meta.url));
  const env = { ...process.env, CODE_HISTORY_RUBY: '/nonexistent/ruby' };
  assert.equal(invoke(process.execPath, [script, '--engine-version'], root, env), ENGINE_VERSION);
  const plan = JSON.parse(invoke(process.execPath, [script, '--plan'], root, env));
  assert.equal(plan.branch, 'main'); assert.equal(typeof plan.sourceChanged, 'boolean');
});
test('official Linguist bridge: full vs incremental counts, persisted cache and complete pipeline',
  { skip: !process.argv.includes('--engine') }, async t => {
    const f = fixture(t), engine = createEngine(f.dir);
    try {
      const a = await engine.analyze(f.a);
      const incremental = await engine.analyze(f.b, f.a, a.cache);
      const full = await engine.analyze(f.b);
      assert.deepEqual(incremental.languages, full.languages);
      assert.deepEqual(full.languages, { TypeScript: sampleBytes });
      atomicJson(f.checkpoint, { ...METADATA, rows: [{ date: '2026-11-14', sha: f.a, languages: a.languages }], sha: f.a, cache: a.cache });
    } finally { await engine.close(); }
    await runHistory({ root: f.dir, log: quiet });
    assert.deepEqual(JSON.parse(readFileSync(f.output, 'utf8')).rows.map((row: Row) => row.languages),
      [{ TypeScript: sampleBytes }, { TypeScript: sampleBytes }, { TypeScript: sampleBytes }]);
    const bad = createEngine(f.dir);
    await assert.rejects(bad.analyze('not-a-commit'), /Linguist/);
    await assert.rejects(bad.close(), /Linguist/);
  });
