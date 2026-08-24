import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, open, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  CUBEOPT_ARTIFACT_SCHEMA,
  CUBEOPT_PROTOCOL,
  CUBEOPT_VARIANT,
  syncDirectoryDurably,
  verifyCubeoptBundle,
} from '../src/cubeopt/artifact.mjs';

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
}) {
  const bundle = required(rawBundle, 'bundle');
  if (!/^cubeopt-opt5-[A-Za-z0-9._-]+$/.test(bundle)) {
    throw new Error('--bundle must start with cubeopt-opt5- and contain only portable characters');
  }
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
  const names = {
    module: 'cube48opt5.mjs',
    wasm: 'cube48opt5.wasm',
    table: 'h48prun31h5.dat',
  };

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
    variant: CUBEOPT_VARIANT,
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

    const verified = await verifyCubeoptBundle(stagingDir);
    await rename(stagingDir, finalDir);
    published = true;
    await syncDirectoryDurably(bundlesDir);
    return Object.freeze({ artifact: verified, finalDir });
  } finally {
    if (!published) await rm(stagingDir, { recursive: true, force: true });
  }
}

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      store: { type: 'string' },
      bundle: { type: 'string' },
      module: { type: 'string' },
      wasm: { type: 'string' },
      table: { type: 'string' },
      'source-url': { type: 'string' },
      'source-revision': { type: 'string' },
      'source-build-command': { type: 'string' },
    },
    strict: true,
  });
  return {
    storeDir: values.store,
    bundle: values.bundle,
    modulePath: values.module,
    wasmPath: values.wasm,
    tablePath: values.table,
    sourceUrl: values['source-url'],
    sourceRevision: values['source-revision'],
    sourceBuildCommand: values['source-build-command'],
  };
}

const isMain = typeof process.argv[1] === 'string'
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = await prepareCubeoptArtifact(parseCliOptions());
  console.log(`published immutable ${result.artifact.manifest.bundle} at ${result.finalDir}`);
}
