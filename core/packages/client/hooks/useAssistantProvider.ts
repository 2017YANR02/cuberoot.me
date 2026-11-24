'use client';
import { useEffect, useRef, useState } from 'react';
import type { AssistantProvider } from '@cuberoot/shared/site-assistant';
import { assistantStreamApiUrl } from '@/lib/api-base';
import { sessionFetch } from '@/lib/session-fetch';

/** This is display state only. Every send is independently checked by the API. */
export function useAssistantProvider(active: boolean) {
  const [selected, setSelected] = useState<AssistantProvider>('openai');
  const [openaiAvailable, setOpenaiAvailable] = useState(false);
  const discovery = useRef<Promise<boolean> | undefined>(undefined);
  useEffect(() => {
    if (!active) return;
    let request: AbortController | undefined;
    const refresh = () => {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      discovery.current = sessionFetch(`${assistantStreamApiUrl()}/providers`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) })
        .then(async response => response.ok ? response.json() : null)
        .then(data => Array.isArray(data?.providers) && data.providers.includes('openai'))
        .catch(() => false)
        .then(available => {
          if (!controller.signal.aborted) setOpenaiAvailable(available);
          return available && !controller.signal.aborted;
        });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => { request?.abort(); window.removeEventListener('focus', refresh); };
  }, [active]);
  async function providerForSend(): Promise<AssistantProvider> {
    if (selected !== 'openai') return selected;
    return await discovery.current ? 'openai' : 'bailian';
  }
  return { providerForSend, provider: selected === 'openai' && !openaiAvailable ? 'bailian' : selected, setProvider: setSelected, openaiAvailable };
}
