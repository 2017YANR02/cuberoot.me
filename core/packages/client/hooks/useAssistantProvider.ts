'use client';
import { useEffect, useState } from 'react';
import type { AssistantProvider } from '@cuberoot/shared/site-assistant';
import { assistantStreamApiUrl } from '@/lib/api-base';
import { sessionFetch } from '@/lib/session-fetch';

/** This is display state only. Every send is independently checked by the API. */
export function useAssistantProvider(active: boolean) {
  const [selected, setSelected] = useState<AssistantProvider>('bailian');
  const [openaiAvailable, setOpenaiAvailable] = useState(false);
  useEffect(() => {
    if (!active) return;
    let request: AbortController | undefined;
    const refresh = () => {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      void sessionFetch(`${assistantStreamApiUrl()}/providers`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) })
        .then(async response => response.ok ? response.json() : null)
        .then(data => { if (!controller.signal.aborted) setOpenaiAvailable(Array.isArray(data?.providers) && data.providers.includes('openai')); })
        .catch(() => { if (!controller.signal.aborted) setOpenaiAvailable(false); });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => { request?.abort(); window.removeEventListener('focus', refresh); };
  }, [active]);
  return { provider: openaiAvailable ? selected : 'bailian' as AssistantProvider, setProvider: setSelected, openaiAvailable };
}
