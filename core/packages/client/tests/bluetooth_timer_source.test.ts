// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bluetoothTimerPickerOptions,
  createBluetoothTimerSource,
  ganTimerDriver,
  qiyiTimerDriver,
  type ExternalTimerEvent,
} from '@/app/[lang]/timer/_lib/bluetooth/timer';

function createFakeDevice(name: string): {
  device: BluetoothDevice;
  connect: ReturnType<typeof vi.fn>;
  emitGattDisconnect(): void;
} {
  let connected = false;
  let disconnectListener: EventListenerOrEventListenerObject | null = null;
  let device: BluetoothDevice;

  const server = {
    get connected() { return connected; },
    get device() { return device; },
  } as unknown as BluetoothRemoteGATTServer;
  const connect = vi.fn(async () => {
    connected = true;
    return server;
  });
  const gatt = {
    get connected() { return connected; },
    connect,
    disconnect: vi.fn(() => { connected = false; }),
  } as unknown as BluetoothRemoteGATTServer;
  device = {
    name,
    gatt,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'gattserverdisconnected') disconnectListener = listener;
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'gattserverdisconnected' && listener === disconnectListener) {
        disconnectListener = null;
      }
    }),
  } as unknown as BluetoothDevice;

  return {
    device,
    connect,
    emitGattDisconnect() {
      connected = false;
      const event = new Event('gattserverdisconnected');
      if (typeof disconnectListener === 'function') disconnectListener(event);
      else disconnectListener?.handleEvent(event);
    },
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(navigator, 'bluetooth', {
    configurable: true,
    value: undefined,
  });
  vi.restoreAllMocks();
});

describe('Bluetooth smart-timer source', () => {
  it('exports the complete timer picker permissions while keeping filters name-only', () => {
    const options = bluetoothTimerPickerOptions();
    const prefixes = options.filters?.map(filter => filter.namePrefix);

    expect(prefixes).toEqual(expect.arrayContaining([
      'GAN',
      'QY-Timer',
      'QY-Adapter',
    ]));
    expect(options.filters?.every(filter => !('services' in filter))).toBe(true);
    expect(options.optionalServices).toEqual(expect.arrayContaining([
      ganTimerDriver.service,
      qiyiTimerDriver.service,
    ]));
    expect(options.optionalManufacturerData).toEqual(
      expect.arrayContaining([...qiyiTimerDriver.manufacturerDataCics ?? []]),
    );
  });

  it('offers both QiYi timer names and does not create a silent GATT connection after MAC cancellation', async () => {
    const gattConnect = vi.fn();
    const picked = {
      name: 'QY-Timer-V003',
      gatt: { connected: false, connect: gattConnect },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as BluetoothDevice;
    const requestDevice = vi.fn((_options: RequestDeviceOptions) => Promise.resolve(picked));
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: { requestDevice },
    });
    const onNeedMac = vi.fn(() => Promise.resolve(null));
    const source = createBluetoothTimerSource({ onNeedMac });

    await source.connect();

    expect(requestDevice).toHaveBeenCalledOnce();
    const options = requestDevice.mock.calls[0]?.[0] as RequestDeviceOptions;
    const prefixes = options.filters?.map(filter => filter.namePrefix);
    expect(prefixes).toContain('QY-Timer');
    expect(prefixes).toContain('QY-Adapter');
    expect(onNeedMac).toHaveBeenCalledWith('QY-Timer-V003', undefined);
    expect(gattConnect).not.toHaveBeenCalled();
    expect(source.connected).toBe(false);
  });

  it('asks the user to confirm a name-derived QiYi MAC instead of silently guessing', async () => {
    const gattConnect = vi.fn();
    const picked = {
      name: 'QY-Timer-x-8F2A',
      gatt: { connected: false, connect: gattConnect },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as BluetoothDevice;
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: { requestDevice: vi.fn(() => Promise.resolve(picked)) },
    });
    const onNeedMac = vi.fn(() => Promise.resolve(null));
    const source = createBluetoothTimerSource({ onNeedMac });

    await source.connect();

    expect(onNeedMac).toHaveBeenCalledWith('QY-Timer-x-8F2A', 'CC:A1:00:00:8F:2A');
    expect(gattConnect).not.toHaveBeenCalled();
    expect(source.connected).toBe(false);
  });

  it('publishes disconnected snapshots before loss callbacks and reconnects the same GAN timer once', async () => {
    vi.useFakeTimers();
    const fake = createFakeDevice('GAN-Timer');
    const driverEvents: Array<(event: ExternalTimerEvent) => void> = [];
    vi.spyOn(ganTimerDriver, 'start').mockImplementation(async (_server, emit) => {
      driverEvents.push(emit);
      return { cleanup: vi.fn() };
    });
    const onConnectionLost = vi.fn();
    const source = createBluetoothTimerSource({ onConnectionLost });
    const callbackOrder: string[] = [];
    onConnectionLost.mockImplementation(() => callbackOrder.push('lost'));
    const snapshots: Array<{ connected: boolean; state: string }> = [];
    source.subscribe(event => {
      callbackOrder.push('event');
      snapshots.push({
        connected: source.connected,
        state: event.state,
      });
    });

    await source.connectDevice(fake.device);
    driverEvents[0]?.({ state: 'DISCONNECT' });

    expect(source.connected).toBe(false);
    expect(snapshots.at(-1)).toEqual({ connected: false, state: 'DISCONNECT' });
    expect(onConnectionLost).toHaveBeenCalledOnce();
    expect(callbackOrder.slice(-2)).toEqual(['lost', 'event']);
    await vi.advanceTimersByTimeAsync(2499);
    expect(fake.connect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.connect).toHaveBeenCalledTimes(2);
    expect(source.connected).toBe(true);
    expect(snapshots.at(-1)).toEqual({ connected: true, state: 'IDLE' });

    fake.emitGattDisconnect();
    expect(source.connected).toBe(false);
    expect(snapshots.at(-1)).toEqual({ connected: false, state: 'DISCONNECT' });
    expect(onConnectionLost).toHaveBeenCalledTimes(2);
    await source.disconnect();
    await vi.advanceTimersByTimeAsync(2500);
    expect(fake.connect).toHaveBeenCalledTimes(2);
  });

  it('reuses the confirmed QiYi MAC when reconnecting', async () => {
    vi.useFakeTimers();
    const fake = createFakeDevice('QY-Timer-x-8F2A');
    const driverEvents: Array<(event: ExternalTimerEvent) => void> = [];
    const startMacs: Array<string | null | undefined> = [];
    vi.spyOn(qiyiTimerDriver, 'start').mockImplementation(async (_server, emit, ctx) => {
      driverEvents.push(emit);
      startMacs.push(ctx?.mac);
      return { cleanup: vi.fn() };
    });
    const onNeedMac = vi.fn(() => Promise.resolve('CC:A1:00:00:8F:2A'));
    const source = createBluetoothTimerSource({ onNeedMac });

    await source.connectDevice(fake.device);
    driverEvents[0]?.({ state: 'DISCONNECT' });
    await vi.advanceTimersByTimeAsync(2500);

    expect(onNeedMac).toHaveBeenCalledOnce();
    expect(startMacs).toEqual(['CC:A1:00:00:8F:2A', 'CC:A1:00:00:8F:2A']);
    expect(fake.connect).toHaveBeenCalledTimes(2);
    await source.disconnect();
  });

  it('cannot become connected after GATT drops while driver setup is pending', async () => {
    vi.useFakeTimers();
    const fake = createFakeDevice('GAN-Timer');
    const firstStart = deferred<{ cleanup: () => void }>();
    const staleCleanup = vi.fn();
    vi.spyOn(ganTimerDriver, 'start')
      .mockImplementationOnce(() => firstStart.promise)
      .mockResolvedValueOnce({ cleanup: vi.fn() });
    const onConnectionLost = vi.fn();
    const source = createBluetoothTimerSource({ onConnectionLost });

    const connection = source.connectDevice(fake.device);
    await vi.waitFor(() => expect(ganTimerDriver.start).toHaveBeenCalledOnce());
    fake.emitGattDisconnect();
    expect(source.connected).toBe(false);
    expect(onConnectionLost).toHaveBeenCalledOnce();

    firstStart.resolve({ cleanup: staleCleanup });
    await expect(connection).rejects.toThrow('disconnected during setup');
    expect(staleCleanup).toHaveBeenCalledOnce();
    expect(source.connected).toBe(false);
    await vi.advanceTimersByTimeAsync(2499);
    expect(source.connected).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(source.connected).toBe(true);
    expect(fake.connect).toHaveBeenCalledTimes(2);
    await source.disconnect();
  });

  it('does not connect a timer selected after the pending picker was cancelled', async () => {
    const fake = createFakeDevice('GAN-Timer');
    const picked = deferred<BluetoothDevice>();
    const requestDevice = vi.fn(() => picked.promise);
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: { requestDevice },
    });
    const source = createBluetoothTimerSource();

    const connection = source.connect();
    await vi.waitFor(() => expect(requestDevice).toHaveBeenCalledOnce());
    await source.disconnect();
    picked.resolve(fake.device);
    await connection;

    expect(fake.connect).not.toHaveBeenCalled();
    expect(source.connected).toBe(false);
  });

  it('does not connect a QiYi timer after disconnecting during MAC confirmation', async () => {
    const fake = createFakeDevice('QY-Timer-x-8F2A');
    const confirmedMac = deferred<string | null>();
    const onNeedMac = vi.fn(() => confirmedMac.promise);
    const source = createBluetoothTimerSource({ onNeedMac });

    const connection = source.connectDevice(fake.device);
    await vi.waitFor(() => expect(onNeedMac).toHaveBeenCalledOnce());
    await source.disconnect();
    confirmedMac.resolve('CC:A1:00:00:8F:2A');
    await connection;

    expect(fake.connect).not.toHaveBeenCalled();
    expect(source.connected).toBe(false);
  });
});
