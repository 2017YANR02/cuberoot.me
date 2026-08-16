import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import process from 'node:process';

const packageRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(packageRoot, 'src');

const sensitiveCapabilities = [
  ['微信用户资料', /\bwx\.getUserProfile\b/],
  ['定位', /\bwx\.(?:getLocation|chooseLocation|startLocationUpdate|startLocationUpdateBackground)\b/],
  ['图片或媒体', /\bwx\.(?:chooseImage|chooseMedia|saveImageToPhotosAlbum|saveVideoToPhotosAlbum)\b/],
  ['录音', /\bwx\.(?:startRecord|getRecorderManager)\b/],
  ['通讯录或地址', /\bwx\.(?:addPhoneContact|chooseAddress|chooseInvoiceTitle)\b/],
  ['蓝牙', /\bwx\.(?:openBluetoothAdapter|getBluetoothAdapterState|createBLEConnection|readBLECharacteristicValue|writeBLECharacteristicValue)\b/],
  ['手机号', /open-type\s*=\s*["']getPhoneNumber["']/],
];

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

const projectConfig = await readJson(join(packageRoot, 'project.config.json'));
const privateConfig = await readJson(join(packageRoot, 'project.private.config.json'), {});
const appConfig = await readJson(join(sourceRoot, 'app.json'));
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
  const confirmedStableVersion = process.env.WECHAT_MINI_LIB_VERSION?.trim() ?? '';
  if (!/^\d+\.\d+\.\d+$/.test(effectiveLibVersion)) {
    failures.push('基础库仍是 trial 或无效值，请在开发者工具中选择稳定版本。');
  }
  if (!/^\d+\.\d+\.\d+$/.test(confirmedStableVersion)) {
    failures.push('请在开发者工具确认稳定基础库后，用 WECHAT_MINI_LIB_VERSION 明确传入该版本。');
  } else if (effectiveLibVersion !== confirmedStableVersion) {
    failures.push(`开发者工具当前基础库 ${effectiveLibVersion || '未设置'} 与确认版本 ${confirmedStableVersion} 不一致。`);
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

for (const file of await walk(sourceRoot)) {
  if (!['.ts', '.wxml'].includes(extname(file))) continue;
  const source = await readFile(file, 'utf8');
  for (const [label, pattern] of sensitiveCapabilities) {
    if (!pattern.test(source)) continue;
    failures.push(
      `${relative(packageRoot, file)} 使用了${label}能力；先更新隐私政策、后台用户隐私保护指引和本检查器的复核边界。`,
    );
  }
}

if (failures.length > 0) {
  console.error('小程序上传前检查未通过：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('小程序自动上传前检查通过。');
  console.log('仍需人工确认：备案、基础信息审核、AppSecret 已轮换，以及 iOS/Android 真机回归。');
}
