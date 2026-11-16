// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAssistantProvider } from '@/hooks/useAssistantProvider';
import { sessionFetch } from '@/lib/session-fetch';

vi.mock('@/lib/session-fetch', () => ({ sessionFetch: vi.fn() }));
const fetcher = vi.mocked(sessionFetch);
let host: HTMLDivElement, root: Root, state: ReturnType<typeof useAssistantProvider>;
function View({ active }: { active: boolean }) { state = useAssistantProvider(active); return createElement('span', null, state.provider); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  fetcher.mockReset();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('keeps discovery separate from chat and removes OpenAI when eligibility changes', async () => {
  fetcher.mockResolvedValueOnce(Response.json({ providers: ['bailian', 'openai'] }));
  await act(async () => root.render(createElement(View, { active: true })));
  expect(fetcher.mock.calls[0][0]).toMatch(/\/site-assistant\/providers$/);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
  expect(state!.provider).toBe('openai'); expect(state!.openaiAvailable).toBe(true);
  await act(async () => state!.setProvider('bailian'));
  fetcher.mockResolvedValueOnce(Response.json({ providers: ['bailian', 'openai'] }));
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(state!.provider).toBe('bailian');
  await act(async () => state!.setProvider('openai'));
  expect(host.textContent).toBe('openai');
  fetcher.mockResolvedValueOnce(Response.json({ providers: ['bailian'] }));
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(host.textContent).toBe('bailian'); expect(state!.openaiAvailable).toBe(false);
});
it('does not query while inactive and fails closed on discovery errors', async () => {
  await act(async () => root.render(createElement(View, { active: false })));
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockRejectedValueOnce(new Error('network unavailable'));
  await act(async () => root.render(createElement(View, { active: true })));
  expect(state!.provider).toBe('bailian'); expect(state!.openaiAvailable).toBe(false);
});
it('cancels metadata work on close and ignores a late response', async () => {
  let resolve!: (response: Response) => void;
  fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await act(async () => root.render(createElement(View, { active: true })));
  const signal = fetcher.mock.calls[0][1]?.signal;
  await act(async () => root.render(createElement(View, { active: false })));
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve(Response.json({ providers: ['openai'] })));
  expect(state!.openaiAvailable).toBe(false);
});
