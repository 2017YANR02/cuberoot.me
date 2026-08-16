import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

export const BUILD_STATE_VERSION = 1;

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
  return [
    ...sourceFiles,
    join(packageRoot, 'package.json'),
    join(packageRoot, 'project.config.template.json'),
    join(packageRoot, 'tsconfig.json'),
    join(packageRoot, 'scripts', 'build.mjs'),
    join(packageRoot, 'scripts', 'build-state.mjs'),
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
