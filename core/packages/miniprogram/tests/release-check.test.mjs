import { describe, expect, it } from 'vitest';

import { BUILD_STATE_VERSION } from '../scripts/build-state.mjs';
import { collectReleaseFailures } from '../scripts/release-check-lib.mjs';

const validInput = {
  projectConfig: {
    appid: 'wx1f92ba91b7e42015',
    libVersion: '3.17.1',
    miniprogramRoot: 'dist/',
    setting: { urlCheck: true },
  },
  privateConfig: {},
  appConfig: { pages: ['pages/timer/index'] },
  confirmedStableVersion: '3.17.1',
  sourceFiles: [{ path: 'src/app.ts', source: 'App({})' }],
  builtFiles: [
    'app.js',
    'app.json',
    'app.wxss',
    'sitemap.json',
    'pages/timer/index.js',
    'pages/timer/index.json',
    'pages/timer/index.wxml',
    'pages/timer/index.wxss',
  ],
  buildState: {
    version: BUILD_STATE_VERSION,
    sourceFingerprint: 'current-source',
    outputFingerprint: 'current-output',
  },
  currentSourceFingerprint: 'current-source',
  currentOutputFingerprint: 'current-output',
};

describe('mini program release check', () => {
  it('accepts a production-shaped configuration', () => {
    expect(collectReleaseFailures(validInput)).toEqual([]);
  });

  it('reports unsafe project configuration instead of silently uploading', () => {
    const failures = collectReleaseFailures({
      ...validInput,
      projectConfig: {
        appid: 'touristappid',
        libVersion: 'trial',
        miniprogramRoot: 'src/',
        setting: { urlCheck: false },
      },
      confirmedStableVersion: '3.17.1',
      appConfig: { pages: [] },
    });

    expect(failures).toEqual(expect.arrayContaining([
      'AppID 不是正式小程序 AppID。',
      '基础库仍是 trial 或无效值，请在开发者工具中选择稳定版本。',
      '开发者工具当前基础库 trial 与确认版本 3.17.1 不一致。',
      '上传前必须开启合法域名校验。',
      'miniprogramRoot 必须保持为 dist/。',
      'src/app.json 没有有效页面声明。',
    ]));
  });

  it('requires a freshly confirmed matching stable base library', () => {
    expect(collectReleaseFailures({
      ...validInput,
      confirmedStableVersion: '',
    })).toContain('请在开发者工具确认稳定基础库后，用 WECHAT_MINI_LIB_VERSION 明确传入该版本。');

    expect(collectReleaseFailures({
      ...validInput,
      confirmedStableVersion: '3.16.0',
    })).toContain('开发者工具当前基础库 3.17.1 与确认版本 3.16.0 不一致。');
  });

  it('rejects incomplete build output', () => {
    const failures = collectReleaseFailures({
      ...validInput,
      sourceFiles: [
        ...validInput.sourceFiles,
        { path: 'src/assets/logo.png', source: '' },
        { path: 'src/templates/web-route-view.wxml', source: '<template />' },
      ],
      builtFiles: validInput.builtFiles.filter((path) => (
        path !== 'pages/timer/index.wxml'
      )),
    });

    expect(failures).toContain(
      'dist 缺少构建产物：assets/logo.png、pages/timer/index.wxml、templates/web-route-view.wxml。',
    );
  });

  it('rejects missing or stale build state', () => {
    expect(collectReleaseFailures({
      ...validInput,
      buildState: null,
    })).toContain('缺少有效的小程序构建状态，请重新运行 build。');

    expect(collectReleaseFailures({
      ...validInput,
      currentSourceFingerprint: 'changed-source',
      currentOutputFingerprint: 'changed-output',
    })).toEqual(expect.arrayContaining([
      'dist 不是由当前源码生成，请重新运行 build。',
      'dist 在构建后发生变化，请重新运行 build。',
    ]));
  });

  it('blocks newly introduced privacy-sensitive capabilities', () => {
    const failures = collectReleaseFailures({
      ...validInput,
      builtFiles: [...validInput.builtFiles, 'pages/login/index.wxml'],
      sourceFiles: [
        { path: 'src/pages/device/index.ts', source: 'wx.openBluetoothAdapter({})' },
        { path: 'src/pages/login/index.wxml', source: '<button open-type="getPhoneNumber">登录</button>' },
      ],
    });

    expect(failures).toEqual([
      'src/pages/device/index.ts 使用了蓝牙能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。',
      'src/pages/login/index.wxml 使用了手机号能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。',
    ]);
  });
});
