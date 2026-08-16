import { afterEach, describe, expect, it, vi } from 'vitest';

interface MiniProgramApp {
  onLaunch?(): void;
}

async function loadApp(wxApi: Record<string, unknown>): Promise<MiniProgramApp> {
  let app: MiniProgramApp | undefined;
  vi.stubGlobal('wx', wxApi);
  vi.stubGlobal('App', (options: MiniProgramApp) => {
    app = options;
  });
  await import('../src/app');
  if (!app) throw new Error('mini program app was not registered');
  return app;
}

describe('mini program app updates', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('keeps launching when the base library has no update manager', async () => {
    const app = await loadApp({});

    expect(() => app.onLaunch?.()).not.toThrow();
  });

  it('keeps launching when update-manager setup throws', async () => {
    const app = await loadApp({
      getUpdateManager() {
        throw new Error('update manager unavailable');
      },
    });

    expect(() => app.onLaunch?.()).not.toThrow();
  });

  it('lets the user apply a downloaded release update', async () => {
    let ready: (() => void) | undefined;
    const applyUpdate = vi.fn();
    const showModal = vi.fn((options: { success(result: { confirm: boolean }): void }) => {
      options.success({ confirm: true });
    });
    const app = await loadApp({
      getUpdateManager: () => ({
        applyUpdate,
        onUpdateFailed: vi.fn(),
        onUpdateReady(callback: () => void) {
          ready = callback;
        },
      }),
      showModal,
      showToast: vi.fn(),
    });

    app.onLaunch?.();
    ready?.();

    expect(showModal).toHaveBeenCalledWith(expect.objectContaining({
      title: '新版本已准备好',
      confirmText: '立即重启',
      cancelText: '稍后',
    }));
    expect(applyUpdate).toHaveBeenCalledOnce();
  });

  it('does not interrupt the current session when the user postpones an update', async () => {
    let ready: (() => void) | undefined;
    const applyUpdate = vi.fn();
    const app = await loadApp({
      getUpdateManager: () => ({
        applyUpdate,
        onUpdateFailed: vi.fn(),
        onUpdateReady(callback: () => void) {
          ready = callback;
        },
      }),
      showModal(options: { success(result: { confirm: boolean }): void }) {
        options.success({ confirm: false });
      },
      showToast: vi.fn(),
    });

    app.onLaunch?.();
    ready?.();

    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it('shows one prompt when the platform repeats the same ready event', async () => {
    let ready: (() => void) | undefined;
    let modalOptions: { success(result: { confirm: boolean }): void } | undefined;
    const applyUpdate = vi.fn();
    const showModal = vi.fn((options: typeof modalOptions) => {
      modalOptions = options;
    });
    const app = await loadApp({
      getUpdateManager: () => ({
        applyUpdate,
        onUpdateFailed: vi.fn(),
        onUpdateReady(callback: () => void) {
          ready = callback;
        },
      }),
      showModal,
      showToast: vi.fn(),
    });

    app.onLaunch?.();
    ready?.();
    ready?.();

    expect(showModal).toHaveBeenCalledOnce();

    modalOptions?.success({ confirm: true });
    modalOptions?.success({ confirm: true });

    expect(applyUpdate).toHaveBeenCalledOnce();
  });

  it('allows a later ready event to retry after the update prompt fails', async () => {
    let ready: (() => void) | undefined;
    const showModal = vi.fn((options: { fail(): void }) => options.fail());
    const app = await loadApp({
      getUpdateManager: () => ({
        applyUpdate: vi.fn(),
        onUpdateFailed: vi.fn(),
        onUpdateReady(callback: () => void) {
          ready = callback;
        },
      }),
      showModal,
      showToast: vi.fn(),
    });

    app.onLaunch?.();
    ready?.();
    ready?.();

    expect(showModal).toHaveBeenCalledTimes(2);
  });

  it('allows a later ready event to retry when the platform swallows the prompt callbacks', async () => {
    vi.useFakeTimers();
    let ready: (() => void) | undefined;
    const showModal = vi.fn();
    const app = await loadApp({
      getUpdateManager: () => ({
        applyUpdate: vi.fn(),
        onUpdateFailed: vi.fn(),
        onUpdateReady(callback: () => void) {
          ready = callback;
        },
      }),
      showModal,
      showToast: vi.fn(),
    });

    app.onLaunch?.();
    ready?.();
    ready?.();
    expect(showModal).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(5_000);
    ready?.();

    expect(showModal).toHaveBeenCalledTimes(2);
  });

  it('ignores stale callbacks after a newer update prompt starts', async () => {
    let ready: (() => void) | undefined;
    const prompts: Array<{
      fail(): void;
      success(result: { confirm: boolean }): void;
    }> = [];
    const applyUpdate = vi.fn();
    const showModal = vi.fn((options: (typeof prompts)[number]) => {
      prompts.push(options);
    });
    const app = await loadApp({
      getUpdateManager: () => ({
        applyUpdate,
        onUpdateFailed: vi.fn(),
        onUpdateReady(callback: () => void) {
          ready = callback;
        },
      }),
      showModal,
      showToast: vi.fn(),
    });

    app.onLaunch?.();
    ready?.();
    prompts[0]?.fail();
    ready?.();

    prompts[0]?.fail();
    ready?.();
    prompts[0]?.success({ confirm: true });

    expect(showModal).toHaveBeenCalledTimes(2);
    expect(applyUpdate).not.toHaveBeenCalled();

    prompts[1]?.success({ confirm: true });

    expect(applyUpdate).toHaveBeenCalledOnce();
  });

  it('keeps the current version usable when the update prompt throws', async () => {
    let ready: (() => void) | undefined;
    const app = await loadApp({
      getUpdateManager: () => ({
        applyUpdate: vi.fn(),
        onUpdateFailed: vi.fn(),
        onUpdateReady(callback: () => void) {
          ready = callback;
        },
      }),
      showModal() {
        throw new Error('modal unavailable');
      },
    });
    app.onLaunch?.();

    expect(() => ready?.()).not.toThrow();
  });

  it('shows a non-blocking message when an update cannot be downloaded', async () => {
    let failed: (() => void) | undefined;
    const showToast = vi.fn();
    const app = await loadApp({
      getUpdateManager: () => ({
        applyUpdate: vi.fn(),
        onUpdateFailed(callback: () => void) {
          failed = callback;
        },
        onUpdateReady: vi.fn(),
      }),
      showModal: vi.fn(),
      showToast,
    });

    app.onLaunch?.();
    failed?.();
    failed?.();

    expect(showToast).toHaveBeenCalledWith({
      title: '更新失败，请稍后重试',
      icon: 'none',
    });
    expect(showToast).toHaveBeenCalledOnce();
  });

  it('allows a later failure event to retry when the toast throws', async () => {
    let failed: (() => void) | undefined;
    const showToast = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('toast unavailable');
      })
      .mockImplementationOnce(() => undefined);
    const app = await loadApp({
      getUpdateManager: () => ({
        applyUpdate: vi.fn(),
        onUpdateFailed(callback: () => void) {
          failed = callback;
        },
        onUpdateReady: vi.fn(),
      }),
      showModal: vi.fn(),
      showToast,
    });

    app.onLaunch?.();

    expect(() => failed?.()).not.toThrow();
    expect(() => failed?.()).not.toThrow();
    expect(showToast).toHaveBeenCalledTimes(2);
  });
});
