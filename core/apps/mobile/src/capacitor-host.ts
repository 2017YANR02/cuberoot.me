import { App as NativeApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import type { InstalledAppHost } from '@cuberoot/app-ui';

import packageInfo from '../package.json';
import { useMobileAuth } from './hooks/use-mobile-auth';
import { useNativeTimerEffects } from './hooks/use-native-timer-effects';
import { useSmartCube } from './hooks/use-smart-cube';
import { printTimerDocument } from './native-print';
import {
  mobileNetBattleClient,
  mobileNetBattleSessionStore,
} from './net-battle/mobile-net-battle';

export const capacitorHost: InstalledAppHost = {
  addBackButtonListener: (listener) => NativeApp.addListener('backButton', listener),
  addNetworkListener: (listener) => Network.addListener(
    'networkStatusChange',
    ({ connected }) => listener(connected),
  ),
  exitApp: () => NativeApp.exitApp(),
  async getNetworkStatus() {
    return (await Network.getStatus()).connected;
  },
  isInstalled: () => Capacitor.isNativePlatform(),
  netBattle: {
    client: mobileNetBattleClient,
    sessions: mobileNetBattleSessionStore,
  },
  openExternal: async (url) => Browser.open({ url }),
  print: printTimerDocument,
  writeClipboardText: (text) => Clipboard.write({ string: text }),
  useAuth: useMobileAuth,
  useSmartCube,
  useTimerEffects: useNativeTimerEffects,
  version: packageInfo.version,
};
