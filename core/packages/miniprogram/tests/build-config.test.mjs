import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveProjectConfig } from '../scripts/build-config.mjs';
import { readJsonObjectFile } from '../scripts/json-object-file.mjs';

const temporaryDirectories = [];

async function fixture({ existing, template = {} } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'cuberoot-miniprogram-config-'));
  temporaryDirectories.push(directory);
  const templatePath = join(directory, 'project.config.template.json');
  const projectConfigPath = join(directory, 'project.config.json');
  await writeFile(templatePath, `${JSON.stringify({
    appid: 'touristappid',
    libVersion: 'trial',
    ...template,
  })}\n`, 'utf8');
  if (existing !== undefined) await writeFile(projectConfigPath, existing, 'utf8');
  return { projectConfigPath, templatePath };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { force: true, recursive: true })
  )));
});

describe('project config resolution', () => {
  it('preserves an existing official AppID and stable base library', async () => {
    const paths = await fixture({
      existing: JSON.stringify({ appid: 'wx-official', libVersion: '3.17.1' }),
    });

    await expect(resolveProjectConfig({
      ...paths,
      environment: {},
    })).resolves.toMatchObject({
      appid: 'wx-official',
      libVersion: '3.17.1',
    });
  });

  it('uses explicit environment values without reading secrets', async () => {
    const paths = await fixture();

    await expect(resolveProjectConfig({
      ...paths,
      environment: {
        WECHAT_MINI_APP_ID: ' wx-env ',
        WECHAT_MINI_LIB_VERSION: ' 3.18.0 ',
      },
    })).resolves.toMatchObject({
      appid: 'wx-env',
      libVersion: '3.18.0',
    });
  });

  it('keeps template defaults when the local config is absent', async () => {
    const paths = await fixture();

    await expect(resolveProjectConfig({
      ...paths,
      environment: {},
    })).resolves.toMatchObject({
      appid: 'touristappid',
      libVersion: 'trial',
    });
  });

  it('rejects malformed local config instead of replacing its identity', async () => {
    const paths = await fixture({ existing: '{ invalid' });

    await expect(resolveProjectConfig({
      ...paths,
      environment: {},
    })).rejects.toThrow('project.config.json 不是有效的 JSON。');
  });

  it('rejects non-object JSON configuration', async () => {
    const paths = await fixture();
    await writeFile(paths.templatePath, '[]\n', 'utf8');

    await expect(readJsonObjectFile(paths.templatePath, {
      label: 'project.config.template.json',
    })).rejects.toThrow('project.config.template.json 的顶层必须是 JSON 对象。');
  });
});
