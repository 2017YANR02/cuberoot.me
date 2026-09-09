// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_BACKGROUNDS, HOME_BACKGROUND_KEY, isHomeBackgroundChoice, resolveHomeBackground } from '@/lib/home-backgrounds';
import { useHomeBackgroundChoice } from '@/hooks/useHomeBackgroundChoice';
import { useEffectiveTheme } from '@/lib/theme';

function Picker() {
  const [choice, setChoice] = useHomeBackgroundChoice();
  return createElement('button', { onClick: () => setChoice('07') }, choice);
}

describe('shared homepage background choice', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('accepts every gallery scene and rejects empty, malformed and out-of-range choices', () => {
    expect(HOME_BACKGROUNDS.map(scene => scene.id)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
    for (const scene of HOME_BACKGROUNDS) expect(isHomeBackgroundChoice(scene.id)).toBe(true);
    for (const invalid of [null, undefined, '', '1', '00', '11', 1, {}, 'invalid']) {
      expect(isHomeBackgroundChoice(invalid)).toBe(false);
    }
    expect(isHomeBackgroundChoice('auto')).toBe(true);
    expect(isHomeBackgroundChoice('none')).toBe(true);
  });

  it('changes only automatic scenes with the effective theme', () => {
    expect(resolveHomeBackground('auto', 'light')?.id).toBe('01');
    expect(resolveHomeBackground('auto', 'dark')?.id).toBe('03');
    for (const theme of ['light', 'dark'] as const) {
      expect(resolveHomeBackground('none', theme)).toBeUndefined();
      for (const scene of HOME_BACKGROUNDS) expect(resolveHomeBackground(scene.id, theme)).toBe(scene);
    }
  });

  it('keeps a stable automatic server snapshot despite a saved browser choice', () => {
    localStorage.setItem(HOME_BACKGROUND_KEY, '08');
    expect(renderToString(createElement(Picker))).toBe('<button>auto</button>');
  });

  it('hydrates automatic backgrounds before reading a saved dark theme', async () => {
    localStorage.setItem('theme', 'dark');
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    function CurrentScene() {
      const theme = useEffectiveTheme();
      return createElement('span', null, resolveHomeBackground('auto', theme)?.id);
    }
    const host = document.createElement('div');
    host.innerHTML = renderToString(createElement(CurrentScene));
    expect(host.textContent).toBe('01');
    const onRecoverableError = vi.fn();
    const root = hydrateRoot(host, createElement(CurrentScene), { onRecoverableError });
    try {
      await act(async () => {});
      expect(host.textContent).toBe('03');
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      vi.unstubAllGlobals();
    }
  });

  it('syncs both mounted pickers, persistence, other tabs and storage removal without changing theme', async () => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem(HOME_BACKGROUND_KEY, 'invalid');
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const values = () => [...host.querySelectorAll('button')].map(button => button.textContent);
    try {
      await act(async () => root.render(createElement('div', null, createElement(Picker), createElement(Picker))));
      expect(values()).toEqual(['auto', 'auto']);
      await act(async () => host.querySelector('button')!.click());
      expect(values()).toEqual(['07', '07']);
      expect(localStorage.getItem(HOME_BACKGROUND_KEY)).toBe('07');
      expect(localStorage.getItem('theme')).toBe('dark');

      await act(async () => {
        localStorage.setItem(HOME_BACKGROUND_KEY, 'none');
        window.dispatchEvent(new StorageEvent('storage', { key: HOME_BACKGROUND_KEY }));
      });
      expect(values()).toEqual(['none', 'none']);
      await act(async () => {
        localStorage.removeItem(HOME_BACKGROUND_KEY);
        window.dispatchEvent(new StorageEvent('storage', { key: null }));
      });
      expect(values()).toEqual(['auto', 'auto']);

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
      await act(async () => host.querySelector('button')!.click());
      expect(values()).toEqual(['07', '07']);
      expect(localStorage.getItem(HOME_BACKGROUND_KEY)).toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
