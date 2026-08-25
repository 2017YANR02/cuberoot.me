import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';

import { BUILD_ASSETS } from './build-assets.mjs';

export const BUILD_STATE_VERSION = 3;

export function buildStatePath(packageRoot) {
  return join(packageRoot, '.tmp', 'miniprogram-build-state.json');
}

export async function walkFiles(directory, { missingOk = false } = {}) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (missingOk && error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(absolute));
    else files.push(absolute);
  }
  return files;
}

export function normalizedRelativePath(root, file) {
  return relative(root, file).replaceAll('\\', '/');
}

function pathIsWithin(root, file) {
  const path = relative(root, file);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith('../') && !path.startsWith('..\\'));
}

function uniqueFiles(root, files) {
  const filesByPath = new Map();
  for (const file of files) {
    const absolute = resolve(file);
    filesByPath.set(normalizedRelativePath(root, absolute), absolute);
  }
  return [...filesByPath.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, file]) => file);
}

function assertAllowedBuildGraphInput(packageRoot, file) {
  const workspaceRoot = resolve(packageRoot, '..', '..');
  if (!pathIsWithin(workspaceRoot, file)) {
    throw new Error(`Build graph input is outside the core workspace: ${file}`);
  }
  const workspacePath = normalizedRelativePath(workspaceRoot, file);
  if (workspacePath.split('/').some((segment) => segment === 'dist' || segment === '.tmp')) {
    throw new Error(`Build graph input points at generated output: ${file}`);
  }
}

export function buildGraphInputFiles(packageRoot, metafile) {
  if (!metafile?.inputs || typeof metafile.inputs !== 'object' || Array.isArray(metafile.inputs)) {
    throw new TypeError('esbuild metafile inputs are required.');
  }

  const files = Object.keys(metafile.inputs).map((input) => {
    if (input.startsWith('<')) {
      throw new Error(`Build graph input is not file-backed: ${input}`);
    }
    const file = resolve(packageRoot, input);
    assertAllowedBuildGraphInput(packageRoot, file);
    return file;
  });
  return uniqueFiles(packageRoot, files);
}

export function serializeBuildGraphInputs(packageRoot, files) {
  return uniqueFiles(packageRoot, files).map((file) => {
    assertAllowedBuildGraphInput(packageRoot, file);
    return normalizedRelativePath(packageRoot, file);
  });
}

export function restoreBuildGraphInputs(packageRoot, inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new TypeError('Stored build graph inputs are required.');
  }
  return uniqueFiles(packageRoot, inputs.map((input) => {
    if (typeof input !== 'string' || input.length === 0 || isAbsolute(input)) {
      throw new TypeError('Stored build graph inputs must be relative paths.');
    }
    const file = resolve(packageRoot, input);
    if (normalizedRelativePath(packageRoot, file) !== input) {
      throw new Error(`Stored build graph input is not normalized: ${input}`);
    }
    assertAllowedBuildGraphInput(packageRoot, file);
    return file;
  }));
}

async function isRegularFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function dependencyPackageFiles(packageRoot, graphInputFiles) {
  const workspaceRoot = resolve(packageRoot, '..', '..');
  const manifests = [];
  for (const input of graphInputFiles) {
    let directory = dirname(input);
    while (pathIsWithin(workspaceRoot, directory)) {
      const manifest = join(directory, 'package.json');
      if (await isRegularFile(manifest)) {
        manifests.push(manifest);
        break;
      }
      if (directory === workspaceRoot) break;
      directory = dirname(directory);
    }
  }
  return uniqueFiles(packageRoot, manifests);
}

export async function fingerprintFiles(root, files) {
  const hash = createHash('sha256');
  const orderedFiles = [...files].sort((left, right) => (
    normalizedRelativePath(root, left).localeCompare(normalizedRelativePath(root, right))
  ));

  for (const file of orderedFiles) {
    hash.update(normalizedRelativePath(root, file));
    hash.update('\0');
    hash.update(await readFile(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export async function collectBuildInputFiles(packageRoot, graphInputFiles) {
  if (!Array.isArray(graphInputFiles) || graphInputFiles.length === 0) {
    throw new TypeError('Resolved build graph inputs are required.');
  }
  const sourceFiles = await walkFiles(join(packageRoot, 'src'));
  const dependencyManifests = await dependencyPackageFiles(packageRoot, graphInputFiles);
  return uniqueFiles(packageRoot, [
    ...sourceFiles,
    ...graphInputFiles,
    ...dependencyManifests,
    ...BUILD_ASSETS.map((asset) => asset.source),
    resolve(packageRoot, '..', '..', 'package.json'),
    resolve(packageRoot, '..', '..', 'pnpm-lock.yaml'),
    join(packageRoot, 'package.json'),
    join(packageRoot, 'project.config.template.json'),
    join(packageRoot, 'tsconfig.json'),
    join(packageRoot, 'scripts', 'build.mjs'),
    join(packageRoot, 'scripts', 'build-assets.mjs'),
    join(packageRoot, 'scripts', 'build-config.mjs'),
    join(packageRoot, 'scripts', 'build-state.mjs'),
    join(packageRoot, 'scripts', 'json-object-file.mjs'),
    join(packageRoot, 'scripts', 'staged-output.mjs'),
  ]);
}

export async function collectExternalGraphWatchFiles(packageRoot, graphInputFiles) {
  const sourceRoot = join(packageRoot, 'src');
  const dependencyManifests = await dependencyPackageFiles(packageRoot, graphInputFiles);
  return uniqueFiles(packageRoot, [...graphInputFiles, ...dependencyManifests])
    .filter((file) => !pathIsWithin(sourceRoot, file));
}

export async function buildInputFingerprint(packageRoot, graphInputFiles) {
  return fingerprintFiles(
    packageRoot,
    await collectBuildInputFiles(packageRoot, graphInputFiles),
  );
}

export async function outputFingerprint(packageRoot, outputRoot) {
  return fingerprintFiles(packageRoot, await walkFiles(outputRoot, { missingOk: true }));
}

export async function readBuildState(packageRoot) {
  try {
    return JSON.parse(await readFile(buildStatePath(packageRoot), 'utf8'));
  } catch {
    return null;
  }
}

export async function writeBuildState(packageRoot, state) {
  const path = buildStatePath(packageRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({
    version: BUILD_STATE_VERSION,
    ...state,
  }, null, 2)}\n`, 'utf8');
}
