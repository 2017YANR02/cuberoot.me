import { describe, expect, it, vi } from 'vitest';
import {
  createMoyu32Cipher, createMoyu32Command, MOYU32_MESSAGE_STATE, MOYU32_SOLVED_STATE,
  moyu32AdvertisementMac, moyu32ManufacturerMac, moyu32MacCandidates,
  MOYU32_MANUFACTURER_IDS, resolveMoyu32Address,
} from '@cuberoot/shared/smart-cube/moyu32';
import { macStringToBytes } from '@cuberoot/shared/timer/external/mac';

function statePacket(facelets = MOYU32_SOLVED_STATE): Uint8Array {
  const packet = createMoyu32Command(MOYU32_MESSAGE_STATE);
  for (const [output, wire] of [2, 5, 0, 3, 4, 1].entries()) {
    const face = facelets.slice(output * 9, output * 9 + 9);
    for (const [index, sticker] of (face.slice(0, 4) + face.slice(5)).split('').entries()) {
      const colour = 'FBUDLR'.indexOf(sticker);
      for (let bit = 0; bit < 3; bit++) {
        const offset = 8 + wire * 24 + index * 3 + bit;
        packet[offset >> 3] |= ((colour >> (2 - bit)) & 1) << (7 - (offset & 7));
      }
    }
  }
  return packet;
}
function rig(mac: string, facelets = MOYU32_SOLVED_STATE) {
  const cipher = createMoyu32Cipher(macStringToBytes(mac));
  let receive: ((frame: Uint8Array) => void) | undefined;
  const stop = vi.fn(async () => { receive = undefined; });
  const io = {
    current: () => true,
    subscribe: async (callback: typeof receive) => { receive = callback; return stop; },
    write: vi.fn(async (encrypted: Uint8Array) => {
      const plain = cipher.decrypt(encrypted);
      if (plain.every((byte, index) => byte === (index === 0 ? 0xa3 : 0))) {
        receive?.(cipher.encrypt(statePacket(facelets)));
      }
    }),
  };
  return { io, stop };
}
describe('shared MoYu32 address negotiation', () => {
  it('reads trailing six bytes under zero and account-derived manufacturer IDs', () => {
    const payload = Uint8Array.of(9, 8, 7, 0x9e, 0xaf, 2, 0x16, 0x30, 0xcf);
    expect(MOYU32_MANUFACTURER_IDS[0]).toBe(0);
    expect(moyu32ManufacturerMac(new Map([[0, payload]]))).toBe('CF:30:16:02:AF:9E');
    expect(moyu32ManufacturerMac(new Map([[0x1234, payload]]))).toBe('CF:30:16:02:AF:9E');
    expect(moyu32AdvertisementMac(new Uint8Array(6))).toBeNull();
    expect(moyu32AdvertisementMac(Uint8Array.of(1, 2))).toBeNull();
  });
  it('orders MY32/MY33 hints without treating them as known addresses', () => {
    expect(moyu32MacCandidates('WCU_MY32_a388')).toEqual(['CF:30:16:00:A3:88', 'CF:30:16:01:A3:88', 'CF:30:16:02:A3:88']);
    expect(moyu32MacCandidates('WCU_MY33_AF9E')[0]).toBe('CF:30:16:02:AF:9E');
    expect(moyu32MacCandidates('WCU_MY32_bad')).toEqual([]);
  });
  it('rejects a stale address and verifies the next candidate before caching', async () => {
    const r = rig('CF:30:16:01:A3:88'), requestMac = vi.fn(), onVerified = vi.fn(), onRejected = vi.fn();
    expect(await resolveMoyu32Address({ id: 'candidate-test', name: 'WCU_MY32_A388',
      hints: ['CF:30:16:00:A3:88'], io: r.io, timeoutMs: 10, requestMac, onVerified, onRejected,
    })).toBe('CF:30:16:01:A3:88');
    expect(r.io.write).toHaveBeenCalledTimes(2);
    expect(requestMac).not.toHaveBeenCalled();
    expect(onRejected).toHaveBeenCalledWith('CF:30:16:00:A3:88');
    expect(onVerified).toHaveBeenCalledWith('CF:30:16:01:A3:88');
    expect(r.stop).toHaveBeenCalledOnce();
    r.io.write.mockClear();
    await resolveMoyu32Address({ id: 'candidate-test', name: 'WCU_MY32_A388', io: r.io, timeoutMs: 10 });
    expect(r.io.write).toHaveBeenCalledOnce();
  });
  it('verifies manual input too and rejects a colour-correct but impossible cube', async () => {
    const facelets = MOYU32_SOLVED_STATE.split('');
    [facelets[5], facelets[10]] = [facelets[10], facelets[5]]; // one flipped UR edge
    const r = rig('CF:30:16:00:12:34', facelets.join('')), onVerified = vi.fn();
    await expect(resolveMoyu32Address({ id: 'illegal-test', name: 'WCU_MY3_unknown', io: r.io,
      requestMac: async () => 'CF:30:16:00:12:34', timeoutMs: 10, onVerified,
    })).rejects.toThrow('MAC unavailable or invalid');
    expect(onVerified).not.toHaveBeenCalled();
    expect(r.stop).toHaveBeenCalledOnce();
  });
  it('stops candidate writes and removes the listener after cancellation', async () => {
    const r = rig('CF:30:16:02:12:34');
    let active = true;
    r.io.current = () => active;
    r.io.write = vi.fn(async () => { active = false; });
    await expect(resolveMoyu32Address({ id: 'cancel-test', name: 'WCU_MY32_1234', io: r.io, timeoutMs: 10 }))
      .rejects.toThrow('connection closed');
    expect(r.io.write).toHaveBeenCalledOnce();
    expect(r.stop).toHaveBeenCalledOnce();
  });
});

it('bounds a native write that never acknowledges and does not probe another key', async () => {
  const r = rig('CF:30:16:01:12:34');
  r.io.write = vi.fn(() => new Promise<void>(() => {}));
  await expect(resolveMoyu32Address({ id: 'stalled-write-test', name: 'WCU_MY32_1234', io: r.io, timeoutMs: 10 }))
    .rejects.toThrow('probe timed out');
  expect(r.io.write).toHaveBeenCalledOnce();
  expect(r.stop).toHaveBeenCalledOnce();
});
