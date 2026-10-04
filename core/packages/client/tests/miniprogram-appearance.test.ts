// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
const postMessage = vi.hoisted(() => vi.fn());
vi.mock('@/lib/miniprogram-bridge', () => ({
  mayUseMiniProgramBridge: () => true,
  loadMiniProgramNavigationApi: async () => ({ postMessage }),
  confirmMiniProgramEnvironment: async () => true,
}));
afterEach(() => { vi.resetModules(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); postMessage.mockClear(); });
it('publishes both saved backgrounds, auto resolution, background-only changes and removal', async () => {
  window.history.replaceState(null, '', '/zh');
  localStorage.setItem('theme', 'dark');
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.removeAttribute('data-palette');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect() {}, fillRect() {}, getImageData: () => ({ data: [23, 23, 23, 255] }),
  } as never);
  const { syncMiniProgramAppearance } = await import('@/lib/miniprogram-appearance');
  localStorage.setItem('home-background.v1.light', '07');
  localStorage.setItem('home-background.v1.dark', 'auto');
  await syncMiniProgramAppearance();
  expect(postMessage.mock.lastCall?.[0].data.backgrounds).toEqual({
    light: { id: '07', position: '75%' }, dark: { id: '03', position: '50%' },
  });
  localStorage.setItem('home-background.v1.dark', '08');
  await syncMiniProgramAppearance();
  expect(postMessage.mock.lastCall?.[0].data.backgrounds.dark).toEqual({ id: '08', position: '30%' });
  localStorage.setItem('home-background.v1.dark', 'none');
  await syncMiniProgramAppearance();
  expect(postMessage.mock.lastCall?.[0].data.backgrounds.dark).toBeNull();
  expect(postMessage).toHaveBeenCalledTimes(3);
});
