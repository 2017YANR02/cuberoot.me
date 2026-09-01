import type { MobileAuthProvider } from '@cuberoot/shared/auth/web-session';
import { useCallback, useEffect, useState } from 'react';

import type { SupportedLanguage } from '../copy';
import type { InstalledAppAuth, InstalledAppListener } from '../platform';
import type { InstalledAuthClient } from './installed-auth';

export interface InstalledAuthPort {
  client: InstalledAuthClient;
  getLaunchUrls(): Promise<string[]>;
  listen(listener: (url: string) => void): Promise<InstalledAppListener>;
}

export function useInstalledAuth(
  language: SupportedLanguage,
  port: InstalledAuthPort,
): InstalledAppAuth {
  const [state, setState] = useState<Omit<InstalledAppAuth, 'issueWebSessionTicket' | 'login' | 'logout'>>({
    busy: false,
    error: false,
    loading: true,
    session: null,
  });

  useEffect(() => {
    let active = true;
    let callbackApplied = false;
    let listener: InstalledAppListener | undefined;

    const acceptCallback = async (url: string) => {
      try {
        const session = await port.client.finish(url);
        if (active && session) {
          callbackApplied = true;
          setState({ busy: false, error: false, loading: false, session });
        }
      } catch {
        if (active) setState((current) => ({ ...current, busy: false, error: true, loading: false }));
      }
    };

    void port.listen((url) => void acceptCallback(url)).then((handle) => {
      if (active) listener = handle;
      else void handle.remove();
    }).catch(() => {
      if (active) setState((current) => ({ ...current, error: true, loading: false }));
    });

    void (async () => {
      for (const url of await port.getLaunchUrls()) await acceptCallback(url);
      if (!active || callbackApplied) return;
      const session = await port.client.restore();
      if (active && !callbackApplied) setState((current) => ({ ...current, loading: false, session }));
    })().catch(() => {
      if (active) setState((current) => ({ ...current, error: true, loading: false }));
    });

    return () => {
      active = false;
      void listener?.remove();
    };
  }, [port]);

  const login = useCallback(async (provider: MobileAuthProvider | null = null) => {
    setState((current) => ({ ...current, busy: true, error: false }));
    try {
      await port.client.start(language, provider);
      setState((current) => ({ ...current, busy: false }));
    } catch {
      setState((current) => ({ ...current, busy: false, error: true }));
    }
  }, [language, port]);

  const logout = useCallback(async () => {
    setState((current) => ({ ...current, busy: true, error: false }));
    try {
      await port.client.logout();
      setState({ busy: false, error: false, loading: false, session: null });
    } catch {
      setState((current) => ({ ...current, busy: false, error: true }));
    }
  }, [port]);

  const issueWebSessionTicket = useCallback(
    () => port.client.issueWebSessionTicket(),
    [port],
  );

  return {
    ...state,
    issueWebSessionTicket,
    login,
    logout,
  };
}
