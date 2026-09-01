import { App as CapacitorApp } from '@capacitor/app';
import {
  useInstalledAuth,
  type InstalledAuthPort,
  type SupportedLanguage,
} from '@cuberoot/app-ui';

import { nativeMobileAuth } from '../mobile-auth';

const mobileAuthPort: InstalledAuthPort = {
  client: nativeMobileAuth,
  async getLaunchUrls() {
    const launch = await CapacitorApp.getLaunchUrl();
    return launch?.url ? [launch.url] : [];
  },
  listen: (listener) => CapacitorApp.addListener('appUrlOpen', ({ url }) => listener(url)),
};

export function useMobileAuth(language: SupportedLanguage) {
  return useInstalledAuth(language, mobileAuthPort);
}
