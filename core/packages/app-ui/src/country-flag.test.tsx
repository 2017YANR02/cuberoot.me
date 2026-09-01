// @vitest-environment jsdom

import { Flag, flagHtml, flagInfo } from '@cuberoot/timer-ui/country-flag';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('shared Web/Mobile country flag renderer', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('normalizes WCA country names before selecting a real flag', async () => {
    await act(async () => root.render(<Flag iso2="United States" />));
    const flag = host.querySelector('span');
    expect(flag?.classList.contains('fi-us')).toBe(true);
    expect(flag?.getAttribute('aria-label')).toBe('us');
  });

  it('keeps Chinese Taipei as an accessible package-owned offline SVG', async () => {
    await act(async () => root.render(<Flag iso2="TW" />));
    const flag = host.querySelector('img');
    expect(flag?.alt).toBe('Chinese Taipei');
    expect(flag?.classList.contains('cr-flag-img')).toBe(true);
    expect(flag?.getAttribute('src')).toMatch(/ChineseTaipei\.svg(?:$|\?)/);
    expect(new URL(flag!.src).origin).toBe(window.location.origin);
  });

  it('uses a neutral marker for WCA multi-region codes in JSX and HTML', () => {
    expect(flagInfo('XW')).toMatchObject({
      kind: 'span',
      className: 'fi flag-multi flag-multi-world',
    });
    expect(flagHtml('XW')).toContain('flag-multi-world');
  });
});
