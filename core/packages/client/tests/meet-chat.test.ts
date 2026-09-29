// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const chat = vi.hoisted(() => ({ send: vi.fn(), chatMessages: [], isSending: false }));
vi.mock('@livekit/components-react', () => ({ useChat: () => chat, ChatEntry: () => null }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
import MeetChat from '@/app/[lang]/meet/MeetChat';

let root: Root;
let host: HTMLDivElement;
beforeEach(async () => {
  Element.prototype.scrollTo = vi.fn();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  chat.send.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(createElement(MeetChat, { open: true, onClose: vi.fn(), onUnread: vi.fn() })); });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const submit = () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

it('retains a failed message, reports the failure, and permits retry', async () => {
  const input = host.querySelector('input')!;
  input.value = 'hello';
  chat.send.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  await act(async () => { submit(); });
  expect(input.value).toBe('hello');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not send');
  await act(async () => { submit(); });
  expect(chat.send.mock.calls).toEqual([['hello'], ['hello']]);
  expect(input.value).toBe('');
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it('sends only once while a request is pending', async () => {
  let resolve!: () => void;
  chat.send.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  host.querySelector('input')!.value = 'hello';
  await act(async () => { submit(); submit(); });
  expect(chat.send).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(); });
});

it('does not submit when Enter confirms an IME composition', async () => {
  const input = host.querySelector('input')!;
  input.value = '中文';
  await act(async () => {
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    submit();
  });
  expect(chat.send).not.toHaveBeenCalled();
  chat.send.mockResolvedValue(undefined);
  await act(async () => {
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    submit();
  });
  expect(chat.send).toHaveBeenCalledWith('中文');
});
