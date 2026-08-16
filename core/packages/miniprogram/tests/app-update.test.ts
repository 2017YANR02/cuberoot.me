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

    expect(showToast).toHaveBeenCalledWith({
      title: '更新失败，请稍后重试',
      icon: 'none',
    });
  });
});
