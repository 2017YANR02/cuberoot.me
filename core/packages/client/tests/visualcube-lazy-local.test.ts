// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VisualCube } from '@/components/VisualCube';
import { CaseThumb } from '@/components/CaseThumb';

const { draw } = vi.hoisted(() => ({ draw: vi.fn((_query: Record<string, unknown>) => '<svg viewBox="0 0 88 88"><path d="M0 0h88v88" /></svg>') }));
vi.mock('@cuberoot/visualcube', async importOriginal => ({
  ...await importOriginal<typeof import('@cuberoot/visualcube')>(), renderFromSimpleQuery: draw,
}));
vi.mock('@cuberoot/timer-ui', () => ({ TimerRoomDialog: () => null }));

let host: HTMLDivElement;
let root: Root;
const observers: { callback: IntersectionObserverCallback; target?: Element; disconnect: () => void }[] = [];
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  observers.length = 0;
  draw.mockClear();
  vi.stubGlobal('IntersectionObserver', class {
    entry: typeof observers[number];
    constructor(callback: IntersectionObserverCallback) { this.entry = { callback, disconnect: vi.fn() }; observers.push(this.entry); }
    observe(target: Element) { this.entry.target = target; }
    disconnect() { this.entry.disconnect(); }
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function reveal(index: number) {
  const observer = observers[index];
  await act(async () => observer.callback([{ target: observer.target!, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
}

it('renders a current case immediately without an image request', async () => {
  await act(async () => root.render(createElement(VisualCube, { view: 'pll', setup: 'R U', local: true })));
  expect(draw).toHaveBeenCalledTimes(1);
  expect(host.querySelectorAll('svg').length).toBe(1);
  expect(host.querySelectorAll('img').length).toBe(0);
  expect(observers.length).toBe(0);
});

it('does not generate an offscreen library, reserves its size, and renders only revealed entries', async () => {
  const items = Array.from({ length: 256 }, (_, i) => createElement(VisualCube, { key: i, view: 'pll', setup: 'R U', local: true, loading: 'lazy', size: 76 }));
  await act(async () => root.render(items));
  expect(draw).toHaveBeenCalledTimes(0);
  expect(host.querySelectorAll('img, svg').length).toBe(0);
  expect(host.children.length).toBe(256);
  expect((host.firstElementChild as HTMLElement).style.width).toBe('76px');
  expect((host.firstElementChild as HTMLElement).style.height).toBe('76px');
  for (let i = 0; i < 4; i++) await reveal(i);
  expect(draw).toHaveBeenCalledTimes(4);
  expect(host.querySelectorAll('svg').length).toBe(4);
  await reveal(0);
  expect(draw).toHaveBeenCalledTimes(4);
  expect(observers[0].disconnect).toHaveBeenCalled();
});

it('forwards CaseThumb lazy rendering and refreshes the visible state after an algorithm change', async () => {
  const props = { puzzle: '3x3' as const, set: 'zbll', sticker: { kind: 'raw' as const, tag: '', attrs: {} }, alg: '', setup: 'R U', local: true, loading: 'lazy' as const };
  await act(async () => root.render(createElement(CaseThumb, props)));
  expect(draw).toHaveBeenCalledTimes(0);
  await reveal(0);
  expect(draw).toHaveBeenCalledTimes(1);
  expect(draw.mock.calls[0][0]).toMatchObject({ setup: 'R U' });
  await act(async () => root.render(createElement(CaseThumb, { ...props, setup: 'F U2' })));
  expect(draw).toHaveBeenCalledTimes(2);
  expect(draw.mock.calls[1][0]).toMatchObject({ setup: 'F U2' });
  expect(host.querySelector('img')).toBeNull();
});

it('keeps SSR lazy placeholders free of SVG generation and cleans up unobserved entries', async () => {
  const element = createElement(VisualCube, { view: 'pll', setup: 'R U', local: true, loading: 'lazy', size: 64 });
  const html = renderToString(element);
  expect(draw).toHaveBeenCalledTimes(0);
  expect(html).toContain('width:64px');
  expect(html).not.toContain('<img');
  await act(async () => root.render(element));
  await act(async () => root.render(null));
  expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  expect(draw).toHaveBeenCalledTimes(0);
});
