import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, open, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import {
  CUBEOPT_ARTIFACT_SCHEMA,
  CUBEOPT_PROTOCOL,
  cubeoptBundleVariant,
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
  const info = await stat(path);
  if (!info.isFile()) throw new Error(`${path} is not a regular file`);
  return { path: expectedName, bytes: info.size, sha256: await hashFile(path) };
}

export function cubeoptArtifactContractFromModulePath(modulePath) {
  const moduleName = basename(modulePath);
  return cubeoptVariantContractFromModuleName(moduleName);
}

export function detectCubeoptArtifactSources({ modulePath, wasmPath, tablePath }) {
  const contract = cubeoptArtifactContractFromModulePath(modulePath);
  const inputs = { module: modulePath, wasm: wasmPath, table: tablePath };
  for (const [role, expectedName] of Object.entries(contract.files)) {
    if (basename(inputs[role]) !== expectedName) {
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
  wasmPath: rawWasmPath,
  tablePath: rawTablePath,
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
    module: resolve(required(rawModulePath, 'module')),
    wasm: resolve(required(rawWasmPath, 'wasm')),
    table: resolve(required(rawTablePath, 'table')),
  };
  const contract = detectCubeoptArtifactSources({
    modulePath: inputs.module,
    wasmPath: inputs.wasm,
    tablePath: inputs.table,
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

  const manifest = {
    schema: CUBEOPT_ARTIFACT_SCHEMA,
    bundle,
    variant: contract.variant,
    protocol: CUBEOPT_PROTOCOL,
    source,
    files,
  };

  await mkdir(stagingDir);
  let published = false;
  try {
    for (const role of Object.keys(names)) {
      const destination = resolve(stagingDir, names[role]);
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
