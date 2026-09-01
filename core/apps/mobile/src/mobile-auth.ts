import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { InstalledAuthClient } from '@cuberoot/app-ui';

import { nativeMobileSecureStorage } from './native/secure-storage';

export const nativeMobileAuth = new InstalledAuthClient({
  storage: nativeMobileSecureStorage,
  fetcher: fetch,
  now: () => Date.now(),
  randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  },
  async digestSha256(value) {
    const buffer = new ArrayBuffer(value.byteLength);
    new Uint8Array(buffer).set(value);
    return new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  },
  async getAppId() {
    if (!Capacitor.isNativePlatform()) throw new Error('native login unavailable');
    return (await CapacitorApp.getInfo()).id;
  },
  async openBrowser(url) {
    await Browser.open({ url });
  },
  async closeBrowser() {
    await Browser.close();
  },
});
