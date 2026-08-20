/**
 * Synchronous client and Web Bluetooth environment detection.
 *
 * User-agent parsing explains the environment and identifies iOS/iPadOS, where
 * Bluefy is required. Everywhere else, `navigator.bluetooth` is the capability
 * check, so a browser that genuinely implements the API is not rejected by a
 * stale name allowlist. The connection path still checks the adapter,
 * permission, picker and GATT after the user clicks connect.
 */

export type ClientOS =
  | 'android'
  | 'ios'
  | 'harmony'
  | 'chromeos'
  | 'windows'
  | 'macos'
  | 'linux'
  | 'unknown';

export type ClientBrowser =
  | 'bluefy'
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'safari'
  | 'opera'
  | 'samsung'
  | 'huawei'
  | 'miui'
  | 'uc'
  | 'quark'
  | 'wechat'
  | 'qq'
  | 'alipay'
  | 'douyin'
  | 'weibo'
  | 'arkweb'
  | 'webview'
  | 'unknown';

export interface ClientNavigatorSnapshot {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  hasBluetooth: boolean;
}

export interface ClientEnvironment {
  os: ClientOS;
  browser: ClientBrowser;
  hasWebBluetooth: boolean;
}

export type BluetoothEnv =
  | 'available'
  | 'available-bluefy'
  | 'bluefy-unavailable'
  | 'ios-no-bluefy'
  | 'android-browser-unavailable'
  | 'harmony-unavailable'
  | 'safari-mac'
  | 'firefox'
  | 'no-bluetooth-hw'
  | 'unknown';

interface TranslatedText {
  en: string;
  zh: string;
}

export interface EnvAdvice {
  /** Short user-facing reason why Bluetooth isn't usable. */
  title: TranslatedText;
  /** Detailed advice. */
  body: TranslatedText;
  /** Optional URL to install or configure the recommended browser. */
  url?: string;
  /** Label for the URL button. */
  urlLabel?: TranslatedText;
}

const BLUEFY_APP_URL = 'https://apps.apple.com/app/bluefy/id1492822055';

function navigatorSnapshot(): ClientNavigatorSnapshot | null {
  if (typeof navigator === 'undefined') return null;
  return {
    userAgent: navigator.userAgent ?? '',
    platform: navigator.platform ?? '',
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    hasBluetooth: Boolean(navigator.bluetooth),
  };
}

/** Detect the device OS and browser without requesting any permission. */
export function detectClientEnvironment(
  snapshot: ClientNavigatorSnapshot | null = navigatorSnapshot(),
): ClientEnvironment {
  if (!snapshot) return { os: 'unknown', browser: 'unknown', hasWebBluetooth: false };

  const ua = snapshot.userAgent;
  const isIPadDesktopUA = snapshot.platform === 'MacIntel' && snapshot.maxTouchPoints > 1;

  let os: ClientOS = 'unknown';
  if (/OpenHarmony|HarmonyOS|HongMeng|ArkWeb/i.test(ua)) os = 'harmony';
  else if (/iPad|iPhone|iPod/i.test(ua) || isIPadDesktopUA) os = 'ios';
  else if (/Android/i.test(ua)) os = 'android';
  else if (/CrOS/i.test(ua)) os = 'chromeos';
  else if (/Windows/i.test(ua)) os = 'windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macos';
  else if (/Linux/i.test(ua)) os = 'linux';

  let browser: ClientBrowser = 'unknown';
  if (/Bluefy/i.test(ua)) browser = 'bluefy';
  else if (/MicroMessenger/i.test(ua)) browser = 'wechat';
  else if (/MQQBrowser|QQBrowser|\bQQ\//i.test(ua)) browser = 'qq';
  else if (/AlipayClient/i.test(ua)) browser = 'alipay';
  else if (/Aweme|ToutiaoMicroApp|NewsArticle/i.test(ua)) browser = 'douyin';
  else if (/Weibo/i.test(ua)) browser = 'weibo';
  else if (/SamsungBrowser/i.test(ua)) browser = 'samsung';
  else if (/HuaweiBrowser/i.test(ua)) browser = 'huawei';
  else if (/MiuiBrowser|XiaoMi/i.test(ua)) browser = 'miui';
  else if (/UCBrowser|UCWEB/i.test(ua)) browser = 'uc';
  else if (/Quark/i.test(ua)) browser = 'quark';
  else if (/ArkWeb/i.test(ua)) browser = 'arkweb';
  else if (/;\s*wv\)|\bVersion\/4\.0\b.*\bChrome\//i.test(ua)) browser = 'webview';
  else if (/EdgiOS|EdgA|Edg\//i.test(ua)) browser = 'edge';
  else if (/OPiOS|OPR\/|Opera/i.test(ua)) browser = 'opera';
  else if (/FxiOS|Firefox/i.test(ua)) browser = 'firefox';
  else if (/CriOS|Chrome\/|Chromium/i.test(ua)) browser = 'chrome';
  else if (/Safari/i.test(ua)) browser = 'safari';

  return { os, browser, hasWebBluetooth: snapshot.hasBluetooth };
}

const OS_LABELS: Record<ClientOS, TranslatedText> = {
  android: { en: 'Android', zh: 'Android' },
  ios: { en: 'iOS / iPadOS', zh: 'iOS / iPadOS' },
  harmony: { en: 'HarmonyOS / OpenHarmony', zh: '鸿蒙 / OpenHarmony' },
  chromeos: { en: 'ChromeOS', zh: 'ChromeOS' },
  windows: { en: 'Windows', zh: 'Windows' },
  macos: { en: 'macOS', zh: 'macOS' },
  linux: { en: 'Linux', zh: 'Linux' },
  unknown: { en: 'Unknown OS', zh: '未知系统' },
};

const BROWSER_LABELS: Record<ClientBrowser, TranslatedText> = {
  bluefy: { en: 'Bluefy', zh: 'Bluefy' },
  chrome: { en: 'Chrome', zh: 'Chrome' },
  edge: { en: 'Edge', zh: 'Edge' },
  firefox: { en: 'Firefox', zh: 'Firefox' },
  safari: { en: 'Safari', zh: 'Safari' },
  opera: { en: 'Opera', zh: 'Opera' },
  samsung: { en: 'Samsung Internet', zh: 'Samsung Internet' },
  huawei: { en: 'Huawei Browser', zh: '华为浏览器' },
  miui: { en: 'Mi Browser', zh: '小米浏览器' },
  uc: { en: 'UC Browser', zh: 'UC 浏览器' },
  quark: { en: 'Quark', zh: '夸克浏览器' },
  wechat: { en: 'WeChat', zh: '微信内置浏览器' },
  qq: { en: 'QQ Browser', zh: 'QQ 浏览器' },
  alipay: { en: 'Alipay', zh: '支付宝内置浏览器' },
  douyin: { en: 'Douyin', zh: '抖音内置浏览器' },
  weibo: { en: 'Weibo', zh: '微博内置浏览器' },
  arkweb: { en: 'ArkWeb', zh: 'ArkWeb' },
  webview: { en: 'In-app WebView', zh: 'App 内置浏览器' },
  unknown: { en: 'Unknown browser', zh: '未知浏览器' },
};

/** A bilingual, compact `OS, browser` label for the modal. */
export function clientEnvironmentLabel(client: ClientEnvironment): TranslatedText {
  return {
    en: `${OS_LABELS[client.os].en}, ${BROWSER_LABELS[client.browser].en}`,
    zh: `${OS_LABELS[client.os].zh}，${BROWSER_LABELS[client.browser].zh}`,
  };
}

/** True when the current page is hosted inside the Bluefy iOS browser. */
export function isBluefy(): boolean {
  return detectClientEnvironment().browser === 'bluefy';
}

export function detectBluetoothEnv(
  snapshot: ClientNavigatorSnapshot | null = navigatorSnapshot(),
): BluetoothEnv {
  const client = detectClientEnvironment(snapshot);

  // iOS browser names do not imply capability: Bluefy is the supported native
  // bridge. Elsewhere the exposed API wins over a browser-name allowlist.
  if (client.os === 'ios') {
    if (client.browser !== 'bluefy') return 'ios-no-bluefy';
    return client.hasWebBluetooth ? 'available-bluefy' : 'bluefy-unavailable';
  }
  if (client.hasWebBluetooth) return 'available';
  if (client.os === 'android') return 'android-browser-unavailable';
  if (client.os === 'harmony') return 'harmony-unavailable';

  if (client.os === 'macos' && client.browser === 'safari') return 'safari-mac';
  if (client.browser === 'firefox') return 'firefox';
  return 'unknown';
}

export function envAdvice(env: BluetoothEnv): EnvAdvice | null {
  switch (env) {
    case 'available':
    case 'available-bluefy':
      return null;
    case 'bluefy-unavailable':
      return {
        title: {
          en: 'Bluefy Bluetooth is not ready',
          zh: 'Bluefy 蓝牙接口未就绪',
        },
        body: {
          en: 'Bluefy was detected, but it did not expose Web Bluetooth. Allow Bluetooth access for Bluefy in iOS Settings, update the app, then fully close and reopen it.',
          zh: '已检测到 Bluefy，但它没有向页面提供 Web Bluetooth。请在 iOS 设置中允许 Bluefy 使用蓝牙，更新 App，然后彻底关闭并重新打开。',
        },
      };
    case 'ios-no-bluefy':
      return {
        title: {
          en: 'iOS needs Bluefy',
          zh: 'iOS 需要 Bluefy 浏览器',
        },
        body: {
          en: 'Safari, Chrome, Edge, and other regular iOS browsers cannot expose Web Bluetooth. Install Bluefy from the App Store, then open this page inside Bluefy.',
          zh: 'Safari、Chrome、Edge 等常规 iOS 浏览器无法提供 Web Bluetooth。请从 App Store 安装 Bluefy，然后在 Bluefy 里打开本页面。',
        },
        url: BLUEFY_APP_URL,
        urlLabel: { en: 'Install Bluefy', zh: '安装 Bluefy' },
      };
    case 'android-browser-unavailable':
      return {
        title: {
          en: 'This Android browser has no Web Bluetooth',
          zh: '当前 Android 浏览器无法连接智能魔方',
        },
        body: {
          en: 'This browser did not expose the Web Bluetooth API. Open this HTTPS page in the latest standalone Chrome app. Other Android browsers can continue directly whenever they genuinely provide Web Bluetooth.',
          zh: '当前浏览器没有提供 Web Bluetooth。请优先在最新版独立 Chrome App 中打开这个 HTTPS 页面；其他 Android 浏览器只要真实提供 Web Bluetooth，也可以直接使用。',
        },
      };
    case 'harmony-unavailable':
      return {
        title: {
          en: 'This HarmonyOS browser cannot connect to the cube',
          zh: '当前鸿蒙浏览器无法连接智能魔方',
        },
        body: {
          en: 'This HarmonyOS / ArkWeb environment did not provide Web Bluetooth. If the device can run Android Chrome, open this page there. On a pure HarmonyOS device, use Chrome or Edge on a computer, or Bluefy on iOS.',
          zh: '当前鸿蒙 / ArkWeb 环境没有提供 Web Bluetooth。若设备可运行 Android 版 Chrome，请改用 Chrome 打开；纯鸿蒙设备请改用电脑上的 Chrome / Edge，或 iOS 上的 Bluefy。',
        },
      };
    case 'safari-mac':
      return {
        title: {
          en: 'Safari has no Web Bluetooth',
          zh: 'Safari 不支持 Web Bluetooth',
        },
        body: {
          en: 'macOS Safari does not implement Web Bluetooth. Use Chrome, Edge, or Opera on macOS instead.',
          zh: 'macOS Safari 不支持 Web Bluetooth。请改用 Chrome、Edge 或 Opera。',
        },
      };
    case 'firefox':
      return {
        title: { en: 'Firefox has no Web Bluetooth', zh: 'Firefox 不支持 Web Bluetooth' },
        body: {
          en: 'Stable Firefox does not provide the Web Bluetooth API required here. Use Chrome, Edge, or Opera on a computer, Chrome on Android, or Bluefy on iOS.',
          zh: 'Firefox 稳定版没有提供本站所需的 Web Bluetooth。请改用电脑上的 Chrome、Edge 或 Opera，Android 上的 Chrome，或 iOS 上的 Bluefy。',
        },
      };
    case 'no-bluetooth-hw':
      return {
        title: { en: 'No Bluetooth hardware', zh: '本机无蓝牙' },
        body: {
          en: 'This device does not have a Bluetooth adapter, or it is disabled in the OS.',
          zh: '当前设备未检测到蓝牙适配器，或系统已关闭蓝牙。',
        },
      };
    case 'unknown':
    default:
      return {
        title: { en: 'Web Bluetooth unavailable', zh: '当前浏览器不支持 Web Bluetooth' },
        body: {
          en: 'Open this page in Chrome or Edge on a computer, Chrome on Android, or Bluefy on iOS. In-app browsers usually do not expose Bluetooth to web pages.',
          zh: '请在电脑上用 Chrome / Edge、Android 上用 Chrome，或在 iOS 上用 Bluefy 打开本页。App 内置浏览器通常不会向网页提供蓝牙。',
        },
      };
  }
}
