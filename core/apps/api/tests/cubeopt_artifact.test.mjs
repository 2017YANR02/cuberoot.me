import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareCubeoptArtifact } from '../scripts/lib/prepare-cubeopt-artifact.mjs';
import { provisionCubeoptArtifact } from '../scripts/provision-cubeopt-artifact.mjs';
import {
  CUBEOPT_ARTIFACT_SCHEMA,
  CUBEOPT_POINTER_SCHEMA,
  CUBEOPT_PROTOCOL,
  CUBEOPT_VARIANTS,
  cubeoptBundleVariant,
  cubeoptVariantContract,
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

async function createTestSymlink(targetFile, linkPath) {
  if (process.platform !== 'win32') {
    await symlink(targetFile, linkPath, 'file');
    return;
  }
  // Unprivileged Windows can create directory junctions but not file symlinks.
  // lstat must reject either reparse-point shape before reading JSON.
  const targetDirectory = `${targetFile}.junction-target`;
  await mkdir(targetDirectory);
  await symlink(targetDirectory, linkPath, 'junction');
}

async function makeFixture({
  store: existingStore,
  variant = 'opt5',
  bundle = `cubeopt-${variant}-test-fixture`,
} = {}) {
  const store = existingStore || await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-'));
  if (!existingStore) scratchDirs.push(store);
  const root = join(store, 'bundles', bundle);
  await mkdir(root, { recursive: true });
  const contract = CUBEOPT_VARIANTS[variant];
  if (!contract) throw new Error(`unsupported test fixture variant ${variant}`);
  const contents = {
    module: Buffer.from(`// fixture references ${contract.files.module} and ${contract.files.wasm}\nexport default async () => ({});\n`),
    wasm: Buffer.concat([
      Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
      Buffer.from(`\0${contract.files.wasm}\0${contract.files.table}\0`),
    ]),
    table: Buffer.from(`small deterministic ${variant} table fixture\n`),
  };
  const paths = contract.files;
  for (const role of Object.keys(paths)) {
    await writeFile(join(root, paths[role]), contents[role]);
  }
  const manifest = {
    schema: CUBEOPT_ARTIFACT_SCHEMA,
    bundle,
    variant,
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

  it.each(['opt5', 'opt6', 'opt8'])('resolves all %s runtime files through one verified current pointer', async (variant) => {
    const { root, store, bundle } = await makeFixture({ variant });
    await promoteCubeoptBundle(store, bundle, { allowFixtureSizes: true });
    const artifact = await loadCubeoptArtifact(store, { allowFixtureSizes: true });
    const contract = CUBEOPT_VARIANTS[variant];

    expect(artifact.manifest.variant).toBe(variant);
    expect(artifact.modulePath).toBe(join(artifact.root, contract.files.module));
    expect(artifact.wasmPath).toBe(join(artifact.root, contract.files.wasm));
    expect(artifact.tablePath).toBe(join(artifact.root, contract.files.table));
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

  it('rejects a current pointer that is a symbolic link', async () => {
    const { store, bundle } = await makeFixture();
    const externalCurrent = join(store, 'external-current.json');
    await writeFile(externalCurrent, JSON.stringify({ schema: CUBEOPT_POINTER_SCHEMA, bundle }));
    await createTestSymlink(externalCurrent, join(store, 'current.json'));

    await expect(loadCubeoptArtifact(store, { allowFixtureSizes: true }))
      .rejects.toThrow(/current\.json must be a regular file, not a symlink/);
  });

  it('rejects a missing manifest', async () => {
    const store = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-'));
    scratchDirs.push(store);
    const root = join(store, 'bundles', 'cubeopt-opt5-missing-manifest');
    await mkdir(root, { recursive: true });

    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true }))
      .rejects.toThrow(/cannot read manifest\.json/);
  });

  it('rejects a manifest that is a symbolic link', async () => {
    const { root, store } = await makeFixture();
    const manifestPath = join(root, 'manifest.json');
    const externalManifest = join(store, 'external-manifest.json');
    await rename(manifestPath, externalManifest);
    await createTestSymlink(externalManifest, manifestPath);

    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true }))
      .rejects.toThrow(/manifest\.json must be a regular file, not a symlink/);
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
      .rejects.toThrow(/bundle variant opt5 does not match manifest variant opt6/);
  });

  it('rejects an unsupported CubeOpt variant', async () => {
    const { root, manifest } = await makeFixture();
    manifest.variant = 'opt7';
    await writeManifest(root, manifest);

    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true }))
      .rejects.toThrow(/unsupported variant "opt7"; expected opt5, opt6, opt8/);
  });

  it.each(['toString', 'constructor'])('rejects inherited object key %s as a variant', (variant) => {
    expect(() => cubeoptVariantContract(variant))
      .toThrow(new RegExp(`unsupported variant "${variant}"`));
    expect(() => cubeoptBundleVariant(`cubeopt-${variant}-fixture`))
      .toThrow(new RegExp(`unsupported variant "${variant}"`));
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

  it.each([
    ['opt5', 972_840_960],
    ['opt6', 1_945_681_920],
    ['opt8', 7_782_727_680],
  ])('rejects fixture-sized %s tables under the production contract', async (variant, tableBytes) => {
    const { root } = await makeFixture({ variant });
    await expect(verifyCubeoptBundle(root))
      .rejects.toThrow(new RegExp(`${variant} table must be ${tableBytes} bytes`));
  });

  it('rejects a wrapper that references another variant', async () => {
    const { root, manifest } = await makeFixture();
    const moduleSource = Buffer.from('// cube48opt5.mjs cube48opt5.wasm cube48opt6.wasm\n');
    await writeFile(join(root, 'cube48opt5.mjs'), moduleSource);
    manifest.files.module.bytes = moduleSource.length;
    manifest.files.module.sha256 = sha256(moduleSource);
    await writeManifest(root, manifest);

    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true }))
      .rejects.toThrow(/cube48opt reference outside opt5/);
  });

  it('rejects an opt5 wasm renamed and rehashed as opt6', async () => {
    const { root, manifest } = await makeFixture({ variant: 'opt6' });
    const renamedOpt5Wasm = Buffer.concat([
      Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
      Buffer.from('\0cube48opt5.wasm\0h48prun31h5.dat\0'),
    ]);
    await writeFile(join(root, 'cube48opt6.wasm'), renamedOpt5Wasm);
    manifest.files.wasm.bytes = renamedOpt5Wasm.length;
    manifest.files.wasm.sha256 = sha256(renamedOpt5Wasm);
    await writeManifest(root, manifest);

    await expect(verifyCubeoptBundle(root, { allowFixtureSizes: true }))
      .rejects.toThrow(/wasm must reference adjacent cube48opt6\.wasm and h48prun31h6\.dat/);
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

  it('idempotently provisions the API store from legacy deployment paths', async () => {
    const source = await makeFixture({ bundle: 'cubeopt-opt5-provision-source' });
    const deployment = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-deploy-'));
    scratchDirs.push(deployment);
    const envFile = join(deployment, '.env');
    const store = join(deployment, 'artifacts', 'cubeopt');
    await writeFile(envFile, 'UNCHANGED=value\n export CUBEOPT_ARTIFACT_DIR=/stale/duplicate\nCUBEOPT_ARTIFACT_DIR=\n');
    const env = {
      CUBEOPT_MODULE: join(source.root, 'cube48opt5.mjs'),
      CUBEOPT_TABLE: join(source.root, 'h48prun31h5.dat'),
    };
    const options = {
      env,
      envFile,
      defaultStore: store,
      bundleSuffix: 'legacy-runtime-v1',
      sourceUrl: 'fixture://legacy-runtime',
      sourceRevision: 'test-only',
      sourceBuildCommand: 'copy fixture bytes',
      allowFixtureSizes: true,
    };

    const first = await provisionCubeoptArtifact(options);
    expect(first).toEqual({ storeDir: resolve(store), migrated: true, envUpdated: true });
    expect((await loadCubeoptArtifact(store, { allowFixtureSizes: true })).manifest.bundle)
      .toBe('cubeopt-opt5-legacy-runtime-v1');
    const persisted = await readFile(envFile, 'utf8');
    expect(persisted).toContain('UNCHANGED=value\n');
    expect(persisted.match(/^CUBEOPT_ARTIFACT_DIR=/gm)).toHaveLength(1);
    expect(persisted).toContain(`CUBEOPT_ARTIFACT_DIR=${resolve(store)}\n`);

    const second = await provisionCubeoptArtifact(options);
    expect(second).toEqual({ storeDir: resolve(store), migrated: false, envUpdated: false });
    expect(await readFile(envFile, 'utf8')).toBe(persisted);
  });

  it('derives an opt6 bundle from matching legacy module, wasm, and h6 table paths', async () => {
    const source = await makeFixture({ variant: 'opt6', bundle: 'cubeopt-opt6-provision-source' });
    const deployment = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-opt6-deploy-'));
    scratchDirs.push(deployment);
    const envFile = join(deployment, '.env');
    const store = join(deployment, 'artifacts', 'cubeopt');
    await writeFile(envFile, 'CUBEOPT_SOLVE_ENABLED=1\n');

    const result = await provisionCubeoptArtifact({
      env: {
        CUBEOPT_MODULE: join(source.root, 'cube48opt6.mjs'),
        CUBEOPT_TABLE: join(source.root, 'h48prun31h6.dat'),
      },
      envFile,
      defaultStore: store,
      bundleSuffix: 'legacy-runtime-v1',
      sourceUrl: 'fixture://legacy-runtime',
      sourceRevision: 'test-only',
      sourceBuildCommand: 'copy fixture bytes',
      allowFixtureSizes: true,
    });

    expect(result).toEqual({ storeDir: resolve(store), migrated: true, envUpdated: true });
    const artifact = await loadCubeoptArtifact(store, { allowFixtureSizes: true });
    expect(artifact.manifest.bundle).toBe('cubeopt-opt6-legacy-runtime-v1');
    expect(artifact.manifest.variant).toBe('opt6');
    expect(artifact.modulePath).toBe(join(artifact.root, 'cube48opt6.mjs'));
    expect(artifact.wasmPath).toBe(join(artifact.root, 'cube48opt6.wasm'));
    expect(artifact.tablePath).toBe(join(artifact.root, 'h48prun31h6.dat'));
  });

  it.each([
    ['opt5', 'opt6'],
    ['opt6', 'opt5'],
    ['opt8', 'opt6'],
    ['opt6', 'opt8'],
  ])('rejects a legacy source set that mixes %s module and wasm with a %s table', async (moduleVariant, tableVariant) => {
    const moduleSource = await makeFixture({
      variant: moduleVariant,
      bundle: `cubeopt-${moduleVariant}-mixed-module-source`,
    });
    const tableSource = await makeFixture({
      variant: tableVariant,
      bundle: `cubeopt-${tableVariant}-mixed-table-source`,
    });
    const moduleContract = CUBEOPT_VARIANTS[moduleVariant];
    const tableContract = CUBEOPT_VARIANTS[tableVariant];
    const deployment = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-mixed-deploy-'));
    scratchDirs.push(deployment);
    const envFile = join(deployment, '.env');
    const originalEnv = 'CUBEOPT_SOLVE_ENABLED=1\n';
    await writeFile(envFile, originalEnv);

    await expect(provisionCubeoptArtifact({
      env: {
        CUBEOPT_MODULE: join(moduleSource.root, moduleContract.files.module),
        CUBEOPT_TABLE: join(tableSource.root, tableContract.files.table),
      },
      envFile,
      defaultStore: join(deployment, 'artifacts', 'cubeopt'),
      bundleSuffix: 'legacy-runtime-v1',
      sourceUrl: 'fixture://legacy-runtime',
      sourceRevision: 'test-only',
      sourceBuildCommand: 'copy fixture bytes',
      allowFixtureSizes: true,
    })).rejects.toThrow(new RegExp(
      `must be named ${moduleContract.files.table.replaceAll('.', '\\.')} for ${moduleVariant}`,
    ));
    expect(await readFile(envFile, 'utf8')).toBe(originalEnv);
  });

  it('rejects an unsupported legacy module basename before mutating the store or env', async () => {
    const deployment = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-unsupported-deploy-'));
    scratchDirs.push(deployment);
    const envFile = join(deployment, '.env');
    const originalEnv = 'CUBEOPT_SOLVE_ENABLED=1\n';
    await writeFile(envFile, originalEnv);

    await expect(provisionCubeoptArtifact({
      env: {
        CUBEOPT_MODULE: join(deployment, 'cube48opt7.mjs'),
        CUBEOPT_TABLE: join(deployment, 'h48prun31h7.dat'),
      },
      envFile,
      defaultStore: join(deployment, 'artifacts', 'cubeopt'),
      bundleSuffix: 'legacy-runtime-v1',
      sourceUrl: 'fixture://legacy-runtime',
      sourceRevision: 'test-only',
      sourceBuildCommand: 'copy fixture bytes',
      allowFixtureSizes: true,
    })).rejects.toThrow(/unsupported module filename.*expected cube48opt5\.mjs or cube48opt6\.mjs or cube48opt8\.mjs/);
    expect(await readFile(envFile, 'utf8')).toBe(originalEnv);
  });

  it.each(['opt5', 'opt6', 'opt8'])(
    'resumes an %s migration after prepare completed before the current pointer was promoted',
    async (variant) => {
    const contract = CUBEOPT_VARIANTS[variant];
    const source = await makeFixture({ variant, bundle: `cubeopt-${variant}-resume-source` });
    const deployment = await mkdtemp(join(tmpdir(), `cuberoot-cubeopt-${variant}-resume-`));
    scratchDirs.push(deployment);
    const envFile = join(deployment, '.env');
    const store = join(deployment, 'artifacts', 'cubeopt');
    const bundle = `cubeopt-${variant}-legacy-runtime-v1`;
    await writeFile(envFile, 'CUBEOPT_SOLVE_ENABLED=1\n');
    await prepareCubeoptArtifact({
      storeDir: store,
      bundle,
      modulePath: join(source.root, contract.files.module),
      wasmPath: join(source.root, contract.files.wasm),
      tablePath: join(source.root, contract.files.table),
      sourceUrl: 'fixture://legacy-runtime',
      sourceRevision: 'test-only',
      sourceBuildCommand: 'copy fixture bytes',
      allowFixtureSizes: true,
    });

    const result = await provisionCubeoptArtifact({
      env: {
        CUBEOPT_MODULE: join(source.root, contract.files.module),
        CUBEOPT_TABLE: join(source.root, contract.files.table),
      },
      envFile,
      defaultStore: store,
      bundleSuffix: 'legacy-runtime-v1',
      sourceUrl: 'fixture://legacy-runtime',
      sourceRevision: 'test-only',
      sourceBuildCommand: 'copy fixture bytes',
      allowFixtureSizes: true,
    });

    expect(result).toEqual({ storeDir: resolve(store), migrated: true, envUpdated: true });
    expect((await loadCubeoptArtifact(store, { allowFixtureSizes: true })).manifest.bundle).toBe(bundle);
    },
  );

  it('persists the store after a current pointer already exists without legacy inputs', async () => {
    const artifact = await makeFixture({ bundle: 'cubeopt-opt5-current-before-env' });
    await promoteCubeoptBundle(artifact.store, artifact.bundle, { allowFixtureSizes: true });
    const deployment = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-current-before-env-'));
    scratchDirs.push(deployment);
    const envFile = join(deployment, '.env');
    await writeFile(envFile, 'CUBEOPT_SOLVE_ENABLED=1\n');

    const result = await provisionCubeoptArtifact({
      env: {},
      envFile,
      defaultStore: artifact.store,
      allowFixtureSizes: true,
    });

    expect(result).toEqual({ storeDir: resolve(artifact.store), migrated: false, envUpdated: true });
    expect(await readFile(envFile, 'utf8')).toContain(`CUBEOPT_ARTIFACT_DIR=${resolve(artifact.store)}\n`);
  });

  it('rejects a prepared retry bundle when the legacy source bytes changed', async () => {
    const source = await makeFixture({ bundle: 'cubeopt-opt5-source-before-change' });
    const deployment = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-source-drift-'));
    scratchDirs.push(deployment);
    const envFile = join(deployment, '.env');
    const store = join(deployment, 'artifacts', 'cubeopt');
    const bundle = 'cubeopt-opt5-legacy-runtime-v1';
    const originalEnv = 'CUBEOPT_SOLVE_ENABLED=1\n';
    await writeFile(envFile, originalEnv);
    await prepareCubeoptArtifact({
      storeDir: store,
      bundle,
      modulePath: join(source.root, 'cube48opt5.mjs'),
      wasmPath: join(source.root, 'cube48opt5.wasm'),
      tablePath: join(source.root, 'h48prun31h5.dat'),
      sourceUrl: 'fixture://legacy-runtime',
      sourceRevision: 'test-only',
      sourceBuildCommand: 'copy fixture bytes',
      allowFixtureSizes: true,
    });
    await writeFile(join(source.root, 'cube48opt5.mjs'), '// changed legacy source\n');

    await expect(provisionCubeoptArtifact({
      env: {
        CUBEOPT_MODULE: join(source.root, 'cube48opt5.mjs'),
        CUBEOPT_TABLE: join(source.root, 'h48prun31h5.dat'),
      },
      envFile,
      defaultStore: store,
      bundleSuffix: 'legacy-runtime-v1',
      sourceUrl: 'fixture://legacy-runtime',
      sourceRevision: 'test-only',
      sourceBuildCommand: 'copy fixture bytes',
      allowFixtureSizes: true,
    })).rejects.toThrow(/does not match the current legacy source/);
    expect(await readFile(envFile, 'utf8')).toBe(originalEnv);
    await expect(readFile(join(store, 'current.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('resumes after promotion completed but env persistence failed', async () => {
    const source = await makeFixture({ bundle: 'cubeopt-opt5-env-retry-source' });
    const deployment = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-env-retry-'));
    scratchDirs.push(deployment);
    const envFile = join(deployment, 'missing', '.env');
    const store = join(deployment, 'artifacts', 'cubeopt');
    const env = {
      CUBEOPT_MODULE: join(source.root, 'cube48opt5.mjs'),
      CUBEOPT_TABLE: join(source.root, 'h48prun31h5.dat'),
    };
    const options = {
      env,
      envFile,
      defaultStore: store,
      bundleSuffix: 'legacy-runtime-v1',
      sourceUrl: 'fixture://legacy-runtime',
      sourceRevision: 'test-only',
      sourceBuildCommand: 'copy fixture bytes',
      allowFixtureSizes: true,
    };

    await expect(provisionCubeoptArtifact(options)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await loadCubeoptArtifact(store, { allowFixtureSizes: true })).manifest.bundle)
      .toBe('cubeopt-opt5-legacy-runtime-v1');
    await mkdir(dirname(envFile), { recursive: true });
    await writeFile(envFile, 'CUBEOPT_SOLVE_ENABLED=1\n');

    expect(await provisionCubeoptArtifact(options))
      .toEqual({ storeDir: resolve(store), migrated: false, envUpdated: true });
  });

  it('does not rewrite env when the existing current pointer is corrupt', async () => {
    const deployment = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-corrupt-current-'));
    scratchDirs.push(deployment);
    const envFile = join(deployment, '.env');
    const store = join(deployment, 'artifacts', 'cubeopt');
    const original = 'CUBEOPT_SOLVE_ENABLED=1\n';
    await mkdir(store, { recursive: true });
    await writeFile(join(store, 'current.json'), '{"schema":"broken"}\n');
    await writeFile(envFile, original);

    await expect(provisionCubeoptArtifact({
      env: {},
      envFile,
      defaultStore: store,
      allowFixtureSizes: true,
    })).rejects.toThrow(/unsupported current pointer schema/);
    expect(await readFile(envFile, 'utf8')).toBe(original);
  });

  it('does not mutate the runtime env file when legacy sources are incomplete', async () => {
    const deployment = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-deploy-'));
    scratchDirs.push(deployment);
    const envFile = join(deployment, '.env');
    const original = 'CUBEOPT_SOLVE_ENABLED=1\n';
    await writeFile(envFile, original);

    await expect(provisionCubeoptArtifact({
      env: {},
      envFile,
      defaultStore: join(deployment, 'artifacts', 'cubeopt'),
      bundleSuffix: 'legacy-runtime-v1',
      sourceUrl: 'fixture://legacy-runtime',
      sourceRevision: 'test-only',
      sourceBuildCommand: 'copy fixture bytes',
      allowFixtureSizes: true,
    })).rejects.toThrow(/legacy CUBEOPT_MODULE/);
    expect(await readFile(envFile, 'utf8')).toBe(original);
  });

  it('executes the bundled provision CLI without invoking another bundled CLI', async () => {
    const deployment = await mkdtemp(join(tmpdir(), 'cuberoot-cubeopt-bundled-cli-'));
    scratchDirs.push(deployment);
    const envFile = join(deployment, '.env');
    const output = join(deployment, 'provision.mjs');
    await writeFile(envFile, 'CUBEOPT_SOLVE_ENABLED=1\n');
    await build({
      entryPoints: [resolve(__dirname, '../scripts/provision-cubeopt-artifact.mjs')],
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'esm',
      outfile: output,
      logLevel: 'silent',
    });

    const originalArgv = process.argv;
    const originalLegacy = {
      CUBEOPT_ARTIFACT_DIR: process.env.CUBEOPT_ARTIFACT_DIR,
      CUBEOPT_MODULE: process.env.CUBEOPT_MODULE,
      CUBEOPT_TABLE: process.env.CUBEOPT_TABLE,
    };
    process.argv = [
      process.execPath,
      output,
      '--env-file', envFile,
      '--default-store', join(deployment, 'artifacts', 'cubeopt'),
      '--bundle-suffix', 'legacy-runtime-v1',
      '--source-url', 'fixture://legacy-runtime',
      '--source-revision', 'test-only',
      '--source-build-command', 'copy fixture bytes',
    ];
    delete process.env.CUBEOPT_ARTIFACT_DIR;
    delete process.env.CUBEOPT_MODULE;
    delete process.env.CUBEOPT_TABLE;
    try {
      await expect(import(`${pathToFileURL(output).href}?run=${Date.now()}`))
        .rejects.toThrow(/missing required legacy CUBEOPT_MODULE/);
    } finally {
      process.argv = originalArgv;
      for (const [name, value] of Object.entries(originalLegacy)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
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
