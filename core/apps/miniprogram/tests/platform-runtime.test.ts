import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { beforeAll, describe, expect, it, vi } from 'vitest';

type Target = 'wechat' | 'douyin';
type Runtime = typeof import('../src/lib/platform') & typeof import('../src/lib/auth')
  & typeof import('../src/lib/share');
const bundles = {} as Record<Target, string>;

beforeAll(async () => {
  for (const target of ['wechat', 'douyin'] as const) {
    const result = await build({
      stdin: {
        contents: "export * from './src/lib/platform'; export * from './src/lib/auth'; export * from './src/lib/share';",
        resolveDir: process.cwd(),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'miniRuntime',
      platform: 'browser',
      target: 'chrome91',
      minify: true,
      define: { __MINI_PROGRAM_TARGET__: JSON.stringify(target) },
    });
    bundles[target] = result.outputFiles[0]!.text;
  }
});

function load(target: Target, globals: Record<string, unknown>): Runtime {
  const sandbox = { globalThis: undefined, ...globals, miniRuntime: undefined };
  runInNewContext(bundles[target], sandbox);
  return sandbox.miniRuntime as unknown as Runtime;
}

describe('bundled native Mini Program runtime without globalThis', () => {
  it.each(['wechat', 'douyin'] as const)('uses the injected %s API', (target) => {
    const native = {};
    expect(load(target, { [target === 'douyin' ? 'tt' : 'wx']: native }).miniProgramApi()).toBe(native);
  });

  it.each(['wechat', 'douyin'] as const)('does not borrow the other platform API for %s', (target) => {
    expect(() => load(target, { [target === 'douyin' ? 'wx' : 'tt']: {} }).miniProgramApi())
      .toThrow(`${target} Mini Program API unavailable`);
  });

  it.each(['wechat', 'douyin'] as const)('uses native share menu names in the %s bundle', (target) => {
    const showShareMenu = vi.fn();
    const hideShareMenu = vi.fn();
    const runtime = load(target, { [target === 'douyin' ? 'tt' : 'wx']: { showShareMenu, hideShareMenu } });

    runtime.showFriendShareMenu();
    runtime.showPublicShareMenu();
    runtime.hidePublicShareMenu();

    expect(showShareMenu).toHaveBeenNthCalledWith(1, {
      menus: target === 'douyin' ? ['share'] : ['shareAppMessage'],
    });
    expect(showShareMenu).toHaveBeenNthCalledWith(2, {
      menus: target === 'douyin' ? ['share'] : ['shareAppMessage', 'shareTimeline'],
    });
    expect(hideShareMenu).toHaveBeenCalledWith({
      menus: target === 'douyin' ? ['share'] : ['shareAppMessage', 'shareTimeline'],
    });
  });

  it.each(['wechat', 'douyin'] as const)('survives missing or throwing optional share APIs on %s', (target) => {
    for (const native of [undefined, {}, {
      showShareMenu() { throw new Error('unavailable'); },
      hideShareMenu() { throw new Error('unavailable'); },
    }]) {
      const runtime = load(target, { [target === 'douyin' ? 'tt' : 'wx']: native });
      expect(() => runtime.showFriendShareMenu()).not.toThrow();
      expect(() => runtime.showPublicShareMenu()).not.toThrow();
      expect(() => runtime.hidePublicShareMenu()).not.toThrow();
    }
  });

  it('treats an absent Douyin session key as signed out without reading or deleting it', () => {
    const getStorageSync = vi.fn(() => { throw new Error('data not found'); });
    const removeStorageSync = vi.fn();
    const runtime = load('douyin', { tt: {
      getStorageInfoSync: () => ({ keys: [] }), getStorageSync, removeStorageSync,
    } });
    expect(runtime.getStoredSessionSnapshot()).toEqual({ status: 'available', session: null });
    expect(getStorageSync).not.toHaveBeenCalled();
    expect(removeStorageSync).not.toHaveBeenCalled();
  });

  it('retains a valid Douyin session', () => {
    const session = { token: 't'.repeat(32), user: { uid: 42, name: 'CubeRoot', wcaId: null } };
    const getStorageSync = vi.fn(() => session);
    const runtime = load('douyin', { tt: {
      getStorageInfoSync: () => ({ keys: ['cuberoot:session'] }), getStorageSync,
    } });
    expect(runtime.getStoredSessionSnapshot()).toEqual({ status: 'available', session });
    expect(getStorageSync).toHaveBeenCalledWith('cuberoot:session');
  });

  it.each(['inventory', 'read', 'cleanup'])('keeps the protective state on Douyin %s failure', (failure) => {
    const runtime = load('douyin', { tt: {
      getStorageInfoSync() {
        if (failure === 'inventory') throw new Error('storage unavailable');
        return { keys: ['cuberoot:session'] };
      },
      getStorageSync() {
        if (failure === 'read') throw new Error('storage unavailable');
        return { token: 'invalid' };
      },
      removeStorageSync() { throw new Error('cleanup failed'); },
    } });
    expect(runtime.getStoredSessionSnapshot()).toEqual({ status: 'unavailable', session: null });
  });

  it('retains the WeChat missing-key contract without requesting a storage inventory', () => {
    const runtime = load('wechat', { wx: { getStorageSync: () => '' } });
    expect(runtime.getStoredSessionSnapshot()).toEqual({ status: 'available', session: null });
  });
});
