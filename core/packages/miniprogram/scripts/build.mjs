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
  sharedSmartCubeSourceRoot,
  walkFiles,
  writeBuildState,
} from './build-state.mjs';
import { validateJsonObjectFiles } from './json-object-file.mjs';
import { publishStagedDirectory } from './staged-output.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const outputRoot = join(packageRoot, 'dist');
const stagingRoot = join(packageRoot, '.tmp', 'dist-next');
const backupRoot = join(packageRoot, '.tmp', 'dist-previous');
const projectConfigPath = join(packageRoot, 'project.config.json');
const watch = process.argv.includes('--watch');

async function prepareOutput(sourceFiles) {
  await rm(stagingRoot, { force: true, recursive: true });
  await mkdir(stagingRoot, { recursive: true });
  await Promise.all(sourceFiles
    .filter((file) => extname(file) !== '.ts')
    .map(async (file) => {
      const target = join(stagingRoot, relative(sourceRoot, file));
      await mkdir(dirname(target), { recursive: true });
      await copyFile(file, target);
    }));
  await Promise.all(BUILD_ASSETS.map(async (asset) => {
    const target = join(stagingRoot, asset.output);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(asset.source, target);
  }));
}

function entryPoints(sourceFiles) {
  return sourceFiles.filter((file) => {
    if (extname(file) !== '.ts') return false;
    if (basename(file) === 'app.ts') return true;
    const sourcePath = relative(sourceRoot, file).replaceAll('\\', '/');
    return /^pages\/[^/]+\/index\.ts$/.test(sourcePath);
  });
}

async function buildProject() {
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
  await prepareOutput(sourceFiles);
  await build({
    bundle: true,
    entryPoints: entryPoints(sourceFiles),
    format: 'iife',
    logLevel: 'info',
    minifySyntax: !watch,
    minifyWhitespace: !watch,
    outbase: sourceRoot,
    outdir: stagingRoot,
    platform: 'browser',
    sourcemap: watch,
    target: 'chrome91',
  });
  await writeFile(
    projectConfigPath,
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  );
  await publishStagedDirectory({
    stagedPath: stagingRoot,
    targetPath: outputRoot,
    backupPath: backupRoot,
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

  function queueRebuild() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void rebuild(), 100);
  }

  async function rebuild() {
    if (rebuilding) {
      rebuildQueued = true;
      return;
    }

    rebuilding = true;
    try {
      await buildProject();
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

  const sourceWatcher = watchSource(sourceRoot, { recursive: true }, queueRebuild);
  const sharedSourceWatcher = watchSource(
    sharedSmartCubeSourceRoot(packageRoot),
    { recursive: true },
    queueRebuild,
  );
  const sharedPackageWatcher = watchSource(
    resolve(packageRoot, '..', 'shared', 'package.json'),
    queueRebuild,
  );
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
    sharedSourceWatcher.close();
    sharedPackageWatcher.close();
    for (const assetWatcher of assetWatchers) assetWatcher.close();
    process.exit(0);
  };
  process.once('SIGINT', stopWatching);
  process.once('SIGTERM', stopWatching);
  console.log('Watching mini program and shared smart-cube source files.');
}
