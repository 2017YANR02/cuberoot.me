import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, link, lstat, mkdir, open, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import {
  CUBEOPT_ARTIFACT_SCHEMA,
  CUBEOPT_PROTOCOL,
  CUBEOPT_RUST_OPT8,
  cubeoptBundleVariant,
  cubeoptEngineContract,
  cubeoptVariantContractFromModuleName,
  syncDirectoryDurably,
  verifyCubeoptBundle,
} from '../../src/cubeopt/artifact.mjs';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`missing required --${name}`);
  }
  return value.trim();
}

function hashFile(path) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('error', rejectHash);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });
}

async function fileEntry(path, expectedName) {
  if (basename(path) !== expectedName) {
    throw new Error(`${path} must be named ${expectedName}`);
  }
  const info = await lstat(path);
  if (!info.isFile()) throw new Error(`${path} is not a regular file`);
  return { path: expectedName, bytes: info.size, sha256: await hashFile(path) };
}

export function cubeoptArtifactContractFromModulePath(modulePath, engine = 'emscripten') {
  const moduleName = basename(modulePath);
  if (engine !== 'emscripten') {
    const contract = cubeoptEngineContract('opt8', engine);
    if (moduleName !== contract.files.module) throw new Error(`${modulePath} must be named ${contract.files.module}`);
    return contract;
  }
  return cubeoptVariantContractFromModuleName(moduleName);
}

export function detectCubeoptArtifactSources({ binaryPath, modulePath, wasmPath, workerPath, snapshotPath, tablePath, engine = 'emscripten' }) {
  const contract = engine === 'rust-native' ? cubeoptEngineContract('opt8', engine) : cubeoptArtifactContractFromModulePath(modulePath, engine);
  const inputs = { binary: binaryPath, module: modulePath, wasm: wasmPath, worker: workerPath, snapshot: snapshotPath, table: tablePath };
  for (const [role, expectedName] of Object.entries(contract.files)) {
    if (typeof inputs[role] !== 'string' || basename(inputs[role]) !== expectedName) {
      throw new Error(`${inputs[role]} must be named ${expectedName} for ${contract.variant}`);
    }
  }
  return contract;
}

export async function assertCubeoptArtifactSources(manifest, {
  modulePath,
  wasmPath,
  tablePath,
}) {
  const inputs = {
    module: resolve(modulePath),
    wasm: resolve(wasmPath),
    table: resolve(tablePath),
  };
  const contract = detectCubeoptArtifactSources({
    modulePath: inputs.module,
    wasmPath: inputs.wasm,
    tablePath: inputs.table,
  });
  if ((manifest.engine ?? 'emscripten') !== 'emscripten') {
    throw new Error('existing immutable bundle engine does not match legacy sources');
  }
  if (manifest.variant !== contract.variant) {
    throw new Error(`existing immutable bundle variant ${manifest.variant} does not match ${contract.variant} legacy sources`);
  }
  for (const role of Object.keys(contract.files)) {
    const actual = await fileEntry(inputs[role], contract.files[role]);
    const expected = manifest.files[role];
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
      throw new Error(`existing immutable bundle ${role} does not match the current legacy source`);
    }
  }
}

async function syncFile(path) {
  // Windows rejects fsync on a read-only handle; staging files are private and
  // writable until publication, so open read/write on every platform.
  const handle = await open(path, 'r+');
  try { await handle.sync(); } finally { await handle.close(); }
}

export async function prepareCubeoptArtifact({
  storeDir: rawStoreDir,
  bundle: rawBundle,
  modulePath: rawModulePath,
  binaryPath: rawBinaryPath,
  wasmPath: rawWasmPath,
  workerPath: rawWorkerPath,
  snapshotPath: rawSnapshotPath,
  tablePath: rawTablePath,
  engine = 'emscripten',
  linkTable = false,
  sourceUrl,
  sourceRevision,
  sourceBuildCommand,
  allowFixtureSizes = false,
}) {
  const bundle = required(rawBundle, 'bundle');
  const source = {
    url: required(sourceUrl, 'source-url'),
    revision: required(sourceRevision, 'source-revision'),
    buildCommand: required(sourceBuildCommand, 'source-build-command'),
  };
  const storeDir = resolve(required(rawStoreDir, 'store'));
  const inputs = {
    table: resolve(required(rawTablePath, 'table')),
  };
  if (engine === 'rust-native') {
    inputs.binary = resolve(required(rawBinaryPath, 'binary'));
    inputs.snapshot = resolve(required(rawSnapshotPath, 'snapshot'));
  } else {
    inputs.module = resolve(required(rawModulePath, 'module'));
    inputs.wasm = resolve(required(rawWasmPath, 'wasm'));
  }
  if (engine === 'rust-wasm') {
    inputs.worker = resolve(required(rawWorkerPath, 'worker'));
    inputs.snapshot = resolve(required(rawSnapshotPath, 'snapshot'));
  } else if (rawWorkerPath || (rawSnapshotPath && engine !== 'rust-native')) {
    throw new Error('--worker requires rust-wasm; --snapshot requires a Rust engine');
  }
  if (typeof linkTable !== 'boolean') throw new Error('--link-table must be a boolean');
  const contract = detectCubeoptArtifactSources({
    binaryPath: inputs.binary,
    modulePath: inputs.module,
    wasmPath: inputs.wasm,
    tablePath: inputs.table,
    workerPath: inputs.worker,
    snapshotPath: inputs.snapshot,
    engine,
  });
  if (cubeoptBundleVariant(bundle, '--bundle') !== contract.variant) {
    throw new Error(`--bundle must start with cubeopt-${contract.variant}- and contain only portable characters`);
  }
  const names = contract.files;

  const bundlesDir = resolve(storeDir, 'bundles');
  const finalDir = resolve(bundlesDir, bundle);
  const stagingDir = resolve(bundlesDir, `.${bundle}.staging-${randomUUID()}`);
  await mkdir(bundlesDir, { recursive: true });
  try {
    await lstat(finalDir);
    throw new Error(`immutable bundle already exists: ${finalDir}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const files = {};
  for (const role of Object.keys(names)) {
    files[role] = await fileEntry(inputs[role], names[role]);
  }
  let linkedSource;
  if (linkTable) {
    // Reuse only a fully verified, already published immutable bundle. Logical
    // immutability does not require chmod: changing an old inode's mode would
    // also mutate the retained rollback bundle. All table access here is read-only.
    linkedSource = await verifyCubeoptBundle(dirname(inputs.table), { allowFixtureSizes });
    if (basename(linkedSource.root) !== linkedSource.manifest.bundle
      || await realpath(inputs.table) !== linkedSource.tablePath
      || linkedSource.manifest.variant !== contract.variant
      || linkedSource.manifest.files.table.sha256 !== files.table.sha256
      || linkedSource.manifest.files.table.bytes !== files.table.bytes) {
      throw new Error('--link-table requires the matching table from a verified immutable bundle');
    }
  }

  const manifest = {
    schema: CUBEOPT_ARTIFACT_SCHEMA,
    bundle,
    variant: contract.variant,
    protocol: CUBEOPT_PROTOCOL,
    ...(engine === 'rust-wasm' ? { engine, abiVersion: CUBEOPT_RUST_OPT8.abiVersion,
      memory64: true, sharedTable: true, maxThreads: CUBEOPT_RUST_OPT8.maxThreads } : {}),
    ...(engine === 'rust-native' ? { engine, maxThreads: contract.maxThreads } : {}),
    source,
    files,
  };

  await mkdir(stagingDir);
  let published = false;
  try {
    for (const role of Object.keys(names)) {
      const destination = resolve(stagingDir, names[role]);
      if (role === 'table' && linkedSource) {
        const sourceInfo = await lstat(inputs.table);
        if (sourceInfo.dev !== (await lstat(stagingDir)).dev) throw new Error('--link-table requires the same filesystem; copying is not a fallback');
        await link(inputs.table, destination);
        const linkedInfo = await lstat(destination);
        if (linkedInfo.dev !== sourceInfo.dev || linkedInfo.ino !== sourceInfo.ino) throw new Error('--link-table inode changed during linking');
        // The existing table is never opened for writing, chmodded, or copied.
        // The staging directory fsync below persists its new hard-link entry.
        continue;
      }
      await copyFile(inputs[role], destination);
      await syncFile(destination);
    }
    const manifestPath = resolve(stagingDir, 'manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await syncFile(manifestPath);
    await syncDirectoryDurably(stagingDir);

    const verified = await verifyCubeoptBundle(stagingDir, { allowFixtureSizes });
    await rename(stagingDir, finalDir);
    published = true;
    await syncDirectoryDurably(bundlesDir);
    return Object.freeze({ artifact: verified, finalDir });
  } finally {
    if (!published) await rm(stagingDir, { recursive: true, force: true });
  }
}
