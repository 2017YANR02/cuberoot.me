import { createMiniProgramStackmatSource } from '@/app/[lang]/timer/_lib/bluetooth/timer/miniprogram';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { connectMiniProgramCubeBridge } from '@/app/[lang]/timer/_lib/bluetooth/miniprogram_bridge';
import { normalizeMiniProgramCubeBrand } from '@/app/[lang]/timer/_lib/bluetooth';

type Listener = (event: { data?: string; reason?: string }) => void;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instance: FakeWebSocket | null = null;
  static instances: FakeWebSocket[] = [];

  readonly sent: string[] = [];
  readyState = FakeWebSocket.CONNECTING;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {
    FakeWebSocket.instance = this;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  emitOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    for (const listener of this.listeners.get('open') ?? []) listener({});
  }

  emitMessage(data: unknown): void {
    const event = { data: JSON.stringify(data) };
    for (const listener of this.listeners.get('message') ?? []) listener(event);
  }

  emitClose(reason = ''): void {
    this.readyState = FakeWebSocket.CLOSED;
    for (const listener of this.listeners.get('close') ?? []) listener({ reason });
  }
}

interface MiniProgramNavigateOptions {
  url: string;
  fail?(error: { errMsg?: string }): void;
  success?(): void;
}

type MiniProgramNavigateTo = (options: MiniProgramNavigateOptions) => void;

function stubMiniProgram(navigateTo: MiniProgramNavigateTo = () => {}): void {
  vi.stubGlobal('window', {
    __wxjs_environment: 'miniprogram',
    clearTimeout,
    navigator: { userAgent: 'MicroMessenger miniProgram' },
    setTimeout,
    wx: { miniProgram: { navigateTo } },
  });
  vi.stubGlobal('WebSocket', FakeWebSocket);
}

describe('mini-program smart-cube bridge', () => {
  it('correlates calibration ACKs, surfaces failures and cancels on relay loss without replay', async () => {
    stubMiniProgram();
    const onState = vi.fn(); const onMove = vi.fn();
    const pending = connectMiniProgramCubeBridge({ onBattery: vi.fn(), onGyro: vi.fn(), onMove, onState, onStatus: vi.fn() });
    await vi.waitFor(() => expect(FakeWebSocket.instance).not.toBeNull());
    const socket = FakeWebSocket.instance!; socket.emitOpen();
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    socket.emitMessage({ type: 'status', phase: 'connected', canResetDevice: true });
    const bridge = await pending; bridge.activate();
    let confirmed = false;
    const reset = bridge.resetDeviceState!().then(() => { confirmed = true; });
    const command = JSON.parse(socket.sent.at(-1)!);
    socket.emitMessage({ type: 'command-result', requestId: 'wrongrequest000000', ok: true });
    await Promise.resolve(); expect(confirmed).toBe(false);
    socket.emitMessage({ type: 'command-result', requestId: command.requestId, ok: true });
    await reset;
    socket.emitMessage({ type: 'state', facelets: 'U'.repeat(54), calibration: true, relaySeq: 1 });
    socket.emitMessage({ type: 'move', move: 'R', relaySeq: 2 });
    expect(onState).toHaveBeenCalledWith('U'.repeat(54), true);
    expect(onMove).toHaveBeenCalledOnce();
    const failure = expect(bridge.resetDeviceState!()).rejects.toThrow('hardware failure');
    const next = JSON.parse(socket.sent.at(-1)!);
    socket.emitMessage({ type: 'command-result', requestId: next.requestId, ok: false, error: 'hardware failure' });
    await failure;
    vi.useFakeTimers();
    const timedOut = expect(bridge.resetDeviceState!()).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(8000); await timedOut;
    vi.useRealTimers();
    const lost = expect(bridge.resetDeviceState!()).rejects.toThrow('disconnected');
    socket.emitClose(); await lost; bridge.disconnect();
  });

  it('updates native Stackmat readings without starting or recording a solve twice', async () => {
    stubMiniProgram();
    const source = createMiniProgramStackmatSource(); const listener = vi.fn(); source.subscribe(listener);
    const pending = source.connect();
    await vi.waitFor(() => expect(FakeWebSocket.instance).not.toBeNull());
    const socket = FakeWebSocket.instance!; socket.emitOpen();
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    socket.emitMessage({ type: 'status', phase: 'connected', brand: 'stackmat-mic' });
    await pending;
    expect(source.snapshot().listening).toBe(true);
    for (const [index, state, solveTime] of [[1, 'RUNNING', 100], [2, 'RUNNING', 200], [3, 'STOPPED', 234], [4, 'STOPPED', 234]] as const) {
      socket.emitMessage({ type: 'timer', event: { state, solveTime }, relaySeq: index });
    }
    expect(listener.mock.calls.map(([event]) => event)).toEqual([{ state: 'RUNNING', solveTime: 100 }, { state: 'STOPPED', solveTime: 234 }]);
    expect(source.snapshot()).toMatchObject({ phase: 'stopped', ms: 234, listening: true });
    await source.disconnect();
    expect(source.snapshot().listening).toBe(false);
  });

  it('routes timers to native setup and does not replay a received result twice', async () => {
    const navigateTo = vi.fn(); stubMiniProgram(navigateTo);
    const onTimer = vi.fn();
    const pending = connectMiniProgramCubeBridge({ onTimer, onBattery: vi.fn(), onGyro: vi.fn(), onMove: vi.fn(), onState: vi.fn(), onStatus: vi.fn() }, 'bluetooth-timer');
    await vi.waitFor(() => expect(FakeWebSocket.instance).not.toBeNull());
    const socket = FakeWebSocket.instance!; socket.emitOpen();
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    expect(navigateTo.mock.calls[0][0].url).toContain('/pages/external-timer/index?mode=bluetooth-timer&token=');
    socket.emitMessage({ type: 'status', phase: 'connected', brand: 'gan-timer' });
    const bridge = await pending; bridge.activate();
    const result = { type: 'timer', event: { state: 'STOPPED', solveTime: 12345 }, relaySeq: 1 };
    socket.emitMessage(result); socket.emitMessage(result);
    expect(onTimer).toHaveBeenCalledExactlyOnceWith({ state: 'STOPPED', solveTime: 12345 });
    bridge.disconnect();
  });

  afterEach(() => {
    FakeWebSocket.instance = null;
    FakeWebSocket.instances = [];
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['gan-v2', 'gan-v3', 'gan-v4', 'gocube', 'qiyi', 'giiker', 'moyu', 'moyu32'])(
    'preserves the supported %s protocol identity',
    (brand) => {
      expect(normalizeMiniProgramCubeBrand(brand)).toBe(brand);
    },
  );

  it('maps an absent or unsupported protocol identity to unknown', () => {
    expect(normalizeMiniProgramCubeBrand(undefined)).toBe('unknown');
    expect(normalizeMiniProgramCubeBrand('future-protocol')).toBe('unknown');
  });

  it('confirms the iOS WeChat container when its user agent omits miniProgram', async () => {
    const getEnv = vi.fn((callback: (result: { miniprogram: boolean }) => void) => {
      callback({ miniprogram: true });
    });
    const navigateTo = vi.fn();
    vi.stubGlobal('window', {
      clearTimeout,
      navigator: { userAgent: 'Mozilla/5.0 (iPhone) MicroMessenger/8.0' },
      setTimeout,
      wx: { miniProgram: { getEnv, navigateTo } },
    });
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const pending = connectMiniProgramCubeBridge({
      onBattery: vi.fn(),
      onGyro: vi.fn(),
      onMove: vi.fn(),
      onState: vi.fn(),
      onStatus: vi.fn(),
    });
    await vi.waitFor(() => expect(FakeWebSocket.instance).not.toBeNull());
    const socket = FakeWebSocket.instance!;
    socket.emitOpen();
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    socket.emitMessage({ type: 'status', phase: 'connected', brand: 'gan-v4' });
    const connection = await pending;
    connection.disconnect();

    expect(getEnv).toHaveBeenCalledOnce();
    expect(navigateTo).toHaveBeenCalledOnce();
  });

  it('reuses the same relay through the Douyin WebView bridge', async () => {
    const navigateTo = vi.fn();
    vi.stubGlobal('window', {
      clearTimeout,
      navigator: { userAgent: 'Mozilla/5.0 toutiaomicroapp' },
      setTimeout,
      tt: { miniProgram: { navigateTo } },
    });
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const pending = connectMiniProgramCubeBridge({
      onBattery: vi.fn(),
      onGyro: vi.fn(),
      onMove: vi.fn(),
      onState: vi.fn(),
      onStatus: vi.fn(),
    });
    const socket = FakeWebSocket.instance!;
    socket.emitOpen();
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    socket.emitMessage({ type: 'status', phase: 'connected', brand: 'gan-v4' });
    const connection = await pending;
    connection.disconnect();

    expect(navigateTo).toHaveBeenCalledOnce();
  });

  it('does not open the relay from an ordinary WeChat browser', async () => {
    const getEnv = vi.fn((callback: (result: { miniprogram: boolean }) => void) => {
      callback({ miniprogram: false });
    });
    vi.stubGlobal('window', {
      clearTimeout,
      navigator: { userAgent: 'Mozilla/5.0 (iPhone) MicroMessenger/8.0' },
      setTimeout,
      wx: { miniProgram: { getEnv, navigateTo: vi.fn() } },
    });
    vi.stubGlobal('WebSocket', FakeWebSocket);

    await expect(connectMiniProgramCubeBridge({
      onBattery: vi.fn(),
      onGyro: vi.fn(),
      onMove: vi.fn(),
      onState: vi.fn(),
      onStatus: vi.fn(),
    })).rejects.toThrow('NOT_MINIPROGRAM_WEBVIEW');
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('waits for relay acknowledgement and replays early events only after timer setup', async () => {
    const navigations: string[] = [];
    stubMiniProgram(({ url }) => {
      navigations.push(url);
    });

    const received: string[] = [];
    const pending = connectMiniProgramCubeBridge({
      onBattery: (level) => received.push(`battery:${level}`),
      onGyro: () => received.push('gyro'),
      onMove: (move, _deviceTs, metadata) => received.push(
        `move:${move}:${metadata?.futureHistory ? 'future' : 'current'}`,
      ),
      onState: (facelets) => received.push(`state:${facelets[0]}`),
      onStatus: (status) => received.push(`status:${status.phase}`),
    });
    const socket = FakeWebSocket.instance!;

    socket.emitOpen();
    expect(navigations).toEqual([]);
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    expect(navigations[0]).toMatch(/^\/pages\/smart-cube\/index\?token=/);
    socket.emitMessage({
      type: 'state',
      facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
    });
    socket.emitMessage({ type: 'move', move: 'U', deviceTs: 42, futureHistory: true, relaySeq: 1 });
    expect(received).toEqual([]);

    socket.emitMessage({
      type: 'status',
      phase: 'connected',
      brand: 'gan-v4',
      deviceName: 'GAN16ui',
      hasGyro: true,
    });
    const connection = await pending;
    expect(received).toEqual([]);

    connection.activate();
    expect(received).toEqual(['state:U', 'move:U:future', 'status:connected']);
    expect(connection).toMatchObject({ brand: 'gan-v4', deviceName: 'GAN16ui', hasGyro: true });
  });

  it('replays an immediate disconnect only after timer setup', async () => {
    stubMiniProgram();

    const phases: string[] = [];
    const pending = connectMiniProgramCubeBridge({
      onBattery: vi.fn(),
      onGyro: vi.fn(),
      onMove: vi.fn(),
      onState: vi.fn(),
      onStatus: (status) => phases.push(status.phase),
    });
    const socket = FakeWebSocket.instance!;
    socket.emitOpen();
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    socket.emitMessage({
      type: 'status',
      phase: 'connected',
      brand: 'gan-v4',
      deviceName: 'GAN16ui',
    });
    const connection = await pending;
    socket.emitMessage({ type: 'status', phase: 'disconnected' });
    expect(phases).toEqual([]);

    connection.activate();
    expect(phases).toEqual(['connected', 'disconnected']);
  });

  it('reconnects with the same token and acknowledged move position', async () => {
    vi.useFakeTimers();
    const navigateTo = vi.fn();
    stubMiniProgram(navigateTo);

    const phases: string[] = [];
    const pending = connectMiniProgramCubeBridge({
      onBattery: vi.fn(),
      onGyro: vi.fn(),
      onMove: vi.fn(),
      onState: vi.fn(),
      onStatus: (status) => phases.push(status.phase),
    });
    const firstSocket = FakeWebSocket.instances[0];
    firstSocket.emitOpen();
    const firstHello = JSON.parse(firstSocket.sent[0]) as { token: string };
    firstSocket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    firstSocket.emitMessage({
      type: 'status',
      phase: 'connected',
      brand: 'gan-v4',
      deviceName: 'GAN16ui',
      hasGyro: true,
    });
    const connection = await pending;
    connection.activate();
    firstSocket.emitMessage({ type: 'move', move: 'R', relaySeq: 1 });

    firstSocket.emitClose();
    expect(phases).toEqual(['connected']);
    await vi.advanceTimersByTimeAsync(250);
    const secondSocket = FakeWebSocket.instances[1];
    secondSocket.emitOpen();
    const secondHello = JSON.parse(secondSocket.sent[0]) as {
      token: string;
      lastMoveSeq: number;
    };
    expect(secondHello).toEqual(expect.objectContaining({
      token: firstHello.token,
      lastMoveSeq: 1,
    }));
    secondSocket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 1 });
    expect(navigateTo).toHaveBeenCalledTimes(1);

    secondSocket.emitMessage({
      type: 'status',
      phase: 'connected',
      brand: 'gan-v4',
      deviceName: 'GAN16ui',
      hasGyro: true,
    });
    expect(phases).toEqual(['connected', 'connected']);
  });

  it('delivers moves replayed before the reconnect acknowledgement', async () => {
    vi.useFakeTimers();
    stubMiniProgram();
    const moves: string[] = [];
    const pending = connectMiniProgramCubeBridge({
      onBattery: vi.fn(),
      onGyro: vi.fn(),
      onMove: (move) => moves.push(move),
      onState: vi.fn(),
      onStatus: vi.fn(),
    });
    const firstSocket = FakeWebSocket.instances[0];
    firstSocket.emitOpen();
    firstSocket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    firstSocket.emitMessage({ type: 'status', phase: 'connected', brand: 'gan-v4' });
    const connection = await pending;
    connection.activate();
    firstSocket.emitMessage({ type: 'move', move: 'R', relaySeq: 1 });
    firstSocket.emitClose();

    await vi.advanceTimersByTimeAsync(250);
    const secondSocket = FakeWebSocket.instances[1];
    secondSocket.emitOpen();
    secondSocket.emitMessage({ type: 'move', move: 'U', relaySeq: 2 });
    secondSocket.emitMessage({ type: 'move', move: 'F2', relaySeq: 3 });
    secondSocket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 3 });

    expect(moves).toEqual(['R', 'U', 'F2']);
  });

  it('fails closed instead of silently accepting a relay sequence gap', async () => {
    stubMiniProgram();
    const phases: string[] = [];
    const pending = connectMiniProgramCubeBridge({
      onBattery: vi.fn(),
      onGyro: vi.fn(),
      onMove: vi.fn(),
      onState: vi.fn(),
      onStatus: (status) => phases.push(status.phase),
    });
    const socket = FakeWebSocket.instance!;
    socket.emitOpen();
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    socket.emitMessage({ type: 'status', phase: 'connected', brand: 'gan-v4' });
    const connection = await pending;
    connection.activate();

    socket.emitMessage({ type: 'move', move: 'U', relaySeq: 2 });
    expect(phases).toEqual(['connected', 'disconnected']);
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it('rejects promptly when the native smart-cube page cannot open', async () => {
    stubMiniProgram(({ fail }) => {
      fail?.({ errMsg: 'page not found' });
    });

    const pending = connectMiniProgramCubeBridge({
      onBattery: vi.fn(),
      onGyro: vi.fn(),
      onMove: vi.fn(),
      onState: vi.fn(),
      onStatus: vi.fn(),
    });
    const socket = FakeWebSocket.instance!;
    socket.emitOpen();
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });

    await expect(pending).rejects.toThrow('MINIPROGRAM_SMART_CUBE_PAGE_UNAVAILABLE');
  });

  it('uses the jWeixin alias injected by the DevTools web-view', async () => {
    const navigateTo = vi.fn();
    const sdk = {
      config: vi.fn(),
      ready: vi.fn(),
      error: vi.fn(),
      updateAppMessageShareData: vi.fn(),
      updateTimelineShareData: vi.fn(),
      miniProgram: { navigateTo },
    };
    vi.stubGlobal('window', {
      __wxjs_environment: 'miniprogram',
      clearTimeout,
      jWeixin: sdk,
      navigator: { userAgent: 'MicroMessenger miniProgram' },
      setTimeout,
    });
    vi.stubGlobal('document', {});
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const pending = connectMiniProgramCubeBridge({
      onBattery: vi.fn(),
      onGyro: vi.fn(),
      onMove: vi.fn(),
      onState: vi.fn(),
      onStatus: vi.fn(),
    });
    await vi.waitFor(() => expect(FakeWebSocket.instance).not.toBeNull());
    const socket = FakeWebSocket.instance!;
    socket.emitOpen();
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    socket.emitMessage({ type: 'status', phase: 'connected', brand: 'gan-v4' });
    const connection = await pending;
    connection.disconnect();

    expect(window.wx).toBeUndefined();
    expect(window.jWeixin).toBe(sdk);
    expect(navigateTo).toHaveBeenCalledOnce();
  });

  it('loads the self-hosted WeChat SDK when the web-view does not inject wx', async () => {
    const navigateTo = vi.fn();
    const script = {} as HTMLScriptElement;
    const appendChild = vi.fn((node: HTMLScriptElement) => {
      expect(node).toBe(script);
      expect(node.src).toBe('/vendor/jweixin-1.6.0.js');
      window.wx = {
        config: vi.fn(),
        ready: vi.fn(),
        error: vi.fn(),
        updateAppMessageShareData: vi.fn(),
        updateTimelineShareData: vi.fn(),
        miniProgram: { navigateTo },
      };
      node.onload?.(new Event('load'));
      return node;
    });
    vi.stubGlobal('window', {
      __wxjs_environment: 'miniprogram',
      clearTimeout,
      navigator: { userAgent: 'MicroMessenger miniProgram' },
      setTimeout,
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => script),
      head: { appendChild },
    });
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const pending = connectMiniProgramCubeBridge({
      onBattery: vi.fn(),
      onGyro: vi.fn(),
      onMove: vi.fn(),
      onState: vi.fn(),
      onStatus: vi.fn(),
    });
    await vi.waitFor(() => expect(FakeWebSocket.instance).not.toBeNull());
    const socket = FakeWebSocket.instance!;
    socket.emitOpen();
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    expect(navigateTo).toHaveBeenCalledOnce();
    socket.emitMessage({ type: 'status', phase: 'connected', brand: 'gan-v4' });
    const connection = await pending;
    connection.disconnect();

    expect(appendChild).toHaveBeenCalledOnce();
  });

  it('replaces an incomplete wx object before opening the native bridge page', async () => {
    const navigateTo = vi.fn();
    const script = {} as HTMLScriptElement;
    const incompleteWx = {
      config: vi.fn(),
      ready: vi.fn(),
      error: vi.fn(),
      updateAppMessageShareData: vi.fn(),
      updateTimelineShareData: vi.fn(),
      miniProgram: {},
    };
    const appendChild = vi.fn((node: HTMLScriptElement) => {
      window.wx = { ...incompleteWx, miniProgram: { navigateTo } };
      node.onload?.(new Event('load'));
      return node;
    });
    vi.stubGlobal('window', {
      __wxjs_environment: 'miniprogram',
      clearTimeout,
      navigator: { userAgent: 'MicroMessenger miniProgram' },
      setTimeout,
      wx: incompleteWx,
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => script),
      head: { appendChild },
    });
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const pending = connectMiniProgramCubeBridge({
      onBattery: vi.fn(),
      onGyro: vi.fn(),
      onMove: vi.fn(),
      onState: vi.fn(),
      onStatus: vi.fn(),
    });
    await vi.waitFor(() => expect(FakeWebSocket.instance).not.toBeNull());
    const socket = FakeWebSocket.instance!;
    socket.emitOpen();
    socket.emitMessage({ type: 'ready', role: 'sink', lastMoveSeq: 0 });
    socket.emitMessage({ type: 'status', phase: 'connected', brand: 'gan-v4' });
    const connection = await pending;
    connection.disconnect();

    expect(appendChild).toHaveBeenCalledOnce();
    expect(navigateTo).toHaveBeenCalledOnce();
  });
});
