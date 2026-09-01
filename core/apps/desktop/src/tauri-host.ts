import { invoke } from '@tauri-apps/api/core';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  InstalledAuthClient,
  mobileApiUrl,
  useInstalledSmartCube,
  useInstalledAuth,
  useInstalledTimerEffects,
  type InstalledAppHost,
  type InstalledAuthPort,
} from '@cuberoot/app-ui';
import {
  createNetBattleClient,
  createNetBattleSessionStore,
} from '@cuberoot/shared/timer';
import { browserPrintTransport } from '@cuberoot/timer-ui';

import packageInfo from '../package.json';
import { TauriBleTransport } from './tauri-ble-transport';

const desktopSecureStorage = {
  getItem: (key: string) => invoke<string | null>('secure_get', { key }),
  setItem: (key: string, value: string) => invoke<void>('secure_set', { key, value }),
  removeItem: (key: string) => invoke<void>('secure_remove', { key }),
};

const desktopAuth = new InstalledAuthClient({
  storage: desktopSecureStorage,
  fetcher: fetch,
  now: () => Date.now(),
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
  async digestSha256(value) {
    const buffer = new ArrayBuffer(value.byteLength);
    new Uint8Array(buffer).set(value);
    return new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  },
  getAppId: async () => 'me.cuberoot.app',
  openBrowser: openUrl,
  closeBrowser: async () => undefined,
});

const desktopAuthPort: InstalledAuthPort = {
  client: desktopAuth,
  getLaunchUrls: async () => (await getCurrent()) ?? [],
  async listen(listener) {
    const unlisten = await onOpenUrl((urls) => urls.forEach(listener));
    return { remove: async () => unlisten() };
  },
};

const desktopNetBattle = {
  client: createNetBattleClient({ apiUrl: mobileApiUrl }),
  sessions: createNetBattleSessionStore(desktopSecureStorage),
};

export const desktopHost: InstalledAppHost = {
  async addNetworkListener(listener) {
    const update = () => listener(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return {
      async remove() {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      },
    };
  },
  getNetworkStatus: async () => navigator.onLine,
  isInstalled: () => true,
  netBattle: desktopNetBattle,
  openExternal: openUrl,
  print: browserPrintTransport,
  useAuth: (language) => useInstalledAuth(language, desktopAuthPort),
  useSmartCube: (options) => useInstalledSmartCube(() => new TauriBleTransport(), options),
  useTimerEffects: useInstalledTimerEffects,
  version: packageInfo.version,
};
