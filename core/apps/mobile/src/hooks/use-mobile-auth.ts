import { App as CapacitorApp } from '@capacitor/app';
import { useCallback, useEffect } from 'react';
import {
  useInstalledAuth,
  type InstalledAuthPort,
  type SupportedLanguage,
} from '@cuberoot/app-ui';

import { nativeMobileAuth } from '../mobile-auth';
import { recordPush } from '../native/record-push';

const mobileAuthPort: InstalledAuthPort = {
  client: nativeMobileAuth,
  async getLaunchUrls() {
    const launch = await CapacitorApp.getLaunchUrl();
    return launch?.url ? [launch.url] : [];
  },
  listen: (listener) => CapacitorApp.addListener('appUrlOpen', ({ url }) => listener(url)),
};

export function useMobileAuth(language: SupportedLanguage) {
  const auth = useInstalledAuth(language, mobileAuthPort);
  useEffect(() => {
    const push = recordPush;
    if (!push || auth.loading) return;
    const sync = () => { void push.sync(auth.session).catch(() => undefined); };
    sync();
    const timer = window.setInterval(sync, 30_000);
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (isActive) sync(); });
    return () => { window.clearInterval(timer); void listener.then(handle => handle.remove()); };
  }, [auth.loading, auth.session]);
  const logout = useCallback(async () => {
    // Offline revocation stays in secure storage and is retried without retaining the JWT.
    try { await recordPush?.logout(); } catch { /* SDK stopped; revoke remains pending. */ }
    await auth.logout();
  }, [auth.logout]);
  return { ...auth, logout };
}
