import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPgPublication } from './pg-publication-state.ts';
const a = 'a'.repeat(64), b = 'b'.repeat(64), c = 'c'.repeat(64);
function fixture(t: any) { const path = mkdtempSync(join(tmpdir(), 'pg-publish-state-')); t.after(() => rmSync(path, { recursive: true, force: true })); return path; }

test('a second publisher cannot overwrite a newer database generation; replay does not rerun SQL', async t => {
  const root = fixture(t); await applyPgPublication(root, { domain: 'steps', before: null, after: a }, () => {}, () => 'match'); let writes = 0;
  await applyPgPublication(root, { domain: 'steps', before: a, after: b }, () => { writes++; });
  await assert.rejects(applyPgPublication(root, { domain: 'steps', before: a, after: c }, () => { writes++; }), /Concurrent PG/);
  assert.equal(await applyPgPublication(root, { domain: 'steps', before: a, after: b }, () => { writes++; }), 'replayed');
  assert.equal(writes, 1);
});

test('uncertain SQL outcome retains its journal and only the exact candidate may resume', async t => {
  const root = fixture(t); await applyPgPublication(root, { domain: 'optimal-333', before: null, after: a }, () => {}, () => 'match');
  const request = { domain: 'optimal-333', before: a, after: b };
  await assert.rejects(applyPgPublication(root, request, () => { throw Error('connection lost after commit'); }), /connection lost/);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'optimal-333.pending.json'), 'utf8')), request);
  await assert.rejects(applyPgPublication(root, { ...request, after: c }, () => {}), /Unfinished PG/);
  await applyPgPublication(root, request, () => {});
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'optimal-333.json'), 'utf8')), { token: b });
});

test('uninitialized and protected baselines cannot be silently adopted or replaced', async t => {
  const root = fixture(t);
  await assert.rejects(applyPgPublication(root, { domain: 'steps', before: a, after: b }, () => { throw Error('must not mutate'); }), /not initialized/);
  await assert.rejects(applyPgPublication(root, { domain: 'steps', before: null, after: a }, () => { throw Error('must not mutate'); }, () => 'different'), /not initialized/);
  await applyPgPublication(root, { domain: 'steps', before: null, after: a }, () => {}, () => 'empty');
  await assert.rejects(applyPgPublication(root, { domain: 'steps', before: null, after: b }, () => {}, () => 'empty'), /Concurrent PG/);
});

test('mirror supplements run on initial matching snapshots and every idempotent replay', async t => {
  const root = fixture(t), request = { domain: 'mirror', before: null, after: a }; let applied = 0, ensured = 0;
  const apply = () => { applied++; }, ensure = () => { ensured++; };
  assert.equal(await applyPgPublication(root, request, apply, () => 'match', ensure), 'replayed');
  assert.equal(await applyPgPublication(root, request, apply, undefined, ensure), 'replayed');
  assert.equal(applied, 0); assert.equal(ensured, 2);
});

test('missing server receipt with a pending journal refuses initialization without writing a receipt', async t => {
  const root = fixture(t), request = { domain: 'steps', before: null, after: a };
  writeFileSync(join(root, 'steps.pending.json'), JSON.stringify(request));
  let verified = false;
  await assert.rejects(applyPgPublication(root, request, () => {}, () => { verified = true; return 'match'; }), /Unfinished PG/);
  assert.equal(verified, false); assert.equal(existsSync(join(root, 'steps.json')), false);
});
