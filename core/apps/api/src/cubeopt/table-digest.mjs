import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';

function identity(info, expected) {
  return JSON.stringify(['cubeopt-sha256-v1', expected, ...['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map(key => String(info[key]))]);
}

// Deployment verification always hashes. Only daemon restarts may reuse a
// successful receipt, bound to the expected digest and nanosecond file identity.
export async function verifyTableDigest(path, expected, { cached = false } = {}) {
  const receipt = `${path}.sha256-verified.json`;
  const handle = await open(path, 'r');
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) throw new Error('CubeOpt table must be a regular file');
    const key = identity(before, expected);
    let hit = false;
    if (cached && process.platform !== 'win32') {
      try {
        const info = await lstat(receipt);
        if (info.isFile() && info.size < 4096) hit = JSON.parse(await readFile(receipt, 'utf8')).identity === key;
      } catch { /* Absent or malformed receipt requires a full hash. */ }
    }
    if (!hit) {
      await unlink(receipt).catch(() => {});
      const hash = createHash('sha256');
      for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
      if (hash.digest('hex') !== expected) throw new Error('table sha256 mismatch');
    }
    const after = await handle.stat({ bigint: true });
    const current = await lstat(path, { bigint: true });
    if (!current.isFile() || key !== identity(after, expected) || key !== identity(current, expected)) {
      throw new Error('CubeOpt table changed during verification');
    }
    if (!hit && process.platform !== 'win32') {
      const temp = `${receipt}.${randomUUID()}.tmp`;
      try {
        const output = await open(temp, 'wx', 0o600);
        try { await output.writeFile(JSON.stringify({ identity: key })); await output.sync(); }
        finally { await output.close(); }
        await rename(temp, receipt);
      } catch { /* Read-only stores remain usable with full verification. */ }
      finally { await unlink(temp).catch(() => {}); }
    }
    return { cached: hit };
  } finally { await handle.close(); }
}
