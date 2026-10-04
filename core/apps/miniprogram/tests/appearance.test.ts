import { afterEach, describe, expect, it, vi } from 'vitest';
import { NATIVE_APPEARANCE_TOKENS, decodeNativeAppearance, type NativeAppearance } from '@cuberoot/shared/appearance';

function appearance(): NativeAppearance {
  return { type: 'cuberoot:appearance', scheme: 'dark', followSystem: false,
    colors: Object.fromEntries(Object.keys(NATIVE_APPEARANCE_TOKENS).map((key) => [key, '#142b32'])) as NativeAppearance['colors'] };
}
afterEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });

describe('native appearance', () => {
  it('validates the complete color boundary and rejects CSS injection', () => {
    const value = appearance();
    expect(decodeNativeAppearance(value)).toEqual(value);
    expect(decodeNativeAppearance({ ...value, colors: {} })).toBeNull();
    value.colors['--cr-bg'] = 'red;background:url(https://example.com)';
    expect(decodeNativeAppearance(value)).toBeNull();
  });
  it('persists and applies the latest WebView appearance to existing pages and native chrome', async () => {
    const setData = vi.fn();
    const setTabBarStyle = vi.fn();
    const setNavigationBarColor = vi.fn();
    let stored: unknown = null;
    const setStorageSync = vi.fn((_key: string, value: unknown) => { stored = value; });
    vi.stubGlobal('getCurrentPages', () => [{ setData }]);
    vi.stubGlobal('wx', { getStorageSync: () => stored, setStorageSync,
      getSystemInfoSync: () => ({ theme: 'light' }), setTabBarStyle, setNavigationBarColor, setBackgroundColor: vi.fn() });
    const { receiveNativeAppearance, nativeAppearanceStyle } = await import('../src/lib/appearance');
    receiveNativeAppearance(appearance());
    expect(setStorageSync).toHaveBeenCalledWith('cuberoot.appearance.v1', appearance());
    expect(nativeAppearanceStyle()).toContain('--cr-bg:#142b32');
    expect(setData).toHaveBeenCalledWith({ appearanceStyle: nativeAppearanceStyle() });
    expect(setNavigationBarColor).toHaveBeenLastCalledWith({ backgroundColor: '#142b32', frontColor: '#ffffff' });
    expect(setTabBarStyle).toHaveBeenLastCalledWith({ backgroundColor: '#142b32', color: '#142b32', selectedColor: '#142b32', borderStyle: 'black' });
    receiveNativeAppearance({ ...appearance(), followSystem: true });
    expect(nativeAppearanceStyle()).toBe('');
    expect(setNavigationBarColor).toHaveBeenLastCalledWith({ backgroundColor: '#fafafa', frontColor: '#000000' });
  });

  it('refreshes an already loaded account bundle after the tools bundle saves a new appearance', async () => {
    let stored: unknown = null;
    const setData = vi.fn();
    vi.stubGlobal('getCurrentPages', () => [{ setData }]);
    vi.stubGlobal('wx', { getStorageSync: () => stored,
      setStorageSync: (_key: string, value: unknown) => { stored = value; },
      getAppBaseInfo: () => ({ theme: 'light' }), setTabBarStyle: vi.fn(),
      setNavigationBarColor: vi.fn(), setBackgroundColor: vi.fn() });
    // The build bundles each entry separately, so each page has its own module state.
    const account = await import('../src/lib/appearance');
    expect(account.nativeAppearanceStyle()).toBe('');
    vi.resetModules();
    const tools = await import('../src/lib/appearance');
    tools.receiveNativeAppearance(appearance());
    account.applyNativeAppearance();
    expect(account.nativeAppearanceStyle()).toContain('--cr-bg:#142b32');
    expect(setData).toHaveBeenLastCalledWith({ appearanceStyle: account.nativeAppearanceStyle() });
    tools.receiveNativeAppearance({ ...appearance(), followSystem: true });
    expect(account.nativeAppearanceStyle()).toBe('');
  });
});
