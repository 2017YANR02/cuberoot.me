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
  sessionStorage.clear();
  window.history.replaceState(null, '', '/zh/shop?q=mat');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(EntryNavigationBridge)));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); document.querySelectorAll('a').forEach(a => a.remove()); });
function anchor(href: string) { const a = document.createElement('a'); a.setAttribute('href', href); document.body.append(a); return a; }
it('never rewrites links when focusing, copying or opening context menus', () => {
  const a = anchor('/zh/contact');
  for (const event of ['pointerdown', 'focusin', 'contextmenu']) {
    a.dispatchEvent(new Event(event, { bubbles: true }));
    expect(a.getAttribute('href')).toBe('/zh/contact'); expect(sessionStorage.length).toBe(0);
  }
});
it('records an actual native navigation locally without changing its href', () => {
  const a = anchor('/zh/contact');
  a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(a.getAttribute('href')).toBe('/zh/contact'); expect(sessionStorage.length).toBe(1);
  window.history.pushState(null, '', a.href);
  expect(entryNavigationBack('/zh/contact')).toBe('/zh/shop?q=mat');
});
it('does not record cancelled clicks, managed links, modified clicks or new-tab targets', () => {
  const a = anchor('/zh/contact');
  a.addEventListener('click', event => event.preventDefault(), { once: true });
  a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  for (const attr of ['data-entry-navigation', 'download']) {
    const managed = anchor('/zh/contact'); managed.setAttribute(attr, 'none');
    managed.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
  a.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
  a.target = '_blank'; a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(sessionStorage.length).toBe(0);
});
it('ignores external links, resources, auth and local anchors', () => {
  for (const target of ['#apps', 'https://example.com', '/icons/logo.svg', '/auth/login']) {
    const a = anchor(target); a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(a.getAttribute('href')).toBe(target);
  }
  expect(sessionStorage.length).toBe(0);
});
