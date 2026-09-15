// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import WrHistoryChart from '@/components/wca-stats/WrHistoryChart';

const css = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('WCA statistics inherit site appearance', () => {
  it('does not override site tokens at the root or in nested statistics pages', () => {
    const globalCss = css('app/globals.css');
    for (const name of ['wca-stats-page', 'wse-page', 'records-page', 'fun-stats', 'result-watch-page', 'cs-page']) {
      expect(globalCss).not.toContain(`:has(.${name})`);
    }
    for (const path of ['app/[lang]/wca/_wca_stats_extra.css', 'components/wca-stats/top10_history.css']) {
      const source = css(path);
      expect(source).not.toMatch(/color-scheme:\s*dark/);
      expect(source).not.toMatch(/--(?:background|foreground|muted-foreground|faint-foreground):/);
    }
    expect(globalCss).toContain('@media (prefers-color-scheme: dark)');
    expect(globalCss).toContain('html:not([data-theme=light])');
    expect(globalCss).toContain('html[data-theme=dark]');
  });
});

describe('WR canvas appearance updates', () => {
  let root: Root;
  let host: HTMLDivElement;
  let media: EventTarget;
  let ctx: Record<string, any>;
  let frame: FrameRequestCallback | undefined;
  let accent = '#123456';
  const flush = async () => {
    await act(async () => { await Promise.resolve(); });
    await act(async () => { const callback = frame; frame = undefined; callback?.(0); });
  };

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    media = new EventTarget();
    vi.stubGlobal('matchMedia', () => media);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => { frame = undefined; });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (name: string) => name === '--accent' ? accent : '#777777' }));
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    ctx = Object.fromEntries(['setTransform', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fillText', 'closePath', 'fill', 'arc'].map(key => [key, vi.fn()]));
    ctx.createLinearGradient = () => ({ addColorStop: vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as CanvasRenderingContext2D);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(React.createElement(WrHistoryChart, {
      header: [{ key: 'result', label: 'Result' }, { key: 'date', label: 'Date' }],
      rows: [['10.00', '2020-01-01'], ['9.00', '2021-01-01']],
    })));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.documentElement.removeAttribute('data-palette');
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    frame = undefined;
  });

  it('repaints for system changes and explicit theme/palette changes', async () => {
    for (const [attribute, value, color] of [
      ['data-theme', 'light', '#234567'],
      ['data-theme', 'dark', '#345678'],
      ['data-palette', 'hantan', '#456789'],
      ['data-palette', 'wujin', '#567890'],
    ]) {
      accent = color;
      document.documentElement.setAttribute(attribute, value);
      await flush();
      expect(ctx.strokeStyle).toBe(accent);
    }
    accent = '#678901';
    media.dispatchEvent(new Event('change'));
    await flush();
    expect(ctx.strokeStyle).toBe(accent);
  });

  it('repaints final animated preview tokens and cleans up pending work', async () => {
    accent = '#567890';
    const event = new Event('transitionend', { bubbles: true });
    Object.defineProperty(event, 'propertyName', { value: '--accent' });
    document.body.dispatchEvent(event);
    await flush();
    expect(ctx.strokeStyle).toBe(accent);
    media.dispatchEvent(new Event('change'));
    expect(frame).toBeDefined();
    await act(async () => root.unmount());
    expect(frame).toBeUndefined();
    media.dispatchEvent(new Event('change'));
    document.documentElement.setAttribute('data-theme', 'light');
    await flush();
    expect(frame).toBeUndefined();
  });
});
