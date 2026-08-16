import { BUILD_STATE_VERSION } from './build-state.mjs';

const sensitiveCapabilities = [
  ['微信用户资料', /\bwx\.getUserProfile\b/],
  ['定位', /\bwx\.(?:getLocation|chooseLocation|startLocationUpdate|startLocationUpdateBackground)\b/],
  ['图片或媒体', /\bwx\.(?:chooseImage|chooseMedia|saveImageToPhotosAlbum|saveVideoToPhotosAlbum)\b/],
  ['录音', /\bwx\.(?:startRecord|getRecorderManager)\b/],
  ['通讯录或地址', /\bwx\.(?:addPhoneContact|chooseAddress|chooseInvoiceTitle)\b/],
  ['蓝牙', /\bwx\.(?:openBluetoothAdapter|getBluetoothAdapterState|createBLEConnection|readBLECharacteristicValue|writeBLECharacteristicValue)\b/],
  ['手机号', /open-type\s*=\s*["']getPhoneNumber["']/],
];

const forbiddenCredentials = [
  [
    '小程序 AppSecret',
    /\b(?:WECHAT_MINI_APP_SECRET|APP_SECRET|appSecret|app_secret)\b\s*(?::|=)\s*["'`][^"'`\r\n]+["'`]/i,
  ],
  ['私钥', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];

const binaryFileExtensions = new Set([
  '.avif', '.bmp', '.br', '.eot', '.gif', '.gz', '.ico', '.jpeg', '.jpg', '.m4a',
  '.mov', '.mp3', '.mp4', '.ogg', '.otf', '.pdf', '.png', '.ttf', '.wasm', '.wav',
  '.webm', '.webp', '.woff', '.woff2', '.zip',
]);

const nativeThemeReferences = [
  ['window.backgroundColor', '@backgroundColor'],
  ['window.backgroundTextStyle', '@backgroundTextStyle'],
  ['window.navigationBarBackgroundColor', '@navigationBarBackgroundColor'],
  ['window.navigationBarTextStyle', '@navigationBarTextStyle'],
  ['tabBar.color', '@tabBarColor'],
  ['tabBar.selectedColor', '@tabBarSelectedColor'],
  ['tabBar.backgroundColor', '@tabBarBackgroundColor'],
  ['tabBar.borderStyle', '@tabBarBorderStyle'],
];

const nativeThemeKeys = [
  'backgroundColor',
  'backgroundTextStyle',
  'navigationBarBackgroundColor',
  'navigationBarTextStyle',
  'tabBarColor',
  'tabBarSelectedColor',
  'tabBarBackgroundColor',
  'tabBarBorderStyle',
];

export const PUBLIC_INDEXED_PAGES = [
  'pages/timer/index',
  'pages/tools/index',
];

export const EXPECTED_APP_PAGES = [
  'pages/timer/index',
  'pages/tools/index',
  'pages/account/index',
  'pages/web/index',
];

export const EXPECTED_TAB_BAR = [
  { pagePath: 'pages/timer/index', text: '计时' },
  { pagePath: 'pages/tools/index', text: '工具' },
  { pagePath: 'pages/account/index', text: '我的' },
];

export const PRODUCTION_APP_ID = 'wx1f92ba91b7e42015';
export const MAX_UPLOAD_PACKAGE_BYTES = 512 * 1024;
export const MAX_UPLOAD_FILE_BYTES = 128 * 1024;

export function isReleaseAuditTextFile(path) {
  const normalizedPath = String(path).replaceAll('\\', '/').toLowerCase();
  const filename = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1);
  const extensionStart = filename.lastIndexOf('.');
  const extension = extensionStart >= 0 ? filename.slice(extensionStart) : '';
  return !binaryFileExtensions.has(extension);
}

function formatKibibytes(bytes) {
  return `${Math.ceil(bytes / 1024)} KiB`;
}

function hasExpectedSitemapPolicy(sitemapConfig) {
  const expectedRules = [
    ...PUBLIC_INDEXED_PAGES.map((page) => ({ action: 'allow', page })),
    { action: 'disallow', page: '*' },
  ];
  return JSON.stringify(sitemapConfig?.rules) === JSON.stringify(expectedRules);
}

function valueAtPath(source, path) {
  return path.split('.').reduce((value, key) => value?.[key], source);
}

export function collectReleaseFailures({
  projectConfig,
  privateConfig = {},
  appConfig,
  themeConfig,
  sitemapConfig,
  confirmedStableVersion = '',
  confirmedSecretRotation = false,
  sourceFiles = [],
  uploadFiles = [],
  builtFiles = [],
  builtFileSizes = [],
  buildState = null,
  currentSourceFingerprint = '',
  currentOutputFingerprint = '',
}) {
  const failures = [];

  if (confirmedSecretRotation !== true) {
    failures.push(
      '已暴露的 AppSecret 尚未确认轮换；后台生成新密钥并更新服务端后，上传时设置 WECHAT_MINI_SECRET_ROTATED=1。',
    );
  }

  if (!hasExpectedSitemapPolicy(sitemapConfig)) {
    failures.push('sitemap 只能收录计时和工具页，账号页与通用网页壳必须保持禁止收录。');
  }

  if (appConfig?.sitemapLocation !== 'sitemap.json') {
    failures.push('src/app.json 必须继续引用 sitemap.json，避免搜索收录边界与实际发布配置脱钩。');
  }

  if (!projectConfig) {
    failures.push('缺少 project.config.json，请先运行构建。');
  } else {
    const appId = typeof projectConfig.appid === 'string' ? projectConfig.appid.trim() : '';
    if (!/^wx[0-9a-f]{16}$/i.test(appId)) {
      failures.push('AppID 不是正式小程序 AppID。');
    } else if (appId !== PRODUCTION_APP_ID) {
      failures.push(`AppID 与 CubeRoot 正式小程序不一致，当前为 ${appId}。`);
    }

    const effectiveLibVersion = typeof privateConfig?.libVersion === 'string'
      ? privateConfig.libVersion.trim()
      : String(projectConfig.libVersion ?? '').trim();
    const stableVersion = confirmedStableVersion.trim();
    if (!/^\d+\.\d+\.\d+$/.test(effectiveLibVersion)) {
      failures.push('基础库仍是 trial 或无效值，请在开发者工具中选择稳定版本。');
    }
    if (!/^\d+\.\d+\.\d+$/.test(stableVersion)) {
      failures.push('请在开发者工具确认稳定基础库后，用 WECHAT_MINI_LIB_VERSION 明确传入该版本。');
    } else if (effectiveLibVersion !== stableVersion) {
      failures.push(`开发者工具当前基础库 ${effectiveLibVersion || '未设置'} 与确认版本 ${stableVersion} 不一致。`);
    }

    const effectiveUrlCheck = privateConfig?.setting?.urlCheck ?? projectConfig.setting?.urlCheck;
    if (effectiveUrlCheck !== true) {
      failures.push('上传前必须开启合法域名校验。');
    }
    if (projectConfig.compileType !== 'miniprogram') {
      failures.push('compileType 必须保持为 miniprogram，避免上传成其他微信项目类型。');
    }
    if (projectConfig.miniprogramRoot !== 'dist/') {
      failures.push('miniprogramRoot 必须保持为 dist/。');
    }
  }

  if (!appConfig || !Array.isArray(appConfig.pages) || appConfig.pages.length === 0) {
    failures.push('src/app.json 没有有效页面声明。');
  } else {
    if (JSON.stringify(appConfig.pages) !== JSON.stringify(EXPECTED_APP_PAGES)) {
      failures.push(
        `src/app.json 页面清单或顺序已漂移，应为：${EXPECTED_APP_PAGES.join('、')}。`,
      );
    }

    const requiredFiles = new Set(['app.js', 'app.json', 'app.wxss', 'sitemap.json']);
    for (const page of appConfig.pages) {
      if (typeof page !== 'string' || page.length === 0) continue;
      for (const extension of ['js', 'json', 'wxml', 'wxss']) {
        requiredFiles.add(`${page}.${extension}`);
      }
    }
    for (const { path } of sourceFiles) {
      const normalizedPath = String(path).replaceAll('\\', '/');
      if (!normalizedPath.startsWith('src/') || normalizedPath.endsWith('.ts')) continue;
      requiredFiles.add(normalizedPath.slice('src/'.length));
    }

    const availableFiles = new Set(builtFiles.map((path) => String(path).replaceAll('\\', '/')));
    const missingFiles = [...requiredFiles].filter((path) => !availableFiles.has(path)).sort();
    if (missingFiles.length > 0) {
      failures.push(`dist 缺少构建产物：${missingFiles.join('、')}。`);
    }
  }

  if (JSON.stringify(appConfig?.tabBar?.list) !== JSON.stringify(EXPECTED_TAB_BAR)) {
    failures.push('底部导航必须保持“计时、工具、我的”三个正式入口及既定顺序。');
  }

  const sourceMaps = builtFiles
    .map((path) => String(path).replaceAll('\\', '/'))
    .filter((path) => path.endsWith('.map'))
    .sort();
  if (sourceMaps.length > 0) {
    failures.push(`正式上传包不能包含 source map：${sourceMaps.join('、')}。请重新运行非监听构建。`);
  }

  const sizeByPath = new Map(builtFileSizes.map(({ path, bytes }) => [
    String(path).replaceAll('\\', '/'),
    bytes,
  ]));
  const missingSizeMetadata = builtFiles
    .map((path) => String(path).replaceAll('\\', '/'))
    .filter((path) => !Number.isFinite(sizeByPath.get(path)) || sizeByPath.get(path) < 0)
    .sort();
  if (missingSizeMetadata.length > 0) {
    failures.push(`dist 缺少体积信息：${missingSizeMetadata.join('、')}。`);
  } else {
    const measuredFiles = builtFiles.map((path) => {
      const normalizedPath = String(path).replaceAll('\\', '/');
      return [normalizedPath, sizeByPath.get(normalizedPath)];
    });
    const oversizedFiles = measuredFiles
      .filter(([, bytes]) => bytes > MAX_UPLOAD_FILE_BYTES)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, bytes]) => `${path}（${formatKibibytes(bytes)}）`);
    if (oversizedFiles.length > 0) {
      failures.push(
        `dist 单文件超过项目预算 ${formatKibibytes(MAX_UPLOAD_FILE_BYTES)}：${oversizedFiles.join('、')}。`,
      );
    }

    const totalBytes = measuredFiles.reduce((sum, [, bytes]) => sum + bytes, 0);
    if (totalBytes > MAX_UPLOAD_PACKAGE_BYTES) {
      failures.push(
        `dist 总体积 ${formatKibibytes(totalBytes)} 超过项目预算 ${formatKibibytes(MAX_UPLOAD_PACKAGE_BYTES)}。`,
      );
    }
  }

  if (appConfig?.darkmode !== true || appConfig?.themeLocation !== 'theme.json') {
    failures.push('src/app.json 必须开启 darkmode 并将 themeLocation 设为 theme.json。');
  }

  const invalidThemeReferences = nativeThemeReferences
    .filter(([path, expected]) => valueAtPath(appConfig, path) !== expected)
    .map(([path]) => path);
  if (invalidThemeReferences.length > 0) {
    failures.push(`原生窗口和 tabBar 必须完整引用 theme.json 变量：${invalidThemeReferences.join('、')}。`);
  }

  const invalidThemeValues = ['light', 'dark'].flatMap((mode) => (
    nativeThemeKeys
      .filter((key) => typeof themeConfig?.[mode]?.[key] !== 'string' || themeConfig[mode][key].length === 0)
      .map((key) => `${mode}.${key}`)
  ));
  if (invalidThemeValues.length > 0) {
    failures.push(`theme.json 必须完整定义浅色和深色原生主题：${invalidThemeValues.join('、')}。`);
  }

  if (!buildState || buildState.version !== BUILD_STATE_VERSION) {
    failures.push('缺少有效的小程序构建状态，请重新运行 build。');
  } else {
    if (
      typeof buildState.sourceFingerprint !== 'string'
      || buildState.sourceFingerprint !== currentSourceFingerprint
    ) {
      failures.push('dist 不是由当前源码生成，请重新运行 build。');
    }
    if (
      typeof buildState.outputFingerprint !== 'string'
      || buildState.outputFingerprint !== currentOutputFingerprint
    ) {
      failures.push('dist 在构建后发生变化，请重新运行 build。');
    }
  }

  const auditedFiles = [...sourceFiles, ...uploadFiles];
  for (const [label, pattern] of forbiddenCredentials) {
    const paths = auditedFiles
      .filter(({ source }) => typeof source === 'string' && pattern.test(source))
      .map(({ path }) => path);
    if (paths.length === 0) continue;
    failures.push(`${paths.join('、')} 包含${label}；小程序源码和上传包禁止保存服务端凭据。`);
  }
  for (const [label, pattern] of sensitiveCapabilities) {
    const paths = auditedFiles
      .filter(({ source }) => typeof source === 'string' && pattern.test(source))
      .map(({ path }) => path);
    if (paths.length === 0) continue;
    failures.push(
      `${paths.join('、')} 使用了${label}能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。`,
    );
  }

  return failures;
}
