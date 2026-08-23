/**
 * Device clocks: QiYi and MoYu32.
 * =========================================================================
 *
 * Sprint 3 established why arrival time is not good enough (BLE batches
 * notifications, so the gap between two turns — the quantity every per-move
 * metric is made of — is destroyed on the way to us) and wired GAN v3/v4's
 * 32-bit ms counter through to the host. These are the two remaining brands
 * that carry a clock, and neither carries it the same way:
 *
 *   QiYi    a 32-bit counter at 1.6 ticks per ms, and — uniquely — one per
 *           move INCLUDING the up-to-nine history slots, so a dropped
 *           notification costs nothing in timing accuracy.
 *   MoYu32  five u16 DELTAS per frame, the gap before each window slot, which
 *           only mean anything accumulated.
 *
 * The property under test is never the absolute number. It is that the
 * DIFFERENCE between two reported timestamps is the real interval between those
 * two turns, which is what `MoveClock` then anchors to local time.
 */

import { describe, it, expect } from 'vitest';
import { qiyiDriver } from '@/app/[lang]/timer/_lib/bluetooth/qiyi';
import { createMoyu32State, decodeMoyu32Frame } from '@/app/[lang]/timer/_lib/bluetooth/moyu32';
import { MoveClock } from '@/app/[lang]/timer/_lib/bluetooth/move_clock';
import { makeFakeGatt } from '@/tests/_fake_gatt';
import {
  createCstimerSandbox, cstimerFileExists, type CstimerSandbox,
} from '@/tests/_cstimer_sandbox';
import {
  installQiyiCrypto, qiyiFrameBody, qiyiApplyMoves, qiyiResetCube,
  packBits, type BitWrite, type QiyiCrypto,
  QIYI_SERVICE, QIYI_CHAR,
} from '@/tests/_bt_frame_fixtures';

const HAVE_CSTIMER = cstimerFileExists();
const describeIf = HAVE_CSTIMER ? describe : describe.skip;

/* ================================================================== */
/*  QiYi — 1.6 ticks per millisecond, one per move                     */
/* ================================================================== */

const QIYI_DEVICE = 'QY-QYSC-2-A1B2';

interface QiyiRig {
  sb: CstimerSandbox;
  crypto: QiyiCrypto;
  moves: Array<{ mv: string; ts?: number }>;
  feed(cipher: number[]): void;
}

async function makeQiyiRig(): Promise<QiyiRig> {
  const sb = await createCstimerSandbox({
    hardware: 'qiyicube.js',
    deviceName: QIYI_DEVICE,
    services: { [QIYI_SERVICE]: [QIYI_CHAR] },
    mac: 'CC:A3:00:00:A1:B2',
  });
  const crypto = installQiyiCrypto(sb);
  await sb.connect();
  qiyiResetCube(sb);

  const gatt = makeFakeGatt(QIYI_DEVICE, { [QIYI_SERVICE]: [QIYI_CHAR] });
  const moves: Array<{ mv: string; ts?: number }> = [];
  await qiyiDriver.start(gatt.asServer, (mv, ts) => moves.push({ mv, ts }), {
    mac: 'CC:A3:00:00:A1:B2',
  });
  const notify = gatt.char(QIYI_SERVICE, QIYI_CHAR);
  return { sb, crypto, moves, feed: (c) => notify.emit(c) };
}

describeIf('QiYi device clock', () => {
  it('converts its 1.6-per-ms tick counter to milliseconds', async () => {
    const rig = await makeQiyiRig();
    const after = qiyiApplyMoves(rig.sb, [1]);
    // 16000 ticks / 1.6 = 10000 ms. csTimer: Math.trunc(ts / 1.6).
    rig.feed(rig.crypto.build(qiyiFrameBody({
      opcode: 3, ts: 16_000, facelet: after, curMove: 1,
    })));
    expect(rig.moves).toEqual([{ mv: "L'", ts: 10_000 }]);
  });

  it('recovers the true interval from moves that arrived in one batch', async () => {
    const rig = await makeQiyiRig();
    // Three turns 250 ms apart on the cube clock (400 ticks each), delivered as
    // three notifications in the same connection interval.
    let facelet = qiyiResetCube(rig.sb);
    const ticks = [1000, 1400, 1800];
    for (let i = 0; i < 3; i++) {
      facelet = qiyiApplyMoves(rig.sb, [3]);
      rig.feed(rig.crypto.build(qiyiFrameBody({
        opcode: 3, ts: ticks[i], facelet, curMove: 3,
      })));
    }
    const stamps = rig.moves.map((m) => m.ts!);
    const gaps = stamps.slice(1).map((t, i) => t - stamps[i]);
    expect(gaps).toEqual([250, 250]);
  });

  it('stamps moves recovered from history with their OWN time, not the frame time', async () => {
    const rig = await makeQiyiRig();
    // Baseline so lastTs is 1000 ticks.
    let facelet = qiyiApplyMoves(rig.sb, [1]);
    rig.feed(rig.crypto.build(qiyiFrameBody({
      opcode: 3, ts: 1000, facelet, curMove: 1,
    })));
    rig.moves.length = 0;

    // Two notifications went missing. The next frame reports the newest move at
    // 2600 ticks and carries the two lost ones in its history slots, each with
    // its own timestamp. history[0] is one step back, history[1] two steps.
    facelet = qiyiApplyMoves(rig.sb, [3, 5, 7]);
    rig.feed(rig.crypto.build(qiyiFrameBody({
      opcode: 3,
      ts: 2600,
      facelet,
      curMove: 7,
      history: [{ ts: 2200, mv: 5 }, { ts: 1800, mv: 3 }],
    })));

    // Chronological order, each with the time the cube recorded for it:
    // 1800/1.6 = 1125, 2200/1.6 = 1375, 2600/1.6 = 1625.
    // Move bytes 3 / 5 / 7 decode as R' / D' / U' — axis
    // `[4,1,3,0,2,5][(mv-1)>>1]`, power `[0,2][mv&1]`.
    expect(rig.moves).toEqual([
      { mv: "R'", ts: 1125 },
      { mv: "D'", ts: 1375 },
      { mv: "U'", ts: 1625 },
    ]);
    // This is the property GAN cannot offer: the recovered moves are spaced
    // 250 ms apart exactly as they happened, not collapsed onto arrival.
    const stamps = rig.moves.map((m) => m.ts!);
    expect(stamps.slice(1).map((t, i) => t - stamps[i])).toEqual([250, 250]);
  });

  it('feeds MoveClock timestamps whose intervals survive a batched delivery', async () => {
    const rig = await makeQiyiRig();
    let facelet = qiyiResetCube(rig.sb);
    for (const ts of [800, 960, 1120]) {
      facelet = qiyiApplyMoves(rig.sb, [3]);
      rig.feed(rig.crypto.build(qiyiFrameBody({ opcode: 3, ts, facelet, curMove: 3 })));
    }

    // All three notifications land within 2 ms of each other locally.
    const clock = new MoveClock();
    const arrivals = [5000, 5001, 5001.5];
    const local = rig.moves.map((m, i) => clock.stamp(m.ts, arrivals[i]));
    // 160 ticks = 100 ms.
    expect(local.slice(1).map((t, i) => t - local[i])).toEqual([100, 100]);
  });

  it('does not stamp the hello frame as a move', async () => {
    const rig = await makeQiyiRig();
    rig.feed(rig.crypto.build(qiyiFrameBody({
      opcode: 2, ts: 12_345, facelet: qiyiResetCube(rig.sb), battery: 70,
    })));
    expect(rig.moves).toEqual([]);
  });
});

/* ================================================================== */
/*  MoYu32 — accumulated inter-move deltas                             */
/* ================================================================== */

/** 0xA3 snapshot carrying only the move counter (blank facelets). */
function moyu32Seed(moveCnt: number): Uint8Array {
  return Uint8Array.from(packBits(20, [[0, 8, 0xa3], [152, 8, moveCnt & 0xff]]));
}

/**
 * 0xA5 move frame with both the move codes and the five inter-move offsets.
 * `timeOffs[i]` is the gap BEFORE window slot i, and slot 0 is the NEWEST move.
 */
function moyu32MoveFrame(moveCnt: number, codes: number[], timeOffs: number[] = []): Uint8Array {
  const writes: BitWrite[] = [[0, 8, 0xa5], [88, 8, moveCnt & 0xff]];
  for (let i = 0; i < 5; i++) {
    writes.push([96 + i * 5, 5, (codes[i] ?? 0) & 0x1f]);
    writes.push([8 + i * 16, 16, (timeOffs[i] ?? 0) & 0xffff]);
  }
  return Uint8Array.from(packBits(20, writes));
}

describe('MoYu32 device clock', () => {
  it('accumulates the deltas into a rising clock, oldest move first', () => {
    const dec = createMoyu32State();
    decodeMoyu32Frame(moyu32Seed(0), dec);

    // Counter 0 -> 3: the three newest slots are new. Slot 2 is the oldest of
    // them, so the emitted order is slot 2, 1, 0 and the gaps are the offsets
    // of those slots in that order: 300, 120, 900.
    const moves = decodeMoyu32Frame(
      moyu32MoveFrame(3, [0, 2, 4, 6, 8], [900, 120, 300, 7777, 8888]),
      dec,
    );
    expect(moves.map((m) => m.mv)).toEqual(['U', 'B', 'F']);
    expect(moves.map((m) => m.ts)).toEqual([300, 420, 1320]);
    // The two offsets belonging to slots we did not emit are not consumed.
    expect(dec.deviceTime).toBe(1320);
  });

  it('keeps the clock running across frames', () => {
    const dec = createMoyu32State();
    decodeMoyu32Frame(moyu32Seed(0), dec);
    const first = decodeMoyu32Frame(moyu32MoveFrame(1, [0], [500]), dec);
    const second = decodeMoyu32Frame(moyu32MoveFrame(2, [2], [250]), dec);

    expect(first[0].ts).toBe(500);
    expect(second[0].ts).toBe(750);   // 500 + 250, not 250
  });

  it('only consumes the offsets of the moves it actually emits', () => {
    const dec = createMoyu32State();
    decodeMoyu32Frame(moyu32Seed(0), dec);
    // A jump of 200 is clamped to the 5-slot window: we emit five moves and
    // accumulate five offsets. The turns before those are lost to us, exactly
    // as they are to csTimer — their time is gone with them, and inventing one
    // would put a fabricated gap into every downstream metric.
    const moves = decodeMoyu32Frame(
      moyu32MoveFrame(200, [0, 2, 4, 6, 8], [10, 20, 30, 40, 50]),
      dec,
    );
    expect(moves).toHaveLength(5);
    expect(moves.map((m) => m.ts)).toEqual([50, 90, 120, 140, 150]);
  });

  it('leaves the clock alone on a frame it rejects', () => {
    const dec = createMoyu32State();
    decodeMoyu32Frame(moyu32Seed(0), dec);
    decodeMoyu32Frame(moyu32MoveFrame(1, [0], [500]), dec);

    // Out-of-range code: wrong key. Neither the counter nor the clock may move,
    // or the next good frame would be timed from a garbage baseline.
    expect(decodeMoyu32Frame(moyu32MoveFrame(2, [31], [999]), dec)).toEqual([]);
    expect(dec.deviceTime).toBe(500);
    expect(dec.prevMoveCnt).toBe(1);

    // A duplicate counter likewise contributes nothing.
    expect(decodeMoyu32Frame(moyu32MoveFrame(1, [0], [999]), dec)).toEqual([]);
    expect(dec.deviceTime).toBe(500);
  });

  it('survives the batched-arrival case end to end through MoveClock', () => {
    const dec = createMoyu32State();
    decodeMoyu32Frame(moyu32Seed(0), dec);
    const moves = decodeMoyu32Frame(
      moyu32MoveFrame(4, [0, 2, 4, 6], [40, 40, 40, 40]),
      dec,
    );

    const clock = new MoveClock();
    const arrivals = [900, 900.4, 901, 901.2];
    const local = moves.map((m, i) => clock.stamp(m.ts, arrivals[i]));
    expect(local.slice(1).map((t, i) => t - local[i])).toEqual([40, 40, 40]);
  });
});
