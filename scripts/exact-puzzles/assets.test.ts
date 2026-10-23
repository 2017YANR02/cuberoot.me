import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';
import { assetPath, hydrate, inventoryHash, prepare, readReleaseManifest, type Asset, type DownloadManifest } from './assets.ts';

test('exact corpus archives restore into an empty root and reject changed archives and paths', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'exact-corpus-fixture-'));
  try {
    const source = join(temporary, 'source'), prepared = join(temporary, 'prepared'), restored = join(temporary, 'restored');
    async function file(name: string, content: string, rows: number): Promise<Asset> {
      const bytes = gzipSync(content), a = { url: '', bytes: bytes.length, rows, sha256: createHash('sha256').update(bytes).digest('hex') };
      const relative = assetPath('tiny', a, name); a.url = `/stats/${relative}`;
      await mkdir(dirname(join(source, relative)), { recursive: true }); await writeFile(join(source, relative), bytes); return a;
    }
    const manifest: DownloadManifest = { schemaVersion: 1, puzzles: { tiny: {
      allStates: await file('all.csv.gz', 'optimal_length,scramble\n0,\n1,U\n', 2),
      byDepth: { '0': await file('depth-0.txt.gz', '\n', 1), '1': await file('depth-1.txt.gz', 'U\n', 1) },
    } } };
    manifest.inventorySha256 = inventoryHash(manifest);
    const result = await prepare(manifest, source, prepared);
    const oversized = join(prepared, 'oversized.json');
    await writeFile(oversized, ''); await truncate(oversized, 2 ** 20);
    await assert.rejects(readReleaseManifest(oversized), /bounded file below 1 MiB/);
    assert.deepEqual(await hydrate(result.path, prepared, restored), { events: 1, files: 3, inventorySha256: manifest.inventorySha256 });
    for (const a of result.manifest.archives[0].files) assert.deepEqual(await readFile(join(restored, a.path)), await readFile(join(source, a.path)));
    assert.deepEqual(await hydrate(result.path, prepared, restored), { events: 1, files: 3, inventorySha256: manifest.inventorySha256 });
    const archive = join(prepared, result.manifest.archives[0].name), bytes = await readFile(archive); bytes[0] ^= 1; await writeFile(archive, bytes);
    await assert.rejects(hydrate(result.path, prepared, join(temporary, 'corrupt')), /Checksum mismatch/);
    const malicious = structuredClone(result.manifest); malicious.archives[0].files[0].path = '../escaped';
    const json = JSON.stringify(malicious), changed = join(prepared, `exact-puzzles-${createHash('sha256').update(json).digest('hex')}.json`);
    await writeFile(changed, json); await assert.rejects(readReleaseManifest(changed));
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
