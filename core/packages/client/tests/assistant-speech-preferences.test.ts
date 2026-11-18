// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('@/lib/admin-api', () => ({ authHeaders: () => ({}) }));
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: vi.fn() }));
import { sessionFetch } from '@/lib/session-fetch';
beforeEach(() => { localStorage.clear(); vi.resetModules(); vi.mocked(sessionFetch).mockReset(); });
it('hydrates validated preferences while keeping a stable default server snapshot', async () => {
  localStorage.setItem('assistant-speech-preferences-v1', JSON.stringify({ voice: 'xunanchuan_v3.1', rate: 1.5 }));
  const store = await import('@/lib/assistant-speech-preferences');
  expect(store.getServerSpeechPreferences()).toEqual({ voice: '', rate: 1 });
  expect(store.getSpeechPreferences()).toEqual({ voice: 'xunanchuan_v3.1', rate: 1.5 });
  expect(store.getSpeechPreferences()).toBe(store.getSpeechPreferences());
  store.setSpeechPreferences({ rate: 99 });
  expect(store.getSpeechPreferences().rate).toBe(1.5);
});
it('synchronizes changes, persists them, and releases subscribers', async () => {
  const store = await import('@/lib/assistant-speech-preferences'), notify = vi.fn();
  const unsubscribe = store.subscribeSpeechPreferences(notify);
  store.setSpeechPreferences({ voice: 'longanhuan_v3.1', rate: 0.75 });
  expect(notify).toHaveBeenCalledOnce();
  expect(JSON.parse(localStorage.getItem('assistant-speech-preferences-v1')!)).toEqual({ voice: 'longanhuan_v3.1', rate: 0.75 });
  localStorage.removeItem('assistant-speech-preferences-v1');
  window.dispatchEvent(new StorageEvent('storage', { key: 'assistant-speech-preferences-v1' }));
  expect(store.getSpeechPreferences()).toEqual({ voice: '', rate: 1 });
  unsubscribe(); store.setSpeechPreferences({ rate: 2 });
  expect(notify).toHaveBeenCalledTimes(2);
});
it('deduplicates model voice discovery and allows retry after a failed request', async () => {
  const store = await import('@/lib/assistant-speech-preferences');
  vi.mocked(sessionFetch).mockResolvedValueOnce(new Response('', { status: 503 }));
  await expect(store.loadSpeechVoices()).rejects.toThrow();
  const value = { defaultVoice: 'Cherry', voices: [{ id: 'Cherry', name: { en: 'Cherry', zh: '芊悦' } }] };
  vi.mocked(sessionFetch).mockResolvedValue(Response.json(value));
  const first = store.loadSpeechVoices(), second = store.loadSpeechVoices();
  expect(first).toBe(second); expect(await first).toEqual(value);
  expect(await store.loadSpeechVoices()).toEqual(value);
  expect(sessionFetch).toHaveBeenCalledTimes(2);
});
