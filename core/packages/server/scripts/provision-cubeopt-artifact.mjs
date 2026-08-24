import { randomUUID } from 'node:crypto';
import {
  chmod,
  chown,
  lstat,
  open,
  readFile,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  assertCubeoptArtifactSources,
  prepareCubeoptArtifact,
} from './lib/prepare-cubeopt-artifact.mjs';
import {
  loadCubeoptArtifact,
  promoteCubeoptBundle,
  syncDirectoryDurably,
  verifyCubeoptBundle,
} from '../src/cubeopt/artifact.mjs';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`missing required ${name}`);
  }
  return value.trim();
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function persistEnvValue(envFile, name, value) {
  if (/[^\x20-\x7e]/.test(value) || /[\s#]/.test(value)) {
    throw new Error(`${name} must be a plain printable path without whitespace or #`);
  }
  const source = await readFile(envFile, 'utf8');
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);
  while (lines.at(-1) === '') lines.pop();
  const assignment = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`);
  const retained = lines.filter((line) => !assignment.test(line));
  retained.push(`${name}=${value}`);
  const next = `${retained.join(newline)}${newline}`;
  if (next === source) return false;

  const metadata = await stat(envFile);
  const temp = resolve(dirname(envFile), `.${basename(envFile)}.cubeopt-${randomUUID()}`);
  let renamed = false;
  try {
    const handle = await open(temp, 'wx', metadata.mode);
    try {
      await handle.writeFile(next, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await chmod(temp, metadata.mode);
    if (process.platform !== 'win32') await chown(temp, metadata.uid, metadata.gid);
    const metadataHandle = await open(temp, 'r+');
    try {
      await metadataHandle.sync();
    } finally {
      await metadataHandle.close();
    }
    await rename(temp, envFile);
    renamed = true;
    await syncDirectoryDurably(dirname(envFile));
    return true;
  } finally {
    if (!renamed) await rm(temp, { force: true });
  }
}

/**
 * One-time deployment migration only. Runtime code never reads the legacy
 * variables: this function copies their current bytes into the API-owned,
 * manifest-verified store before the new release is activated.
 */
export async function provisionCubeoptArtifact({
  env = process.env,
  envFile: rawEnvFile,
  defaultStore: rawDefaultStore,
  bundle: rawBundle,
  sourceUrl,
  sourceRevision,
  sourceBuildCommand,
  allowFixtureSizes = false,
}) {
  const envFile = resolve(required(rawEnvFile, '--env-file'));
  const configuredStore = env.CUBEOPT_ARTIFACT_DIR?.trim();
  const storeDir = configuredStore || required(rawDefaultStore, '--default-store');
  if (!isAbsolute(storeDir)) throw new Error('CubeOpt artifact store must be an absolute path');
  const resolvedStore = resolve(storeDir);
  const currentPath = resolve(resolvedStore, 'current.json');

  let migrated = false;
  if (await pathExists(currentPath)) {
    await loadCubeoptArtifact(resolvedStore, { allowFixtureSizes });
  } else {
    const bundle = required(rawBundle, '--bundle');
    const modulePath = resolve(required(env.CUBEOPT_MODULE, 'legacy CUBEOPT_MODULE'));
    const tablePath = resolve(required(env.CUBEOPT_TABLE, 'legacy CUBEOPT_TABLE'));
    const wasmPath = resolve(dirname(modulePath), 'cube48opt5.wasm');
    const bundleDir = resolve(resolvedStore, 'bundles', bundle);

    if (await pathExists(bundleDir)) {
      const artifact = await verifyCubeoptBundle(bundleDir, { allowFixtureSizes });
      await assertCubeoptArtifactSources(artifact.manifest, {
        modulePath,
        wasmPath,
        tablePath,
      });
    } else {
      await prepareCubeoptArtifact({
        storeDir: resolvedStore,
        bundle,
        modulePath,
        wasmPath,
        tablePath,
        sourceUrl,
        sourceRevision,
        sourceBuildCommand,
        allowFixtureSizes,
      });
    }
    await promoteCubeoptBundle(resolvedStore, bundle, { allowFixtureSizes });
    await loadCubeoptArtifact(resolvedStore, { allowFixtureSizes });
    migrated = true;
  }

  const envUpdated = configuredStore !== resolvedStore
    ? await persistEnvValue(envFile, 'CUBEOPT_ARTIFACT_DIR', resolvedStore)
    : false;
  env.CUBEOPT_ARTIFACT_DIR = resolvedStore;
  return Object.freeze({ storeDir: resolvedStore, migrated, envUpdated });
}

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      'env-file': { type: 'string' },
      'default-store': { type: 'string' },
      bundle: { type: 'string' },
      'source-url': { type: 'string' },
      'source-revision': { type: 'string' },
      'source-build-command': { type: 'string' },
    },
    strict: true,
  });
  return {
    envFile: values['env-file'],
    defaultStore: values['default-store'],
    bundle: values.bundle,
    sourceUrl: values['source-url'],
    sourceRevision: values['source-revision'],
    sourceBuildCommand: values['source-build-command'],
  };
}

const isMain = typeof process.argv[1] === 'string'
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = await provisionCubeoptArtifact(parseCliOptions());
  console.log(JSON.stringify(result, null, 2));
}
