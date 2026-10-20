import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('public Douyin route restriction in native runtimes', () => {
  it('routes legacy links by their destination, retains unsupported options and permits retry after navigation failure', async () => {
    const result = await build({
      stdin: { contents: "export * from './src/lib/web-view-page';", resolveDir: process.cwd(), loader: 'ts' },
      bundle: true, write: false, format: 'iife', globalName: 'page', platform: 'browser',
      define: { __MINI_PROGRAM_TARGET__: JSON.stringify('douyin') },
    });
    const redirectTo = vi.fn(), switchTab = vi.fn(), request = vi.fn();
    const app: { nativeTimerLink?: unknown } = {};
    const sandbox = { getApp: () => app, tt: { getStorageSync: () => '', getAppBaseInfo: () => ({ language: 'zh_CN' }), redirectTo, switchTab, request },
      page: undefined, setTimeout, clearTimeout };
    runInNewContext(result.outputFiles[0]!.text, sandbox);
    const module = sandbox.page as unknown as typeof import('../src/lib/web-view-page');
    const adapter = module.createWebViewPageOptions();
    const context = { data: module.createWebViewPageData(), setData(value: object) { Object.assign(this.data, value); } };
    const open = (options: Record<string, string>) => adapter.onLoad!.call(context as never, options);
    open({ key: 'home', path: encodeURIComponent('/zh/contact') });
    expect(redirectTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/contact/index' }));
    expect(context.data.src).toBe('');
    redirectTo.mock.calls[0][0].fail();
    expect(context.data.canRetry).toBe(true);
    await module.openWebRoute(context, context.data.routeKey);
    expect(redirectTo).toHaveBeenCalledTimes(2);
    redirectTo.mock.calls[0][0].fail();
    expect(context.data.canRetry).toBe(false);
    open({ key: 'home', path: '/zh/timer' });
    expect(switchTab).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/timer/index' }));
    switchTab.mockClear();
    open({ nativeTab: 'timer', path: encodeURIComponent('/zh/timer?event=222&scramble=R') });
    expect(switchTab).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/timer/index' }));
    expect(app.nativeTimerLink).toEqual({ event: '222', scramble: 'R' });
    switchTab.mock.calls[0][0].fail();
    expect(app.nativeTimerLink).toBeUndefined();
    switchTab.mockClear();
    open({ nativeTab: 'timer', path: encodeURIComponent('/zh/timer?event=222&unknown=1') });
    expect(switchTab).not.toHaveBeenCalled();
    expect(context.data.errorMessage).toContain('参数');
    expect(context.data.src).toBe('');
    expect(request).not.toHaveBeenCalled();
    open({ key: 'privacy' });
    expect(redirectTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/privacy/index' }));
  });
  it('shares the native BLE session between independently bundled pages', async () => {
    const result = await build({
      stdin: { contents: "export { getSmartCubeSession } from './src/lib/smart-cube/session';", resolveDir: process.cwd(), loader: 'ts' },
      bundle: true, write: false, format: 'iife', globalName: 'page', platform: 'browser',
      define: { __MINI_PROGRAM_TARGET__: JSON.stringify('douyin') },
    });
    const app = {};
    const load = () => {
      const sandbox = { getApp: () => app, page: undefined };
      runInNewContext(result.outputFiles[0]!.text, sandbox);
      return sandbox.page as unknown as typeof import('../src/lib/smart-cube/session');
    };
    const timer = load(), picker = load();
    expect(timer.getSmartCubeSession()).toBe(picker.getSmartCubeSession());
  });
  it.each(['wechat', 'douyin'])('resolves routes in %s without browser URL globals', async target => {
    const result = await build({
      stdin: { contents: "export * from './src/lib/web-routes';", resolveDir: process.cwd(), loader: 'ts' },
      bundle: true, write: false, format: 'iife', globalName: 'routes', platform: 'browser',
      define: { __MINI_PROGRAM_TARGET__: JSON.stringify(target) },
    });
    const native = { getStorageSync: () => '', getAppBaseInfo: () => ({ language: 'zh_CN' }) };
    const sandbox = { wx: native, tt: native, routes: undefined };
    runInNewContext(result.outputFiles[0]!.text, sandbox);
    const routes = sandbox.routes as unknown as typeof import('../src/lib/web-routes');
    expect(routes.resolveWebRoute('timer')?.path).toBe('/zh/timer');
    expect(routes.resolveWebRoute('home')?.path).toBe('/zh');
    if (target === 'douyin') {
      expect(routes.resolveWebRoute('contact')?.path).toBe('/zh/contact');
      expect(routes.resolveWebRouteShare('home', '/zh/contact')?.path).toBe('/pages/contact/index');
      expect(routes.resolveWebRouteShare('home', '/zh/timer')?.path).toBe('/pages/timer/index');
      expect(routes.resolveWebRouteShare('home', '/zh/timer?event=222')?.path).toContain('path=%2Fzh%2Ftimer%3Fevent%3D222');
      expect(routes.resolveWebRoute('training')).toBeNull();
      expect(routes.resolveWebRoute('home', '/zh/timer?training=home')).toBeNull();
      expect(routes.resolveWebRouteShare('home', '/zh/alg/3x3/oll/run')).toBeNull();
      expect(routes.listWebTools().some(tool => tool.href.startsWith('/alg'))).toBe(false);
    } else {
      expect(routes.resolveWebRoute('training')?.path).toBe('/zh/learn');
      expect(routes.resolveWebRoute('home', '/zh/timer?training=home')).not.toBeNull();
    }
  });
});
