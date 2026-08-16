import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import process from 'node:process';

import { collectReleaseFailures } from './release-check-lib.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(packageRoot, 'src');

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

const projectConfig = await readJson(join(packageRoot, 'project.config.json'));
const privateConfig = await readJson(join(packageRoot, 'project.private.config.json'), {});
const appConfig = await readJson(join(sourceRoot, 'app.json'));
const sourceFiles = [];
for (const file of await walk(sourceRoot)) {
  if (!['.ts', '.wxml'].includes(extname(file))) continue;
  sourceFiles.push({ path: relative(packageRoot, file), source: await readFile(file, 'utf8') });
}

const failures = collectReleaseFailures({
  projectConfig,
  privateConfig,
  appConfig,
  confirmedStableVersion: process.env.WECHAT_MINI_LIB_VERSION ?? '',
  sourceFiles,
});

if (failures.length > 0) {
  console.error('小程序上传前检查未通过：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('小程序自动上传前检查通过。');
  console.log('仍需人工确认：备案、基础信息审核、AppSecret 已轮换，以及 iOS/Android 真机回归。');
}
