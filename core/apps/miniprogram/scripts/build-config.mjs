import process from 'node:process';

import { readJsonObjectFile } from './json-object-file.mjs';

export async function resolveProjectConfig({
  templatePath,
  projectConfigPath,
  environment = process.env,
  appIdEnvironmentKey = 'WECHAT_MINI_APP_ID',
  libVersionEnvironmentKey = 'WECHAT_MINI_LIB_VERSION',
  placeholderAppId = 'touristappid',
  templateLabel = 'project.config.template.json',
  projectConfigLabel = 'project.config.json',
}) {
  const config = await readJsonObjectFile(templatePath, {
    label: templateLabel,
  });
  const existingConfig = await readJsonObjectFile(projectConfigPath, {
    label: projectConfigLabel,
    missingValue: {},
  });
  const existingAppId = typeof existingConfig.appid === 'string'
    ? existingConfig.appid.trim()
    : '';
  const existingLibVersion = typeof existingConfig.libVersion === 'string'
    ? existingConfig.libVersion.trim()
    : '';

  config.appid =
    environment[appIdEnvironmentKey]?.trim() ||
    (existingAppId !== placeholderAppId ? existingAppId : '') ||
    placeholderAppId;
  if (typeof config.libVersion === 'string' && libVersionEnvironmentKey) {
    config.libVersion =
      environment[libVersionEnvironmentKey]?.trim() ||
      (/^\d+\.\d+\.\d+$/.test(existingLibVersion) ? existingLibVersion : '') ||
      config.libVersion;
  }

  return config;
}
