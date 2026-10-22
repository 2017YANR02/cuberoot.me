import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { managed, owns, inventory, patch, applyPatch, packSnapshot, unpackSnapshot, validate } from './snapshot.ts';
import { activateSnapshot, finalizeSnapshot, recoverSnapshot } from './snapshot-deploy.ts';
const commit = '1'.repeat(40), noop = async () => {};
function workspace(t: any) { const p = mkdtempSync(join(tmpdir(), 'stats-snapshot-test-')); t.after(() => rmSync(p, { recursive: true, force: true })); return p; }
function put(root: string, path: string, value: string) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value); }

test('ownership preserves authored media, binary exports and server-only scramble shards', () => {
  for (const path of ['all_past_comps.json', 'records/history/world.json', 'scramble/distribution.json', 'scramble/downloads/a.txt']) assert(managed(path));
  for (const path of ['../escape.json', 'stats/../escape.json', 'tutorial/a.json', 'comp/a.json', 'scramble/steps/checkpoint.json', 'scramble/comp_steps/a.json', 'persons_search.json.gz', 'nemesizer/meta.json']) assert(!managed(path));
  assert(owns('wca', 'all_past_comps.json')); assert(!owns('wca', 'all_upcoming_comps.json')); assert(!owns('upcoming', 'all_past_comps.json')); assert(!owns('wca', 'comp_calendar/index.json'));
});

test('verified archives preserve bytes and reject corrupt data or invalid inventories', async t => {
  const root = workspace(t), source = join(root, 'source'); put(source, 'all_past_comps.json', '[]'); put(source, 'scramble/downloads/a.txt', 'R U R\'\n');
  const m = await inventory(source, commit), a = await packSnapshot(source, m, join(root, 'pack'));
  const unpacked = await unpackSnapshot(join(root, 'pack', a.name), join(root, 'out'), a); assert.deepEqual(unpacked, m);
  assert.equal(readFileSync(join(root, 'out/data/scramble/downloads/a.txt'), 'utf8'), 'R U R\'\n');
  assert.throws(() => validate({ ...m, files: [{ ...m.files[0], path: '../escape.json' }] }), /file record/);
  const corrupt = readFileSync(join(root, 'pack', a.name)); corrupt[20] ^= 1; writeFileSync(join(root, 'pack', a.name), corrupt);
  await assert.rejects(unpackSnapshot(join(root, 'pack', a.name), join(root, 'corrupt'), a), /checksum/);
});

test('owner patches merge independent writers, reject conflicting updates before mutation and replay safely', async t => {
  const root = workspace(t), source = join(root, 'source'); put(source, 'all_past_comps.json', '[1]'); put(source, 'all_upcoming_comps.json', '[2]');
  const base = await inventory(source, commit); put(source, 'all_past_comps.json', '[3]');
  const change = patch(base, await inventory(source, commit), 'wca');
  const a = await packSnapshot(source, change, join(root, 'pack')); const extracted = join(root, 'patch'); await unpackSnapshot(join(root, 'pack', a.name), extracted);
  const live = join(root, 'live'); put(live, 'all_past_comps.json', '[1]'); put(live, 'all_upcoming_comps.json', '[4]');
  applyPatch(live, await inventory(live, commit), change, extracted);
  assert.equal(readFileSync(join(live, 'all_past_comps.json'), 'utf8'), '[3]'); assert.equal(readFileSync(join(live, 'all_upcoming_comps.json'), 'utf8'), '[4]');
  applyPatch(live, await inventory(live, commit), change, extracted);
  put(live, 'all_past_comps.json', '[5]'); assert.throws(() => applyPatch(live, { ...base, files: base.files.map(f => f.path === 'all_past_comps.json' ? { ...f, sha256: 'a'.repeat(64) } : f) }, change, extracted), /Concurrent/);
  assert.equal(readFileSync(join(live, 'all_past_comps.json'), 'utf8'), '[5]');
});

test('atomic adoption, interrupted rollback and finalization retain only latest snapshot without touching siblings', async t => {
  const root = workspace(t), live = join(root, 'live'), source = join(root, 'source');
  put(live, 'all_past_comps.json', '[1]'); put(live, 'scramble/distribution.json', '[2]'); put(live, 'comp/keep.json', 'keep'); put(live, 'scramble/steps/checkpoint.json', 'checkpoint');
  put(live, 'scramble/downloads/a.txt', 'R U');
  writeFileSync(join(live, 'scramble/downloads/._a.txt'), Buffer.from([0, 5, 22, 7, 0, 2, 0, 0]));
  cpSync(live, source, { recursive: true });
  const m = await inventory(source, commit), a = await packSnapshot(source, m, join(root, 'pack1'));
  await activateSnapshot(live, join(root, 'pack1', a.name), a, 'none', noop); finalizeSnapshot(live, a.sha256);
  assert(!existsSync(join(live, 'scramble/downloads/._a.txt')));
  put(source, 'all_past_comps.json', '[3]'); put(source, 'new_stat.json', '[4]');
  const b = await packSnapshot(source, await inventory(source, commit), join(root, 'pack2'));
  await assert.rejects(activateSnapshot(live, join(root, 'pack2', b.name), b, a.sha256, async () => { throw Error('public verification failed'); }), /verification/);
  assert.equal(readFileSync(join(live, 'all_past_comps.json'), 'utf8'), '[1]'); assert(!existsSync(join(live, 'new_stat.json')));
  await activateSnapshot(live, join(root, 'pack2', b.name), b, a.sha256, noop); recoverSnapshot(live, b.sha256);
  assert.equal(readFileSync(join(live, 'all_past_comps.json'), 'utf8'), '[3]'); assert.equal(readFileSync(join(live, 'comp/keep.json'), 'utf8'), 'keep'); assert.equal(readFileSync(join(live, 'scramble/steps/checkpoint.json'), 'utf8'), 'checkpoint');
  assert.deepEqual(readdirSync(join(live, '.stats-data/datasets')), [b.sha256]);
});

test('daily producers union the shared elevation cache without losing concurrent coordinates', async t => {
  const root = workspace(t), source = join(root, 'source'), live = join(root, 'live');
  put(source, 'comp_elevations.json', '{"1.0000,2.0000":3}'); const base = await inventory(source, commit);
  put(source, 'comp_elevations.json', '{"1.0000,2.0000":3,"4.0000,5.0000":6}');
  const change = patch(base, await inventory(source, commit), 'wca');
  const a = await packSnapshot(source, change, join(root, 'pack')); const extracted = join(root, 'patch'); await unpackSnapshot(join(root, 'pack', a.name), extracted);
  put(live, 'comp_elevations.json', '{"1.0000,2.0000":3,"7.0000,8.0000":9}');
  applyPatch(live, await inventory(live, commit), change, extracted);
  assert.deepEqual(JSON.parse(readFileSync(join(live, 'comp_elevations.json'), 'utf8')), { '1.0000,2.0000': 3, '4.0000,5.0000': 6, '7.0000,8.0000': 9 });
  put(live, 'comp_elevations.json', '{"1.0000,2.0000":99}');
  assert.throws(() => applyPatch(live, { ...base, files: [] }, change, extracted), /Concurrent elevation/);
});
