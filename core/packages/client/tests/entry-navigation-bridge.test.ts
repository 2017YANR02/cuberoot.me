// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import EntryNavigationBridge from '@/components/EntryNavigationBridge';
import { entryNavigationBack } from '@/lib/entry-navigation';
let root: Root;
let host: HTMLDivElement;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, '', '/zh/shop?q=mat');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(EntryNavigationBridge)));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); document.querySelectorAll('a').forEach(a => a.remove()); });
function anchor(href: string) { const a = document.createElement('a'); a.setAttribute('href', href); document.body.append(a); return a; }
it('prepares real links for middle-click and keyboard navigation', () => {
  for (const event of ['pointerdown', 'focusin', 'contextmenu']) {
    const a = anchor('/zh/platform/orders'); a.dispatchEvent(new Event(event, { bubbles: true }));
    expect(entryNavigationBack(a.getAttribute('href')!)).toBe('/zh/shop?q=mat');
  }
});
it('does not accumulate context on repeated events or keep a stale source', () => {
  const a = anchor('/zh/contact'); a.dispatchEvent(new Event('pointerdown', { bubbles: true })); const first = a.getAttribute('href');
  a.dispatchEvent(new Event('focusin', { bubbles: true })); a.dispatchEvent(new Event('contextmenu', { bubbles: true })); expect(a.getAttribute('href')).toBe(first);
  window.history.replaceState(null, '', '/zh/teachers'); a.dispatchEvent(new Event('pointerdown', { bubbles: true })); expect(entryNavigationBack(a.getAttribute('href')!)).toBe('/zh/teachers');
});
it('respects managed links, explicit opt-outs, downloads and external destinations', () => {
  for (const attr of ['data-entry-navigation', 'download']) {
    const a = anchor('/zh/contact'); a.setAttribute(attr, 'none'); a.dispatchEvent(new Event('pointerdown', { bubbles: true })); expect(a.getAttribute('href')).toBe('/zh/contact');
  }
  for (const target of ['#apps', 'https://example.com', '/icons/logo.svg', '/auth/login']) {
    const a = anchor(target); a.dispatchEvent(new Event('pointerdown', { bubbles: true })); expect(a.getAttribute('href')).toBe(target);
  }
});
it('handles reused DOM anchors with changed destinations', () => {
  const a = anchor('/zh/contact'); a.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  a.setAttribute('href', '/zh/privacy'); a.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  expect(a.getAttribute('href')).toMatch(/^\/zh\/privacy\?/); expect(entryNavigationBack(a.getAttribute('href')!)).toBe('/zh/shop?q=mat');
});
