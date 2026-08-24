import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

export const CUBEOPT_ARTIFACT_SCHEMA = 'cuberoot.cubeopt-artifact/v1';
export const CUBEOPT_POINTER_SCHEMA = 'cuberoot.cubeopt-current/v1';
export const CUBEOPT_PROTOCOL = 1;
export const CUBEOPT_VARIANT = 'opt5';

const EXPECTED = Object.freeze({
  module: 'cube48opt5.mjs',
  wasm: 'cube48opt5.wasm',
  table: 'h48prun31h5.dat',
});

// This size is a property of the h5 table consumed by the currently deployed
// opt5 executable. Keeping it in the runtime contract prevents an h6 table
// renamed to h5 from allocating almost 2 GB before the mismatch is noticed.
const OPT5_TABLE_BYTES = 972_840_960;
const SHA256 = /^[0-9a-f]{64}$/;
const PORTABLE_DIRECTORY_FSYNC_ERRORS = new Set(['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM']);

function artifactError(message) {
  return new Error(`cubeopt artifact: ${message}`);
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw artifactError(`${field} must be a non-empty string`);
  }
  return value;
}

function validateManifest(manifest, { allowFixtureSizes }) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw artifactError('manifest.json must contain an object');
  }
  if (manifest.schema !== CUBEOPT_ARTIFACT_SCHEMA) {
    throw artifactError(`unsupported schema ${JSON.stringify(manifest.schema)}`);
  }
  const bundle = requireNonEmptyString(manifest.bundle, 'bundle');
  if (!/^cubeopt-opt5-[A-Za-z0-9._-]+$/.test(bundle)) {
    throw artifactError('bundle must start with cubeopt-opt5- and contain only portable characters');
  }
  if (manifest.variant !== CUBEOPT_VARIANT) {
    throw artifactError(`variant must be ${CUBEOPT_VARIANT}, got ${JSON.stringify(manifest.variant)}`);
  }
  if (manifest.protocol !== CUBEOPT_PROTOCOL) {
    throw artifactError(`protocol must be ${CUBEOPT_PROTOCOL}, got ${JSON.stringify(manifest.protocol)}`);
  }

  const source = manifest.source;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw artifactError('source must be an object');
  }
  requireNonEmptyString(source.url, 'source.url');
  requireNonEmptyString(source.revision, 'source.revision');
  requireNonEmptyString(source.buildCommand, 'source.buildCommand');

  const files = manifest.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw artifactError('files must be an object');
  }
  for (const [role, expectedPath] of Object.entries(EXPECTED)) {
    const entry = files[role];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw artifactError(`files.${role} must be an object`);
    }
    if (entry.path !== expectedPath) {
      throw artifactError(`files.${role}.path must be ${expectedPath}, got ${JSON.stringify(entry.path)}`);
    }
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) {
      throw artifactError(`files.${role}.bytes must be a positive safe integer`);
    }
    if (!SHA256.test(entry.sha256)) {
      throw artifactError(`files.${role}.sha256 must be a lowercase SHA-256 digest`);
    }
  }
  if (!allowFixtureSizes && files.table.bytes !== OPT5_TABLE_BYTES) {
    throw artifactError(`opt5 table must be ${OPT5_TABLE_BYTES} bytes, got ${files.table.bytes}`);
  }
}

function sha256File(path) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('error', rejectHash);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });
}

/**
 * Flush a directory entry after an atomic rename.
 *
 * Linux is the production contract, so every open/fsync/close error is fatal
 * there. Other platforms may not support opening or syncing directories; only
 * their explicit "unsupported" errors are ignored. I/O and capacity failures
 * are never downgraded to best-effort.
 */
export async function syncDirectoryDurably(
  path,
  { openDirectory = (directoryPath) => open(directoryPath, 'r'), platform = process.platform } = {},
) {
  let handle;
  try {
    handle = await openDirectory(path);
    await handle.sync();
  } catch (error) {
    if (platform !== 'linux' && PORTABLE_DIRECTORY_FSYNC_ERRORS.has(error?.code)) return;
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}

/**
 * Resolve current.json and fully verify its API-owned immutable CubeOpt bundle.
 *
 * `allowFixtureSizes` exists only so ordinary tests can exercise the real hash
 * and manifest checks without checking a 972 MB table into the repository. The
 * daemon never enables it.
 */
export async function loadCubeoptArtifact(storeDir, { allowFixtureSizes = false } = {}) {
  const store = resolve(requireNonEmptyString(storeDir, 'CUBEOPT_ARTIFACT_DIR'));
  const currentPath = resolve(store, 'current.json');
  let current;
  try {
    current = JSON.parse(await readFile(currentPath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw artifactError(`invalid current.json: ${error.message}`);
    throw artifactError(`cannot read current.json: ${error.message}`);
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    throw artifactError('current.json must contain an object');
  }
  if (current.schema !== CUBEOPT_POINTER_SCHEMA) {
    throw artifactError(`unsupported current pointer schema ${JSON.stringify(current.schema)}`);
  }
  const bundle = requireNonEmptyString(current.bundle, 'current.bundle');
  if (!/^cubeopt-opt5-[A-Za-z0-9._-]+$/.test(bundle)) {
    throw artifactError('current.bundle must be a portable cubeopt-opt5- bundle ID');
  }

  const artifact = await verifyCubeoptBundle(resolve(store, 'bundles', bundle), { allowFixtureSizes });
  if (artifact.manifest.bundle !== bundle) {
    throw artifactError(`current bundle ${bundle} does not match manifest bundle ${artifact.manifest.bundle}`);
  }
  return Object.freeze({ ...artifact, store, currentPath });
}

/** Verify one immutable bundle directory without consulting the current pointer. */
export async function verifyCubeoptBundle(bundleDir, { allowFixtureSizes = false } = {}) {
  const root = resolve(requireNonEmptyString(bundleDir, 'bundle directory'));
  let rootInfo;
  try {
    rootInfo = await lstat(root);
  } catch (error) {
    throw artifactError(`cannot read bundle directory: ${error.message}`);
  }
  if (!rootInfo.isDirectory()) throw artifactError('bundle path must be a real directory, not a symlink');
  const canonicalRoot = await realpath(root);
  const manifestPath = resolve(root, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw artifactError(`invalid manifest.json: ${error.message}`);
    throw artifactError(`cannot read manifest.json: ${error.message}`);
  }
  validateManifest(manifest, { allowFixtureSizes });

  const paths = {};
  for (const [role, expectedPath] of Object.entries(EXPECTED)) {
    const path = resolve(root, expectedPath);
    let info;
    try {
      info = await lstat(path);
    } catch (error) {
      throw artifactError(`missing ${role} file ${expectedPath}: ${error.message}`);
    }
    if (!info.isFile()) throw artifactError(`${role} path ${expectedPath} is not a regular file or is a symlink`);
    if (info.size !== manifest.files[role].bytes) {
      throw artifactError(`${role} size mismatch: manifest=${manifest.files[role].bytes}, actual=${info.size}`);
    }
    const actualHash = await sha256File(path);
    if (actualHash !== manifest.files[role].sha256) {
      throw artifactError(`${role} sha256 mismatch: manifest=${manifest.files[role].sha256}, actual=${actualHash}`);
    }
    paths[`${role}Path`] = path;
  }

  // The generated Node wrapper hard-codes both adjacent filenames for its wasm
  // and worker-thread bootstrap. Validate those references before importing it.
  const moduleSource = await readFile(paths.modulePath, 'utf8');
  if (!moduleSource.includes(EXPECTED.module) || !moduleSource.includes(EXPECTED.wasm)) {
    throw artifactError(`module must reference adjacent ${EXPECTED.module} and ${EXPECTED.wasm}`);
  }
  const referencedVariants = [...moduleSource.matchAll(/cube48opt([0-9]+)\.(?:mjs|wasm)/g)]
    .map((match) => match[1]);
  if (referencedVariants.some((variant) => variant !== '5')) {
    throw artifactError(`module contains a non-opt5 cube48opt reference: ${referencedVariants.join(', ')}`);
  }

  return Object.freeze({
    root: canonicalRoot,
    manifestPath,
    manifest: Object.freeze(manifest),
    modulePath: paths.modulePath,
    wasmPath: paths.wasmPath,
    tablePath: paths.tablePath,
  });
}

/**
 * Verify an immutable bundle, then atomically switch the store's current.json.
 * The temporary file is fully flushed before the same-directory rename, so a
 * failed verification or interrupted write never exposes a partial pointer.
 */
export async function promoteCubeoptBundle(storeDir, bundle, { allowFixtureSizes = false } = {}) {
  const store = resolve(requireNonEmptyString(storeDir, 'artifact store'));
  const bundleId = requireNonEmptyString(bundle, 'bundle');
  if (!/^cubeopt-opt5-[A-Za-z0-9._-]+$/.test(bundleId)) {
    throw artifactError('bundle must be a portable cubeopt-opt5- bundle ID');
  }
  const artifact = await verifyCubeoptBundle(resolve(store, 'bundles', bundleId), { allowFixtureSizes });
  if (artifact.manifest.bundle !== bundleId) {
    throw artifactError(`requested bundle ${bundleId} does not match manifest bundle ${artifact.manifest.bundle}`);
  }

  const currentPath = resolve(store, 'current.json');
  const temporaryPath = resolve(store, `.current.${process.pid}.${randomUUID()}.tmp`);
  const pointer = `${JSON.stringify({ schema: CUBEOPT_POINTER_SCHEMA, bundle: bundleId }, null, 2)}\n`;
  let pointerRenamed = false;
  try {
    const handle = await open(temporaryPath, 'wx', 0o644);
    try {
      await handle.writeFile(pointer, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, currentPath);
    pointerRenamed = true;
  } finally {
    if (!pointerRenamed) {
      try { await unlink(temporaryPath); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }

  await syncDirectoryDurably(store);

  return Object.freeze({ ...artifact, store, currentPath });
}
