import { watch as watchSource } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import process from 'node:process';

import { build } from 'esbuild';

import {
  buildInputFingerprint,
  outputFingerprint,
  walkFiles,
  writeBuildState,
} from './build-state.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const outputRoot = join(packageRoot, 'dist');
const projectConfigPath = join(packageRoot, 'project.config.json');
const watch = process.argv.includes('--watch');

async function existingProjectConfig() {
  try {
    return JSON.parse(await readFile(projectConfigPath, 'utf8'));
  } catch {
    return {};
  }
}

async function prepareOutput(clean = true) {
  if (clean) await rm(outputRoot, { force: true, recursive: true });
  await mkdir(outputRoot, { recursive: true });
  const files = await walkFiles(sourceRoot);
  await Promise.all(files
    .filter((file) => extname(file) !== '.ts')
    .map(async (file) => {
      const target = join(outputRoot, relative(sourceRoot, file));
      await mkdir(dirname(target), { recursive: true });
      await copyFile(file, target);
    }));

  const templatePath = join(packageRoot, 'project.config.template.json');
  const config = JSON.parse(await readFile(templatePath, 'utf8'));
  const existingConfig = await existingProjectConfig();
  const existingAppId = typeof existingConfig.appid === 'string'
    ? existingConfig.appid.trim()
    : '';
  const existingLibVersion = typeof existingConfig.libVersion === 'string'
    ? existingConfig.libVersion.trim()
    : '';
  config.appid =
    process.env.WECHAT_MINI_APP_ID?.trim() ||
    (existingAppId !== 'touristappid' ? existingAppId : '') ||
    'touristappid';
  config.libVersion =
    process.env.WECHAT_MINI_LIB_VERSION?.trim() ||
    (/^\d+\.\d+\.\d+$/.test(existingLibVersion) ? existingLibVersion : '') ||
    config.libVersion;
  await writeFile(
    projectConfigPath,
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  );
}

async function entryPoints() {
  const files = await walkFiles(sourceRoot);
  return files.filter((file) => {
    if (extname(file) !== '.ts') return false;
    if (basename(file) === 'app.ts') return true;
    const sourcePath = relative(sourceRoot, file).replaceAll('\\', '/');
    return /^pages\/[^/]+\/index\.ts$/.test(sourcePath);
  });
}

async function buildProject(clean = true) {
  await prepareOutput(clean);
  await build({
    bundle: true,
    entryPoints: await entryPoints(),
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
    if (eventType === 'rename') cleanBeforeRebuild = true;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void rebuild(), 100);
  });

  const stopWatching = () => {
    clearTimeout(debounceTimer);
    sourceWatcher.close();
    process.exit(0);
  };
  process.once('SIGINT', stopWatching);
  process.once('SIGTERM', stopWatching);
  console.log('Watching all mini program source files.');
}
