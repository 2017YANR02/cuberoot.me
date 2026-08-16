import { describe, expect, it } from 'vitest';

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

  it('blocks newly introduced privacy-sensitive capabilities', () => {
    const failures = collectReleaseFailures({
      ...validInput,
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
