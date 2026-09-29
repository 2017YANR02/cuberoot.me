import { describe, expect, it, vi } from 'vitest';
import { connectNativeTimer } from '../src/lib/external-timer/ble';
import { createStackmatPcmReceiver } from '../src/lib/external-timer/stackmat';
import { GAN_TIMER_SERVICE, GAN_TIMER_STATE_CHAR } from '@cuberoot/shared/timer/external/gan';
import { crc16CcittFalse } from '@cuberoot/shared/timer/external/crc';
import { QIYI_TIMER_SERVICE, QIYI_TIMER_READ_CHAR, QIYI_TIMER_WRITE_CHAR, createQiyiTimerReassembler, parseQiyiTimerFrame, encodeQiyiTimerPackets } from '@cuberoot/shared/timer/external/qiyi';
import { synthesizePacket } from '@cuberoot/shared/timer/external/stackmat-decoder';
import type { MiniProgramBleApi, CharacteristicValueChange } from '../src/lib/smart-cube/ble-api';

function rig(qiyi = false) {
  const serviceId = qiyi ? QIYI_TIMER_SERVICE : GAN_TIMER_SERVICE;
  const characteristicId = qiyi ? QIYI_TIMER_READ_CHAR : GAN_TIMER_STATE_CHAR;
  let listener: ((event: CharacteristicValueChange) => void) | undefined;
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
    writeBLECharacteristicValue(o) { writes.push(new Uint8Array(o.value)); o.success?.({}); if (qiyi && writes.length === 2) {
      for (const packet of encodeQiyiTimerPackets(1, 1, 1, [0])) listener?.({ deviceId: 'opaque-ios-id', serviceId, characteristicId, value: Uint8Array.from(packet).buffer });
    } },
  };
  return { api, writes, device: { deviceId: 'opaque-ios-id', name: qiyi ? 'QY-Timer-X-1234' : 'GAN Timer' },
    notify(bytes: Uint8Array) { listener?.({ deviceId: 'opaque-ios-id', serviceId, characteristicId, value: Uint8Array.from(bytes).buffer }); },
  };
}

describe('native external timers', () => {
  it('accepts a notify-only GAN characteristic without fabricating a MAC or write channel', async () => {
    const r = rig(); const onEvent = vi.fn();
    const connection = await connectNativeTimer('gan-timer', { ...r, onEvent, onDisconnect: vi.fn() });
    const bytes = new Uint8Array([0xfe, 8, 0, 4, 0, 12, 0x59, 1, 0, 0]);
    const crc = crc16CcittFalse(bytes.subarray(2, 8));
    bytes[8] = crc & 255; bytes[9] = crc >>> 8;
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

describe('Stackmat recorder lifecycle', () => {
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
