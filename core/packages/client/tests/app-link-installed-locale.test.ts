// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ lang: 'en' }));
vi.mock('next/navigation', () => ({ useParams: () => ({ lang: state.lang }) }));
vi.mock('next/link', () => ({ default: ({ prefetch: _prefetch, onNavigate: _onNavigate, ...props }: ComponentProps<'a'> & { prefetch?: boolean; onNavigate?: unknown }) => createElement('a', props) }));
vi.mock('@/lib/training-host', () => ({ useTrainingHref: () => (href: string) => href }));
vi.mock('@/lib/douyin-content', () => ({ useDouyinToolSurface: () => false }));
vi.mock('@/components/StartupStatus', () => ({ LinkPendingIndicator: () => null }));
import AppLink from '@/components/AppLink';

const originalParent = window.parent;
let root: Root | undefined;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.lang = 'en';
  Object.defineProperty(window, 'parent', { configurable: true, value: {} });
  window.name = 'cuberoot-mobile-account';
  container = document.createElement('div'); document.body.append(container);
});
afterEach(async () => {
  await act(async () => root?.unmount()); root = undefined; container.remove();
  window.name = ''; Object.defineProperty(window, 'parent', { configurable: true, value: originalParent });
});
async function renderedHref(href: string) {
  root ??= createRoot(container);
  await act(async () => root!.render(createElement(AppLink, { href }, 'Results')));
  return container.querySelector('a')!.getAttribute('href');
}

it.each(['cuberoot-mobile-account', 'cuberoot-mobile-tools'])('preserves English product navigation in %s without relying on cookies', async name => {
  window.name = name;
  expect(await renderedHref('/wca/persons/2017TEST01?tab=records#results')).toBe('/en/wca/persons/2017TEST01?tab=records#results');
});

it('applies the current language after removing a prior prefix and old navigation provenance', async () => {
  expect(await renderedHref('/zh/wca/persons/2017TEST01?navBack=%5B%5D&tab=records#results')).toBe('/en/wca/persons/2017TEST01?tab=records#results');
  state.lang = 'zh';
  expect(await renderedHref('/en/account')).toBe('/zh/account');
  expect(await renderedHref('/')).toBe('/zh');
});

it.each(['en', 'zh'])('keeps native/static/external targets unchanged on installed %s pages', async lang => {
  state.lang = lang;
  for (const href of ['/api/example', '/v1/example', '/auth/mobile?state=example', '/callback.html', '/tools/test/index.html', '/stats/example.json', '/icons/wca.svg', '/fonts/timer.woff2', '/images/logo.svg', '/assets/chunk.js', '/file.pdf?download=1', '/en/tools/test/index.html', '/zh/api/example', 'https://example.org/path', '//example.org/path', 'mailto:test@example.org', '#section']) {
    expect(await renderedHref(href), href).toBe(href);
  }
});

it('keeps ordinary top-level website English links bare and Chinese links prefixed', async () => {
  Object.defineProperty(window, 'parent', { configurable: true, value: window });
  expect(await renderedHref('/en/wca/persons/2017TEST01')).toBe('/wca/persons/2017TEST01');
  state.lang = 'zh';
  expect(await renderedHref('/wca/persons/2017TEST01')).toBe('/zh/wca/persons/2017TEST01');
});

it('does not change ordinary embedded pages without an installed surface name', async () => {
  window.name = 'some-other-iframe';
  expect(await renderedHref('/account')).toBe('/account');
});

it('hydrates canonical server markup without a mismatch then selects the explicit installed locale', async () => {
  const element = createElement(AppLink, { href: '/wca/persons/2017TEST01' }, 'Results');
  container.innerHTML = renderToString(element);
  expect(container.querySelector('a')!.getAttribute('href')).toBe('/wca/persons/2017TEST01');
  const errors: unknown[] = [];
  await act(async () => { root = hydrateRoot(container, element, { onRecoverableError: error => errors.push(error) }); });
  expect(errors).toEqual([]);
  expect(container.querySelector('a')!.getAttribute('href')).toBe('/en/wca/persons/2017TEST01');
});
