import process from 'node:process';

import { readJsonObjectFile } from './json-object-file.mjs';

export async function resolveProjectConfig({
  templatePath,
  projectConfigPath,
  environment = process.env,
}) {
  const config = await readJsonObjectFile(templatePath, {
    label: 'project.config.template.json',
  });
  const existingConfig = await readJsonObjectFile(projectConfigPath, {
    label: 'project.config.json',
    missingValue: {},
  });
  const existingAppId = typeof existingConfig.appid === 'string'
    ? existingConfig.appid.trim()
    : '';
  const existingLibVersion = typeof existingConfig.libVersion === 'string'
    ? existingConfig.libVersion.trim()
    : '';

  config.appid =
    environment.WECHAT_MINI_APP_ID?.trim() ||
    (existingAppId !== 'touristappid' ? existingAppId : '') ||
    'touristappid';
  config.libVersion =
    environment.WECHAT_MINI_LIB_VERSION?.trim() ||
    (/^\d+\.\d+\.\d+$/.test(existingLibVersion) ? existingLibVersion : '') ||
    config.libVersion;

  return config;
}
