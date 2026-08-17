import { watch as watchSource } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import process from 'node:process';

import { build } from 'esbuild';

import { BUILD_ASSETS } from './build-assets.mjs';
import { resolveProjectConfig } from './build-config.mjs';
import {
  buildInputFingerprint,
  normalizedRelativePath,
  outputFingerprint,
  walkFiles,
  writeBuildState,
} from './build-state.mjs';
import { validateJsonObjectFiles } from './json-object-file.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const outputRoot = join(packageRoot, 'dist');
const projectConfigPath = join(packageRoot, 'project.config.json');
const watch = process.argv.includes('--watch');

async function prepareOutput(config, sourceFiles, clean = true) {
  if (clean) await rm(outputRoot, { force: true, recursive: true });
  await mkdir(outputRoot, { recursive: true });
  await Promise.all(sourceFiles
    .filter((file) => extname(file) !== '.ts')
    .map(async (file) => {
      const target = join(outputRoot, relative(sourceRoot, file));
      await mkdir(dirname(target), { recursive: true });
      await copyFile(file, target);
    }));
  await Promise.all(BUILD_ASSETS.map(async (asset) => {
    const target = join(outputRoot, asset.output);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(asset.source, target);
  }));

  await writeFile(
    projectConfigPath,
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  );
}

function entryPoints(sourceFiles) {
  return sourceFiles.filter((file) => {
    if (extname(file) !== '.ts') return false;
    if (basename(file) === 'app.ts') return true;
    const sourcePath = relative(sourceRoot, file).replaceAll('\\', '/');
    return /^pages\/[^/]+\/index\.ts$/.test(sourcePath);
  });
}

async function buildProject(clean = true) {
  const config = await resolveProjectConfig({
    templatePath: join(packageRoot, 'project.config.template.json'),
    projectConfigPath,
  });
  const sourceFiles = await walkFiles(sourceRoot);
  const appConfigPath = join(sourceRoot, 'app.json');
  const sourceJsonFiles = [
    appConfigPath,
    ...sourceFiles
      .filter((file) => extname(file) === '.json' && file !== appConfigPath)
      .sort(),
  ];
  await validateJsonObjectFiles(sourceJsonFiles, {
    labelForPath: (file) => normalizedRelativePath(packageRoot, file),
  });
  await prepareOutput(config, sourceFiles, clean);
  await build({
    bundle: true,
    entryPoints: entryPoints(sourceFiles),
    format: 'iife',
    logLevel: 'info',
    outbase: sourceRoot,
    outdir: outputRoot,
    platform: 'browser',
    sourcemap: watch,
    target: 'chrome91',
  });
  await writeBuildState(packageRoot, {
    sourceFingerprint: await buildInputFingerprint(packageRoot),
    outputFingerprint: await outputFingerprint(packageRoot, outputRoot),
  });
}

if (!watch) {
  await buildProject();
} else {
  await buildProject();

  let debounceTimer;
  let rebuilding = false;
  let rebuildQueued = false;
  let cleanBeforeRebuild = false;

  function queueRebuild({ clean = false } = {}) {
    if (clean) cleanBeforeRebuild = true;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void rebuild(), 100);
  }

  async function rebuild() {
    if (rebuilding) {
      rebuildQueued = true;
      return;
    }

    rebuilding = true;
    const clean = cleanBeforeRebuild;
    cleanBeforeRebuild = false;
    try {
      await buildProject(clean);
      console.log(`[${new Date().toLocaleTimeString()}] Mini program rebuilt.`);
    } catch (error) {
      console.error(error);
    } finally {
      rebuilding = false;
      if (rebuildQueued) {
        rebuildQueued = false;
        void rebuild();
      }
    }
  }

  const sourceWatcher = watchSource(sourceRoot, { recursive: true }, (eventType) => {
    queueRebuild({ clean: eventType === 'rename' });
  });
  const assetDirectories = [...new Set(BUILD_ASSETS.map((asset) => dirname(asset.source)))];
  const assetWatchers = assetDirectories.map((directory) => {
    const filenames = new Set(BUILD_ASSETS
      .filter((asset) => dirname(asset.source) === directory)
      .map((asset) => basename(asset.source)));
    return watchSource(directory, (_eventType, filename) => {
      if (filename && !filenames.has(String(filename))) return;
      queueRebuild();
    });
  });

  const stopWatching = () => {
    clearTimeout(debounceTimer);
    sourceWatcher.close();
    for (const assetWatcher of assetWatchers) assetWatcher.close();
    process.exit(0);
  };
  process.once('SIGINT', stopWatching);
  process.once('SIGTERM', stopWatching);
  console.log('Watching all mini program source files.');
}
