import test from 'node:test';
import assert from 'node:assert/strict';
import { FILES, readReleaseBody, renderReleaseBody } from './common.ts';

const hash = (c: string) => c.repeat(64);
const manifest = {
  schema: 1, sourceCommit: 'a'.repeat(40), generatedAt: '2026-11-11T00:00:00Z', exportDate: '2026-11-11', personCount: 1, rankCount: 1,
  archive: { name: `wca-data-${hash('a')}.tar`, bytes: 10, sha256: hash('a') },
  statistics: { name: `stats-snapshot-${hash('b')}.tgz`, bytes: 10, sha256: hash('b') },
  files: FILES.map(path => ({ path, bytes: 1, sha256: hash('c') })),
};

test('Release notes round trip preserves descriptors, extensions and legacy JSON', () => {
  const value = { ...manifest, extension: { future: true } };
  assert.deepEqual(readReleaseBody(JSON.stringify(value)), value);
  const notes = renderReleaseBody(value);
  assert.ok(notes.startsWith('这里保存 CubeRoot'));
  assert.ok(notes.includes('<details>'));
  assert.deepEqual(readReleaseBody(notes), value);
  assert.equal(renderReleaseBody(readReleaseBody(notes)), notes);
  assert.throws(() => readReleaseBody(notes + notes), /duplicate/);
  assert.throws(() => readReleaseBody('Unstructured notes'), /manifest/);
  assert.throws(() => renderReleaseBody({}), /manifest/);
});

