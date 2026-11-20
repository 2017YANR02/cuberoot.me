import { useEffect, useState } from 'react';
import { fetchInstalledCommunityAvailability, INSTALLED_COMMUNITY_POLICY_PATH } from '@cuberoot/shared/installed-content';

export function useInstalledCommunityAvailability(restricted: boolean, siteOrigin: string): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!restricted) return;
    let request: AbortController | undefined;
    const refresh = async () => {
      if (document.hidden) return;
      request?.abort();
      const current = new AbortController();
      request = current;
      const timeout = window.setTimeout(() => current.abort(), 5000);
      const allowed = await fetchInstalledCommunityAvailability(siteOrigin + INSTALLED_COMMUNITY_POLICY_PATH, current.signal);
      window.clearTimeout(timeout);
      if (request === current) setAvailable(allowed);
    };
    const offline = () => {
      request?.abort();
      request = undefined;
      setAvailable(null);
    };
    const onVisibility = () => {
      if (!document.hidden) {
        offline();
        void refresh();
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      request?.abort();
      request = undefined;
      window.clearInterval(timer);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [restricted, siteOrigin]);

  return restricted ? available : true;
}
