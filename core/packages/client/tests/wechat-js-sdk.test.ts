import { afterEach, describe, expect, it, vi } from 'vitest';

interface FakeScript {
  async?: boolean;
  onerror?: ((event: Event) => void) | null;
  onload?: ((event: Event) => void) | null;
  remove: ReturnType<typeof vi.fn>;
  src?: string;
}

function stubSdkDom(scripts: FakeScript[]): ReturnType<typeof vi.fn> {
  const appendChild = vi.fn((script: FakeScript) => script);
  vi.stubGlobal('window', {
    clearTimeout,
    setTimeout,
  });
  vi.stubGlobal('document', {
    createElement: vi.fn(() => {
      const script: FakeScript = { remove: vi.fn() };
      scripts.push(script);
      return script;
    }),
    head: { appendChild },
  });
  return appendChild;
}

describe('shared WeChat JS-SDK loader', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('shares one script load across bridge and sharing callers', async () => {
    const scripts: FakeScript[] = [];
    const appendChild = stubSdkDom(scripts);
    const {
      loadWeChatJsSdk,
      supportsWeChatMiniProgramNavigation,
      supportsWeChatShare,
    } = await import('@/lib/wechat-js-sdk');

    const sharing = loadWeChatJsSdk(supportsWeChatShare);
    const bridge = loadWeChatJsSdk(supportsWeChatMiniProgramNavigation);
    expect(appendChild).toHaveBeenCalledOnce();

    const sdk = {
      config: vi.fn(),
      ready: vi.fn(),
      error: vi.fn(),
      updateAppMessageShareData: vi.fn(),
      updateTimelineShareData: vi.fn(),
      miniProgram: { navigateTo: vi.fn() },
    };
    window.wx = sdk;
    scripts[0].onload?.(new Event('load'));

    await expect(sharing).resolves.toBe(sdk);
    await expect(bridge).resolves.toBe(sdk);
    expect(scripts[0].remove).toHaveBeenCalledOnce();
  });

  it('uses the jWeixin alias injected by the DevTools web-view', async () => {
    const scripts: FakeScript[] = [];
    const appendChild = stubSdkDom(scripts);
    const { loadWeChatJsSdk, supportsWeChatMiniProgramNavigation } = await import(
      '@/lib/wechat-js-sdk'
    );
    const sdk = {
      config: vi.fn(),
      ready: vi.fn(),
      error: vi.fn(),
      updateAppMessageShareData: vi.fn(),
      updateTimelineShareData: vi.fn(),
      miniProgram: { navigateTo: vi.fn() },
    };
    window.jWeixin = sdk;

    await expect(loadWeChatJsSdk(supportsWeChatMiniProgramNavigation)).resolves.toBe(sdk);
    expect(window.wx).toBeUndefined();
    expect(appendChild).not.toHaveBeenCalled();
  });

  it('preserves split aliases with different capabilities', async () => {
    const scripts: FakeScript[] = [];
    const appendChild = stubSdkDom(scripts);
    const {
      loadWeChatJsSdk,
      supportsWeChatMiniProgramNavigation,
    } = await import('@/lib/wechat-js-sdk');
    const sharingSdk = {
      config: vi.fn(),
      ready: vi.fn(),
      error: vi.fn(),
      updateAppMessageShareData: vi.fn(),
      updateTimelineShareData: vi.fn(),
    };
    const bridgeSdk = {
      ...sharingSdk,
      miniProgram: { navigateTo: vi.fn() },
    };
    window.wx = sharingSdk;
    window.jWeixin = bridgeSdk;

    await expect(loadWeChatJsSdk(supportsWeChatMiniProgramNavigation)).resolves.toBe(bridgeSdk);
    expect(window.wx).toBe(sharingSdk);
    expect(window.jWeixin).toBe(bridgeSdk);
    expect(appendChild).not.toHaveBeenCalled();
  });

  it('recovers when the loaded script populates only jWeixin', async () => {
    const scripts: FakeScript[] = [];
    stubSdkDom(scripts);
    const { loadWeChatJsSdk, supportsWeChatMiniProgramNavigation } = await import(
      '@/lib/wechat-js-sdk'
    );
    const sdk = {
      config: vi.fn(),
      ready: vi.fn(),
      error: vi.fn(),
      updateAppMessageShareData: vi.fn(),
      updateTimelineShareData: vi.fn(),
      miniProgram: { navigateTo: vi.fn() },
    };

    const pending = loadWeChatJsSdk(supportsWeChatMiniProgramNavigation);
    window.jWeixin = sdk;
    scripts[0].onload?.(new Event('load'));

    await expect(pending).resolves.toBe(sdk);
    expect(window.wx).toBeUndefined();
  });

  it('loads past an unsupported jWeixin alias', async () => {
    const scripts: FakeScript[] = [];
    stubSdkDom(scripts);
    const { loadWeChatJsSdk, supportsWeChatMiniProgramNavigation } = await import(
      '@/lib/wechat-js-sdk'
    );
    const incompleteSdk = {
      config: vi.fn(),
      ready: vi.fn(),
      error: vi.fn(),
      updateAppMessageShareData: vi.fn(),
      updateTimelineShareData: vi.fn(),
    };
    const completeSdk = {
      ...incompleteSdk,
      miniProgram: { navigateTo: vi.fn() },
    };
    window.jWeixin = incompleteSdk;

    const pending = loadWeChatJsSdk(supportsWeChatMiniProgramNavigation);
    expect(window.jWeixin).toBeUndefined();
    window.wx = completeSdk;
    window.jWeixin = completeSdk;
    scripts[0].onload?.(new Event('load'));

    await expect(pending).resolves.toBe(completeSdk);
  });

  it('cleans up a timed-out script and permits a later retry', async () => {
    vi.useFakeTimers();
    const scripts: FakeScript[] = [];
    const appendChild = stubSdkDom(scripts);
    const { loadWeChatJsSdk, supportsWeChatMiniProgramNavigation } = await import(
      '@/lib/wechat-js-sdk'
    );

    const first = loadWeChatJsSdk(supportsWeChatMiniProgramNavigation);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(first).resolves.toBeNull();
    expect(scripts[0].remove).toHaveBeenCalledOnce();

    const second = loadWeChatJsSdk(supportsWeChatMiniProgramNavigation);
    expect(appendChild).toHaveBeenCalledTimes(2);
    const sdk = {
      config: vi.fn(),
      ready: vi.fn(),
      error: vi.fn(),
      updateAppMessageShareData: vi.fn(),
      updateTimelineShareData: vi.fn(),
      miniProgram: { navigateTo: vi.fn() },
    };
    window.wx = sdk;
    scripts[1].onload?.(new Event('load'));

    await expect(second).resolves.toBe(sdk);
  });
});
