// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_BACKGROUNDS, HOME_BACKGROUND_KEY, isHomeBackgroundChoice, resolveHomeBackground } from '@/lib/home-backgrounds';
import { useHomeBackgroundChoice } from '@/hooks/useHomeBackgroundChoice';
import { useEffectiveTheme } from '@/lib/theme';

function Picker({ theme = 'dark', value = '07' }: { theme?: 'light' | 'dark'; value?: '07' | '08' | 'none' }) {
  const [choice, setChoice] = useHomeBackgroundChoice(theme);
  return createElement('button', { onClick: () => setChoice(value) }, choice);
}

describe('shared homepage background choice', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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

  it('keeps a stable transparent server snapshot despite a saved browser choice', () => {
    localStorage.setItem(HOME_BACKGROUND_KEY, '08');
    expect(renderToString(createElement(Picker))).toBe('<button>transparent</button>');
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
      expect(values()).toEqual(['transparent', 'transparent']);
      await act(async () => host.querySelector('button')!.click());
      expect(values()).toEqual(['07', '07']);
      expect(localStorage.getItem(`${HOME_BACKGROUND_KEY}.dark`)).toBe('07');
      expect(localStorage.getItem('theme')).toBe('dark');

      await act(async () => {
        localStorage.setItem(`${HOME_BACKGROUND_KEY}.dark`, 'none');
        window.dispatchEvent(new StorageEvent('storage', { key: `${HOME_BACKGROUND_KEY}.dark` }));
      });
      expect(values()).toEqual(['none', 'none']);
      await act(async () => {
        localStorage.removeItem(`${HOME_BACKGROUND_KEY}.dark`);
        window.dispatchEvent(new StorageEvent('storage', { key: null }));
      });
      expect(values()).toEqual(['transparent', 'transparent']);

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
      await act(async () => host.querySelector('button')!.click());
      expect(values()).toEqual(['07', '07']);
      expect(localStorage.getItem(`${HOME_BACKGROUND_KEY}.dark`)).toBeNull();
    } finally {
      await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: null })));
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it('remembers light, dark and no-background choices independently across theme switches and remounts', async () => {
    const host = document.createElement('div');
    let root = createRoot(host);
    const show = async (theme: 'light' | 'dark', value: '07' | '08' | 'none' = '07') => {
      await act(async () => root.render(createElement(Picker, { theme, value })));
    };
    const choose = async () => { await act(async () => host.querySelector('button')!.click()); };
    try {
      await show('light');
      await choose();
      await show('dark', '08');
      expect(host.textContent).toBe('transparent');
      await choose();
      await show('light', 'none');
      expect(host.textContent).toBe('07');
      await choose();
      await show('dark');
      expect(host.textContent).toBe('08');
      await act(async () => root.unmount());
      root = createRoot(host);
      await show('light');
      expect(host.textContent).toBe('none');
      await show('dark');
      expect(host.textContent).toBe('08');
    } finally {
      await act(async () => root.unmount());
    }
  });

  it('migrates the legacy choice only to the saved effective theme', async () => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem(HOME_BACKGROUND_KEY, '08');
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      await act(async () => root.render(createElement(Picker, { theme: 'dark' })));
      expect(host.textContent).toBe('08');
      await act(async () => root.render(createElement(Picker, { theme: 'light' })));
      expect(host.textContent).toBe('transparent');
      expect(localStorage.getItem(`${HOME_BACKGROUND_KEY}.dark`)).toBe('08');
      expect(localStorage.getItem(`${HOME_BACKGROUND_KEY}.light`)).toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  });

  it.each([null, 'transparent', 'none', '03'] as const)('retires transparency preferences without changing background %s', async (saved) => {
    if (saved) localStorage.setItem(`${HOME_BACKGROUND_KEY}.dark`, saved);
    localStorage.setItem(`${HOME_BACKGROUND_KEY}.transparency.light`, 'false');
    localStorage.setItem(`${HOME_BACKGROUND_KEY}.transparency.dark`, 'false');
    let state: ReturnType<typeof useHomeBackgroundChoice>;
    function Preferences() {
      state = useHomeBackgroundChoice('dark');
      return null;
    }
    const root = createRoot(document.createElement('div'));
    try {
      await act(async () => root.render(createElement(Preferences)));
      expect(state![0]).toBe(saved ?? 'transparent');
      for (const choice of ['07', 'none'] as const) {
        await act(async () => state![1](choice));
        expect(state![0]).toBe(choice);
        expect(localStorage.getItem(`${HOME_BACKGROUND_KEY}.transparency.light`)).toBeNull();
        expect(localStorage.getItem(`${HOME_BACKGROUND_KEY}.transparency.dark`)).toBeNull();
      }
    } finally {
      await act(async () => root.unmount());
    }
  });

  it('starts with no image and restores the last image per theme after disabling and remounting', async () => {
    let state: ReturnType<typeof useHomeBackgroundChoice>;
    function Preferences({ theme }: { theme: 'light' | 'dark' }) {
      state = useHomeBackgroundChoice(theme);
      return null;
    }
    const host = document.createElement('div');
    let root = createRoot(host);
    const show = async (theme: 'light' | 'dark') => {
      await act(async () => root.render(createElement(Preferences, { theme })));
    };
    try {
      for (const [theme, image] of [['light', '07'], ['dark', '08']] as const) {
        await show(theme);
        expect(state![2]).toBe(false);
        await act(async () => state![3](true));
        expect(resolveHomeBackground(state![0], theme)?.id).toBe(theme === 'dark' ? '03' : '01');
        await act(async () => state![1](image));
        await act(async () => state![3](false));
        expect(state![2]).toBe(false);
        expect(resolveHomeBackground(state![0], theme)).toBeUndefined();
      }
      await act(async () => root.unmount());
      root = createRoot(host);
      for (const [theme, image] of [['light', '07'], ['dark', '08']] as const) {
        await show(theme);
        expect(state![2]).toBe(false);
        await act(async () => state![3](true));
        expect(state![0]).toBe(image);
        expect(state![2]).toBe(true);
      }
    } finally {
      await act(async () => root.unmount());
    }
  });
});
