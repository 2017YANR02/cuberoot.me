import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

import { BUILD_ASSETS } from './build-assets.mjs';

export const BUILD_STATE_VERSION = 2;

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

export function sharedSmartCubeSourceRoot(packageRoot) {
  return resolve(packageRoot, '..', 'shared', 'src', 'smart_cube');
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

export async function collectBuildInputFiles(packageRoot) {
  const sourceFiles = await walkFiles(join(packageRoot, 'src'));
  const sharedSmartCubeFiles = await walkFiles(sharedSmartCubeSourceRoot(packageRoot));
  return [
    ...sourceFiles,
    ...sharedSmartCubeFiles,
    ...BUILD_ASSETS.map((asset) => asset.source),
    resolve(packageRoot, '..', '..', 'package.json'),
    resolve(packageRoot, '..', '..', 'pnpm-lock.yaml'),
    resolve(packageRoot, '..', 'shared', 'package.json'),
    join(packageRoot, 'package.json'),
    join(packageRoot, 'project.config.template.json'),
    join(packageRoot, 'tsconfig.json'),
    join(packageRoot, 'scripts', 'build.mjs'),
    join(packageRoot, 'scripts', 'build-assets.mjs'),
    join(packageRoot, 'scripts', 'build-config.mjs'),
    join(packageRoot, 'scripts', 'build-state.mjs'),
    join(packageRoot, 'scripts', 'json-object-file.mjs'),
    join(packageRoot, 'scripts', 'staged-output.mjs'),
  ];
}

export async function buildInputFingerprint(packageRoot) {
  return fingerprintFiles(packageRoot, await collectBuildInputFiles(packageRoot));
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
