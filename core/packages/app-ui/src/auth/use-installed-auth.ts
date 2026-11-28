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
  const [state, setState] = useState<Pick<InstalledAppAuth, 'busy' | 'error' | 'accountReadError' | 'loading' | 'session'>>({
    busy: false,
    error: false,
    accountReadError: false,
    loading: true,
    session: null,
  });
  const sessionVersion = useRef(0);

  const readAccount = useCallback(async (version: number) => {
    try {
      const session = await port.client.restore();
      if (version === sessionVersion.current) {
        setState((current) => ({ ...current, loading: false, accountReadError: false, session }));
      }
    } catch {
      if (version === sessionVersion.current) {
        setState((current) => ({ ...current, loading: false, accountReadError: true }));
      }
    }
  }, [port]);

  const retryAccountRead = useCallback(async () => {
    const version = ++sessionVersion.current;
    setState((current) => ({ ...current, loading: true, accountReadError: false }));
    await readAccount(version);
  }, [readAccount]);

  useEffect(() => {
    let active = true;
    const startupVersion = sessionVersion.current;
    let listener: InstalledAppListener | undefined;

    const acceptCallback = async (url: string) => {
      try {
        const session = await port.client.finish(url);
        if (active && session) {
          sessionVersion.current++;
          setState({ busy: false, error: false, accountReadError: false, loading: false, session });
        }
      } catch {
        if (active) setState((current) => ({ ...current, busy: false, error: true, loading: false }));
      }
    };

    void port.listen((url) => void acceptCallback(url)).then((handle) => {
      if (active) listener = handle;
      else void handle.remove();
    }).catch(() => {
      if (active) setState((current) => ({ ...current, error: true }));
    });

    void (async () => {
      try {
        for (const url of await port.getLaunchUrls()) await acceptCallback(url);
      } catch {
        if (active && startupVersion === sessionVersion.current) setState((current) => ({ ...current, error: true }));
      }
      if (active && startupVersion === sessionVersion.current) await readAccount(startupVersion);
    })();

    return () => {
      active = false;
      sessionVersion.current++;
      void listener?.remove();
    };
  }, [port, readAccount]);

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
      setState({ busy: false, error: false, accountReadError: false, loading: false, session: null });
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
    setState({ busy: false, error: false, accountReadError: false, loading: false, session });
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
    retryAccountRead,
    refreshAccountSession,
  };
}
