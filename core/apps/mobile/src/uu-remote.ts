import { App } from '@capacitor/app';
import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';
import { UURemoteClient } from '@cuberoot/app-ui';
import { nativeMobileSecureStorage } from './native/secure-storage';

export const uuRemote = Capacitor.isNativePlatform() ? new UURemoteClient({
  storage: nativeMobileSecureStorage,
  canOpen: async () => (await AppLauncher.canOpenUrl({ url: 'uuremote://external' })).value,
  open: async url => (await AppLauncher.openUrl({ url })).completed,
  appId: async () => (await App.getInfo()).id,
  nonce: () => crypto.randomUUID(),
  now: () => Date.now(),
}) : undefined;

let started: Promise<void> | undefined;
/** Register before reading the launch URL; the controller serializes and deduplicates both. */
export function initializeUURemote(): Promise<void> {
  if (!uuRemote) return Promise.resolve();
  return started ??= (async () => {
    await App.addListener('appUrlOpen', ({ url }) => { void uuRemote.handleUrl(url); });
    await uuRemote.initialize();
    const launch = await App.getLaunchUrl();
    if (launch?.url) await uuRemote.handleUrl(launch.url);
  })();
}
