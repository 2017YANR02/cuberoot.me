import { describe, expect, it, vi } from 'vitest';
import { connectNativeTimer, discoverNativeTimers, resolveNativeQiyiTimerMac, type NativeBluetoothTimerCandidate } from '../src/lib/external-timer/ble';
import { createStackmatPcmReceiver } from '../src/lib/external-timer/stackmat';
import { GAN_TIMER_SERVICE, GAN_TIMER_STATE_CHAR } from '@cuberoot/shared/timer/external/gan';
import { crc16CcittFalse } from '@cuberoot/shared/timer/external/crc';
import { QIYI_TIMER_SERVICE, QIYI_TIMER_READ_CHAR, QIYI_TIMER_WRITE_CHAR, createQiyiTimerReassembler, parseQiyiTimerFrame, encodeQiyiTimerPackets } from '@cuberoot/shared/timer/external/qiyi';
import { synthesizePacket } from '@cuberoot/shared/timer/external/stackmat-decoder';
import type { MiniProgramBleApi, CharacteristicValueChange, DiscoveredDevice, BleConnectionStateChange } from '../src/lib/smart-cube/ble-api';
import { NativeTimer } from '../src/lib/native-timer';

function rig(qiyi = false) {
  const serviceId = qiyi ? QIYI_TIMER_SERVICE : GAN_TIMER_SERVICE;
  const characteristicId = qiyi ? QIYI_TIMER_READ_CHAR : GAN_TIMER_STATE_CHAR;
  let listener: ((event: CharacteristicValueChange) => void) | undefined;
  let stateListener: ((event: BleConnectionStateChange) => void) | undefined;
  const writes: Uint8Array[] = [];
  const api: MiniProgramBleApi = {
    openBluetoothAdapter(o) { o.success?.({}); }, closeBluetoothAdapter: vi.fn(o => o.success?.({})),
    startBluetoothDevicesDiscovery(o) { o.success?.({}); }, stopBluetoothDevicesDiscovery(o) { o.success?.({}); },
    onBluetoothDeviceFound() {}, offBluetoothDeviceFound() {},
    createBLEConnection(o) { o.success?.({}); }, closeBLEConnection: vi.fn(o => o.success?.({})),
    getBLEDeviceServices(o) { o.success?.({ services: [{ uuid: serviceId }] }); },
    getBLEDeviceCharacteristics(o) { o.success?.({ characteristics: [
      { uuid: characteristicId, properties: { notify: true } },
      ...(qiyi ? [{ uuid: QIYI_TIMER_WRITE_CHAR, properties: { write: true } }] : []),
    ] }); },
    notifyBLECharacteristicValueChange(o) { o.success?.({}); },
    onBLECharacteristicValueChange(callback) { listener = callback; },
    offBLECharacteristicValueChange() { listener = undefined; },
    onBLEConnectionStateChange(callback) { stateListener = callback; },
    offBLEConnectionStateChange() { stateListener = undefined; },
    writeBLECharacteristicValue(o) { writes.push(new Uint8Array(o.value)); o.success?.({}); if (qiyi && writes.length === 2) {
      for (const packet of encodeQiyiTimerPackets(1, 1, 1, [0])) listener?.({ deviceId: 'opaque-ios-id', serviceId, characteristicId, value: Uint8Array.from(packet).buffer });
    } },
  };
  return { api, writes, device: { deviceId: 'opaque-ios-id', name: qiyi ? 'QY-Timer-X-1234' : 'GAN Timer' },
    notify(bytes: Uint8Array) { listener?.({ deviceId: 'opaque-ios-id', serviceId, characteristicId, value: Uint8Array.from(bytes).buffer }); },
    drop() { stateListener?.({ deviceId: 'opaque-ios-id', connected: false }); },
  };
}

function ganFrame(state: number) {
  const bytes = new Uint8Array([0xfe, 8, 0, state, 0, 12, 0x59, 1, 0, 0]);
  const checksum = crc16CcittFalse(bytes.subarray(2, 8));
  bytes[8] = checksum & 255;
  bytes[9] = checksum >>> 8;
  return bytes;
}

describe('native external timers', () => {
  it('lists named timer advertisements and connects only the selected device after stopping the scan', async () => {
    const { api } = rig();
    const stop = vi.spyOn(api, 'stopBluetoothDevicesDiscovery');
    const connect = vi.spyOn(api, 'createBLEConnection');
    let found: (devices: DiscoveredDevice[]) => void = () => {};
    api.onBluetoothDeviceFound = listener => { found = devices => listener({ devices }); };
    const controller = new AbortController();
    const onUpdate = vi.fn<(devices: NativeBluetoothTimerCandidate[]) => void>();
    const scan = discoverNativeTimers({ api, signal: controller.signal, onUpdate });
    const cancelled = expect(scan).rejects.toMatchObject({ name: 'BleOperationAbortedError' });
    await vi.waitFor(() => {
      found([
        { deviceId: 'other', name: 'Headphones', RSSI: -40 },
        { deviceId: 'cube', name: 'GAN16ui_C2AF', RSSI: -40 },
        { deviceId: 'second', name: 'Generic Bluetooth Device', localName: 'QY-Adapter', RSSI: -55 },
        { deviceId: 'selected', name: 'GAN Timer', RSSI: -43 },
      ]);
      expect(onUpdate).toHaveBeenCalled();
    });
    const candidates = onUpdate.mock.calls[0][0];
    expect(candidates.map(({ device, name, driver }) => [device.deviceId, name, driver])).toEqual([
      ['selected', 'GAN Timer', 'gan-timer'], ['second', 'QY-Adapter', 'qiyi-timer'],
    ]);
    expect(connect).not.toHaveBeenCalled();
    controller.abort();
    await cancelled;
    expect(stop).toHaveBeenCalledOnce();
    expect(api.closeBluetoothAdapter).toHaveBeenCalledOnce();
    const connection = await connectNativeTimer(candidates[0].driver, { api, device: candidates[0].device, onEvent: vi.fn(), onDisconnect: vi.fn() });
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'selected' }));
    await connection.disconnect();
  });

  it('uses the confirmed QiYi address when only an opaque iOS ID was advertised', async () => {
    const r = rig(true);
    const device = { ...r.device, name: 'QY-Adapter' };
    expect(resolveNativeQiyiTimerMac(device)).toBeNull();
    const connection = await connectNativeTimer('qiyi-timer', {
      api: r.api, device, mac: 'CA:FE:12:AB:CD:EF', onEvent: vi.fn(), onDisconnect: vi.fn(),
    });
    const assembler = createQiyiTimerReassembler();
    const messages = r.writes.map(packet => assembler.push(packet)).filter(x => x !== null);
    const hello = parseQiyiTimerFrame(messages[0]!);
    expect(Array.from(hello!.data.slice(-6))).toEqual([0xef, 0xcd, 0xab, 0x12, 0xfe, 0xca]);
    await connection.disconnect();
  });

  it('accepts a notify-only GAN characteristic without fabricating a MAC or write channel', async () => {
    const r = rig(); const onEvent = vi.fn();
    const connection = await connectNativeTimer('gan-timer', { ...r, onEvent, onDisconnect: vi.fn() });
    const bytes = ganFrame(4);
    r.notify(bytes);
    expect(onEvent).toHaveBeenCalledWith({ state: 'STOPPED', solveTime: 12345 });
    bytes[4] ^= 1; r.notify(bytes);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(r.writes).toEqual([]);
    await connection.disconnect();
    r.notify(bytes);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(r.api.closeBLEConnection).toHaveBeenCalledOnce();
  });

  it('uses the shared QiYi encrypted hello, result decoding and acknowledgement framing', async () => {
    const r = rig(true); const onEvent = vi.fn();
    const connection = await connectNativeTimer('qiyi-timer', { ...r, onEvent, onDisconnect: vi.fn() });
    const assembler = createQiyiTimerReassembler();
    const messages = r.writes.map(packet => assembler.push(packet)).filter(x => x !== null);
    const hello = parseQiyiTimerFrame(messages[0]!);
    expect(hello?.cmd).toBe(1);
    expect(Array.from(hello!.data.slice(-6))).toEqual([0x34, 0x12, 0, 0, 0xa1, 0xcc]);
    r.writes.length = 0;
    const payload = new Uint8Array(16); payload.set([1, 1]);
    new DataView(payload.buffer).setUint32(8, 12345);
    for (const packet of encodeQiyiTimerPackets(7, 9, 0x1003, payload)) r.notify(packet);
    expect(onEvent).toHaveBeenCalledWith({ state: 'STOPPED', solveTime: 12345, inspectTime: 0 });
    await vi.waitFor(() => expect(r.writes.length).toBe(1));
    const ack = parseQiyiTimerFrame(assembler.push(r.writes[0])!);
    expect(ack).toMatchObject({ sendSN: 10, ackSN: 7, cmd: 0x1003 });
    expect(Array.from(ack!.data)).toEqual([0]);
    await connection.disconnect();
  });

  it('decodes PCM with odd byte boundaries and preserves run/stop transitions within a large callback', () => {
    const onEvent = vi.fn(); const receive = createStackmatPcmReceiver(onEvent);
    const chunks = [synthesizePacket('S', 12000, 44100), synthesizePacket(' ', 12345, 44100)];
    const length = chunks.reduce((n, c) => n + c.length, 0);
    const pcm = new Uint8Array(length * 2); const view = new DataView(pcm.buffer);
    let offset = 0;
    for (const chunk of chunks) for (const sample of chunk) { view.setInt16(offset, Math.round(sample * 30000), true); offset += 2; }
    receive(pcm.slice(0, 13).buffer); receive(pcm.slice(13).buffer);
    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([
      { state: 'RUNNING', solveTime: 12000 }, { state: 'STOPPED', solveTime: 12345 },
    ]);
  });
});

describe('native bluetooth timer recovery', () => {
  it('drops the interrupted attempt and connects the same ID once before saving a fresh run', async () => {
    vi.useFakeTimers();
    const r = rig();
    const attach = vi.spyOn(r.api, 'createBLEConnection');
    const scan = vi.spyOn(r.api, 'startBluetoothDevicesDiscovery');
    const notify = r.api.notifyBLECharacteristicValueChange;
    vi.spyOn(r.api, 'notifyBLECharacteristicValueChange').mockImplementationOnce(options => {
      r.notify(ganFrame(3));
      notify(options);
    });
    const storage = { getStorageSync: () => undefined, setStorageSync: vi.fn(), removeStorageSync: vi.fn() };
    const t = new NativeTimer(storage, Date.now);
    t.setManualScrambles('R U\nR2 U2');
    vi.stubGlobal('wx', Object.assign(r.api, storage));
    const { startExternalTimer, disconnectExternalTimer } = await import('../src/lib/external-timer/session');
    try {
      await startExternalTimer('', 'gan-timer', t.receiveExternal, { device: r.device });
      expect(t.state.phase).toBe('running');
      r.drop();
      expect(t.externalConnected).toBe(false);
      expect(t.state.phase).toBe('idle');
      expect(t.records).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(2499);
      expect(attach).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(attach.mock.calls.map(([options]) => options.deviceId)).toEqual([r.device.deviceId, r.device.deviceId]);
      expect(scan).not.toHaveBeenCalled();
      expect(t.externalConnected).toBe(true);
      r.notify(ganFrame(4));
      expect(t.records).toHaveLength(0);
      expect(t.scramble).toBe('R U');
      r.notify(ganFrame(3));
      r.notify(ganFrame(4));
      r.notify(ganFrame(4));
      expect(t.records.map(solve => solve.timeMs)).toEqual([12_345]);
    } finally { await disconnectExternalTimer(); t.dispose(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });

  it('reuses the manually confirmed QiYi MAC during native recovery', async () => {
    vi.useFakeTimers();
    const r = rig(true);
    const device = { ...r.device, name: 'QY-Adapter' };
    const receiver = vi.fn();
    vi.stubGlobal('wx', r.api);
    const { startExternalTimer, disconnectExternalTimer } = await import('../src/lib/external-timer/session');
    try {
      await startExternalTimer('', 'qiyi-timer', receiver, { device, mac: 'CA:FE:12:AB:CD:EF' });
      const hello = r.writes.splice(0);
      expect(hello).not.toHaveLength(0);
      r.drop();
      await vi.advanceTimersByTimeAsync(2500);
      expect(r.writes).toEqual(hello);
      expect(receiver.mock.calls.map(([event]) => event.phase)).toEqual(['connected', 'disconnected', 'connected']);
    } finally { await disconnectExternalTimer(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });

  it.each(['manual disconnect', 'retry failed', 'timer busy'])('does not keep retrying after %s', async reason => {
    vi.useFakeTimers();
    const r = rig();
    const attach = vi.spyOn(r.api, 'createBLEConnection');
    const receiver = vi.fn();
    vi.stubGlobal('wx', r.api);
    const { startExternalTimer, disconnectExternalTimer } = await import('../src/lib/external-timer/session');
    try {
      await startExternalTimer('', 'gan-timer', receiver, { device: r.device, canReconnect: () => reason !== 'timer busy' });
      r.notify(ganFrame(0));
      if (reason === 'manual disconnect') await disconnectExternalTimer();
      if (reason === 'retry failed') attach.mockImplementationOnce(o => { o.fail?.({ errMsg: 'timer powered off' }); });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(attach).toHaveBeenCalledTimes(reason === 'retry failed' ? 2 : 1);
      expect(receiver.mock.calls.map(([event]) => event.phase)).toEqual(['connected', 'disconnected']);
    } finally { await disconnectExternalTimer(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
});

describe('Stackmat recorder lifecycle', () => {
  it('uses Douyin PCM, keeps the attempt across the recording limit, and saves an observed stop once', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const listeners: {
      start?: () => void;
      stop?: (result: { duration: number }) => void;
      frame?: (result: { frameBuffer: ArrayBuffer }) => void;
    } = {};
    const recorder = {
      start: vi.fn(() => listeners.start?.()), stop: vi.fn(() => listeners.stop?.({ duration: 60_000 })),
      onStart(fn: NonNullable<typeof listeners.start>) { listeners.start = fn; },
      onStop(fn: NonNullable<typeof listeners.stop>) { listeners.stop = fn; },
      onFrameRecorded(fn: NonNullable<typeof listeners.frame>) { listeners.frame = fn; },
      onPause() {}, onError() {},
    };
    const playback = (state: Parameters<typeof synthesizePacket>[0], timeMs: number) => {
      const samples = synthesizePacket(state, timeMs, 44_100);
      const frameBuffer = new ArrayBuffer(samples.length * 2);
      const pcm = new DataView(frameBuffer);
      samples.forEach((sample, i) => pcm.setInt16(i * 2, Math.round(sample * 30_000), true));
      listeners.frame?.({ frameBuffer });
    };
    const storage = { getStorageSync: () => undefined, setStorageSync: vi.fn(), removeStorageSync: vi.fn() };
    const timer = new NativeTimer(storage, Date.now);
    timer.setManualScrambles('R U\nR2 U2');
    const onStackmatSnapshot = vi.fn();
    const onStackmatError = vi.fn();
    vi.stubGlobal('__MINI_PROGRAM_TARGET__', 'douyin');
    vi.stubGlobal('tt', { ...storage, getRecorderManager: () => recorder });
    const { startExternalTimer, disconnectExternalTimer } = await import('../src/lib/external-timer/session');
    try {
      await startExternalTimer('', 'stackmat-mic', timer.receiveExternal, { onStackmatSnapshot, onStackmatError });
      expect(recorder.start).toHaveBeenCalledWith({ format: 'pcm', sampleRate: 44100, numberOfChannels: 1, encodeBitRate: 128000, frameSize: 1, duration: 60000 });
      expect(timer.externalKind).toBe('stackmat-mic');
      playback('S', 12_000);
      expect(timer.state.phase).toBe('running');
      listeners.stop?.({ duration: 60_000 });
      await vi.advanceTimersByTimeAsync(0);
      expect(recorder.start).toHaveBeenCalledTimes(2);
      expect(timer.externalConnected).toBe(true);
      playback(' ', 12_345);
      playback(' ', 12_345);
      expect(timer.records.map(solve => solve.timeMs)).toEqual([12_345]);
      expect(onStackmatSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ listening: true, signalPresent: true, phase: 'stopped', ms: 12_345, unit: 1 }));
      expect(onStackmatError).not.toHaveBeenCalled();
      await disconnectExternalTimer();
      await vi.advanceTimersByTimeAsync(0);
      expect(recorder.start).toHaveBeenCalledTimes(2);
      expect(recorder.stop).toHaveBeenCalledOnce();
      expect(timer.externalConnected).toBe(false);
    } finally { await disconnectExternalTimer(); timer.dispose(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });

  it('uses PCM only, stops on cancellation and ignores late audio', async () => {
    vi.resetModules();
    const callbacks: Record<string, (...args: never[]) => void> = {};
    const start = vi.fn(() => callbacks.start());
    const stop = vi.fn(() => callbacks.stop());
    const recorder = { start, stop,
      onStart: (f: () => void) => { callbacks.start = f; },
      onStop: (f: () => void) => { callbacks.stop = f; },
      onError: (f: () => void) => { callbacks.error = f; },
      onPause: (f: () => void) => { callbacks.pause = f; },
      onInterruptionBegin: (f: () => void) => { callbacks.interruption = f; },
      onFrameRecorded: (f: () => void) => { callbacks.frame = f; },
    };
    vi.stubGlobal('wx', { getRecorderManager: () => recorder });
    try {
      const { connectNativeStackmat } = await import('../src/lib/external-timer/stackmat');
      const onEvent = vi.fn(); const onDisconnect = vi.fn();
      const connection = await connectNativeStackmat({ onEvent, onDisconnect });
      expect(start).toHaveBeenCalledWith({ format: 'PCM', sampleRate: 44100, numberOfChannels: 1, frameSize: 1, duration: 600000, audioSource: 'auto' });
      await connection.disconnect(); await connection.disconnect();
      expect(stop).toHaveBeenCalledOnce();
      callbacks.frame({ frameBuffer: new ArrayBuffer(1024) } as never);
      expect(onEvent).not.toHaveBeenCalled();
      const reconnected = await connectNativeStackmat({ onEvent, onDisconnect });
      callbacks.pause();
      expect(onDisconnect).toHaveBeenCalledOnce();
      expect(stop).toHaveBeenCalledTimes(2);
      await reconnected.disconnect();
    } finally { vi.unstubAllGlobals(); }
  });

  it('rejects a permission denial without leaving a stuck recorder owner', async () => {
    vi.resetModules();
    let onError = (_error: { errMsg: string }) => {};
    const stop = vi.fn();
    vi.stubGlobal('wx', { getRecorderManager: () => ({
      onStart() {}, onStop() {}, onPause() {}, onInterruptionBegin() {}, onFrameRecorded() {},
      onError(f: typeof onError) { onError = f; },
      start() { onError({ errMsg: 'permission denied' }); }, stop,
    }) });
    try {
      const { connectNativeStackmat } = await import('../src/lib/external-timer/stackmat');
      await expect(connectNativeStackmat({ onEvent: vi.fn(), onDisconnect: vi.fn() })).rejects.toThrow('permission denied');
      expect(stop).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('Stackmat pending native start cleanup', () => {
  it.each(['abort', 'timeout'])('stops on %s, stops a late start and quarantines the recorder until native stop', async (mode) => {
    vi.resetModules(); vi.useFakeTimers();
    const callbacks: Record<string, (...args: any[]) => void> = {};
    const start = vi.fn(); const stop = vi.fn(); let abort = () => {};
    const recorder: Record<string, unknown> = { start, stop };
    for (const name of ['Start', 'Stop', 'Error', 'Pause', 'InterruptionBegin', 'FrameRecorded'])
      recorder['on' + name] = (callback: (...args: any[]) => void) => { callbacks[name] = callback; };
    vi.stubGlobal('wx', { getRecorderManager: () => recorder });
    try {
      const { connectNativeStackmat } = await import('../src/lib/external-timer/stackmat');
      const options = { onEvent: vi.fn(), onDisconnect: vi.fn(), signal: { aborted: false, onAbort(f: () => void) { abort = f; return () => {}; } } };
      const pending = connectNativeStackmat(options);
      const rejected = expect(pending).rejects.toThrow(mode === 'abort' ? 'CANCELLED' : '超时');
      if (mode === 'abort') abort(); else await vi.advanceTimersByTimeAsync(10000);
      await rejected; expect(stop).toHaveBeenCalledTimes(1);
      callbacks.Start(); expect(stop).toHaveBeenCalledTimes(2);
      callbacks.FrameRecorded({ frameBuffer: new ArrayBuffer(1024) });
      expect(options.onEvent).not.toHaveBeenCalled();
      const next = connectNativeStackmat({ onEvent: vi.fn(), onDisconnect: vi.fn() });
      expect(start).toHaveBeenCalledTimes(1);
      callbacks.Stop(); await vi.advanceTimersByTimeAsync(0);
      expect(start).toHaveBeenCalledTimes(2); callbacks.Start();
      const connection = await next; await connection.disconnect(); callbacks.Stop();
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
  });
});
