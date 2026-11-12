import test from 'node:test';
import assert from 'node:assert/strict';
import { FILES, readReleaseBody, renderReleaseBody } from './common.ts';
import { cleanupPlan, RETENTION_MS } from './maintenance.ts';

const now = Date.parse('2026-11-12T12:00:00Z');
const hash = (c: string) => c.repeat(64);
const manifest = {
  schema: 1, sourceCommit: 'a'.repeat(40), generatedAt: '2026-11-11T00:00:00Z', exportDate: '2026-11-11', personCount: 1, rankCount: 1,
  archive: { name: `wca-data-${hash('a')}.tar`, bytes: 10, sha256: hash('a') },
  statistics: { name: `stats-snapshot-${hash('b')}.tgz`, bytes: 10, sha256: hash('b') },
  files: FILES.map(path => ({ path, bytes: 1, sha256: hash('c') })),
};
const body = JSON.stringify(manifest);
const asset = (name: string, age = RETENTION_MS + 1) => ({ id: name.charCodeAt(0), name, size: 10, created_at: new Date(now - age).toISOString() });
const current = [asset(manifest.archive.name), asset(manifest.statistics.name)];

test('expiry preserves current data, staging grace period and unrelated asset families', () => {
  const expired = [asset(`stats-patch-${hash('c')}.tgz`), asset(`stats-snapshot-${hash('d')}.tgz`), asset(`wca-data-${hash('e')}.tar`), asset(`candidate-${hash('f')}.json`)];
  const recent = asset(`stats-patch-${hash('d')}.tgz`, RETENTION_MS - 1);
  const unknown = asset('exact-puzzles-snapshot.tar');
  const invalidDate = { ...asset(`stats-patch-${hash('e')}.tgz`), created_at: 'invalid' };
  const all = [...current, ...expired, recent, unknown, invalidDate];
  assert.deepEqual(cleanupPlan(body, all, now), expired);
  assert.deepEqual(cleanupPlan(renderReleaseBody(manifest), all.filter(a => !expired.includes(a)), now), []);
});

test('a recent candidate protects an old archive reused by content hash', () => {
  const oldArchive = asset(`wca-data-${hash('d')}.tar`);
  const recentCandidate = asset(`candidate-${hash('d')}.json`, 1000);
  assert.deepEqual(cleanupPlan(body, [...current, oldArchive, recentCandidate], now), []);
});

test('missing current assets and corrupt descriptors stop all cleanup', () => {
  const old = asset(`stats-patch-${hash('f')}.tgz`);
  assert.throws(() => cleanupPlan(body, [current[0], old], now), /missing/);
  assert.throws(() => cleanupPlan(JSON.stringify({ ...manifest, statistics: { ...manifest.statistics, sha256: hash('e') } }), [...current, old], now), /descriptor/);
  assert.throws(() => cleanupPlan('bad body', [...current, old], now), /manifest/);
});
