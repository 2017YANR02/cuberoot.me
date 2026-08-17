import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BUILD_ASSETS } from '../scripts/build-assets.mjs';
import {
  BUILD_STATE_VERSION,
  collectBuildInputFiles,
} from '../scripts/build-state.mjs';
import {
  EXPECTED_APP_PAGES,
  EXPECTED_TAB_BAR,
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_PACKAGE_BYTES,
  MIN_TEXT_CONTRAST_RATIO,
  PUBLIC_INDEXED_PAGES,
  PRODUCTION_APP_ID,
  REQUIRED_RELEASE_CONFIRMATIONS,
  collectReleaseFailures,
  colorContrastRatio,
  isReleaseAuditTextFile,
  releaseConfirmationsFromEnv,
} from '../scripts/release-check-lib.mjs';

function sizesFor(paths, bytes = 1) {
  return paths.map((path) => ({ path, bytes }));
}

const validBuiltFiles = [
  'app.js',
  'app.json',
  'app.wxss',
  'sitemap.json',
  ...BUILD_ASSETS.map(({ output }) => output),
  ...EXPECTED_APP_PAGES.flatMap((page) => [
    `${page}.js`,
    `${page}.json`,
    `${page}.wxml`,
    `${page}.wxss`,
  ]),
];

const validInput = {
  projectConfig: {
    appid: PRODUCTION_APP_ID,
    compileType: 'miniprogram',
    libVersion: '3.17.1',
    miniprogramRoot: 'dist/',
    setting: {
      minified: true,
      minifyWXML: true,
      minifyWXSS: true,
      urlCheck: true,
    },
  },
  privateConfig: {},
  appConfig: {
    pages: EXPECTED_APP_PAGES,
    darkmode: true,
    themeLocation: 'theme.json',
    sitemapLocation: 'sitemap.json',
    window: {
      backgroundColor: '@backgroundColor',
      backgroundTextStyle: '@backgroundTextStyle',
      navigationBarBackgroundColor: '@navigationBarBackgroundColor',
      navigationBarTextStyle: '@navigationBarTextStyle',
    },
    tabBar: {
      color: '@tabBarColor',
      selectedColor: '@tabBarSelectedColor',
      backgroundColor: '@tabBarBackgroundColor',
      borderStyle: '@tabBarBorderStyle',
      list: EXPECTED_TAB_BAR,
    },
  },
  themeConfig: {
    light: {
      backgroundColor: '#fafafa',
      backgroundTextStyle: 'dark',
      navigationBarBackgroundColor: '#fafafa',
      navigationBarTextStyle: 'black',
      tabBarColor: '#737373',
      tabBarSelectedColor: '#a94f31',
      tabBarBackgroundColor: '#fafafa',
      tabBarBorderStyle: 'white',
    },
    dark: {
      backgroundColor: '#111111',
      backgroundTextStyle: 'light',
      navigationBarBackgroundColor: '#111111',
      navigationBarTextStyle: 'white',
      tabBarColor: '#a3a3a3',
      tabBarSelectedColor: '#d47a58',
      tabBarBackgroundColor: '#111111',
      tabBarBorderStyle: 'black',
    },
  },
  sitemapConfig: {
    rules: [
      ...PUBLIC_INDEXED_PAGES.map((page) => ({ action: 'allow', page })),
      { action: 'disallow', page: '*' },
    ],
  },
  confirmedStableVersion: '3.17.1',
  confirmedSecretRotation: true,
  releaseConfirmations: Object.fromEntries(
    REQUIRED_RELEASE_CONFIRMATIONS.map(({ key }) => [key, true]),
  ),
  sourceFiles: [{ path: 'src/app.ts', source: 'App({})' }],
  builtFiles: validBuiltFiles,
  builtFileSizes: sizesFor(validBuiltFiles),
  buildState: {
    version: BUILD_STATE_VERSION,
    sourceFingerprint: 'current-source',
    outputFingerprint: 'current-output',
  },
  currentSourceFingerprint: 'current-source',
  currentOutputFingerprint: 'current-output',
};

describe('mini program release check', () => {
  it('builds the public share cover from the canonical website icon', async () => {
    expect(BUILD_ASSETS).toHaveLength(1);
    expect(BUILD_ASSETS[0].output).toBe('assets/share-cover.png');
    const packageRoot = resolve(import.meta.dirname, '..');
    expect(await collectBuildInputFiles(packageRoot)).toContain(BUILD_ASSETS[0].source);
    const source = await readFile(BUILD_ASSETS[0].source);
    expect(source.subarray(0, 8)).toEqual(Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]));
  });

  it('scans code-like and unknown files without decoding known binary assets', () => {
    expect(isReleaseAuditTextFile('src/app.ts')).toBe(true);
    expect(isReleaseAuditTextFile('src/.env')).toBe(true);
    expect(isReleaseAuditTextFile('dist/runtime.custom')).toBe(true);
    expect(isReleaseAuditTextFile('src/assets/logo.PNG')).toBe(false);
    expect(isReleaseAuditTextFile('dist/engine.wasm')).toBe(false);
  });

  it('accepts a production-shaped configuration', () => {
    expect(collectReleaseFailures(validInput)).toEqual([]);
  });

  it('reports unsafe project configuration instead of silently uploading', () => {
    const failures = collectReleaseFailures({
      ...validInput,
      projectConfig: {
        appid: 'touristappid',
        compileType: 'plugin',
        libVersion: 'trial',
        miniprogramRoot: 'src/',
        setting: {
          minified: false,
          minifyWXML: false,
          minifyWXSS: false,
          urlCheck: false,
        },
      },
      confirmedStableVersion: '3.17.1',
      appConfig: { pages: [] },
    });

    expect(failures).toEqual(expect.arrayContaining([
      'AppID 不是正式小程序 AppID。',
      '基础库仍是 trial 或无效值，请在开发者工具中选择稳定版本。',
      '开发者工具当前基础库 trial 与确认版本 3.17.1 不一致。',
      '上传前必须开启合法域名校验。',
      '上传前必须开启代码压缩：JavaScript、WXML、WXSS。',
      'compileType 必须保持为 miniprogram，避免上传成其他微信项目类型。',
      'miniprogramRoot 必须保持为 dist/。',
      'src/app.json 没有有效页面声明。',
    ]));
  });

  it('honors private developer-tool overrides for compression', () => {
    expect(collectReleaseFailures({
      ...validInput,
      privateConfig: {
        setting: {
          minified: false,
          minifyWXML: true,
          minifyWXSS: true,
          urlCheck: true,
        },
      },
    })).toContain('上传前必须开启代码压缩：JavaScript。');
  });

  it('rejects a valid-shaped AppID belonging to another mini program', () => {
    expect(collectReleaseFailures({
      ...validInput,
      projectConfig: {
        ...validInput.projectConfig,
        appid: 'wx0000000000000000',
      },
    })).toContain('AppID 与 CubeRoot 正式小程序不一致，当前为 wx0000000000000000。');
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

  it('blocks release until the exposed AppSecret rotation is explicitly confirmed', () => {
    expect(collectReleaseFailures({
      ...validInput,
      confirmedSecretRotation: false,
    })).toContain(
      '已暴露的 AppSecret 尚未确认轮换；后台生成新密钥并更新服务端后，上传时设置 WECHAT_MINI_SECRET_ROTATED=1。',
    );
  });

  it('requires every human release gate to be explicitly confirmed', () => {
    expect(releaseConfirmationsFromEnv({
      WECHAT_MINI_BASIC_INFO_APPROVED: '1',
      WECHAT_MINI_FILING_COMPLETED: '0',
      WECHAT_MINI_PRIVACY_REVIEWED: '1',
      WECHAT_MINI_REAL_DEVICE_TESTED: 'yes',
    })).toEqual({
      basicInfoApproved: true,
      filingCompleted: false,
      privacyReviewed: true,
      realDeviceTested: false,
    });

    expect(collectReleaseFailures({
      ...validInput,
      releaseConfirmations: {
        ...validInput.releaseConfirmations,
        filingCompleted: false,
        realDeviceTested: false,
      },
    })).toEqual(expect.arrayContaining([
      '小程序备案尚未确认完成；备案状态完成后，上传时设置 WECHAT_MINI_FILING_COMPLETED=1。',
      '本次候选版本尚未确认完成 iOS 和 Android 真机回归；回归通过后，上传时设置 WECHAT_MINI_REAL_DEVICE_TESTED=1。',
    ]));
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

  it('rejects a release missing an external build asset', () => {
    const builtFiles = validInput.builtFiles.filter((path) => (
      path !== 'assets/share-cover.png'
    ));

    expect(collectReleaseFailures({
      ...validInput,
      builtFiles,
      builtFileSizes: sizesFor(builtFiles),
    })).toContain('dist 缺少构建产物：assets/share-cover.png。');
  });

  it('rejects development source maps in the upload package', () => {
    const builtFiles = [
      ...validInput.builtFiles,
      'app.js.map',
      'pages/timer/index.js.map',
    ];
    expect(collectReleaseFailures({
      ...validInput,
      builtFiles,
      builtFileSizes: sizesFor(builtFiles),
    })).toContain(
      '正式上传包不能包含 source map：app.js.map、pages/timer/index.js.map。请重新运行非监听构建。',
    );
  });

  it('rejects unexpectedly large upload files and packages', () => {
    const builtFileSizes = sizesFor(
      validBuiltFiles,
      Math.floor(MAX_UPLOAD_PACKAGE_BYTES / validBuiltFiles.length),
    );
    builtFileSizes[0] = {
      path: validBuiltFiles[0],
      bytes: MAX_UPLOAD_FILE_BYTES + 1,
    };
    const totalKibibytes = Math.ceil(
      builtFileSizes.reduce((sum, { bytes }) => sum + bytes, 0) / 1024,
    );

    expect(collectReleaseFailures({
      ...validInput,
      builtFileSizes,
    })).toEqual(expect.arrayContaining([
      'dist 单文件超过项目预算 128 KiB：app.js（129 KiB）。',
      `dist 总体积 ${totalKibibytes} KiB 超过项目预算 512 KiB。`,
    ]));
  });

  it('rejects upload files without measurable size metadata', () => {
    expect(collectReleaseFailures({
      ...validInput,
      builtFileSizes: validInput.builtFileSizes.slice(1),
    })).toContain('dist 缺少体积信息：app.js。');
  });

  it('rejects search indexing of account and generic web routes', () => {
    expect(collectReleaseFailures({
      ...validInput,
      sitemapConfig: {
        rules: [{ action: 'allow', page: '*' }],
      },
    })).toContain(
      'sitemap 只能收录计时和工具页，账号页与通用网页壳必须保持禁止收录。',
    );
  });

  it('rejects a valid sitemap that is detached from the published app config', () => {
    expect(collectReleaseFailures({
      ...validInput,
      appConfig: {
        ...validInput.appConfig,
        sitemapLocation: 'debug-sitemap.json',
      },
    })).toContain(
      'src/app.json 必须继续引用 sitemap.json，避免搜索收录边界与实际发布配置脱钩。',
    );
  });

  it('rejects page and tab bar drift inside the release audit itself', () => {
    const failures = collectReleaseFailures({
      ...validInput,
      appConfig: {
        ...validInput.appConfig,
        pages: [...EXPECTED_APP_PAGES, 'pages/debug/index'],
        tabBar: {
          ...validInput.appConfig.tabBar,
          list: [...EXPECTED_TAB_BAR].reverse(),
        },
      },
    });

    expect(failures).toEqual(expect.arrayContaining([
      `src/app.json 页面清单或顺序已漂移，应为：${EXPECTED_APP_PAGES.join('、')}。`,
      '底部导航必须保持“计时、工具、我的”三个正式入口及既定顺序。',
    ]));
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
    const builtFiles = [
      ...validInput.builtFiles,
      'pages/login/index.wxml',
      'pages/profile/index.wxml',
    ];
    const failures = collectReleaseFailures({
      ...validInput,
      builtFiles,
      builtFileSizes: sizesFor(builtFiles),
      sourceFiles: [
        { path: 'src/pages/device/index.ts', source: 'wx.openBluetoothAdapter({})' },
        { path: 'src/pages/login/index.wxml', source: '<button open-type="getPhoneNumber">登录</button>' },
        { path: 'src/pages/profile/index.wxml', source: '<button open-type="chooseAvatar">头像</button>' },
        { path: 'src/pages/import/index.ts', source: 'wx.chooseMessageFile({ count: 1 })' },
      ],
    });

    expect(failures).toEqual([
      'src/pages/profile/index.wxml 使用了微信用户资料能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。',
      'src/pages/import/index.ts 使用了文件、图片或媒体能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。',
      'src/pages/device/index.ts 使用了蓝牙能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。',
      'src/pages/login/index.wxml 使用了手机号能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。',
    ]);
  });

  it('blocks privacy declarations that are outside the current review boundary', () => {
    const failures = collectReleaseFailures({
      ...validInput,
      appConfig: {
        ...validInput.appConfig,
        requiredPrivateInfos: [],
        permission: {},
      },
    });

    expect(failures).toContain(
      '当前版本未批准原生隐私能力，src/app.json 不得声明：requiredPrivateInfos、permission。先完成代码、隐私政策和后台指引的联合复核。',
    );
  });

  it('enforces readable native tab bar colors', () => {
    expect(colorContrastRatio('#a94f31', '#fafafa')).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST_RATIO,
    );
    expect(colorContrastRatio('not-a-color', '#fafafa')).toBeNull();

    const failures = collectReleaseFailures({
      ...validInput,
      themeConfig: {
        ...validInput.themeConfig,
        light: {
          ...validInput.themeConfig.light,
          tabBarSelectedColor: '#c15f3c',
        },
      },
    });

    expect(failures).toContain(
      'theme.json 的 tabBar 文字对比度不得低于 4.5:1：light.tabBarSelectedColor/tabBarBackgroundColor（4.05:1）。',
    );
  });

  it('blocks incomplete native theme configuration', () => {
    const failures = collectReleaseFailures({
      ...validInput,
      appConfig: {
        ...validInput.appConfig,
        darkmode: false,
        tabBar: {
          ...validInput.appConfig.tabBar,
          selectedColor: '#c15f3c',
        },
      },
      themeConfig: {
        ...validInput.themeConfig,
        dark: {
          ...validInput.themeConfig.dark,
          navigationBarTextStyle: '',
        },
      },
    });

    expect(failures).toEqual(expect.arrayContaining([
      'src/app.json 必须开启 darkmode 并将 themeLocation 设为 theme.json。',
      '原生窗口和 tabBar 必须完整引用 theme.json 变量：tabBar.selectedColor。',
      'theme.json 必须完整定义浅色和深色原生主题：dark.navigationBarTextStyle。',
    ]));
  });

  it('blocks credentials from entering the upload package', () => {
    const failures = collectReleaseFailures({
      ...validInput,
      sourceFiles: [
        { path: 'src/config.ts', source: "const appSecret = 'do-not-upload';" },
        { path: 'src/key.pem', source: '-----BEGIN PRIVATE KEY-----' },
      ],
    });

    expect(failures).toEqual(expect.arrayContaining([
      'src/config.ts 包含小程序 AppSecret；小程序源码和上传包禁止保存服务端凭据。',
      'src/key.pem 包含私钥；小程序源码和上传包禁止保存服务端凭据。',
    ]));
  });

  it('audits the actual upload output for generated sensitive content', () => {
    const failures = collectReleaseFailures({
      ...validInput,
      uploadFiles: [
        { path: 'app.js', source: "const appSecret = 'generated-secret';" },
        { path: 'pages/timer/index.js', source: 'wx.openBluetoothAdapter({})' },
      ],
    });

    expect(failures).toEqual([
      'app.js 包含小程序 AppSecret；小程序源码和上传包禁止保存服务端凭据。',
      'pages/timer/index.js 使用了蓝牙能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。',
    ]);
  });

  it('ignores binary content placeholders while retaining their release metadata', () => {
    expect(collectReleaseFailures({
      ...validInput,
      uploadFiles: [{ path: 'assets/logo.png', source: null }],
    })).toEqual([]);
  });

  it('reports one finding when source and upload output contain the same sensitive content', () => {
    const failures = collectReleaseFailures({
      ...validInput,
      sourceFiles: [{ path: 'src/pages/device/index.ts', source: 'wx.openBluetoothAdapter({})' }],
      uploadFiles: [{ path: 'pages/device/index.js', source: 'wx.openBluetoothAdapter({})' }],
    });

    expect(failures).toEqual([
      'src/pages/device/index.ts、pages/device/index.js 使用了蓝牙能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。',
    ]);
  });
});
