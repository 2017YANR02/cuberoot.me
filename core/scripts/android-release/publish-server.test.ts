import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { publish } from './publish-server.mjs';

test('Windows promotion preserves the old manifest on public verification failure and never downgrades', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cuberoot-publish-'));
  const source = join(root, 'source'), base = join(root, 'downloads');
  const originalFetch = globalThis.fetch;
  try {
    await mkdir(source); await mkdir(join(base, 'windows'), { recursive: true });
    const old = { versionCode: 1 };
    await writeFile(join(base, 'windows/latest.json'), JSON.stringify(old));
    const data = Buffer.from('test executable'), sha256 = createHash('sha256').update(data).digest('hex');
    const metadata = { versionCode: 2, versionName: '1.0.2', commit: 'a'.repeat(40), files: {} as Record<string, unknown> };
    for (const kind of ['installer', 'portable']) {
      const name = `CubeRoot-1.0.2-2-x64-${kind}.exe`;
      await writeFile(join(source, name), data);
      metadata.files[kind] = { url: `https://static.cuberoot.me/downloads/windows/${name}`, sha256, size: data.length };
    }
    await writeFile(join(source, 'latest.json'), JSON.stringify(metadata));
    globalThis.fetch = async () => new Response('wrong content');
    await assert.rejects(publish(source, 'windows', base), /Public artifact/);
    assert.deepEqual(JSON.parse(await readFile(join(base, 'windows/latest.json'), 'utf8')), old);
    globalThis.fetch = async () => new Response(data);
    await publish(source, 'windows', base);
    assert.deepEqual(JSON.parse(await readFile(join(base, 'windows/latest.json'), 'utf8')), metadata);
    await publish(source, 'windows', base);
    await writeFile(join(base, 'windows/latest.json'), JSON.stringify({ versionCode: 3 }));
    await assert.rejects(publish(source, 'windows', base), /downgrade/);
  } finally { globalThis.fetch = originalFetch; await rm(root, { recursive: true, force: true }); }
});
