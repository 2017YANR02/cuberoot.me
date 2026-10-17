import { afterEach, expect, it, vi } from 'vitest';
import * as v2 from '@cuberoot/shared/smart-cube/gan-v2';
import * as v3 from '@cuberoot/shared/smart-cube/gan-v3';
import * as v4 from '@cuberoot/shared/smart-cube/gan-v4';
import * as moyu from '@cuberoot/shared/smart-cube/moyu32';
import * as qiyi from '@cuberoot/shared/smart-cube/qiyi';
import { createWatchCubeBridge } from './watch-cube';
import { GAN_V4_FIXTURE } from './smart-cube/gan-v4.fixture';
import { decodeWatchTimerRecord } from './watch-timer';

afterEach(() => vi.useRealTimers());
it.each(['gan-v1', 'gan-v2', 'gan-v3', 'gan-v4', 'moyu32', 'qiyi'])('imports Watch recordings tagged %s', model => {
  const record = { version: 1, id: 'record-1', ts: 1000, timeMs: 500, inspectionMs: 0, penalty: 'ok',
    slot: { id: 'slot-1', sessionId: 'session-1', sessionName: 'Watch', event: '333', eventName: '3x3', scramble: 'R', inspectionSec: 0, holdMs: 300 },
    device: { model, name: 'Cube' }, moves: [{ m: "R'", ts: 0 }] };
  expect(decodeWatchTimerRecord(record)).toEqual(record);
  expect(decodeWatchTimerRecord({ ...record, device: { model: 'unknown', name: 'Cube' } })).toBeNull();
});
const protocols = [
  ['gan-v2', 'GAN12ui', v2.GAN_V2_SERVICE_UUID, v2.GAN_V2_NOTIFY_CHARACTERISTIC_UUID, v2.GAN_V2_WRITE_CHARACTERISTIC_UUID],
  ['gan-v3', 'GAN356i', v3.GAN_V3_SERVICE_UUID, v3.GAN_V3_NOTIFY_CHARACTERISTIC_UUID, v3.GAN_V3_WRITE_CHARACTERISTIC_UUID],
  ['gan-v4', 'GAN356i', v4.GAN_V4_SERVICE_UUID, v4.GAN_V4_NOTIFY_CHARACTERISTIC_UUID, v4.GAN_V4_WRITE_CHARACTERISTIC_UUID],
  ['moyu32', 'WCU_MY32_A1B2', moyu.MOYU32_SERVICE_UUID, moyu.MOYU32_NOTIFY_CHARACTERISTIC_UUID, moyu.MOYU32_WRITE_CHARACTERISTIC_UUID],
  ['qiyi', 'QY-QYSC-1-A1B2', qiyi.QIYI_SERVICE_UUID, qiyi.QIYI_CHARACTERISTIC_UUID, qiyi.QIYI_WRITE_CHARACTERISTIC_UUID],
] as const;

function harness(service: string, notify: string, write: string, prompt = false) {
  const bridge = createWatchCubeBridge(), events: Record<string, any>[] = [], native: Record<string, any>[] = [];
  async function feed(message: Record<string, unknown>) {
    bridge.dispatch(message);
    for (let i = 0; i < 80; i++) {
      await Promise.resolve();
      for (const event of JSON.parse(bridge.drain())) {
        if (event.kind !== 'native') { events.push(event); continue; }
        native.push(event);
        if (event.op === 'needMac' && prompt) continue;
        const value = event.op === 'getServices' ? [{ uuid: service, characteristics: [
          { uuid: notify, properties: { notify: true } }, { uuid: write, properties: { write: true } },
        ] }] : event.op === 'needMac' ? 'AB:CD:EF:01:23:45' : undefined;
        bridge.dispatch({ kind: 'reply', id: event.id, value });
      }
    }
  }
  return { bridge, events, native, feed };
}

it.each(protocols)('Watch discovers and handshakes %s using the actual GATT services', async (_model, name, service, notify, write) => {
  vi.useFakeTimers(); const h = harness(service, notify, write);
  expect(h.bridge.supportsDevice(name)).toBe(true);
  await h.feed({ kind: 'connect', device: { id: 'apple-uuid', name, macAddress: 'AB:CD:EF:01:23:45' }, now: 1000 });
  expect(h.events.filter(event => event.phase === 'error')).toEqual([]);
  expect(h.native.some(event => event.op === 'subscribe' && event.service === service && event.characteristic === notify)).toBe(true);
  expect(h.native.some(event => event.op === 'write' && event.service === service && event.characteristic === write)).toBe(true);
  await h.feed({ kind: 'disconnect' });
});

it('Watch routes notifications by service and characteristic and cancels a pending MAC request', async () => {
  vi.useFakeTimers(); const [, name, service, notify, write] = protocols[2];
  const h = harness(service, notify, write);
  await h.feed({ kind: 'connect', device: { id: 'apple-uuid', name, macAddress: 'AB:CD:EF:01:23:45' }, now: 1000 });
  const cipher = v4.createGanV4Cipher(Uint8Array.of(0xab, 0xcd, 0xef, 1, 0x23, 0x45));
  const packet = { kind: 'notification', bytes: [...cipher.encrypt(Uint8Array.from(GAN_V4_FIXTURE.seed))], characteristic: notify };
  await h.feed({ ...packet, service: qiyi.QIYI_SERVICE_UUID });
  expect(h.events.some(event => event.phase === 'connected')).toBe(false);
  await h.feed({ ...packet, service });
  expect(h.events.some(event => event.phase === 'connected')).toBe(true);
  await h.feed({ kind: 'disconnect' });

  const m = harness(moyu.MOYU32_SERVICE_UUID, moyu.MOYU32_NOTIFY_CHARACTERISTIC_UUID, moyu.MOYU32_WRITE_CHARACTERISTIC_UUID, true);
  await m.feed({ kind: 'connect', device: { id: 'apple-uuid', name: 'WCU_MY32_A1B2' } });
  const request = m.native.find(event => event.op === 'needMac');
  expect(request).toBeDefined();
  await m.feed({ kind: 'disconnect' });
  await m.feed({ kind: 'reply', id: request!.id, value: 'AB:CD:EF:01:23:45' });
  expect(m.native.some(event => event.op === 'subscribe')).toBe(false);
});
