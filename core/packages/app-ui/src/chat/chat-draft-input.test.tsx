// @vitest-environment jsdom
import { act, createElement, createRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatDraftInput, readChatDraft, type ChatDraftInputHandle } from './ChatDraftInput';
const token = '[pet:clawd:working.svg]';
const packs = [{ id: 'pet', zh: '宠物', en: 'Pets', items: [{ token, src: '/working.svg', zh: '工作', en: 'Working', large: true }] }];
let host: HTMLDivElement, root: Root;
const changed = vi.fn();
const ref = createRef<ChatDraftInputHandle>();
function Fixture({ initial = '' }) {
  const [value, setValue] = useState(initial);
  return createElement(ChatDraftInput, { ref, value, packs, disabled: false, label: 'Message',
    onChange: value => { changed(value); setValue(value); }, onCompositionStart() {}, onCompositionEnd() {}, onKeyDown() {} });
}
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); changed.mockClear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const editor = () => host.querySelector<HTMLDivElement>('[role=textbox]')!;
const render = async (initial = '') => { await act(async () => root.render(createElement(Fixture, { initial }))); };
it('renders catalog expressions inline without exposing their code, retaining the exact wire draft', async () => {
  await render(`hello ${token} [unknown]`);
  expect(editor().querySelector('img')?.getAttribute('src')).toBe('/working.svg');
  expect(editor().textContent).toBe('hello  [unknown]');
  expect(readChatDraft(editor())).toBe(`hello ${token} [unknown]`);
  expect(editor().querySelector('[data-chat-token]')?.getAttribute('contenteditable')).toBe('false');
});
it('replaces a selected expression with pasted plain text and preserves the caret', async () => {
  await render(`A${token}B`);
  act(() => { ref.current!.focus(); ref.current!.setSelectionRange(1, 1 + token.length); });
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => '<b>text</b>' } });
  await act(async () => editor().dispatchEvent(event));
  expect(changed).toHaveBeenLastCalledWith('A<b>text</b>B');
  expect(editor().querySelector('b')).toBeNull();
  expect(ref.current!.selectionStart).toBe(12);
});
it('does not replace the DOM or publish a partial Chinese composition', async () => {
  await render();
  await act(async () => editor().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
  editor().textContent = '拼音';
  await act(async () => editor().dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true })));
  expect(changed).not.toHaveBeenCalled(); expect(editor().textContent).toBe('拼音');
  await act(async () => editor().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
  expect(changed).toHaveBeenLastCalledWith('拼音');
});
it('copies expression selections as their original tokens', async () => {
  await render(token);
  act(() => { ref.current!.focus(); ref.current!.setSelectionRange(0, token.length); });
  const setData = vi.fn(); const event = new Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { setData } });
  await act(async () => editor().dispatchEvent(event));
  expect(setData).toHaveBeenCalledWith('text/plain', token);
});
