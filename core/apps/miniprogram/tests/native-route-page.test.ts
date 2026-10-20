import { afterEach, expect, it, vi } from 'vitest';
import { createNativeRoutePageOptions } from '../src/lib/native-route-page';
vi.mock('../src/lib/appearance', () => ({ applyNativeAppearance: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const redirectTo = vi.fn(), switchTab = vi.fn(), request = vi.fn();
  vi.stubGlobal('wx', { redirectTo, switchTab, request, getStorageSync: () => 'en' });
  const options = createNativeRoutePageOptions();
  const page = { ...options, data: { ...options.data }, setData(value: object) { Object.assign(this.data, value); } };
  return { page, redirectTo, switchTab, request };
}
it.each([
  [{ key: 'account' }, '/pages/account-settings/index'],
  [{ key: 'account-link' }, '/pages/account-link/index'],
  [{ path: encodeURIComponent('/zh/account?view=signin&mini_program=login') }, '/pages/account-link/index'],
  [{ path: '/privacy' }, '/pages/privacy/index'],
])('redirects old links to native destinations: %j', (query, url) => {
  const { page, redirectTo, request } = fixture();
  page.onLoad(query);
  expect(redirectTo).toHaveBeenCalledWith(expect.objectContaining({ url }));
  expect(request).not.toHaveBeenCalled();
  expect(page.data).not.toHaveProperty('src');
});
it('rejects unsupported link state instead of losing its parameters or loading a website', () => {
  const { page, redirectTo, switchTab, request } = fixture();
  page.onLoad({ path: '/account?unknown=value', key: 'account' });
  expect(page.data.error).not.toBe('');
  expect(redirectTo).not.toHaveBeenCalled();
  expect(switchTab).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});
it('retries navigation failures and ignores stale callbacks after leaving', () => {
  const { page, redirectTo } = fixture();
  page.onLoad({ key: 'account' });
  const fail = redirectTo.mock.calls[0][0].fail;
  fail();
  expect(page.data.canRetry).toBe(true);
  page.navigate();
  page.onHide();
  redirectTo.mock.calls[1][0].fail();
  expect(page.data.canRetry).toBe(false);
});
