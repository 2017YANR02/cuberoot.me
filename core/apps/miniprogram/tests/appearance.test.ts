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
    const setStorageSync = vi.fn();
    vi.stubGlobal('getCurrentPages', () => [{ setData }]);
    vi.stubGlobal('wx', { getStorageSync: () => null, setStorageSync,
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
});
