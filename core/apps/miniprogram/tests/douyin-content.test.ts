import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

describe('public Douyin route restriction in native runtimes', () => {
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
