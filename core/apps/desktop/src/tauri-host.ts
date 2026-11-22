import { printDesktopDocument } from './native-print';
import { openDesktopExternal } from './native-external';
import { createStackmatMicSource } from '@cuberoot/timer-ui/external';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  InstalledAuthClient,
  createNativeScreenWakeLock,
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
import { browserClipboardTransport } from '@cuberoot/timer-ui';

import packageInfo from '../package.json';
import { TauriBleTransport } from './tauri-ble-transport';
import { withDesktopDistribution } from './distribution';

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
  async openBrowser(url) {
    await invoke('prepare_auth_callback');
    await openUrl(url);
  },
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

const requestDesktopScreenWakeLock = createNativeScreenWakeLock(
  (enabled) => invoke<void>('set_keep_awake', { enabled }),
);

type PrimaryNavigation = NonNullable<InstalledAppHost['primaryNavigation']>;

const readNavigationAccent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
let lastNavigationRender = Promise.resolve(false);
let lastNavigationState: Parameters<PrimaryNavigation['render']>[0] = null;
let lastNavigationAccent = '';
const macPrimaryNavigation: PrimaryNavigation = {
  render(state) {
    lastNavigationState = state;
    lastNavigationAccent = state ? readNavigationAccent() : '';
    const layout = state && { ...state, viewportHeight: window.innerHeight, accent: lastNavigationAccent };
    const render = lastNavigationRender.then(() => invoke<boolean>('render_primary_navigation', { state: layout }));
    lastNavigationRender = render.catch(() => false);
    return render;
  },
  async addSelectListener(listener) {
    const select = (event: Event) => {
      const id: unknown = (event as CustomEvent).detail;
      if (id === 'timer' || id === 'tools' || id === 'account' || id === 'search') listener(id);
    };
    window.addEventListener('cuberoot:mac-primary-navigation', select);
    const appearance = new MutationObserver(() => {
      if (lastNavigationState && readNavigationAccent() !== lastNavigationAccent) {
        void macPrimaryNavigation.render(lastNavigationState).catch(() => {});
      }
    });
    appearance.observe(document.documentElement, {
      attributeFilter: ['data-theme', 'data-palette', 'data-palette-scheme', 'data-accent', 'style'],
    });
    return { remove: async () => {
      appearance.disconnect();
      window.removeEventListener('cuberoot:mac-primary-navigation', select);
    } };
  },
};

export const desktopHost: InstalledAppHost = {
  floatingNavigation: 'labeled',
  async listenDesktopNavigation(language, listener) {
    if (!isTauri()) return { remove: async () => {} };
    const unlisten = await listen<Parameters<typeof listener>[0]>('desktop-navigation', event => listener(event.payload), { target: 'main' });
    try {
      await invoke('configure_navigation_menu', { language });
    } catch (error) {
      unlisten();
      throw error;
    }
    return { remove: async () => unlisten() };
  },
  createBleTransport: () => new TauriBleTransport(),
  createStackmatSource: createStackmatMicSource,
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
  openExternal: openDesktopExternal,
  print: printDesktopDocument,
  async exportFile(text, filename) {
    if (!await invoke<boolean>('export_file', { text, filename })) throw new DOMException('Export cancelled', 'AbortError');
  },
  writeClipboardText: text => isTauri() ? invoke<void>('copy_text', { text }) : browserClipboardTransport(text),
  useAuth: (language) => useInstalledAuth(language, desktopAuthPort),
  useSmartCube: (options) => useInstalledSmartCube(() => new TauriBleTransport(), options),
  useTimerEffects: (phase) => useInstalledTimerEffects(phase, undefined, requestDesktopScreenWakeLock),
  version: packageInfo.version,
  ...(navigator.userAgent.includes('Windows') ? { getWindowsUpdateInfo: async () => ({ versionName: await getVersion() }) } : {}),
};

export async function loadDesktopHost(): Promise<InstalledAppHost> {
  if (!isTauri()) return desktopHost;
  const [channel, version, nativeNavigation] = await Promise.all([
    invoke<string>('desktop_distribution'),
    getVersion(),
    macPrimaryNavigation.render(null).catch(() => false),
  ]);
  const host = nativeNavigation ? { ...desktopHost, primaryNavigation: macPrimaryNavigation } : desktopHost;
  return withDesktopDistribution(host, channel, version);
}
