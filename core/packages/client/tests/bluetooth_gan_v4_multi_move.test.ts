import { describe, expect, it, vi } from 'vitest';
import {
  createGanV4Cipher, createGanV4DecodeState, decodeGanV4Frame,
  GAN_V4_SERVICE_UUID, GAN_V4_NOTIFY_CHARACTERISTIC_UUID, GAN_V4_WRITE_CHARACTERISTIC_UUID,
} from '@cuberoot/shared/smart-cube/gan-v4';
import { ganV4Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v4';
import { CubeStateTracker } from '@/app/[lang]/timer/_lib/bluetooth/state_track';
import { makeFakeGatt } from './_fake_gatt';
import { ganV4MoveFrame, ganV4HistoryFrame, ganV4FaceletFrame } from './_bt_frame_fixtures';

// DCTimer-BLE's handleV4Move walks complete 72-bit records, including headers.
function packet(...records: number[][]): Uint8Array {
  const bytes = new Uint8Array(records.length <= 2 ? 20 : 32);
  records.forEach((record, index) => bytes.set(record.slice(0, 9), index * 9));
  return bytes;
}
function rig(counter = 0) {
  const requestHistory = vi.fn();
  const state = createGanV4DecodeState({ requestHistory, now: () => 5000 });
  state.sync.seed(counter);
  return { state, requestHistory };
}

describe('GAN v4 multi-move notifications', () => {
  it('emits both turns with their original timestamps without requesting history', () => {
    const { state, requestHistory } = rig();
    expect(decodeGanV4Frame(packet(
      ganV4MoveFrame(1, 1, 0, 1000), ganV4MoveFrame(2, 4, 1, 1040),
    ), state)).toEqual([{ mv: 'R', ts: 1000 }, { mv: "L'", ts: 1040 }]);
    expect(state.sync.counter).toBe(2);
    expect(state.sync.pending).toBe(0);
    expect(requestHistory).not.toHaveBeenCalled();
  });

  it('handles three records and an 8-bit counter wrap', () => {
    const { state, requestHistory } = rig(254);
    expect(decodeGanV4Frame(packet(
      ganV4MoveFrame(255, 0, 0, 1000), ganV4MoveFrame(256, 1, 0, 1030), ganV4MoveFrame(257, 2, 0, 1060),
    ), state).map(move => move.mv)).toEqual(['U', 'R', 'F']);
    expect(state.sync.counter).toBe(1);
    expect(requestHistory).not.toHaveBeenCalled();
  });

  it('ignores a replayed packet and an already-consumed prefix', () => {
    const { state, requestHistory } = rig();
    const first = packet(ganV4MoveFrame(1, 1, 0, 1000), ganV4MoveFrame(2, 0, 0, 1050));
    expect(decodeGanV4Frame(first, state)).toHaveLength(2);
    expect(decodeGanV4Frame(first, state)).toEqual([]);
    expect(decodeGanV4Frame(packet(ganV4MoveFrame(2, 0, 0, 1050), ganV4MoveFrame(3, 2, 0, 1100)), state))
      .toEqual([{ mv: 'F', ts: 1100 }]);
    expect(requestHistory).not.toHaveBeenCalled();
  });

  it('requests a real gap once after parsing the packet, retaining later timestamps', () => {
    const { state, requestHistory } = rig();
    expect(decodeGanV4Frame(packet(
      ganV4MoveFrame(1, 1, 0, 1000), ganV4MoveFrame(3, 0, 0, 1100), ganV4MoveFrame(4, 2, 0, 1200),
    ), state)).toEqual([{ mv: 'R', ts: 1000 }]);
    expect(requestHistory).toHaveBeenCalledExactlyOnceWith(3, 2);
    expect(decodeGanV4Frame(Uint8Array.from(ganV4HistoryFrame(3, [
      { axis: 1, pow: 0 }, { axis: 4, pow: 0 },
    ])), state)).toEqual([{ mv: 'L', ts: 1050 }, { mv: 'U', ts: 1100 }, { mv: 'F', ts: 1200 }]);
    expect(state.sync.pending).toBe(0);
  });

  it('ignores padding and truncated records, and rejects an invalid second move', () => {
    for (const length of [16, 17, 20]) {
      const { state } = rig();
      const bytes = packet(ganV4MoveFrame(1, 1, 0, 1000));
      if (length < 18) bytes[9] = 1;
      expect(decodeGanV4Frame(bytes.slice(0, length), state)).toEqual([{ mv: 'R', ts: 1000 }]);
    }
    const { state } = rig();
    const bad = packet(ganV4MoveFrame(1, 1, 0, 1000), ganV4MoveFrame(2, 0, 0, 1040));
    bad[17] = 0;
    expect(decodeGanV4Frame(bad, state)).toEqual([{ mv: 'R', ts: 1000 }]);
    expect(state.badFrames).toBe(1);
    expect(state.sync.counter).toBe(1);
  });

  it('does not apply a batch before its initial facelet snapshot', () => {
    const state = createGanV4DecodeState();
    expect(decodeGanV4Frame(packet(ganV4MoveFrame(1, 1, 0), ganV4MoveFrame(2, 0, 0)), state)).toEqual([]);
    expect(state.sync.seeded).toBe(false);
  });

  it('delivers the solved final turn in one encrypted Web notification', async () => {
    const gatt = makeFakeGatt('GAN12ui', {
      [GAN_V4_SERVICE_UUID]: [GAN_V4_NOTIFY_CHARACTERISTIC_UUID, GAN_V4_WRITE_CHARACTERISTIC_UUID],
    });
    const cipher = createGanV4Cipher(new Uint8Array([0xab, 0x12, 0x34, 0x56, 0x78, 0x90]));
    const tracker = new CubeStateTracker();
    const output: Array<{ move: string; ts?: number; solved: boolean }> = [];
    const session = await ganV4Driver.start(gatt.asServer, (move, ts) => {
      tracker.applyMove(move);
      output.push({ move, ts, solved: tracker.isSolved() });
    }, { mac: 'AB:12:34:56:78:90', onState: facelets => { tracker.adoptFacelets(facelets); } });
    try {
      const notify = gatt.char(GAN_V4_SERVICE_UUID, GAN_V4_NOTIFY_CHARACTERISTIC_UUID);
      notify.emit(cipher.encrypt(Uint8Array.from(ganV4FaceletFrame(0,
        Array.from({ length: 8 }, (_, i) => i), Array.from({ length: 12 }, (_, i) => i * 2),
      ))));
      notify.emit(cipher.encrypt(packet(ganV4MoveFrame(1, 1, 0, 1000), ganV4MoveFrame(2, 1, 1, 1040))));
      expect(output).toEqual([{ move: 'R', ts: 1000, solved: false }, { move: "R'", ts: 1040, solved: true }]);
      expect(gatt.writes.some(write => cipher.decrypt(Uint8Array.from(write.bytes))[0] === 0xd1)).toBe(false);
    } finally { session.cleanup(); }
  });
});
