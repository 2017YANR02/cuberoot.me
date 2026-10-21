import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectCubeoptArtifactSources } from '../scripts/lib/prepare-cubeopt-artifact.mjs';
import { CUBEOPT_ARTIFACT_SCHEMA, CUBEOPT_NATIVE_OPT8, cubeoptEngineContract, verifyCubeoptBundle } from '../src/cubeopt/artifact.mjs';

const scratch = [];
const nativePlatform = process.platform === 'linux' && process.arch === 'x64';

async function fixture(infoOverrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cubeopt-native-artifact-'));
  scratch.push(root);
  const info = { engine: 'rust-native', variant: 'opt8', protocol: 1, maxThreads: 4, optimized: true, ...infoOverrides };
  // A bounded executable contract fixture, never a solver or a table loader.
  const contents = {
    binary: Buffer.from(`#!/bin/sh\n[ "$#" -eq 1 ] && [ "$1" = '--server-info' ] || exit 9\nprintf '%s\\n' '${JSON.stringify(info)}'\n`),
    snapshot: Buffer.from('small snapshot fixture'),
    table: Buffer.from('small table fixture'),
  };
  const manifest = {
    schema: CUBEOPT_ARTIFACT_SCHEMA, bundle: 'cubeopt-opt8-native-fixture',
    engine: 'rust-native', variant: 'opt8', protocol: 1, maxThreads: 4,
    source: { url: 'fixture://native', revision: 'test-only', buildCommand: 'bounded fixture' }, files: {},
  };
  for (const [role, path] of Object.entries(CUBEOPT_NATIVE_OPT8.files)) {
    await writeFile(join(root, path), contents[role]);
    manifest.files[role] = { path, bytes: contents[role].length, sha256: createHash('sha256').update(contents[role]).digest('hex') };
  }
  await chmod(join(root, CUBEOPT_NATIVE_OPT8.files.binary), 0o700);
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  return { root, manifest };
}

afterEach(async () => {
  await Promise.all(scratch.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('CubeOpt native artifact contract', () => {
  it('requires Opt8 and the binary/snapshot/table roles with fixed filenames', () => {
    expect(cubeoptEngineContract('opt8', 'rust-native')).toBe(CUBEOPT_NATIVE_OPT8);
    expect(() => cubeoptEngineContract('opt6', 'rust-native')).toThrow('unsupported engine/variant');
    const source = { engine: 'rust-native', binaryPath: '/tmp/cube48opt-native', snapshotPath: '/tmp/cube48opt8.small.bin', tablePath: '/tmp/h48prun31h8.dat' };
    expect(detectCubeoptArtifactSources(source)).toBe(CUBEOPT_NATIVE_OPT8);
    expect(() => detectCubeoptArtifactSources({ ...source, binaryPath: '/tmp/other' })).toThrow('must be named cube48opt-native');
    expect(() => detectCubeoptArtifactSources({ ...source, snapshotPath: undefined })).toThrow('must be named cube48opt8.small.bin');
  });

  it('rejects a mismatched manifest thread contract before executing a binary', async () => {
    const { root, manifest } = await fixture();
    manifest.maxThreads = 8;
    await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true })).rejects.toThrow('maxThreads must be 4');
  });

  it('checks the binary hash before any executable contract probe', async () => {
    const { root } = await fixture();
    const path = join(root, CUBEOPT_NATIVE_OPT8.files.binary);
    // Preserve byte length; this must be a hash failure, not merely a size failure.
    const bytes = await readFile(path);
    bytes[0] ^= 1;
    await writeFile(path, bytes);
    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true })).rejects.toThrow('binary sha256 mismatch');
  });

  it.skipIf(nativePlatform)('rejects a native bundle on unsupported hosts without trying to execute it', async () => {
    const { root } = await fixture();
    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true })).rejects.toThrow('requires Linux x86_64');
  });

  it.skipIf(!nativePlatform)('accepts an optimized Linux executable reporting the exact service protocol', async () => {
    const { root } = await fixture();
    const verified = await verifyCubeoptBundle(root, { allowFixtureSizes: true });
    expect(verified.binaryPath).toBe(join(root, CUBEOPT_NATIVE_OPT8.files.binary));
    expect(verified.manifest.engine).toBe('rust-native');
  });

  it.skipIf(!nativePlatform).each([{ optimized: false }, { protocol: 2 }, { variant: 'opt9' }, { maxThreads: 8 }])(
    'rejects an incompatible binary service report %j', async info => {
      const { root } = await fixture(info);
      await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true })).rejects.toThrow('binary contract mismatch');
    },
  );
});
