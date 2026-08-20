import { describe, expect, it } from 'vitest';
import {
  clientEnvironmentLabel,
  detectBluetoothEnv,
  detectClientEnvironment,
  envAdvice,
  type ClientNavigatorSnapshot,
} from '@/app/[lang]/timer/_lib/bluetooth/env';

function snapshot(
  userAgent: string,
  hasBluetooth = false,
  overrides: Partial<ClientNavigatorSnapshot> = {},
): ClientNavigatorSnapshot {
  return {
    userAgent,
    platform: '',
    maxTouchPoints: 0,
    hasBluetooth,
    ...overrides,
  };
}

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/132.0.0.0 Mobile Safari/537.36';

describe('Bluetooth client environment detection', () => {
  it('allows any Android browser that really exposes Web Bluetooth', () => {
    const edge = snapshot(
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/132.0.0.0 Mobile Safari/537.36 EdgA/132.0.0.0',
      true,
    );
    expect(detectClientEnvironment(edge)).toMatchObject({ os: 'android', browser: 'edge' });
    expect(detectBluetoothEnv(edge)).toBe('available');
  });

  it('recommends standalone Chrome when the current Android browser has no API', () => {
    const samsung = snapshot(
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/121.0 Mobile Safari/537.36 SamsungBrowser/25.0',
    );
    const client = detectClientEnvironment(samsung);
    expect(client).toMatchObject({ os: 'android', browser: 'samsung', hasWebBluetooth: false });
    expect(detectBluetoothEnv(samsung)).toBe('android-browser-unavailable');
    expect(envAdvice(detectBluetoothEnv(samsung))?.title.en).toContain('Android browser');
  });

  it('does not mistake an Android in-app WebView for standalone Chrome', () => {
    const webview = snapshot(
      'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
    );
    expect(detectClientEnvironment(webview).browser).toBe('webview');
    expect(detectBluetoothEnv(webview)).toBe('android-browser-unavailable');
  });

  it('allows Android Chrome when the capability is present and explains when it is not', () => {
    expect(detectBluetoothEnv(snapshot(ANDROID_CHROME, true))).toBe('available');
    expect(detectBluetoothEnv(snapshot(ANDROID_CHROME))).toBe('android-browser-unavailable');
  });

  it('routes regular iOS browsers to Bluefy', () => {
    const safari = snapshot(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 Version/18.2 Mobile/15E148 Safari/604.1',
    );
    expect(detectClientEnvironment(safari)).toMatchObject({ os: 'ios', browser: 'safari' });
    expect(detectBluetoothEnv(safari)).toBe('ios-no-bluefy');
    expect(envAdvice('ios-no-bluefy')?.url).toContain('apps.apple.com');
  });

  it('recognizes iPadOS desktop UA and Bluefy readiness separately', () => {
    const ipadSafari = snapshot(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      false,
      { platform: 'MacIntel', maxTouchPoints: 5 },
    );
    expect(detectClientEnvironment(ipadSafari).os).toBe('ios');
    expect(detectBluetoothEnv(ipadSafari)).toBe('ios-no-bluefy');

    const bluefy = snapshot(`${ipadSafari.userAgent} Bluefy/3.4`, true, {
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    expect(detectBluetoothEnv(bluefy)).toBe('available-bluefy');
    expect(detectBluetoothEnv({ ...bluefy, hasBluetooth: false })).toBe('bluefy-unavailable');
  });

  it('recognizes the official OpenHarmony ArkWeb UA and remains capability-first', () => {
    const harmony = snapshot(
      'Mozilla/5.0 (Phone;OpenHarmony 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 ArkWeb/6.0.0.42 Mobile',
    );
    const client = detectClientEnvironment(harmony);
    expect(client).toMatchObject({ os: 'harmony', browser: 'arkweb' });
    expect(clientEnvironmentLabel(client).zh).toContain('鸿蒙');
    expect(detectBluetoothEnv(harmony)).toBe('harmony-unavailable');
    expect(detectBluetoothEnv({ ...harmony, hasBluetooth: true })).toBe('available');
  });

  it('gives specific desktop advice without blocking a browser that exposes the API', () => {
    const safari = snapshot(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
    );
    expect(detectBluetoothEnv(safari)).toBe('safari-mac');

    const firefox = snapshot('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0');
    expect(detectBluetoothEnv(firefox)).toBe('firefox');
    expect(detectBluetoothEnv({ ...firefox, hasBluetooth: true })).toBe('available');
  });
});
