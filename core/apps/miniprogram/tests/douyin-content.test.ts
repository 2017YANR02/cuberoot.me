import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

describe('public Douyin route restriction in native runtimes', () => {
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
