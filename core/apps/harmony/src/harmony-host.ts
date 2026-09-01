import {
  InstalledAuthClient,
  timerNeedsScreenAwake,
  useInstalledAuth,
  useInstalledSmartCube,
  type InstalledAppHost,
  type InstalledAuthPort,
} from '@cuberoot/app-ui';
import type { TimerPhase } from '@cuberoot/shared/timer';
import { browserPrintTransport } from '@cuberoot/timer-ui';
import { useEffect } from 'react';

import packageInfo from '../package.json';
import {
  addBackEventListener,
  addLaunchUrlListener,
  addNetworkEventListener,
  drainLaunchUrls,
  pushLaunchUrls,
} from './harmony-events';
import { HarmonyBleTransport } from './harmony-ble-transport';
import { bridgeCall, harmonySecureStorage, nativeBridge } from './harmony-native';
import {
  harmonyNetBattleClient,
  harmonyNetBattleSessionStore,
} from './harmony-net-battle';

const harmonyAuth = new InstalledAuthClient({
  storage: harmonySecureStorage,
  fetcher: fetch,
  now: () => Date.now(),
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
  async digestSha256(value) {
    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    return new Uint8Array(await crypto.subtle.digest('SHA-256', copy));
  },
  getAppId: async () => 'me.cuberoot.app',
  openBrowser: (url) => bridgeCall<void>(nativeBridge().openExternal(url)),
  closeBrowser: async () => undefined,
});

const harmonyAuthPort: InstalledAuthPort = {
  client: harmonyAuth,
  async getLaunchUrls() {
    const nativeUrls = await bridgeCall<string[]>(nativeBridge().takeLaunchUrls());
    pushLaunchUrls(nativeUrls);
    return drainLaunchUrls();
  },
  async listen(listener) {
    const remove = addLaunchUrlListener(listener);
    return { remove: async () => remove() };
  },
};

function useHarmonyTimerEffects(phase: TimerPhase): void {
  useEffect(() => {
    const enabled = timerNeedsScreenAwake(phase);
    void bridgeCall<void>(nativeBridge().setKeepScreenOn(String(enabled))).catch(() => undefined);
    return () => {
      if (enabled) void bridgeCall<void>(nativeBridge().setKeepScreenOn('false')).catch(() => undefined);
    };
  }, [phase]);
}

export const harmonyHost: InstalledAppHost = {
  async addBackButtonListener(listener) {
    const remove = addBackEventListener(listener);
    await bridgeCall<void>(nativeBridge().setBackHandlerReady('true'));
    return {
      async remove() {
        remove();
        await bridgeCall<void>(nativeBridge().setBackHandlerReady('false'));
      },
    };
  },
  async addNetworkListener(listener) {
    const remove = addNetworkEventListener(listener);
    return { remove: async () => remove() };
  },
  exitApp: () => bridgeCall<void>(nativeBridge().exitApp()),
  getNetworkStatus: () => bridgeCall<boolean>(nativeBridge().getNetworkStatus()),
  isInstalled: () => true,
  netBattle: {
    client: harmonyNetBattleClient,
    sessions: harmonyNetBattleSessionStore,
  },
  openExternal: (url) => bridgeCall<void>(nativeBridge().openExternal(url)),
  print: browserPrintTransport,
  useAuth: (language) => useInstalledAuth(language, harmonyAuthPort),
  useSmartCube: (options) => useInstalledSmartCube(() => new HarmonyBleTransport(), options),
  useTimerEffects: useHarmonyTimerEffects,
  version: packageInfo.version,
};
