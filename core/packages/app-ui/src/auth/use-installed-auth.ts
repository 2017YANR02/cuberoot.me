import type { MobileAuthProvider, WebSession } from '@cuberoot/shared/auth/web-session';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [state, setState] = useState<Pick<InstalledAppAuth, 'busy' | 'error' | 'loading' | 'session'>>({
    busy: false,
    error: false,
    loading: true,
    session: null,
  });
  const sessionVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const startupVersion = sessionVersion.current;
    let listener: InstalledAppListener | undefined;

    const acceptCallback = async (url: string) => {
      try {
        const session = await port.client.finish(url);
        if (active && session) {
          sessionVersion.current++;
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
      if (!active || startupVersion !== sessionVersion.current) return;
      const session = await port.client.restore();
      if (active && startupVersion === sessionVersion.current) setState((current) => ({ ...current, loading: false, session }));
    })().catch(() => {
      // A native callback can finish while startup storage/network work is pending.
      // Its authenticated session is newer than the failed startup snapshot.
      if (active && startupVersion === sessionVersion.current) setState((current) => ({ ...current, error: true, loading: false }));
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
    sessionVersion.current++;
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
  const installCredentialSession = useCallback(async (candidate: WebSession, isCurrent: () => boolean) => {
    const session = await port.client.installCredentialSession(candidate, isCurrent);
    if (!session || !isCurrent()) return false;
    sessionVersion.current++;
    setState({ busy: false, error: false, loading: false, session });
    return true;
  }, [port]);
  const refreshAccountSession = useCallback(async () => {
    const version = sessionVersion.current;
    const session = await port.client.restore();
    if (version === sessionVersion.current) setState(current => ({ ...current, session }));
  }, [port]);

  return {
    ...state,
    issueWebSessionTicket,
    installCredentialSession,
    login,
    logout,
    refreshAccountSession,
  };
}
