import { beforeEach, describe, expect, it, vi } from 'vitest';

const driverMocks = vi.hoisted(() => ({
  connectGanV4: vi.fn(),
  connectGiiker: vi.fn(),
  connectGoCube: vi.fn(),
  connectMoyu: vi.fn(),
  discoverSmartCubeDriver: vi.fn(),
}));

vi.mock('../src/lib/smart-cube/discover-driver', () => ({
  discoverSmartCubeDriver: driverMocks.discoverSmartCubeDriver,
}));

vi.mock('../src/lib/smart-cube/gan-v4-ble', () => ({
  connectGanV4: driverMocks.connectGanV4,
}));

vi.mock('../src/lib/smart-cube/gocube-ble', () => ({
  connectGoCube: driverMocks.connectGoCube,
}));

vi.mock('../src/lib/smart-cube/giiker-ble', () => ({
  connectGiiker: driverMocks.connectGiiker,
}));

vi.mock('../src/lib/smart-cube/moyu-ble', () => ({
  connectMoyu: driverMocks.connectMoyu,
}));

import { SmartCubeSession } from '../src/lib/smart-cube/session';

class FakeSocketTask {
  readonly sent: string[] = [];
  deferSendPhase = '';
  failNextSend = '';
  failSendPhase = '';
  private deferredSendSuccess: (() => void) | null = null;
  private openListener: (() => void) | null = null;
  private closeListener: (() => void) | null = null;
  private errorListener: ((error: { errMsg?: string }) => void) | null = null;
  private messageListener: ((message: { data: string | ArrayBuffer }) => void) | null = null;

  close(): void {
    this.closeListener?.();
  }

  onClose(callback: () => void): void {
    this.closeListener = callback;
  }

  onError(callback: (error: { errMsg?: string }) => void): void {
    this.errorListener = callback;
  }

  onMessage(callback: (message: { data: string | ArrayBuffer }) => void): void {
    this.messageListener = callback;
  }

  onOpen(callback: () => void): void {
    this.openListener = callback;
  }

  send(options: {
    data: string;
    fail?(error: { errMsg?: string }): void;
    success?(): void;
  }): void {
    const phase = (JSON.parse(options.data) as { phase?: string }).phase ?? '';
    if (this.failNextSend || (this.failSendPhase && phase === this.failSendPhase)) {
      const errMsg = this.failNextSend;
      this.failNextSend = '';
      options.fail?.({ errMsg: errMsg || `${phase} send failed` });
      return;
    }
    this.sent.push(options.data);
    if (this.deferSendPhase && phase === this.deferSendPhase) {
      this.deferSendPhase = '';
      this.deferredSendSuccess = options.success ?? null;
      return;
    }
    options.success?.();
  }

  finishDeferredSend(): void {
    const success = this.deferredSendSuccess;
    this.deferredSendSuccess = null;
    success?.();
  }

  open(): void {
    this.openListener?.();
  }

  ready(lastMoveSeq = 0): void {
    this.message({ type: 'ready', role: 'source', lastMoveSeq });
  }

  message(payload: unknown): void {
    this.messageListener?.({ data: JSON.stringify(payload) });
  }

  remoteClose(): void {
    this.closeListener?.();
  }

  error(errMsg = 'socket failed'): void {
    this.errorListener?.({ errMsg });
  }
}

describe('SmartCubeSession', () => {
  let socket: FakeSocketTask;

  beforeEach(() => {
    driverMocks.connectGanV4.mockReset();
    driverMocks.connectGiiker.mockReset();
    driverMocks.connectGoCube.mockReset();
    driverMocks.connectMoyu.mockReset();
    driverMocks.discoverSmartCubeDriver.mockReset();
    driverMocks.discoverSmartCubeDriver.mockResolvedValue('gan-v4');
    socket = new FakeSocketTask();
    vi.stubGlobal('wx', {
      connectSocket: vi.fn(() => socket),
    });
  });

  async function startSession(session: SmartCubeSession, token = 'a'.repeat(32)): Promise<void> {
    const startPromise = session.start(token);
    await vi.waitFor(() => expect(wx.connectSocket).toHaveBeenCalledOnce());
    socket.open();
    socket.ready();
    await startPromise;
  }

  it('waits for the server acknowledgement before accepting BLE work', async () => {
    const session = new SmartCubeSession();
    let started = false;
    const startPromise = session.start('a'.repeat(32)).then(() => {
      started = true;
    });
    await vi.waitFor(() => expect(wx.connectSocket).toHaveBeenCalledOnce());
    socket.open();
    await Promise.resolve();
    expect(started).toBe(false);
    await expect(session.connect('simulator')).rejects.toThrow('请先从计时器打开连接页');

    socket.ready();
    await startPromise;
    expect(started).toBe(true);
  });

  it('relays Giiker moves, state and battery without claiming gyro support', async () => {
    const session = new SmartCubeSession();
    await startSession(session, 'i'.repeat(32));
    driverMocks.connectGiiker.mockImplementation(async (options: {
      onBattery(level: number): void;
      onMove(move: string): void;
      onState(facelets: string): void;
    }) => {
      options.onMove('R');
      options.onState('U'.repeat(54));
      options.onBattery(72);
      return {
        deviceName: 'Gi123456',
        disconnect: async () => {},
        requestBattery: async () => 72,
      };
    });

    await session.connect('giiker');

    expect(driverMocks.connectGiiker).toHaveBeenCalledOnce();
    const payloads = socket.sent.map((data) => JSON.parse(data) as {
      hasGyro?: boolean;
      level?: number;
      move?: string;
      phase?: string;
      type?: string;
    });
    expect(payloads).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'move', move: 'R' }),
      expect.objectContaining({ type: 'battery', level: 72 }),
      expect.objectContaining({ type: 'status', phase: 'connected', hasGyro: false }),
    ]));
  });

  it('relays MoYu moves without inventing battery or gyro support', async () => {
    const session = new SmartCubeSession();
    await startSession(session, 'm'.repeat(32));
    driverMocks.connectMoyu.mockImplementation(async (options: {
      onMove(move: string): void;
    }) => {
      options.onMove('R');
      return {
        deviceName: 'MHC Cube',
        disconnect: async () => {},
        requestBattery: async () => null,
      };
    });

    await session.connect('moyu');
    await Promise.resolve();

    expect(driverMocks.connectMoyu).toHaveBeenCalledOnce();
    const payloads = socket.sent.map((data) => JSON.parse(data) as {
      brand?: string;
      hasGyro?: boolean;
      move?: string;
      phase?: string;
      type?: string;
    });
    expect(payloads).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'move', move: 'R' }),
      expect.objectContaining({
        type: 'status',
        phase: 'connected',
        brand: 'moyu',
        hasGyro: false,
      }),
    ]));
    expect(payloads.some((payload) => payload.type === 'battery')).toBe(false);
  });

  it('waits for connected status delivery before completing a BLE connection', async () => {
    const session = new SmartCubeSession();
    await startSession(session, 'q'.repeat(32));
    socket.deferSendPhase = 'connected';

    const connection = session.connect('simulator');
    let connected = false;
    const observed = connection.then(() => {
      connected = true;
    });
    await vi.waitFor(() => {
      const payloads = socket.sent.map((data) => JSON.parse(data) as { phase?: string });
      expect(payloads.at(-1)?.phase).toBe('connected');
    });
    expect(connected).toBe(false);

    socket.finishDeferredSend();
    await observed;
    expect(connected).toBe(true);
  });

  it('rejects a BLE connection when connected status delivery fails', async () => {
    const session = new SmartCubeSession();
    const snapshots: Array<{ error: string; phase: string }> = [];
    session.subscribe((snapshot) => snapshots.push({
      error: snapshot.error,
      phase: snapshot.phase,
    }));
    await startSession(session, 'r'.repeat(32));
    socket.failSendPhase = 'connected';

    const connection = session.connect('simulator');

    await expect(connection).rejects.toThrow('connected send failed');
    expect(snapshots.at(-1)).toEqual({
      error: 'connected send failed',
      phase: 'error',
    });
  });

  it('rejects immediately when the relay hello cannot be sent', async () => {
    const session = new SmartCubeSession();
    const startPromise = session.start('b'.repeat(32));
    await vi.waitFor(() => expect(wx.connectSocket).toHaveBeenCalledOnce());
    socket.failNextSend = 'send failed';
    socket.open();

    await expect(startPromise).rejects.toThrow('send failed');
  });

  it('rejects a relay start that is replaced by a newer session', async () => {
    const session = new SmartCubeSession();
    const firstSocket = new FakeSocketTask();
    const secondSocket = new FakeSocketTask();
    vi.mocked(wx.connectSocket)
      .mockReturnValueOnce(firstSocket as never)
      .mockReturnValueOnce(secondSocket as never);

    const firstStart = session.start('1'.repeat(32));
    await vi.waitFor(() => expect(wx.connectSocket).toHaveBeenCalledTimes(1));
    firstSocket.open();
    const secondStart = session.start('2'.repeat(32));

    await expect(firstStart).rejects.toThrow('计时器连接已被新的会话替代');
    await vi.waitFor(() => expect(wx.connectSocket).toHaveBeenCalledTimes(2));
    secondSocket.open();
    secondSocket.ready();
    await expect(secondStart).resolves.toBeUndefined();
  });

  it('disconnects a BLE connection that resolves after the session was cancelled', async () => {
    const session = new SmartCubeSession();
    await startSession(session);

    const disconnect = vi.fn(async () => {});
    let finishConnect!: (connection: {
      deviceName: string;
      disconnect: () => Promise<void>;
      requestBattery: () => Promise<number | null>;
    }) => void;
    driverMocks.connectGanV4.mockReturnValue(new Promise((resolve) => {
      finishConnect = resolve;
    }));

    const pendingConnect = session.connect('gan-v4');
    await vi.waitFor(() => expect(driverMocks.connectGanV4).toHaveBeenCalledOnce());
    let disconnected = false;
    const pendingDisconnect = session.disconnect().then(() => {
      disconnected = true;
    });
    const options = driverMocks.connectGanV4.mock.calls[0]?.[0] as {
      signal: { aborted: boolean };
    };
    expect(options.signal.aborted).toBe(true);
    await Promise.resolve();
    expect(disconnected).toBe(false);
    finishConnect({
      deviceName: 'GAN16ui Test',
      disconnect,
      requestBattery: async () => 80,
    });
    await Promise.all([pendingConnect, pendingDisconnect]);

    expect(disconnect).toHaveBeenCalledOnce();
    const payloads = socket.sent.map((data) => JSON.parse(data) as { phase?: string });
    expect(payloads.some((payload) => payload.phase === 'connected')).toBe(false);
  });

  it('drains late BLE callbacks before starting a replacement scan', async () => {
    const session = new SmartCubeSession();
    await startSession(session, '0'.repeat(32));

    let finishLateCallback!: () => void;
    driverMocks.connectGanV4.mockImplementation((options: {
      signal: {
        onAbort(listener: () => void): () => void;
        track(operation: Promise<unknown>): void;
      };
    }) => new Promise((_resolve, reject) => {
      options.signal.track(new Promise<void>((resolve) => {
        finishLateCallback = resolve;
      }));
      options.signal.onAbort(() => reject(new Error('cancelled')));
    }));
    driverMocks.connectGoCube.mockResolvedValue({
      deviceName: 'GoCube Test',
      disconnect: async () => {},
      requestBattery: async () => 70,
    });

    const firstConnect = session.connect('gan-v4');
    await vi.waitFor(() => expect(driverMocks.connectGanV4).toHaveBeenCalledOnce());
    const disconnect = session.disconnect();
    const replacementConnect = session.connect('gocube');
    await Promise.resolve();
    expect(driverMocks.connectGoCube).not.toHaveBeenCalled();

    finishLateCallback();
    await Promise.all([firstConnect, disconnect, replacementConnect]);

    expect(driverMocks.connectGoCube).not.toHaveBeenCalled();
  });

  it('cancels an in-flight BLE search without waiting for its scan timeout', async () => {
    const session = new SmartCubeSession();
    await startSession(session, 'c'.repeat(32));

    driverMocks.connectGanV4.mockImplementation((options: {
      signal: { onAbort(listener: () => void): () => void };
    }) => new Promise((_resolve, reject) => {
      options.signal.onAbort(() => reject(new Error('cancelled')));
    }));

    const pendingConnect = session.connect('gan-v4');
    await vi.waitFor(() => expect(driverMocks.connectGanV4).toHaveBeenCalledOnce());
    await session.disconnect();
    await expect(pendingConnect).resolves.toBeUndefined();

    const payloads = socket.sent.map((data) => JSON.parse(data) as { phase?: string });
    expect(payloads.at(-1)?.phase).toBe('disconnected');
  });

  it('coalesces rapid repeated connect taps into one BLE attempt', async () => {
    const session = new SmartCubeSession();
    await startSession(session, 'e'.repeat(32));

    let finishConnect!: (connection: {
      deviceName: string;
      disconnect: () => Promise<void>;
      requestBattery: () => Promise<number | null>;
    }) => void;
    driverMocks.connectGanV4.mockReturnValue(new Promise((resolve) => {
      finishConnect = resolve;
    }));

    const first = session.connect('gan-v4');
    const second = session.connect('gan-v4');
    await vi.waitFor(() => expect(driverMocks.connectGanV4).toHaveBeenCalledOnce());
    finishConnect({
      deviceName: 'GAN16ui Test',
      disconnect: async () => {},
      requestBattery: async () => 80,
    });
    await Promise.all([first, second]);

    expect(driverMocks.connectGanV4).toHaveBeenCalledOnce();
  });

  it('detects the nearby protocol before using the existing driver', async () => {
    const session = new SmartCubeSession();
    await startSession(session, 'j'.repeat(32));
    driverMocks.discoverSmartCubeDriver.mockResolvedValue('gocube');
    driverMocks.connectGoCube.mockResolvedValue({
      deviceName: 'GoCube Edge',
      disconnect: async () => {},
      requestBattery: async () => 65,
    });

    await session.connectAutomatically();

    expect(driverMocks.discoverSmartCubeDriver).toHaveBeenCalledOnce();
    expect(driverMocks.connectGoCube).toHaveBeenCalledOnce();
    expect(driverMocks.connectGanV4).not.toHaveBeenCalled();
  });

  it('coalesces repeated automatic connection requests', async () => {
    const session = new SmartCubeSession();
    await startSession(session, 'k'.repeat(32));
    let finishDetection!: (driver: 'gan-v4') => void;
    driverMocks.discoverSmartCubeDriver.mockReturnValue(new Promise((resolve) => {
      finishDetection = resolve;
    }));
    driverMocks.connectGanV4.mockResolvedValue({
      deviceName: 'GAN16ui Test',
      disconnect: async () => {},
      requestBattery: async () => 80,
    });

    const first = session.connectAutomatically();
    const second = session.connectAutomatically();
    await vi.waitFor(() => expect(driverMocks.discoverSmartCubeDriver).toHaveBeenCalledOnce());
    finishDetection('gan-v4');
    await Promise.all([first, second]);

    expect(driverMocks.discoverSmartCubeDriver).toHaveBeenCalledOnce();
    expect(driverMocks.connectGanV4).toHaveBeenCalledOnce();
  });

  it('publishes an actionable error when automatic discovery finds no cube', async () => {
    const session = new SmartCubeSession();
    const snapshots: Array<{ error: string; phase: string }> = [];
    session.subscribe((snapshot) => snapshots.push({
      error: snapshot.error,
      phase: snapshot.phase,
    }));
    await startSession(session, 'l'.repeat(32));
    driverMocks.discoverSmartCubeDriver.mockRejectedValue(new Error(
      '未发现智能魔方，请转动魔方将它唤醒后重试',
    ));

    await expect(session.connectAutomatically()).rejects.toThrow('未发现智能魔方');

    expect(snapshots.at(-1)).toEqual({
      error: '未发现智能魔方，请转动魔方将它唤醒后重试',
      phase: 'error',
    });
    expect(driverMocks.connectGanV4).not.toHaveBeenCalled();
    expect(driverMocks.connectGoCube).not.toHaveBeenCalled();
  });

  it('does not start a new BLE scan after disconnecting during prior hardware cleanup', async () => {
    const session = new SmartCubeSession();
    await startSession(session, '9'.repeat(32));

    let finishDisconnect!: () => void;
    driverMocks.connectGanV4.mockResolvedValue({
      deviceName: 'GAN16ui Test',
      disconnect: () => new Promise<void>((resolve) => {
        finishDisconnect = resolve;
      }),
      requestBattery: async () => 80,
    });
    await session.connect('gan-v4');

    const nextConnect = session.connect('gocube');
    await vi.waitFor(() => expect(finishDisconnect).toBeTypeOf('function'));
    const disconnect = session.disconnect();
    finishDisconnect();
    await Promise.all([nextConnect, disconnect]);

    expect(driverMocks.connectGoCube).not.toHaveBeenCalled();
  });

  it('publishes a disconnected snapshot when the physical cube drops', async () => {
    const session = new SmartCubeSession();
    const snapshots: Array<{ phase: string; deviceName: string }> = [];
    session.subscribe((snapshot) => snapshots.push({
      phase: snapshot.phase,
      deviceName: snapshot.deviceName,
    }));
    await startSession(session, 'd'.repeat(32));

    let physicalDisconnect!: (message: string) => void;
    driverMocks.connectGanV4.mockImplementation(async (options: {
      onDisconnect(message: string): void;
    }) => {
      physicalDisconnect = options.onDisconnect;
      return {
        deviceName: 'GAN16ui Test',
        disconnect: async () => {},
        requestBattery: async () => 88,
      };
    });
    await session.connect('gan-v4');

    physicalDisconnect('GAN 智能魔方连接已断开');

    expect(snapshots.at(-1)).toEqual({
      phase: 'disconnected',
      deviceName: 'GAN 智能魔方连接已断开',
    });
    const payloads = socket.sent.map((data) => JSON.parse(data) as { phase?: string });
    expect(payloads.at(-1)?.phase).toBe('disconnected');
  });

  it('disconnects hardware and ignores late BLE callbacks after relay loss', async () => {
    const session = new SmartCubeSession();
    const snapshots: Array<{ phase: string; battery: number | null }> = [];
    session.subscribe((snapshot) => snapshots.push({
      phase: snapshot.phase,
      battery: snapshot.battery,
    }));
    await startSession(session, 'f'.repeat(32));

    const disconnect = vi.fn(async () => {});
    let lateBattery!: (level: number) => void;
    driverMocks.connectGanV4.mockImplementation(async (options: {
      onBattery(level: number): void;
    }) => {
      lateBattery = options.onBattery;
      return {
        deviceName: 'GAN16ui Test',
        disconnect,
        requestBattery: async () => null,
      };
    });
    await session.connect('gan-v4');

    socket.remoteClose();
    await vi.waitFor(() => expect(disconnect).toHaveBeenCalledOnce());
    lateBattery(99);

    expect(snapshots.at(-1)).toEqual({ phase: 'error', battery: null });
  });

  it('disconnects hardware when an established relay send fails', async () => {
    const session = new SmartCubeSession();
    const snapshots: Array<{ phase: string; error: string }> = [];
    session.subscribe((snapshot) => snapshots.push({
      phase: snapshot.phase,
      error: snapshot.error,
    }));
    await startSession(session, 'g'.repeat(32));
    await session.connect('simulator');

    socket.failNextSend = 'relay write failed';
    session.simulateMove('R');

    await vi.waitFor(() => expect(snapshots.at(-1)).toEqual({
      phase: 'error',
      error: 'relay write failed',
    }));
    await expect(session.connect('simulator')).rejects.toThrow('请先从计时器打开连接页');
  });

  it('honors a disconnect command from the timer sink', async () => {
    const session = new SmartCubeSession();
    await startSession(session, 'h'.repeat(32));
    await session.connect('simulator');

    socket.message({ type: 'command', command: 'disconnect' });

    await vi.waitFor(() => {
      const payloads = socket.sent.map((data) => JSON.parse(data) as { phase?: string });
      expect(payloads.at(-1)?.phase).toBe('disconnected');
    });
  });
});
