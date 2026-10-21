import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, rename, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyTableDigest } from '../src/cubeopt/table-digest.mjs';

const scratch = [];
const sha256 = data => createHash('sha256').update(data).digest('hex');
const supportsCache = process.platform !== 'win32';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'cubeopt-digest-'));
  scratch.push(directory);
  const path = join(directory, 'table.dat');
  const content = Buffer.from('bounded deterministic pruning table fixture');
  await writeFile(path, content);
  return { directory, path, content, digest: sha256(content), receipt: `${path}.sha256-verified.json` };
}

afterEach(async () => {
  await Promise.all(scratch.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('CubeOpt table SHA receipt', () => {
  it('hashes initially, reuses the same identity only on Unix, and always honors a full verification', async () => {
    const f = await fixture();
    expect(await verifyTableDigest(f.path, f.digest, { cached: true })).toEqual({ cached: false });
    expect(await verifyTableDigest(f.path, f.digest, { cached: true })).toEqual({ cached: supportsCache });
    expect(await verifyTableDigest(f.path, f.digest)).toEqual({ cached: false });
  });

  it('binds a receipt to the expected SHA and removes it when a full check fails', async () => {
    const f = await fixture();
    await verifyTableDigest(f.path, f.digest);
    await expect(verifyTableDigest(f.path, sha256('other content'), { cached: true })).rejects.toThrow('sha256 mismatch');
    await expect(lstat(f.receipt)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await verifyTableDigest(f.path, f.digest, { cached: true })).toEqual({ cached: false });
  });

  it('rejects changed bytes even when size and mtime are restored', async () => {
    const f = await fixture();
    await verifyTableDigest(f.path, f.digest);
    const original = await lstat(f.path);
    const corrupted = Buffer.from(f.content);
    corrupted[0] ^= 1;
    await writeFile(f.path, corrupted);
    await utimes(f.path, original.atime, original.mtime);
    await expect(verifyTableDigest(f.path, f.digest, { cached: true })).rejects.toThrow('sha256 mismatch');
  });

  it('rehashes a replaced inode even if the bytes and mtime are unchanged', async () => {
    const f = await fixture();
    await verifyTableDigest(f.path, f.digest);
    const original = await lstat(f.path);
    const replacement = join(f.directory, 'replacement.dat');
    await writeFile(replacement, f.content);
    await utimes(replacement, original.atime, original.mtime);
    await rename(replacement, f.path);
    expect(await verifyTableDigest(f.path, f.digest, { cached: true })).toEqual({ cached: false });
  });

  it.each(['{malformed', '{}', JSON.stringify({ identity: 'obsolete-version' }), 'x'.repeat(4096)])(
    'recovers a malformed or stale receipt without trusting it (%#)', async receipt => {
      const f = await fixture();
      await writeFile(f.receipt, receipt);
      expect(await verifyTableDigest(f.path, f.digest, { cached: true })).toEqual({ cached: false });
      if (supportsCache) expect(JSON.parse(await readFile(f.receipt, 'utf8')).identity).toContain(f.digest);
    },
  );

  it.skipIf(!supportsCache)('does not follow a receipt symlink or modify its target', async () => {
    const f = await fixture();
    const target = join(f.directory, 'unrelated.json');
    await writeFile(target, 'must remain unchanged');
    await symlink(target, f.receipt);
    expect(await verifyTableDigest(f.path, f.digest, { cached: true })).toEqual({ cached: false });
    expect(await readFile(target, 'utf8')).toBe('must remain unchanged');
    expect((await lstat(f.receipt)).isSymbolicLink()).toBe(false);
  });
});
