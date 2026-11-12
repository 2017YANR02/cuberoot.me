import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectCubeoptArtifactSources } from '../scripts/lib/prepare-cubeopt-artifact.mjs';
import { CUBEOPT_ARTIFACT_SCHEMA, CUBEOPT_NATIVE_OPT8, CUBEOPT_EGG_H8, EGG_CPU_FLAGS, assertEggCpu, cubeoptEngineContract, verifyCubeoptBundle } from '../src/cubeopt/artifact.mjs';

const scratch = [];
const nativePlatform = process.platform === 'linux' && process.arch === 'x64';
let eggPlatform = false;
if (nativePlatform) { try { assertEggCpu(await readFile('/proc/cpuinfo', 'utf8')); eggPlatform = true; } catch { /* Expected on baseline-only CI CPUs. */ } }

async function fixture(infoOverrides = {}, contract = CUBEOPT_NATIVE_OPT8) {
  const root = await mkdtemp(join(tmpdir(), 'cubeopt-native-artifact-'));
  scratch.push(root);
  const info = { engine: contract.engine, variant: contract.variant, protocol: 1, maxThreads: 4, optimized: true, ...(contract.upstream ? { upstream: contract.upstream } : {}), ...infoOverrides };
  // A bounded executable contract fixture, never a solver or a table loader.
  const contents = {
    binary: Buffer.from(`#!/bin/sh\n[ "$#" -eq 1 ] && [ "$1" = '--server-info' ] || exit 9\nprintf '%s\\n' '${JSON.stringify(info)}'\n`),
    snapshot: Buffer.from('small snapshot fixture'),
    table: Buffer.from('small table fixture'),
  };
  const manifest = {
    schema: CUBEOPT_ARTIFACT_SCHEMA, bundle: `cubeopt-${contract.variant}-native-fixture`,
    engine: contract.engine, variant: contract.variant, protocol: 1, maxThreads: 4,
    ...(contract.cpuTarget ? { cpuTarget: contract.cpuTarget, tablePrefetch: contract.tablePrefetch } : {}),
    source: { url: 'fixture://native', revision: 'test-only', buildCommand: 'bounded fixture' }, files: {},
  };
  for (const [role, path] of Object.entries(contract.files)) {
    await writeFile(join(root, path), contents[role]);
    manifest.files[role] = { path, bytes: contents[role].length, sha256: createHash('sha256').update(contents[role]).digest('hex') };
  }
  await chmod(join(root, contract.files.binary), 0o700);
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  return { root, manifest };
}

afterEach(async () => {
  await Promise.all(scratch.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('CubeOpt native artifact contract', () => {
  it('keeps egg h8 distinct from incompatible Opt8 files and engines', async () => {
    expect(cubeoptEngineContract('h8', 'egg-native')).toBe(CUBEOPT_EGG_H8);
    for (const [variant, engine] of [['opt8','egg-native'], ['h8','rust-native'], ['h8','emscripten']]) {
      expect(() => cubeoptEngineContract(variant, engine)).toThrow('unsupported engine/variant');
    }
    const { root, manifest } = await fixture({}, CUBEOPT_EGG_H8);
    manifest.files.table.path = 'h48prun31h8.dat';
    await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true })).rejects.toThrow('must be egg-h8.dat');
  });

  it('rejects missing features on any processor before executing an egg binary', () => {
    const supported = `flags : ${EGG_CPU_FLAGS.join(' ')}`;
    expect(() => assertEggCpu(supported)).not.toThrow();
    expect(() => assertEggCpu('')).toThrow('unavailable');
    expect(() => assertEggCpu(`${supported}\nflags : avx2 sse2`)).toThrow('avx512f');
  });

  it('rejects an unmeasured egg build contract', async () => {
    const { root, manifest } = await fixture({}, CUBEOPT_EGG_H8);
    manifest.tablePrefetch = 'nta';
    await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true })).rejects.toThrow('measured skylake-avx512 / t0');
  });

  it.skipIf(!eggPlatform)('accepts the fixed egg protocol and rejects a different upstream revision', async () => {
    const valid = await fixture({}, CUBEOPT_EGG_H8);
    expect((await verifyCubeoptBundle(valid.root, { allowFixtureSizes: true })).manifest.engine).toBe('egg-native');
    const changed = await fixture({ upstream: 'different-table-layout' }, CUBEOPT_EGG_H8);
    await expect(verifyCubeoptBundle(changed.root, { allowFixtureSizes: true })).rejects.toThrow('binary contract mismatch');
  });

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
