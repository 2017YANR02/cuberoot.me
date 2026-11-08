import { createMoyu32Cipher, createMoyu32ResetCommand, MOYU32_SERVICE_UUID, MOYU32_WRITE_CHARACTERISTIC_UUID, MOYU32_NOTIFY_CHARACTERISTIC_UUID } from '@cuberoot/shared/smart-cube/moyu32';
import { macStringToBytes } from '@cuberoot/shared/timer/external/mac';
import { vi } from 'vitest';
import type { makeFakeGatt } from './_fake_gatt';

/** A stationary cube replying to an explicit state query, without gyro or moves. */
export function replyMoyu32State(gatt: ReturnType<typeof makeFakeGatt>, mac = 'CF:30:16:00:A1:B2', counter = 10) {
  const cipher = createMoyu32Cipher(macStringToBytes(mac));
  const state = createMoyu32ResetCommand();
  state[0] = 0xa3;
  state[19] = counter;
  const writer = gatt.char(MOYU32_SERVICE_UUID, MOYU32_WRITE_CHARACTERISTIC_UUID);
  const original = writer.writeValue.bind(writer);
  return vi.spyOn(writer, 'writeValue').mockImplementation(async bytes => {
    await original(bytes);
    const raw = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (cipher.decrypt(raw).every((byte, i) => byte === (i === 0 ? 0xa3 : 0))) {
      gatt.char(MOYU32_SERVICE_UUID, MOYU32_NOTIFY_CHARACTERISTIC_UUID).emit(cipher.encrypt(state));
    }
  });
}
