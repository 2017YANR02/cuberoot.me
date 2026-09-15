import { describe, expect, it, vi } from 'vitest';
import { createDeviceStateReset } from '@/app/[lang]/timer/_lib/bluetooth/device_reset';
import { ganV2Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v2';
import { ganV3Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v3';
import { ganV4Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v4';
import { createGanV2Cipher } from '@cuberoot/shared/smart-cube/gan-v2';
import { createGanV3Cipher } from '@cuberoot/shared/smart-cube/gan-v3';
import { createGanV4Cipher } from '@cuberoot/shared/smart-cube/gan-v4';
import { makeFakeGatt } from './_fake_gatt';
import { GAN_V2_READ, GAN_V2_WRITE, GAN_V3_READ, GAN_V3_WRITE, GAN_V4_READ, GAN_V4_WRITE, ganV2FaceletFrame, ganV3FaceletFrame, ganV4FaceletFrame } from './_bt_frame_fixtures';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const versions = [
  { driver: ganV2Driver, read: GAN_V2_READ, write: GAN_V2_WRITE, cipher: createGanV2Cipher, state: ganV2FaceletFrame, reset: '0A05397700000123456789AB0000000000000000' },
  { driver: ganV3Driver, read: GAN_V3_READ, write: GAN_V3_WRITE, cipher: createGanV3Cipher, state: ganV3FaceletFrame, reset: '680505397700000123456789AB000000' },
  { driver: ganV4Driver, read: GAN_V4_READ, write: GAN_V4_WRITE, cipher: createGanV4Cipher, state: ganV4FaceletFrame, reset: 'D20D05397700000123456789AB00000000000000' },
];

describe('GAN device-state calibration', () => {
  it.each(versions)('sends the DCTimer reset bytes and waits for $driver.brand confirmation', async (v) => {
    const gatt = makeFakeGatt('GAN12ui', { [v.driver.service]: [v.read, v.write] });
    const cipher = v.cipher(new Uint8Array([0xab, 0x12, 0x34, 0x56, 0x78, 0x90]));
    const onState = vi.fn();
    const session = await v.driver.start(gatt.asServer, vi.fn(), { mac: 'AB:12:34:56:78:90', onState });
    try {
      const before = gatt.writes.length;
      let done = false;
      const reset = session.resetDeviceState!().then(() => { done = true; });
      void reset.catch(() => {});
      await vi.waitFor(() => expect(gatt.writes.length).toBe(before + 2));
      expect(done).toBe(false);
      expect(cipher.decrypt(Uint8Array.from(gatt.writes[before].bytes)))
        .toEqual(Uint8Array.from(Buffer.from(v.reset, 'hex')));
      gatt.char(v.driver.service, v.read).emit(cipher.encrypt(Uint8Array.from(v.state(5,
        Array.from({ length: 8 }, (_, i) => i), Array.from({ length: 12 }, (_, i) => i * 2),
      ))));
      await reset;
      expect(onState).toHaveBeenCalledWith(SOLVED);
      expect(done).toBe(true);
    } finally { session.cleanup(); }
  });

  it('propagates a rejected device write instead of claiming success', async () => {
    const v = versions[2];
    const gatt = makeFakeGatt('GAN12ui', { [v.driver.service]: [v.read, v.write] });
    const session = await v.driver.start(gatt.asServer, vi.fn(), { mac: 'AB:12:34:56:78:90' });
    gatt.char(v.driver.service, v.write).failWrites = true;
    try { await expect(session.resetDeviceState!()).rejects.toThrow(); }
    finally { session.cleanup(); }
  });

  it('times out, rejects unsolved replies, and cancels pending work on disconnect', async () => {
    vi.useFakeTimers();
    try {
      const reset = createDeviceStateReset({ sendReset: async () => {}, prepareSnapshot() {}, requestSnapshot: async () => {} });
      const timeout = expect(reset.run()).rejects.toThrow('did not confirm');
      await vi.advanceTimersByTimeAsync(4000); await timeout;
      const unsolved = expect(reset.run()).rejects.toThrow('not solved');
      await vi.advanceTimersByTimeAsync(0); reset.observe('not-solved'); await unsolved;
      const cancelled = expect(reset.run()).rejects.toThrow('disconnected');
      reset.dispose(); await cancelled;
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
