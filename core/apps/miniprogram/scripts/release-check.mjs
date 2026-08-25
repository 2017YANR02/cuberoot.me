import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';

import {
  buildInputFingerprint,
  normalizedRelativePath,
  outputFingerprint,
  readBuildState,
  restoreBuildGraphInputs,
  walkFiles,
} from './build-state.mjs';
import {
  JsonObjectFileError,
  readJsonObjectFile,
} from './json-object-file.mjs';
import {
  collectReleaseFailures,
  isReleaseAuditTextFile,
  releaseConfirmationsFromEnv,
} from './release-check-lib.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const outputRoot = join(packageRoot, 'dist');

async function runReleaseCheck() {
  const [projectConfig, privateConfig, appConfig, themeConfig, sitemapConfig] =
    await Promise.all([
      readJsonObjectFile(join(packageRoot, 'project.config.json'), {
        label: 'project.config.json',
        missingValue: null,
      }),
      readJsonObjectFile(join(packageRoot, 'project.private.config.json'), {
        label: 'project.private.config.json',
        missingValue: {},
      }),
      readJsonObjectFile(join(sourceRoot, 'app.json'), {
        label: 'src/app.json',
      }),
      readJsonObjectFile(join(sourceRoot, 'theme.json'), {
        label: 'src/theme.json',
      }),
      readJsonObjectFile(join(sourceRoot, 'sitemap.json'), {
        label: 'src/sitemap.json',
      }),
    ]);
  const buildState = await readBuildState(packageRoot);
  let currentSourceFingerprint = null;
  try {
    const graphInputFiles = restoreBuildGraphInputs(
      packageRoot,
      buildState?.buildGraphInputs,
    );
    currentSourceFingerprint = await buildInputFingerprint(packageRoot, graphInputFiles);
  } catch {
    // The release audit reports a stale or invalid build state below.
  }
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
    releaseConfirmations: releaseConfirmationsFromEnv(process.env),
    sourceFiles,
    uploadFiles,
    builtFiles: outputFiles.map((file) => normalizedRelativePath(outputRoot, file)),
    builtFileSizes,
    buildState,
    currentSourceFingerprint,
    currentOutputFingerprint: await outputFingerprint(packageRoot, outputRoot),
  });

  if (failures.length > 0) {
    console.error('小程序上传前检查未通过：');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('小程序自动上传前检查通过。');
    console.log('基础信息、备案、隐私指引和双平台真机回归均已显式确认。');
  }
}

try {
  await runReleaseCheck();
} catch (error) {
  if (!(error instanceof JsonObjectFileError)) throw error;
  console.error('小程序上传前检查未通过：');
  console.error(`- ${error.message}`);
  process.exitCode = 1;
}
