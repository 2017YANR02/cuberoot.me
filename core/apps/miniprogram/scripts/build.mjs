import { watch as watchSource } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import process from 'node:process';

import { build } from 'esbuild';

import { BUILD_ASSETS } from './build-assets.mjs';
import { resolveProjectConfig } from './build-config.mjs';
import {
  buildGraphInputFiles,
  buildInputFingerprint,
  collectExternalGraphWatchFiles,
  normalizedRelativePath,
  outputFingerprint,
  serializeBuildGraphInputs,
  walkFiles,
  writeBuildState,
} from './build-state.mjs';
import { validateJsonObjectFiles } from './json-object-file.mjs';
import { publishStagedDirectory } from './staged-output.mjs';
import { validateWxmlExpressionFiles } from './wxml-expression.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const targetArgument = process.argv.find((argument) => argument.startsWith('--target='));
const target = targetArgument?.slice('--target='.length) ?? 'wechat';
if (target !== 'wechat' && target !== 'douyin') {
  throw new Error(`不支持的小程序构建目标：${target}`);
}
const douyin = target === 'douyin';
const outputRoot = join(packageRoot, douyin ? 'dist-douyin' : 'dist');
const stagingRoot = join(packageRoot, '.tmp', douyin ? 'dist-douyin-next' : 'dist-next');
const compileRoot = douyin
  ? join(packageRoot, '.tmp', 'dist-douyin-wechat-next')
  : stagingRoot;
const converterLogRoot = join(packageRoot, '.tmp', 'wx-to-tt-log');
const backupRoot = join(packageRoot, '.tmp', douyin ? 'dist-douyin-previous' : 'dist-previous');
const projectConfigPath = join(packageRoot, douyin ? 'project.douyin.config.json' : 'project.config.json');
const douyinUnsupportedAppConfigKeys = [
  'darkmode',
  'lazyCodeLoading',
  'sitemapLocation',
  'style',
  'themeLocation',
];
const watch = process.argv.includes('--watch');
if (watch && douyin) throw new Error('抖音构建暂不支持 watch，请运行 build:douyin。');

function watchExactFiles(files, onChange) {
  const filenamesByDirectory = new Map();
  for (const file of files) {
    const directory = dirname(file);
    const filenames = filenamesByDirectory.get(directory) ?? new Set();
    filenames.add(basename(file));
    filenamesByDirectory.set(directory, filenames);
  }
  return [...filenamesByDirectory].map(([directory, filenames]) => (
    watchSource(directory, (_eventType, filename) => {
      if (filename && !filenames.has(String(filename))) return;
      onChange();
    })
  ));
}

async function prepareOutput(sourceFiles) {
  await rm(compileRoot, { force: true, recursive: true });
  await mkdir(compileRoot, { recursive: true });
  await Promise.all(sourceFiles
    .filter((file) => extname(file) !== '.ts')
    .map(async (file) => {
      const output = join(compileRoot, relative(sourceRoot, file));
      await mkdir(dirname(output), { recursive: true });
      await copyFile(file, output);
    }));
  await Promise.all(BUILD_ASSETS.map(async (asset) => {
    const output = join(compileRoot, asset.output);
    await mkdir(dirname(output), { recursive: true });
    await copyFile(asset.source, output);
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
    templatePath: join(packageRoot, douyin
      ? 'project.douyin.config.template.json'
      : 'project.config.template.json'),
    projectConfigPath,
    ...(douyin ? {
      appIdEnvironmentKey: 'DOUYIN_MINI_APP_ID',
      libVersionEnvironmentKey: '',
      placeholderAppId: 'testAppId',
      projectConfigLabel: 'project.douyin.config.json',
      templateLabel: 'project.douyin.config.template.json',
    } : {}),
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
  await validateWxmlExpressionFiles(
    sourceFiles.filter((file) => extname(file) === '.wxml'),
    { labelForPath: (file) => normalizedRelativePath(packageRoot, file) },
  );
  await prepareOutput(sourceFiles);
  const buildResult = await build({
    absWorkingDir: packageRoot,
    bundle: true,
    entryPoints: entryPoints(sourceFiles),
    format: 'iife',
    logLevel: 'info',
    metafile: true,
    minifySyntax: !watch,
    minifyWhitespace: !watch,
    outbase: sourceRoot,
    outdir: compileRoot,
    platform: 'browser',
    sourcemap: watch,
    target: 'chrome91',
    define: {
      __MINI_PROGRAM_TARGET__: JSON.stringify(target),
    },
  });
  const graphInputFiles = buildGraphInputFiles(packageRoot, buildResult.metafile);
  if (douyin) {
    await convertToDouyin();
    await normalizeDouyinAppConfig();
    await writeFile(join(stagingRoot, 'project.config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    await validateDouyinOutput();
  }
  await writeFile(projectConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await publishStagedDirectory({
    stagedPath: stagingRoot,
    targetPath: outputRoot,
    backupPath: backupRoot,
  });
  if (!douyin) {
    await writeBuildState(packageRoot, {
      buildGraphInputs: serializeBuildGraphInputs(packageRoot, graphInputFiles),
      sourceFingerprint: await buildInputFingerprint(packageRoot, graphInputFiles),
      outputFingerprint: await outputFingerprint(packageRoot, outputRoot),
    });
  }
  return collectExternalGraphWatchFiles(packageRoot, graphInputFiles);
}

async function convertToDouyin() {
  await rm(stagingRoot, { force: true, recursive: true });
  await mkdir(stagingRoot, { recursive: true });
  await rm(converterLogRoot, { force: true, recursive: true });
  await mkdir(converterLogRoot, { recursive: true });
  const require = createRequire(import.meta.url);
  const { wx2tt } = require('wx-to-tt');
  await new Promise((resolveConversion, rejectConversion) => {
    wx2tt({ src: compileRoot, dist: stagingRoot, log: converterLogRoot, type: 'wx2tt' }, (error) => {
      if (error) rejectConversion(error);
      else resolveConversion();
    });
  });
}

async function normalizeDouyinAppConfig() {
  const appConfigPath = join(stagingRoot, 'app.json');
  const themePath = join(stagingRoot, 'theme.json');
  const config = JSON.parse(await readFile(appConfigPath, 'utf8'));
  const theme = JSON.parse(await readFile(themePath, 'utf8'));
  for (const key of douyinUnsupportedAppConfigKeys) delete config[key];
  const normalized = JSON.parse(JSON.stringify(config, (_key, value) => {
    if (typeof value !== 'string' || !value.startsWith('@')) return value;
    const resolvedValue = theme.light?.[value.slice(1)];
    if (typeof resolvedValue !== 'string') throw new Error(`抖音 app.json 无法解析主题值：${value}`);
    return resolvedValue;
  }));
  await writeFile(appConfigPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  await Promise.all([
    rm(themePath, { force: true }),
    rm(join(stagingRoot, 'sitemap.json'), { force: true }),
  ]);
}

async function validateDouyinOutput() {
  const files = await walkFiles(stagingRoot);
  const sourceFiles = files.filter((file) => ['.js', '.json', '.ttml', '.ttss'].includes(extname(file)));
  const forbiddenFile = files.find((file) => ['.wxml', '.wxss'].includes(extname(file)));
  if (forbiddenFile) {
    throw new Error(`抖音产物残留微信模板：${normalizedRelativePath(stagingRoot, forbiddenFile)}`);
  }
  const appConfig = JSON.parse(await readFile(join(stagingRoot, 'app.json'), 'utf8'));
  const unsupportedKey = douyinUnsupportedAppConfigKeys.find((key) => key in appConfig);
  if (unsupportedKey) throw new Error(`抖音 app.json 残留微信配置：${unsupportedKey}`);
  if (/\"@[^\"]+\"/.test(JSON.stringify(appConfig))) {
    throw new Error('抖音 app.json 残留微信主题变量');
  }
  const forbidden = [
    /\bwx\s*\./,
    /globalThis\.wx/,
    /\/auth\/wechat\/miniprogram/,
    /wechat_redirect/,
    /\bwx:/,
    /\.nextTick\s*\(/,
    /\.getDeviceInfo\s*\(/,
  ];
  for (const file of sourceFiles) {
    const contents = await readFile(file, 'utf8');
    const match = forbidden.find((pattern) => pattern.test(contents));
    if (match) {
      throw new Error(`抖音产物含未适配的平台实现：${normalizedRelativePath(stagingRoot, file)} (${match})`);
    }
  }
}

if (!watch) {
  await buildProject();
} else {
  const initialExternalInputs = await buildProject();

  let debounceTimer;
  let rebuilding = false;
  let rebuildQueued = false;
  let externalInputWatchers = [];

  function replaceExternalInputWatchers(files) {
    const nextWatchers = watchExactFiles(files, queueRebuild);
    const previousWatchers = externalInputWatchers;
    externalInputWatchers = nextWatchers;
    for (const watcher of previousWatchers) watcher.close();
  }

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
      replaceExternalInputWatchers(await buildProject());
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
  replaceExternalInputWatchers(initialExternalInputs);
  const assetWatchers = watchExactFiles(
    BUILD_ASSETS.map((asset) => asset.source),
    queueRebuild,
  );

  const stopWatching = () => {
    clearTimeout(debounceTimer);
    sourceWatcher.close();
    for (const inputWatcher of externalInputWatchers) inputWatcher.close();
    for (const assetWatcher of assetWatchers) assetWatcher.close();
    process.exit(0);
  };
  process.once('SIGINT', stopWatching);
  process.once('SIGTERM', stopWatching);
  console.log('Watching mini program source and resolved external build inputs.');
}
