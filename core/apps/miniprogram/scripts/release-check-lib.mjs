import { BUILD_ASSETS } from './build-assets.mjs';
import { BUILD_STATE_VERSION } from './build-state.mjs';

function wxApiAccess(methods) {
  return new RegExp(
    `\\bwx\\s*(?:\\.\\s*(?:${methods})\\b|\\[\\s*["'](?:${methods})["']\\s*\\])`,
  );
}

function bundledApiAccess(methods) {
  return new RegExp(
    `(?:\\.\\s*(?:${methods})\\b|\\[\\s*["'](?:${methods})["']\\s*\\])`,
  );
}

function wxApiDestructure(methods) {
  return new RegExp(
    `\\b(?:const|let|var)\\s*\\{[^}]*\\b(?:${methods})\\b[^}]*\\}\\s*=\\s*wx\\b`,
  );
}

function bundledApiDestructure(methods) {
  return new RegExp(
    `\\b(?:const|let|var)\\s*\\{[^}]*\\b(?:${methods})\\b[^}]*\\}\\s*=`,
  );
}

function normalizeAuditPath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function sensitiveWxCapability(label, methods, markupPattern = null, allow = {}) {
  const sourceApiPattern = wxApiAccess(methods);
  const bundledApiPattern = bundledApiAccess(methods);
  const sourceCodePattern = new RegExp(
    `${sourceApiPattern.source}|${wxApiDestructure(methods).source}`,
  );
  const uploadCodePattern = new RegExp(
    `${bundledApiPattern.source}|${bundledApiDestructure(methods).source}`,
  );
  const allowedSourcePaths = new Set((allow.sourcePaths ?? []).map(normalizeAuditPath));
  const allowedUploadPaths = new Set((allow.uploadPaths ?? []).map(normalizeAuditPath));
  return {
    label,
    sourcePattern: markupPattern
      ? new RegExp(`${sourceCodePattern.source}|${markupPattern.source}`)
      : sourceCodePattern,
    uploadPattern: markupPattern
      ? new RegExp(`${uploadCodePattern.source}|${markupPattern.source}`)
      : uploadCodePattern,
    sourcePathAllowed: (path) => allowedSourcePaths.has(normalizeAuditPath(path)),
    uploadPathAllowed: (path) => allowedUploadPaths.has(normalizeAuditPath(path)),
  };
}

const sensitiveCapabilities = [
  sensitiveWxCapability(
    '微信用户资料',
    'getUserProfile|getUserInfo',
    /open-type\s*=\s*["'](?:chooseAvatar|getUserInfo)["']/,
  ),
  sensitiveWxCapability(
    '定位',
    'getLocation|getFuzzyLocation|chooseLocation|startLocationUpdate|startLocationUpdateBackground|onLocationChange',
  ),
  sensitiveWxCapability(
    '文件、图片或媒体',
    'chooseImage|chooseMedia|chooseVideo|chooseMessageFile|saveImageToPhotosAlbum|saveVideoToPhotosAlbum',
  ),
  sensitiveWxCapability('录音', 'startRecord|getRecorderManager'),
  sensitiveWxCapability(
    '通讯录、地址或发票',
    'addPhoneContact|chooseAddress|chooseInvoice|chooseInvoiceTitle',
  ),
  sensitiveWxCapability('运动数据', 'getWeRunData'),
  sensitiveWxCapability('剪贴板内容', 'getClipboardData'),
  {
    label: '相机或直播画面',
    sourcePattern: /<(?:camera|live-pusher)\b/,
    uploadPattern: /<(?:camera|live-pusher)\b/,
  },
  sensitiveWxCapability(
    '蓝牙',
    'openBluetoothAdapter|closeBluetoothAdapter|getBluetoothAdapterState|startBluetoothDevicesDiscovery|stopBluetoothDevicesDiscovery|onBluetoothDeviceFound|offBluetoothDeviceFound|createBLEConnection|closeBLEConnection|getBLEDeviceServices|getBLEDeviceCharacteristics|notifyBLECharacteristicValueChange|readBLECharacteristicValue|writeBLECharacteristicValue|onBLECharacteristicValueChange|offBLECharacteristicValueChange|onBLEConnectionStateChange|offBLEConnectionStateChange',
    null,
    {
      sourcePaths: [
        'src/lib/smart-cube/discover-driver.ts',
        'src/lib/smart-cube/gan-v4-ble.ts',
        'src/lib/smart-cube/giiker-ble.ts',
        'src/lib/smart-cube/gocube-ble.ts',
        'src/lib/smart-cube/moyu-ble.ts',
      ],
      uploadPaths: ['pages/smart-cube/index.js'],
    },
  ),
  {
    label: '手机号',
    sourcePattern: /open-type\s*=\s*["']getPhoneNumber["']/,
    uploadPattern: /open-type\s*=\s*["']getPhoneNumber["']/,
  },
];

const sensitiveManifestKeys = ['requiredPrivateInfos', 'permission'];

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
  'pages/smart-cube/index',
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
export const MIN_TEXT_CONTRAST_RATIO = 4.5;

export const REQUIRED_RELEASE_CONFIRMATIONS = [
  {
    key: 'socketDomainConfigured',
    env: 'WECHAT_MINI_SOCKET_DOMAIN_CONFIGURED',
    failure: '小程序后台尚未确认配置 socket 合法域名 wss://api.cuberoot.me；配置生效后，上传时设置 WECHAT_MINI_SOCKET_DOMAIN_CONFIGURED=1。',
  },
  {
    key: 'basicInfoApproved',
    env: 'WECHAT_MINI_BASIC_INFO_APPROVED',
    failure: '小程序基础信息审核尚未确认通过；后台显示通过后，上传时设置 WECHAT_MINI_BASIC_INFO_APPROVED=1。',
  },
  {
    key: 'filingCompleted',
    env: 'WECHAT_MINI_FILING_COMPLETED',
    failure: '小程序备案尚未确认完成；备案状态完成后，上传时设置 WECHAT_MINI_FILING_COMPLETED=1。',
  },
  {
    key: 'privacyReviewed',
    env: 'WECHAT_MINI_PRIVACY_REVIEWED',
    failure: '后台用户隐私保护指引尚未确认与实际能力一致；复核并提交后，上传时设置 WECHAT_MINI_PRIVACY_REVIEWED=1。',
  },
  {
    key: 'iosRealDeviceTested',
    env: 'WECHAT_MINI_IOS_REAL_DEVICE_TESTED',
    failure: '本次候选版本尚未确认完成 iOS 真机回归；回归通过后，上传时设置 WECHAT_MINI_IOS_REAL_DEVICE_TESTED=1。',
  },
  {
    key: 'androidRealDeviceTested',
    env: 'WECHAT_MINI_ANDROID_REAL_DEVICE_TESTED',
    failure: '本次候选版本尚未确认完成 Android 真机回归；回归通过后，上传时设置 WECHAT_MINI_ANDROID_REAL_DEVICE_TESTED=1。',
  },
  {
    key: 'gan16UiTested',
    env: 'WECHAT_MINI_GAN16UI_TESTED',
    failure: 'GAN 16 ui 尚未完成 Android 真机连接、转动同步、电量和断线重连回归；通过后，上传时设置 WECHAT_MINI_GAN16UI_TESTED=1。',
  },
  {
    key: 'goCubeTested',
    env: 'WECHAT_MINI_GOCUBE_TESTED',
    failure: 'GoCube 尚未完成真机连接、转动同步、电量和断线重连回归；通过后，上传时设置 WECHAT_MINI_GOCUBE_TESTED=1。',
  },
  {
    key: 'giikerTested',
    env: 'WECHAT_MINI_GIIKER_TESTED',
    failure: 'Giiker 与米家智能魔方尚未完成真机连接、转动同步、电量和断线重连回归；通过后，上传时设置 WECHAT_MINI_GIIKER_TESTED=1。',
  },
  {
    key: 'moyuTested',
    env: 'WECHAT_MINI_MOYU_TESTED',
    failure: 'MoYu AI（MHC 旧协议）尚未完成真机连接、转动同步和断线重连回归；通过后，上传时设置 WECHAT_MINI_MOYU_TESTED=1。',
  },
];

export function releaseConfirmationsFromEnv(environment) {
  return Object.fromEntries(REQUIRED_RELEASE_CONFIRMATIONS.map(({ key, env }) => [
    key,
    environment?.[env] === '1',
  ]));
}

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

function relativeLuminance(hexColor) {
  if (typeof hexColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(hexColor)) return null;
  const channels = hexColor.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255);
  const linearChannels = channels.map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * linearChannels[0]) + (0.7152 * linearChannels[1]) + (0.0722 * linearChannels[2]);
}

export function colorContrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  if (foregroundLuminance === null || backgroundLuminance === null) return null;
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function collectReleaseFailures({
  projectConfig,
  privateConfig = {},
  appConfig,
  themeConfig,
  sitemapConfig,
  confirmedStableVersion = '',
  releaseConfirmations = {},
  sourceFiles = [],
  uploadFiles = [],
  builtFiles = [],
  builtFileSizes = [],
  buildState = null,
  currentSourceFingerprint = '',
  currentOutputFingerprint = '',
}) {
  const failures = [];

  for (const confirmation of REQUIRED_RELEASE_CONFIRMATIONS) {
    if (releaseConfirmations[confirmation.key] !== true) {
      failures.push(confirmation.failure);
    }
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
    const disabledCompression = [
      ['minified', 'JavaScript'],
      ['minifyWXML', 'WXML'],
      ['minifyWXSS', 'WXSS'],
    ].filter(([key]) => (
      (privateConfig?.setting?.[key] ?? projectConfig.setting?.[key]) !== true
    )).map(([, label]) => label);
    if (disabledCompression.length > 0) {
      failures.push(`上传前必须开启代码压缩：${disabledCompression.join('、')}。`);
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

    const requiredFiles = new Set([
      'app.js',
      'app.json',
      'app.wxss',
      'sitemap.json',
      ...BUILD_ASSETS.map(({ output }) => output),
    ]);
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

  const sensitiveManifestDeclarations = sensitiveManifestKeys
    .filter((key) => Object.hasOwn(appConfig ?? {}, key));
  if (sensitiveManifestDeclarations.length > 0) {
    failures.push(
      `当前版本未批准原生隐私能力，src/app.json 不得声明：${sensitiveManifestDeclarations.join('、')}。先完成代码、隐私政策和后台指引的联合复核。`,
    );
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

  if (appConfig?.lazyCodeLoading !== 'requiredComponents') {
    failures.push('src/app.json 必须将 lazyCodeLoading 设为 requiredComponents。');
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

  const invalidThemeContrasts = ['light', 'dark'].flatMap((mode) => (
    [
      ['tabBarColor', 'tabBarBackgroundColor'],
      ['tabBarSelectedColor', 'tabBarBackgroundColor'],
    ].flatMap(([foregroundKey, backgroundKey]) => {
      const ratio = colorContrastRatio(
        themeConfig?.[mode]?.[foregroundKey],
        themeConfig?.[mode]?.[backgroundKey],
      );
      if (ratio !== null && ratio >= MIN_TEXT_CONTRAST_RATIO) return [];
      const result = ratio === null ? '颜色格式无效' : `${ratio.toFixed(2)}:1`;
      return [`${mode}.${foregroundKey}/${backgroundKey}（${result}）`];
    })
  ));
  if (invalidThemeContrasts.length > 0) {
    failures.push(
      `theme.json 的 tabBar 文字对比度不得低于 ${MIN_TEXT_CONTRAST_RATIO}:1：${invalidThemeContrasts.join('、')}。`,
    );
  }

  if (
    !buildState
    || buildState.version !== BUILD_STATE_VERSION
    || !Array.isArray(buildState.buildGraphInputs)
    || buildState.buildGraphInputs.length === 0
  ) {
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
  for (const {
    label,
    sourcePattern,
    uploadPattern,
    sourcePathAllowed = () => false,
    uploadPathAllowed = () => false,
  } of sensitiveCapabilities) {
    const paths = [
      ...sourceFiles
        .filter(({ path, source }) => (
          typeof source === 'string'
          && sourcePattern.test(source)
          && !sourcePathAllowed(path)
        ))
        .map(({ path }) => path),
      ...uploadFiles
        .filter(({ path, source }) => (
          typeof source === 'string'
          && uploadPattern.test(source)
          && !uploadPathAllowed(path)
        ))
        .map(({ path }) => path),
    ];
    if (paths.length === 0) continue;
    failures.push(
      `${paths.join('、')} 使用了${label}能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。`,
    );
  }

  return failures;
}
