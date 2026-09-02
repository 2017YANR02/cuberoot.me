import { afterEach, describe, expect, it, vi } from 'vitest';

type SnapshotPhase = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

interface Snapshot {
  phase: SnapshotPhase;
  brand: string;
  deviceName: string;
  battery: number | null;
  error: string;
  lastMove: string;
}

interface SmartCubePage {
  data: Record<string, unknown>;
  onLoad(options: { token?: string }): void;
  onUnload(): void;
  retryConnection(): void;
  returnToTimer(): void;
  setData(data: Record<string, unknown>): void;
}

const idleSnapshot: Snapshot = {
  phase: 'idle',
  brand: '',
  deviceName: '',
  battery: null,
  error: '',
  lastMove: '',
};

async function loadPage(
  navigateBack: ReturnType<typeof vi.fn>,
  initialSnapshot: Snapshot = idleSnapshot,
  connectAutomatically?: ReturnType<typeof vi.fn<() => Promise<void>>>,
  storedSession: unknown = {
    token: 't'.repeat(20),
    user: { uid: 42, name: 'CubeRoot user', wcaId: null, avatar: '' },
  },
) {
  let page: SmartCubePage | undefined;
  let listener: ((snapshot: Snapshot) => void) | undefined;
  const connectAutomaticallyMock = connectAutomatically ?? vi.fn(async (): Promise<void> => {
    listener?.(connectedSnapshot());
  });
  const session = {
    connect: vi.fn(async () => undefined),
    connectAutomatically: connectAutomaticallyMock,
    disconnect: vi.fn(async () => undefined),
    simulateMove: vi.fn(),
    start: vi.fn(async () => undefined),
    subscribe: vi.fn((nextListener: (snapshot: Snapshot) => void) => {
      listener = nextListener;
      nextListener(initialSnapshot);
      return vi.fn();
    }),
  };

  vi.doMock('../src/lib/smart-cube/session', () => ({ smartCubeSession: session }));
  const switchTab = vi.fn();
  vi.stubGlobal('wx', {
    getDeviceInfo: () => ({ platform: 'ios' }),
    getStorageSync: () => storedSession,
    navigateBack,
    removeStorageSync: vi.fn(),
    switchTab,
  });
  vi.stubGlobal('Page', (options: SmartCubePage) => {
    page = options;
  });

  await import('../src/pages/smart-cube/index');
  if (!page) throw new Error('smart-cube page was not registered');
  page.setData = function setData(data) {
    this.data = { ...this.data, ...data };
  };

  return {
    emit(snapshot: Snapshot) {
      if (!listener) throw new Error('smart-cube session was not subscribed');
      listener(snapshot);
    },
    page,
    session,
    switchTab,
  };
}

function connectedSnapshot(battery: number | null = null): Snapshot {
  return {
    ...idleSnapshot,
    phase: 'connected',
    brand: 'gan',
    deviceName: 'GAN16ui_C296',
    battery,
  };
}

describe('native smart-cube page', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns to the website timer immediately after a relayed connection succeeds', async () => {
    vi.useFakeTimers();
    const navigateBack = vi.fn();
    const { emit, page } = await loadPage(navigateBack);

    page.onLoad({ token: 'relay-token' });
    await vi.waitFor(() => expect(navigateBack).toHaveBeenCalledTimes(1));
    emit(connectedSnapshot(100));

    expect(navigateBack).toHaveBeenCalledTimes(1);
    expect(navigateBack).toHaveBeenCalledWith({ fail: expect.any(Function) });
    page.onUnload();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('opens the existing account login before starting Bluetooth when signed out', async () => {
    const navigateBack = vi.fn();
    const { page, session, switchTab } = await loadPage(
      navigateBack,
      idleSnapshot,
      undefined,
      null,
    );

    page.onLoad({ token: 'relay token' });

    expect(switchTab).toHaveBeenCalledWith({ url: '/pages/account/index' });
    expect(session.subscribe).not.toHaveBeenCalled();
    expect(session.start).not.toHaveBeenCalled();
    expect(session.connectAutomatically).not.toHaveBeenCalled();
  });

  it('keeps the success page when it was not opened by the website relay', async () => {
    const navigateBack = vi.fn();
    const { page } = await loadPage(navigateBack);

    page.onLoad({});
    await vi.waitFor(() => expect(page.data.phase).toBe('idle'));

    expect(navigateBack).not.toHaveBeenCalled();
  });

  it('does not return for a stale connected snapshot before this attempt completes', async () => {
    let finishConnection!: () => void;
    const connectAutomatically = vi.fn(() => new Promise<void>((resolve) => {
      finishConnection = resolve;
    }));
    const navigateBack = vi.fn();
    const { emit, page } = await loadPage(
      navigateBack,
      connectedSnapshot(100),
      connectAutomatically,
    );

    page.onLoad({ token: 'relay-token' });
    await vi.waitFor(() => expect(connectAutomatically).toHaveBeenCalledOnce());
    expect(navigateBack).not.toHaveBeenCalled();

    emit({ ...idleSnapshot, phase: 'scanning' });
    emit(connectedSnapshot(100));
    finishConnection();
    await vi.waitFor(() => expect(navigateBack).toHaveBeenCalledOnce());
  });

  it('does not return when an existing scan finishes the call without connecting', async () => {
    const connectAutomatically = vi.fn(async (): Promise<void> => {});
    const navigateBack = vi.fn();
    const { page } = await loadPage(
      navigateBack,
      { ...idleSnapshot, phase: 'scanning' },
      connectAutomatically,
    );

    page.onLoad({ token: 'relay-token' });
    await vi.waitFor(() => expect(connectAutomatically).toHaveBeenCalledOnce());

    expect(navigateBack).not.toHaveBeenCalled();
  });

  it('stays on the native page when the connected status cannot reach the timer', async () => {
    const connectAutomatically = vi.fn(async () => {
      throw new Error('无法向计时器发送智能魔方数据，请返回重试');
    });
    const navigateBack = vi.fn();
    const { page } = await loadPage(navigateBack, idleSnapshot, connectAutomatically);

    page.onLoad({ token: 'relay-token' });
    await vi.waitFor(() => expect(page.data.error).toBe(
      '无法向计时器发送智能魔方数据，请返回重试',
    ));

    expect(navigateBack).not.toHaveBeenCalled();
  });

  it('keeps manual return available when automatic navigation fails', async () => {
    const navigateBack = vi.fn((options: { fail?(): void }) => options.fail?.());
    const { page } = await loadPage(navigateBack);

    page.onLoad({ token: 'relay-token' });
    await vi.waitFor(() => expect(navigateBack).toHaveBeenCalledOnce());
    page.returnToTimer();

    expect(navigateBack).toHaveBeenCalledTimes(2);
  });
});
