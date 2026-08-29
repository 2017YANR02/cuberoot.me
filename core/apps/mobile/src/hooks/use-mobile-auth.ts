import { App as CapacitorApp } from '@capacitor/app';
import type { WebSession } from '@cuberoot/shared/auth/web-session';
import { useCallback, useEffect, useState } from 'react';

import type { SupportedLanguage } from '../copy';
import { nativeMobileAuth } from '../auth/mobile-auth';

interface MobileAuthState {
  busy: boolean;
  error: boolean;
  loading: boolean;
  session: WebSession | null;
}

export function useMobileAuth(language: SupportedLanguage) {
  const [state, setState] = useState<MobileAuthState>({
    busy: false,
    error: false,
    loading: true,
    session: null,
  });

  useEffect(() => {
    let active = true;
    let callbackApplied = false;
    let removeUrlListener: (() => Promise<void>) | undefined;

    const acceptCallback = async (url: string) => {
      try {
        const session = await nativeMobileAuth.finish(url);
        if (active && session) {
          callbackApplied = true;
          setState({ busy: false, error: false, loading: false, session });
        }
      } catch {
        if (active) setState((current) => ({ ...current, busy: false, error: true, loading: false }));
      }
    };

    void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      void acceptCallback(url);
    }).then((handle) => {
      if (active) removeUrlListener = handle.remove;
      else void handle.remove();
    });

    // Cold-start callbacks must finish before restore. Otherwise an older restore result can
    // overwrite the fresh session that just came back from the browser.
    void (async () => {
      const launch = await CapacitorApp.getLaunchUrl();
      if (launch?.url) await acceptCallback(launch.url);
      if (!active || callbackApplied) return;
      const session = await nativeMobileAuth.restore();
      if (active && !callbackApplied) {
        setState((current) => ({ ...current, loading: false, session }));
      }
    })().catch(() => {
      if (active) setState((current) => ({ ...current, error: true, loading: false }));
    });

    return () => {
      active = false;
      void removeUrlListener?.();
    };
  }, []);

  const login = useCallback(async () => {
    setState((current) => ({ ...current, busy: true, error: false }));
    try {
      await nativeMobileAuth.start(language);
      setState((current) => ({ ...current, busy: false }));
    } catch {
      setState((current) => ({ ...current, busy: false, error: true }));
    }
  }, [language]);

  const logout = useCallback(async () => {
    setState((current) => ({ ...current, busy: true, error: false }));
    try {
      await nativeMobileAuth.logout();
      setState({ busy: false, error: false, loading: false, session: null });
    } catch {
      setState((current) => ({ ...current, busy: false, error: true }));
    }
  }, []);

  return { ...state, login, logout };
}
