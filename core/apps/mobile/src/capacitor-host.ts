import { primaryNavigation } from './primary-navigation';
import { addNotificationOpenListener } from './native/notification-open';
import { watchTimerPort } from './watch-timer';
import { uuRemote } from './uu-remote';
import { exportNativeFile } from './native-export';
import { openNativeExternal } from './native-external';
import { createStackmatMicSource } from '@cuberoot/timer-ui/external';
import { NativeBleTransport } from './bluetooth/native-ble-transport';
import { handleAppleMembership } from './apple-membership';
import { handleGoogleMembership } from './google-membership';
import { usesDirectPayments, usesGooglePayments } from './distribution';
import { handleWebMembership } from './web-membership';
import { App as NativeApp } from '@capacitor/app';
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

const isIos = Capacitor.getPlatform() === 'ios';

export const capacitorHost: InstalledAppHost = {
  uuRemote,
  addNotificationOpenListener,
  watchTimer: isIos ? watchTimerPort : undefined,
  floatingNavigation: Capacitor.isNativePlatform(),
  primaryNavigation: isIos ? primaryNavigation : undefined,
  createBleTransport: () => new NativeBleTransport(),
  createStackmatSource: createStackmatMicSource,
  appleMembership: isIos ? handleAppleMembership : undefined,
  get googleMembership() { return usesGooglePayments() ? handleGoogleMembership : undefined; },
  get webMembership() { return usesDirectPayments() ? handleWebMembership : undefined; },
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
  openExternal: (href) => openNativeExternal(href, isIos),
  print: printTimerDocument,
  exportFile: exportNativeFile,
  writeClipboardText: (text) => Clipboard.write({ string: text }),
  useAuth: useMobileAuth,
  useSmartCube,
  useTimerEffects: useNativeTimerEffects,
  version: packageInfo.version,
  icpFilingNumber: isIos ? '沪ICP备2025130431号-2A' : undefined,
  generativeAiDisabled: isIos,
  getAndroidUpdateInfo: Capacitor.getPlatform() === 'android' ? async () => {
    const info = await NativeApp.getInfo();
    const versionCode = Number(info.build);
    if (info.id !== 'me.cuberoot.app' || !Number.isSafeInteger(versionCode) || versionCode < 1) {
      throw new Error('Official Android build information unavailable');
    }
    return { versionName: info.version, versionCode, channel: usesDirectPayments() ? 'direct' : 'play' };
  } : undefined,
};
