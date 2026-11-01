// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { ChatMessageText, type ChatExpressionPack } from './ChatMessageText';

it('renders catalogued tokens, preserves text, fails back to text, and follows updated/locked catalogs', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'), root = createRoot(host);
  const packs: ChatExpressionPack[] = [{ id: 'test', zh: '测试', en: 'Test', items: [{ token: '[捂脸]', zh: '捂脸', en: 'Facepalm', src: '/test?v=1' }] }];
  const body = '你好[捂脸]😀[未知]<img src=x onerror=alert(1)>';
  try {
    await act(async () => root.render(createElement(ChatMessageText, { body, packs })));
    expect(host.querySelectorAll('img')).toHaveLength(1);
    expect(host.textContent).toBe('你好😀[未知]<img src=x onerror=alert(1)>');
    await act(async () => host.querySelector('img')!.dispatchEvent(new Event('error')));
    expect(host.textContent).toBe(body);
    packs[0].items[0].src = '/test?v=2';
    await act(async () => root.render(createElement(ChatMessageText, { body, packs: [...packs] })));
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/test?v=2');
    await act(async () => root.render(createElement(ChatMessageText, { body, packs: [] })));
    expect(host.querySelectorAll('img')).toHaveLength(0);
    expect(host.textContent).toBe(body);
  } finally { await act(async () => root.unmount()); }
});

it('limits conversation previews after parsing, without splitting long expression tokens', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'), root = createRoot(host);
  const token = '[pet:rootbeast:04-double-jump.svg]';
  const packs: ChatExpressionPack[] = [{ id: 'pet', zh: '宠物', en: 'Pets', items: [{ token, zh: '跳跃', en: 'Jump', src: '/jump.svg', large: true }] }];
  try {
    await act(async () => root.render(createElement(ChatMessageText, { body: token.repeat(4), packs, maxLength: 60 })));
    expect(host.querySelectorAll('img')).toHaveLength(4);
    expect(host.textContent).toBe('');
    await act(async () => root.render(createElement(ChatMessageText, { body: '😀'.repeat(59) + token + 'tail', packs, maxLength: 60 })));
    expect(host.querySelectorAll('img')).toHaveLength(1);
    expect(host.textContent).toBe('😀'.repeat(59));
  } finally { await act(async () => root.unmount()); }
});
