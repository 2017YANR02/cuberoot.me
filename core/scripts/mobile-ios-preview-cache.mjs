import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const originFile = '.cuberoot-preview-origin';

function readIfPresent(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    return undefined;
  }
}

function canReusePreviewCache(derivedData) {
  // SwiftPM and Xcode record absolute paths. A copied directory is never reusable.
  if (readIfPresent(join(derivedData, originFile)) !== derivedData) return false;
  const packages = join(derivedData, 'SourcePackages');
  const state = readIfPresent(join(packages, 'workspace-state.json'));
  if (state === undefined) {
    const packagesStat = statSync(packages, { throwIfNoEntry: false });
    return !packagesStat || packagesStat.isDirectory();
  }

  let artifacts;
  try {
    artifacts = JSON.parse(state)?.object?.artifacts;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return false;
  }
  if (!Array.isArray(artifacts)) return true; // Let Xcode handle newer layouts.

  const artifactRoot = join(packages, 'artifacts') + sep;
  return artifacts.every(artifact => {
    if (artifact?.source?.type !== 'remote') return true;
    const path = typeof artifact.path === 'string' ? resolve(artifact.path) : '';
    if (!path.startsWith(artifactRoot)) return false;
    const artifactStat = statSync(path, { throwIfNoEntry: false });
    if (!artifactStat) return false;
    return !path.endsWith('.xcframework') || (
      artifactStat.isDirectory() && statSync(join(path, 'Info.plist'), { throwIfNoEntry: false })?.isFile()
    );
  });
}

export function devicePreviewDerivedData(mobileDirectory, root = join(homedir(), 'Library/Developer/Xcode/DerivedData')) {
  mkdirSync(root, { recursive: true });
  const prefix = join(realpathSync(root), `CubeRoot-Device-Preview-${createHash('sha256').update(realpathSync(mobileDirectory)).digest('hex').slice(0, 16)}`);
  for (let generation = 1; ; generation++) {
    const derivedData = `${prefix}-${generation}`;
    try {
      mkdirSync(derivedData);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (canReusePreviewCache(derivedData)) return derivedData;
      // Leave stale caches in place so recovery cannot move another build's files.
      continue;
    }
    writeFileSync(join(derivedData, originFile), derivedData);
    return derivedData;
  }
}
