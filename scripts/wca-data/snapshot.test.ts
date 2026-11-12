import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync, readdirSync, linkSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { managed, owns, inventory, patch, applyPatch, packSnapshot, unpackSnapshot, validate } from './snapshot.ts';
import { activateSnapshot, finalizeSnapshot, recoverSnapshot, prepareSnapshot, verifyPreparedSnapshot, assertStagingSpace } from './snapshot-deploy.ts';
import { sha } from './common.ts';
const commit = '1'.repeat(40), noop = async () => {};
function workspace(t: any) { const p = mkdtempSync(join(tmpdir(), 'stats-snapshot-test-')); t.after(() => rmSync(p, { recursive: true, force: true })); return p; }
function put(root: string, path: string, value: string) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value); }

test('incremental staging verifies the complete inventory, preserves old hardlinks and rolls back on public failure', async t => {
  const root = workspace(t), live = join(root, 'live'), source = join(root, 'source');
  put(source, 'all_past_comps.json', '[1]'); put(source, 'world_bests.json', '[2]');
  cpSync(source, live, { recursive: true });
  const base = await packSnapshot(source, await inventory(source, commit), join(root, 'base'));
  await activateSnapshot(live, join(root, 'base', base.name), base, 'none', noop); finalizeSnapshot(live, base.sha256);
  put(source, 'world_bests.json', '[3]');
  const next = await inventory(source, commit), a = await packSnapshot(source, next, join(root, 'next'));
  const bytes = Buffer.from(JSON.stringify(next)), digest = sha(bytes), inventoryFile = join(root, '_inventory.json'); writeFileSync(inventoryFile, bytes);
  async function stage(name: string) {
    const directory = join(root, name);
    prepareSnapshot(live, directory, { ...a, inventorySha256: digest }, inventoryFile, base.sha256);
    linkSync(join(live, '.stats-data/datasets', base.sha256, 'data/all_past_comps.json'), join(directory, 'data/all_past_comps.json'));
    put(directory, 'data/world_bests.json', '[3]');
    assert.deepEqual(await verifyPreparedSnapshot({ directory, inventorySha256: digest }), next);
    return { directory, inventorySha256: digest };
  }
  const failed = await stage('failed');
  await assert.rejects(activateSnapshot(live, '', a, base.sha256, async () => { throw Error('public failure'); }, failed), /public failure/);
  assert.equal(readFileSync(join(live, 'world_bests.json'), 'utf8'), '[2]');
  const prepared = await stage('success');
  await activateSnapshot(live, '', a, base.sha256, noop, prepared);
  const datasets = join(live, '.stats-data/datasets');
  assert.equal(statSync(join(datasets, base.sha256, 'data/all_past_comps.json')).ino, statSync(join(datasets, a.sha256, 'data/all_past_comps.json')).ino);
  finalizeSnapshot(live, a.sha256);
  assert.equal(readFileSync(join(live, 'all_past_comps.json'), 'utf8'), '[1]');
  assert.equal(readFileSync(join(live, 'world_bests.json'), 'utf8'), '[3]');
  assert.deepEqual(readdirSync(datasets), [a.sha256]);
});

test('prepared snapshots reject changed inventory, missing/extra files, corrupt bytes and symlinks', async t => {
  const root = workspace(t), source = join(root, 'data'); put(source, 'world_bests.json', '[1]');
  const m = await inventory(source, commit), bytes = Buffer.from(JSON.stringify(m)); writeFileSync(join(root, '_inventory.json'), bytes);
  const prepared = { directory: root, inventorySha256: sha(bytes) };
  await verifyPreparedSnapshot(prepared);
  await assert.rejects(verifyPreparedSnapshot({ ...prepared, inventorySha256: 'a'.repeat(64) }), /inventory checksum/);
  put(source, 'world_bests.json', '[2]'); await assert.rejects(verifyPreparedSnapshot(prepared), /file checksum/);
  rmSync(join(source, 'world_bests.json')); await assert.rejects(verifyPreparedSnapshot(prepared), /incomplete/);
  put(source, 'world_bests.json', '[1]'); put(source, 'unexpected.json', '{}'); await assert.rejects(verifyPreparedSnapshot(prepared), /Unexpected prepared file/);
  rmSync(join(source, 'unexpected.json')); symlinkSync('world_bests.json', join(source, 'alias.json')); await assert.rejects(verifyPreparedSnapshot(prepared), /symlink/);
  assert.throws(() => assertStagingSpace(m, 0), /Insufficient/);
  assert.doesNotThrow(() => assertStagingSpace(m, 256 * 1024 * 1024));
});

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
