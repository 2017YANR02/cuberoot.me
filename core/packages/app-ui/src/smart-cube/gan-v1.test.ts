import { createCipheriv } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { GAN_V1_CHARACTERISTICS as C, GAN_V1_META_SERVICE_UUID, GAN_V1_SERVICE_UUID } from '@cuberoot/shared/smart-cube/gan-v1';
import { GanCubeConnection } from './gan-cube';
import type { BleTransport } from './transport';

afterEach(() => vi.useRealTimers());
// csTimer Gen1 1.0.8 base key, zero hardware salt; Node crypto is an independent AES oracle.
const KEY = Buffer.from([198, 202, 21, 223, 79, 110, 19, 182, 119, 13, 230, 89, 58, 175, 186, 162]);
function encrypted(frame: Uint8Array) {
  const result = Buffer.from(frame);
  for (const offset of [0, result.length - 16]) {
    const aes = createCipheriv('aes-128-ecb', KEY, null); aes.setAutoPadding(false);
    Buffer.concat([aes.update(result.subarray(offset, offset + 16)), aes.final()]).copy(result, offset);
  }
  return new DataView(result.buffer, result.byteOffset, result.length);
}
function setup() {
  let counter = 254, race = false;
  const onMove = vi.fn(), onState = vi.fn(), onProtocolError = vi.fn(), onNeedMac = vi.fn();
  const transport: BleTransport = {
    initialize: async () => {}, getMtu: async () => null, requestDevice: async () => { throw new Error('unused'); },
    connect: async () => {}, disconnect: async () => {}, write: async () => {}, subscribe: async () => async () => {},
    getServices: async () => [GAN_V1_SERVICE_UUID, GAN_V1_META_SERVICE_UUID].map(uuid => ({ uuid, characteristics: [] })),
    read: async (_device, _service, characteristic) => {
      if (characteristic === C.version) return new DataView(Uint8Array.of(1, 0, 8).buffer);
      if (characteristic === C.hardware) return new DataView(new Uint8Array(6).buffer);
      const frame = new Uint8Array(20);
      if (characteristic === C.state) frame.set(Buffer.from('00002400499224496d92dbb64992b6246ddb0000', 'hex'));
      if (characteristic === C.moves) { frame[12] = counter; frame[17] = 3; frame[18] = 5; }
      if (characteristic === C.times) {
        new DataView(frame.buffer).setUint16(15, 100, true);
        new DataView(frame.buffer).setUint16(17, 250, true);
        if (race) { counter++; race = false; }
      }
      if (characteristic === C.battery) frame[7] = 80;
      return encrypted(frame);
    },
  };
  const connection = new GanCubeConnection(transport, { onMove, onState, onProtocolError, onNeedMac, onDisconnect() {} });
  return { connection, onMove, onState, onProtocolError, onNeedMac, setCounter: (n: number) => { counter = n; }, race: () => { race = true; } };
}

it('discovers Gen1 without a MAC prompt, seeds state and preserves timed turns across counter wrap', async () => {
  vi.useFakeTimers(); const cube = setup();
  await cube.connection.connect({ id: 'apple-uuid', name: 'GAN356i' });
  expect(cube.connection.getProtocol()).toBe('gan-v1');
  expect(cube.onNeedMac).not.toHaveBeenCalled();
  expect(cube.onState).toHaveBeenCalledWith('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  cube.setCounter(0); await vi.advanceTimersByTimeAsync(30);
  expect(cube.onMove.mock.calls).toEqual([['R', 100, { delayed: true }], ["R'", 350, { delayed: true }]]);
  await cube.connection.disconnect();
  cube.setCounter(1); await vi.advanceTimersByTimeAsync(100);
  expect(cube.onMove).toHaveBeenCalledTimes(2);
});
it('never publishes a mixed move/time window or a truncated history', async () => {
  vi.useFakeTimers(); const cube = setup();
  await cube.connection.connect({ id: 'apple-uuid', name: 'GAN356i' });
  cube.setCounter(255); cube.race(); await vi.advanceTimersByTimeAsync(30);
  expect(cube.onMove).not.toHaveBeenCalled();
  cube.setCounter(8); await vi.advanceTimersByTimeAsync(30);
  expect(cube.onProtocolError).toHaveBeenCalledTimes(1);
  expect(cube.onMove).not.toHaveBeenCalled();
  await cube.connection.disconnect();
});
