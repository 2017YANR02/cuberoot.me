/**
 * Environment detection for Web Bluetooth availability.
 *
 * Web Bluetooth coverage as of 2026:
 *   - ✅ Chrome / Edge / Opera (desktop & Android)
 *   - ✅ Bluefy on iOS / iPadOS (third-party browser, App Store)
 *   - ❌ Safari (any platform)
 *   - ❌ Firefox (no flag in stable release)
 *   - ❌ iOS Chrome / Edge (forced to use WebKit, no Web Bluetooth)
 *
 * On iOS, the user MUST use Bluefy (https://apps.apple.com/app/bluefy/id1492822055).
 */

export type BluetoothEnv =
  | 'available'           // navigator.bluetooth works (generic Chromium / Android)
  | 'available-bluefy'    // navigator.bluetooth works AND we're in Bluefy on iOS
  | 'ios-no-bluefy'       // iOS device, Safari / iOS Chrome — recommend Bluefy
  | 'safari-mac'          // macOS Safari — no Web Bluetooth at all
  | 'firefox'             // Firefox — needs a flag, not on by default
  | 'no-bluetooth-hw'     // device has no BLE adapter (rare to detect cleanly)
  | 'unknown';            // catch-all

/** True when the current page is hosted inside the Bluefy iOS browser. */
export function isBluefy(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Bluefy/i.test(navigator.userAgent ?? '');
}

const BLUEFY_APP_URL = 'https://apps.apple.com/app/bluefy/id1492822055';

export function detectBluetoothEnv(): BluetoothEnv {
  if (typeof navigator === 'undefined') return 'unknown';
  if (navigator.bluetooth) return isBluefy() ? 'available-bluefy' : 'available';

  const ua = navigator.userAgent ?? '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    // iPad on iOS 13+ reports as Mac with touch support.
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1);
  if (isIOS) return 'ios-no-bluefy';

  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) {
    return 'safari-mac';
  }
  if (/Firefox/.test(ua)) return 'firefox';
  return 'unknown';
}

export interface EnvAdvice {
  /** Short user-facing reason why bluetooth isn't usable. */
  title: { en: string; zh: string };
  /** Detailed advice. */
  body: { en: string; zh: string };
  /** Optional URL to install / configure the recommended browser. */
  url?: string;
  /** Label for the URL button. */
  urlLabel?: { en: string; zh: string };
}

export function envAdvice(env: BluetoothEnv): EnvAdvice | null {
  switch (env) {
    case 'available':
    case 'available-bluefy':
      return null;
    case 'ios-no-bluefy':
      return {
        title: {
          en: 'iOS needs Bluefy',
          zh: 'iOS 需要 Bluefy 浏览器'
        },
        body: {
          en: 'Apple does not allow Safari (or any other iOS browser) to access Bluetooth. Install Bluefy from the App Store, then open this page inside Bluefy.',
          zh: '苹果不允许 Safari（以及任何 iOS 浏览器）访问蓝牙。请从 App Store 安装 Bluefy 浏览器，然后在 Bluefy 里打开本页面。'
        },
        url: BLUEFY_APP_URL,
        urlLabel: { en: 'Install Bluefy', zh: '安装 Bluefy'
        },
      };
    case 'safari-mac':
      return {
        title: {
          en: 'Safari has no Web Bluetooth',
          zh: 'Safari 不支持 Web Bluetooth'
        },
        body: {
          en: 'macOS Safari does not implement Web Bluetooth. Use Chrome, Edge, or Opera on macOS instead.',
          zh: 'macOS Safari 不支持 Web Bluetooth。请改用 Chrome / Edge / Opera。'
        },
      };
    case 'firefox':
      return {
        title: { en: 'Firefox needs a flag', zh: 'Firefox 需要开启实验功能'
        },
        body: {
          en: 'Firefox hides Web Bluetooth behind dom.webbluetooth.enabled in about:config, and stable Firefox does not ship the API even with the flag. Use Chrome / Edge / Opera, or Bluefy on iOS.',
          zh: 'Firefox 把 Web Bluetooth 放在 about:config 里 dom.webbluetooth.enabled 后面，且稳定版即使开启也不可用。请改用 Chrome / Edge / Opera，或在 iOS 用 Bluefy。'
        },
      };
    case 'no-bluetooth-hw':
      return {
        title: { en: 'No Bluetooth hardware', zh: '本机无蓝牙'
        },
        body: {
          en: 'This device does not have a Bluetooth adapter, or it is disabled in the OS.',
          zh: '当前设备未检测到蓝牙适配器，或系统已关闭蓝牙。'
        },
      };
    case 'unknown':
    default:
      return {
        title: { en: 'Web Bluetooth unavailable', zh: '当前浏览器不支持 Web Bluetooth'
        },
        body: {
          en: 'Use Chrome / Edge / Opera on desktop or Android, or Bluefy on iOS.',
          zh: '请改用桌面或 Android 上的 Chrome / Edge / Opera，或 iOS 上的 Bluefy 浏览器。'
        },
        url: BLUEFY_APP_URL,
        urlLabel: { en: 'Install Bluefy (iOS)', zh: '安装 Bluefy（iOS）'
        },
      };
  }
}
