import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';

import {
  buildInputFingerprint,
  normalizedRelativePath,
  outputFingerprint,
  readBuildState,
  walkFiles,
} from './build-state.mjs';
import {
  collectReleaseFailures,
  isReleaseAuditTextFile,
} from './release-check-lib.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const outputRoot = join(packageRoot, 'dist');

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

const projectConfig = await readJson(join(packageRoot, 'project.config.json'));
const privateConfig = await readJson(join(packageRoot, 'project.private.config.json'), {});
const appConfig = await readJson(join(sourceRoot, 'app.json'));
const themeConfig = await readJson(join(sourceRoot, 'theme.json'));
const sitemapConfig = await readJson(join(sourceRoot, 'sitemap.json'));
const buildState = await readBuildState(packageRoot);
const sourceFiles = [];
for (const file of await walkFiles(sourceRoot)) {
  const path = normalizedRelativePath(packageRoot, file);
  sourceFiles.push({
    path,
    source: isReleaseAuditTextFile(path) ? await readFile(file, 'utf8') : null,
  });
}
const outputFiles = await walkFiles(outputRoot, { missingOk: true });
const uploadFiles = await Promise.all(outputFiles.map(async (file) => {
  const path = normalizedRelativePath(outputRoot, file);
  return {
    path,
    source: isReleaseAuditTextFile(path) ? await readFile(file, 'utf8') : null,
  };
}));
const builtFileSizes = await Promise.all(outputFiles.map(async (file) => ({
  path: normalizedRelativePath(outputRoot, file),
  bytes: (await stat(file)).size,
})));

const failures = collectReleaseFailures({
  projectConfig,
  privateConfig,
  appConfig,
  themeConfig,
  sitemapConfig,
  confirmedStableVersion: process.env.WECHAT_MINI_LIB_VERSION ?? '',
  confirmedSecretRotation: process.env.WECHAT_MINI_SECRET_ROTATED === '1',
  sourceFiles,
  uploadFiles,
  builtFiles: outputFiles.map((file) => normalizedRelativePath(outputRoot, file)),
  builtFileSizes,
  buildState,
  currentSourceFingerprint: await buildInputFingerprint(packageRoot),
  currentOutputFingerprint: await outputFingerprint(packageRoot, outputRoot),
});

if (failures.length > 0) {
  console.error('小程序上传前检查未通过：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('小程序自动上传前检查通过。');
  console.log('仍需人工确认：备案、基础信息审核，以及 iOS/Android 真机回归。');
}
