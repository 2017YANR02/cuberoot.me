const sensitiveCapabilities = [
  ['微信用户资料', /\bwx\.getUserProfile\b/],
  ['定位', /\bwx\.(?:getLocation|chooseLocation|startLocationUpdate|startLocationUpdateBackground)\b/],
  ['图片或媒体', /\bwx\.(?:chooseImage|chooseMedia|saveImageToPhotosAlbum|saveVideoToPhotosAlbum)\b/],
  ['录音', /\bwx\.(?:startRecord|getRecorderManager)\b/],
  ['通讯录或地址', /\bwx\.(?:addPhoneContact|chooseAddress|chooseInvoiceTitle)\b/],
  ['蓝牙', /\bwx\.(?:openBluetoothAdapter|getBluetoothAdapterState|createBLEConnection|readBLECharacteristicValue|writeBLECharacteristicValue)\b/],
  ['手机号', /open-type\s*=\s*["']getPhoneNumber["']/],
];

export function collectReleaseFailures({
  projectConfig,
  privateConfig = {},
  appConfig,
  confirmedStableVersion = '',
  sourceFiles = [],
}) {
  const failures = [];

  if (!projectConfig) {
    failures.push('缺少 project.config.json，请先运行构建。');
  } else {
    const appId = typeof projectConfig.appid === 'string' ? projectConfig.appid.trim() : '';
    if (!/^wx[0-9a-f]{16}$/i.test(appId)) {
      failures.push('AppID 不是正式小程序 AppID。');
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
    if (projectConfig.miniprogramRoot !== 'dist/') {
      failures.push('miniprogramRoot 必须保持为 dist/。');
    }
  }

  if (!appConfig || !Array.isArray(appConfig.pages) || appConfig.pages.length === 0) {
    failures.push('src/app.json 没有有效页面声明。');
  }

  for (const { path, source } of sourceFiles) {
    for (const [label, pattern] of sensitiveCapabilities) {
      if (!pattern.test(source)) continue;
      failures.push(
        `${path} 使用了${label}能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。`,
      );
    }
  }

  return failures;
}
