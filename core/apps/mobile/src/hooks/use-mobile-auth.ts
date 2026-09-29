import { Capacitor } from '@capacitor/core';
import { handleAppleMembership, listenForAppleMembership } from '../apple-membership';
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
  useEffect(() => {
    const session = auth.session;
    if (Capacitor.getPlatform() !== 'ios' || !session?.user.uid || auth.loading) return;
    const sync = () => { void handleAppleMembership({ type: 'cuberoot:mobile:apple-membership',
      action: 'sync', surface: 'account', expectedUid: session.user.uid!, requestId: crypto.randomUUID(),
    }, session).catch(() => undefined); };
    sync();
    const timer = window.setInterval(sync, 60_000);
    const active = CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (isActive) sync(); });
    const updates = listenForAppleMembership(sync);
    return () => { window.clearInterval(timer); void active.then(h => h.remove()); void updates.then(h => h.remove()); };
  }, [auth.loading, auth.session]);
  const logout = useCallback(async () => {
    // Offline revocation stays in secure storage and is retried without retaining the JWT.
    try { await recordPush?.logout(); } catch { /* SDK stopped; revoke remains pending. */ }
    await auth.logout();
  }, [auth.logout]);
  return { ...auth, logout };
}
