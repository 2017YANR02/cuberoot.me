import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareCubeoptArtifact } from '../scripts/prepare-cubeopt-artifact.mjs';
import {
  CUBEOPT_ARTIFACT_SCHEMA,
  CUBEOPT_POINTER_SCHEMA,
  CUBEOPT_PROTOCOL,
  loadCubeoptArtifact,
  promoteCubeoptBundle,
  syncDirectoryDurably,
  verifyCubeoptBundle,
} from '../src/cubeopt/artifact.mjs';
import { cubeoptChildEnv, resolveCubeoptArtifactConfig } from '../src/cubeopt/config.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scratchDirs = [];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function makeFixture({ store: existingStore, bundle = 'cubeopt-opt5-test-fixture' } = {}) {
  const store = existingStore || await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-'));
  if (!existingStore) scratchDirs.push(store);
  const root = join(store, 'bundles', bundle);
  await mkdir(root, { recursive: true });
  const contents = {
    module: Buffer.from('// fixture references cube48opt5.mjs and cube48opt5.wasm\nexport default async () => ({});\n'),
    wasm: Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
    table: Buffer.from('small deterministic opt5 table fixture\n'),
  };
  const paths = {
    module: 'cube48opt5.mjs',
    wasm: 'cube48opt5.wasm',
    table: 'h48prun31h5.dat',
  };
  for (const role of Object.keys(paths)) {
    await writeFile(join(root, paths[role]), contents[role]);
  }
  const manifest = {
    schema: CUBEOPT_ARTIFACT_SCHEMA,
    bundle,
    variant: 'opt5',
    protocol: CUBEOPT_PROTOCOL,
    source: {
      url: 'fixture://cubeopt',
      revision: 'test-only',
      buildCommand: 'create deterministic fixture',
    },
    files: Object.fromEntries(Object.keys(paths).map((role) => [role, {
      path: paths[role],
      bytes: contents[role].length,
      sha256: sha256(contents[role]),
    }])),
  };
  await writeFile(join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, store, bundle, manifest };
}

async function writeManifest(root, manifest) {
  await writeFile(join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

afterEach(async () => {
  await Promise.all(scratchDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('CubeOpt artifact bundle', () => {
  it('prefers the artifact store and strips all legacy path variables', () => {
    const env = {
      CUBEOPT_SOLVE_ENABLED: '1',
      CUBEOPT_ARTIFACT_DIR: '/api-owned/cubeopt',
      CUBEOPT_DAEMON_SCRIPT: '/web/legacy-daemon.mjs',
      CUBEOPT_MODULE: '/web/cube48opt5.mjs',
      CUBEOPT_TABLE: '/solver/tables/h48prun31h5.dat',
    };
    const config = resolveCubeoptArtifactConfig(env);

    expect(config.configError).toBeNull();
    expect(config.artifactStore).toBe(resolve('/api-owned/cubeopt'));
    expect(config.warning).toMatch(/ignoring legacy CUBEOPT_DAEMON_SCRIPT, CUBEOPT_MODULE, CUBEOPT_TABLE/);
    const childEnv = cubeoptChildEnv(env, config.artifactStore);
    expect(childEnv.CUBEOPT_ARTIFACT_DIR).toBe(resolve('/api-owned/cubeopt'));
    expect(childEnv).not.toHaveProperty('CUBEOPT_DAEMON_SCRIPT');
    expect(childEnv).not.toHaveProperty('CUBEOPT_MODULE');
    expect(childEnv).not.toHaveProperty('CUBEOPT_TABLE');
  });

  it('does not use legacy paths when the required artifact store is missing', () => {
    const config = resolveCubeoptArtifactConfig({
      CUBEOPT_SOLVE_ENABLED: '1',
      CUBEOPT_MODULE: '/web/cube48opt5.mjs',
      CUBEOPT_TABLE: '/solver/tables/h48prun31h5.dat',
    });

    expect(config.artifactStore).toBeNull();
    expect(config.configError).toMatch(/CUBEOPT_ARTIFACT_DIR is required/);
  });

  it('resolves all runtime files through one verified current pointer', async () => {
    const { root, store, bundle } = await makeFixture();
    await promoteCubeoptBundle(store, bundle, { allowFixtureSizes: true });
    const artifact = await loadCubeoptArtifact(store, { allowFixtureSizes: true });

    expect(artifact.manifest.variant).toBe('opt5');
    expect(artifact.modulePath).toBe(join(root, 'cube48opt5.mjs'));
    expect(artifact.wasmPath).toBe(join(root, 'cube48opt5.wasm'));
    expect(artifact.tablePath).toBe(join(root, 'h48prun31h5.dat'));
    expect(JSON.parse(await readFile(join(store, 'current.json'), 'utf8'))).toEqual({
      schema: CUBEOPT_POINTER_SCHEMA,
      bundle,
    });
    expect(Object.values(artifact).join('\n')).not.toMatch(/packages[\\/]client[\\/]public|solver[\\/]tables/);
  });

  it('rejects a missing current pointer', async () => {
    const store = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-'));
    scratchDirs.push(store);

    await expect(loadCubeoptArtifact(store, { allowFixtureSizes: true }))
      .rejects.toThrow(/cannot read current\.json/);
  });

  it('rejects a missing manifest', async () => {
    const store = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-'));
    scratchDirs.push(store);
    const root = join(store, 'bundles', 'cubeopt-opt5-missing-manifest');
    await mkdir(root, { recursive: true });

    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true }))
      .rejects.toThrow(/cannot read manifest\.json/);
  });

  it('rejects a missing manifest-listed file', async () => {
    const { root } = await makeFixture();
    await rm(join(root, 'cube48opt5.wasm'));

    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true }))
      .rejects.toThrow(/missing wasm file cube48opt5\.wasm/);
  });

  it('rejects a file whose SHA-256 does not match the manifest', async () => {
    const { root, manifest } = await makeFixture();
    manifest.files.module.sha256 = '0'.repeat(64);
    await writeManifest(root, manifest);

    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true }))
      .rejects.toThrow(/module sha256 mismatch/);
  });

  it('rejects a manifest for a different CubeOpt variant', async () => {
    const { root, manifest } = await makeFixture();
    manifest.variant = 'opt6';
    await writeManifest(root, manifest);

    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true }))
      .rejects.toThrow(/variant must be opt5/);
  });

  it.each([
    ['schema', (manifest) => { manifest.schema = 'cuberoot.cubeopt-artifact/v2'; }, /unsupported schema/],
    ['protocol', (manifest) => { manifest.protocol = 2; }, /protocol must be 1/],
    ['source', (manifest) => { delete manifest.source.revision; }, /source\.revision must be a non-empty string/],
    ['bytes', (manifest) => { manifest.files.wasm.bytes += 1; }, /wasm size mismatch/],
  ])('rejects invalid manifest %s metadata', async (_field, mutate, expected) => {
    const { root, manifest } = await makeFixture();
    mutate(manifest);
    await writeManifest(root, manifest);

    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true })).rejects.toThrow(expected);
  });

  it('rejects fixture-sized tables under the production contract', async () => {
    const { root } = await makeFixture();
    await expect(verifyCubeoptBundle(root)).rejects.toThrow(/opt5 table must be 972840960 bytes/);
  });

  it('rejects a wrapper that references another variant', async () => {
    const { root, manifest } = await makeFixture();
    const moduleSource = Buffer.from('// cube48opt5.mjs cube48opt5.wasm cube48opt6.wasm\n');
    await writeFile(join(root, 'cube48opt5.mjs'), moduleSource);
    manifest.files.module.bytes = moduleSource.length;
    manifest.files.module.sha256 = sha256(moduleSource);
    await writeManifest(root, manifest);

    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true }))
      .rejects.toThrow(/non-opt5 cube48opt reference/);
  });

  it('keeps current on a verified bundle and never exposes a failed promotion', async () => {
    const first = await makeFixture({ bundle: 'cubeopt-opt5-first' });
    await promoteCubeoptBundle(first.store, first.bundle, { allowFixtureSizes: true });

    const bad = await makeFixture({ store: first.store, bundle: 'cubeopt-opt5-bad' });
    bad.manifest.files.table.sha256 = '0'.repeat(64);
    await writeManifest(bad.root, bad.manifest);
    await expect(promoteCubeoptBundle(first.store, bad.bundle, { allowFixtureSizes: true }))
      .rejects.toThrow(/table sha256 mismatch/);
    expect((await loadCubeoptArtifact(first.store, { allowFixtureSizes: true })).manifest.bundle)
      .toBe(first.bundle);

    const second = await makeFixture({ store: first.store, bundle: 'cubeopt-opt5-second' });
    await promoteCubeoptBundle(first.store, second.bundle, { allowFixtureSizes: true });
    expect((await loadCubeoptArtifact(first.store, { allowFixtureSizes: true })).manifest.bundle)
      .toBe(second.bundle);
    expect((await readdir(first.store)).filter((name) => name.startsWith('.current.'))).toEqual([]);
  });

  it('surfaces production directory fsync failures and still closes the handle', async () => {
    const failure = Object.assign(new Error('disk I/O failure'), { code: 'EIO' });
    const close = vi.fn(async () => undefined);

    await expect(syncDirectoryDurably('/artifact-store', {
      platform: 'linux',
      openDirectory: async () => ({
        sync: async () => { throw failure; },
        close,
      }),
    })).rejects.toBe(failure);
    expect(close).toHaveBeenCalledOnce();
  });

  it('only ignores explicit unsupported directory fsync errors off Linux', async () => {
    const unsupported = Object.assign(new Error('directory fsync unsupported'), { code: 'EINVAL' });
    const close = vi.fn(async () => undefined);

    await expect(syncDirectoryDurably('/artifact-store', {
      platform: 'win32',
      openDirectory: async () => ({
        sync: async () => { throw unsupported; },
        close,
      }),
    })).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  });

  it('removes prepare staging directories when production verification fails', async () => {
    const source = await makeFixture({ bundle: 'cubeopt-opt5-prepare-source' });
    const targetStore = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-prepare-'));
    scratchDirs.push(targetStore);
    const targetBundle = 'cubeopt-opt5-prepare-cleanup';
    await expect(prepareCubeoptArtifact({
      storeDir: targetStore,
      bundle: targetBundle,
      modulePath: join(source.root, 'cube48opt5.mjs'),
      wasmPath: join(source.root, 'cube48opt5.wasm'),
      tablePath: join(source.root, 'h48prun31h5.dat'),
      sourceUrl: 'fixture://prepare-cleanup',
      sourceRevision: 'test-only',
      sourceBuildCommand: 'create deterministic fixture',
    })).rejects.toThrow(/opt5 table must be 972840960 bytes/);
    expect(await readdir(join(targetStore, 'bundles'))).toEqual([]);
  });

  it('keeps server runtime sources free of Web and solver-table path fallbacks', async () => {
    const sources = await Promise.all([
      '../src/cubeopt/artifact.mjs',
      '../src/cubeopt/solve-daemon.mjs',
      '../src/cubeopt/daemon.ts',
    ].map((path) => readFile(resolve(__dirname, path), 'utf8')));

    expect(sources.join('\n')).not.toMatch(/packages[\\/]client[\\/]public|solver[\\/]tables/);
  });
});
