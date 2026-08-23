/**
 * Byte-level parity harness: our TypeScript smart-cube drivers vs csTimer's
 * original JavaScript.
 * =========================================================================
 *
 * We own no physical smart cube, so this is the ONLY trustworthy verification
 * of the Bluetooth decoders. The contract enforced here:
 *
 *   ONE ciphertext byte array  ->  csTimer's real driver (in a Node `vm`)
 *                              ->  our TypeScript driver (unmodified)
 *                              ->  the two emitted move sequences must match.
 *
 * Nothing under `D:\cube\cstimer` is written to; its files are read and
 * evaluated in a sandbox (see `_cstimer_sandbox.ts`). Frames are synthesised
 * from csTimer's OWN parsers (inverted) and encrypted with csTimer's OWN key
 * derivation / AES, sliced out of `hardware/gancube.js` + `hardware/qiyicube.js`
 * by brace matching — so the oracle never inherits our port's assumptions.
 *
 * Randomisation is seeded (`_lib/scramble/seeded_rng`), so a failure is
 * reproducible from the seed printed in the test name.
 *
 * ---------------------------------------------------------------------------
 * BUGS THIS HARNESS FOUND — all three are now FIXED, and each has a dedicated
 * regression test that goes red the moment the old behaviour comes back:
 *   * QiYi move direction was INVERTED (`qiyi.ts` decoded `(mv & 1) ? 0 : 2`
 *     where csTimer decodes `power = [0, 2][mv & 1]`). Pinned by
 *     "move direction matches csTimer" + "REGRESSION PIN: … not the mirror".
 *   * Giiker dropped every 0xA7-obfuscated frame (`valhex.length < 40` guard
 *     vs csTimer's 36-nibble de-obfuscated output). Pinned by
 *     "0xA7-obfuscated frames decode like csTimer" + the toHexVal length
 *     contract test that asserts 40 / 36 straight out of csTimer's own code.
 *   * MoYu read the rotation delta as a SIGNED int8 where csTimer uses
 *     `getUint8`. Pinned by "delta bytes > 127 decode like csTimer".
 *
 * DOCUMENTED (still-open) divergences live in the tests named
 * "DOCUMENTED DIVERGENCE"; they are behavioural choices, not defects.
 * ---------------------------------------------------------------------------
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { xorshift32, fnv1a32 } from '@/app/[lang]/timer/_lib/scramble/seeded_rng';
import { ganV2Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v2';
import { qiyiDriver } from '@/app/[lang]/timer/_lib/bluetooth/qiyi';
import { gocubeDriver } from '@/app/[lang]/timer/_lib/bluetooth/gocube';
import { moyuDriver } from '@/app/[lang]/timer/_lib/bluetooth/moyu';
import { giikerDriver } from '@/app/[lang]/timer/_lib/bluetooth/giiker';
import { makeFakeGatt, type FakeCharacteristic, type FakeWrite } from '@/tests/_fake_gatt';
import { createCstimerSandbox, cstimerFileExists, extractFunction, type CstimerSandbox } from '@/tests/_cstimer_sandbox';
import {
  GAN_V2_SERVICE, GAN_V2_READ, GAN_V2_WRITE, QIYI_SERVICE, QIYI_CHAR,
  installGanCrypto, installQiyiCrypto, type GanCrypto, type QiyiCrypto,
  ganV2FaceletFrame, ganV2MoveFrame, ganV2BatteryFrame, ganV2GyroFrame, ganV2HardwareFrame,
  ganV2CodeToMove, cubieStateAfter,
  qiyiFrameBody, qiyiApplyMoves, qiyiResetCube, qiyiMoveByteToMove, type QiyiHistorySlot,
  GOCUBE_SERVICE, GOCUBE_WRITE, GOCUBE_READ, goCubeFrame, goCubeMoveFrame, goCubeCodeToMove,
  MOYU_SERVICE, MOYU_WRITE, MOYU_READ, MOYU_TURN, MOYU_GYRO, moyuTurnFrame,
  GIIKER_DATA_SERVICE, GIIKER_NOTIFY, GIIKER_RW_SERVICE, GIIKER_READ, GIIKER_WRITE,
  giikerStateFrame, giikerMoveToString, type GiikerMove,
} from '@/tests/_bt_frame_fixtures';

/**
 * The csTimer clone is a local read-only checkout (see repo AGENTS.md). Without
 * it there is no oracle, so skip loudly rather than pretend to pass.
 */
const HAVE_CSTIMER = cstimerFileExists();
const describeIf = HAVE_CSTIMER ? describe : describe.skip;
if (!HAVE_CSTIMER) {
  // eslint-disable-next-line no-console
  console.warn('[bluetooth_parity] csTimer clone not found — parity tests SKIPPED');
}

/* ================================================================== */
/*  Shared helpers                                                     */
/* ================================================================== */

function randMac(rand: () => number): string {
  const b: string[] = [];
  for (let i = 0; i < 6; i++) b.push(Math.floor(rand() * 256).toString(16).padStart(2, '0').toUpperCase());
  return b.join(':');
}

/** Assert two move streams are identical element by element (readable diffs). */
function expectSameMoves(ours: string[], theirs: string[], label: string): void {
  expect(`${label}: ${ours.length} moves`).toBe(`${label}: ${theirs.length} moves`);
  for (let i = 0; i < theirs.length; i++) {
    expect(`${label}[${i}]=${ours[i]}`).toBe(`${label}[${i}]=${theirs[i]}`);
  }
}

/** Drop the direction suffix so we can compare axis choice independently. */
const faceOnly = (m: string): string => m.charAt(0);

/* ================================================================== */
/*  GAN v2                                                             */
/* ================================================================== */

interface GanRig {
  sb: CstimerSandbox;
  crypto: GanCrypto;
  notify: FakeCharacteristic;
  ourMoves: string[];
  ourWrites: FakeWrite[];
  /** Feed one ciphertext frame to BOTH implementations. */
  feed(cipher: number[]): void;
  cstimerMoves(): string[];
}

async function makeGanRig(mac: string, deviceName = 'GAN-1234567890AB'): Promise<GanRig> {
  const sb = await createCstimerSandbox({
    hardware: 'gancube.js',
    deviceName,
    services: { [GAN_V2_SERVICE]: [GAN_V2_READ, GAN_V2_WRITE] },
    mac,
  });
  const crypto = installGanCrypto(sb, mac, deviceName.startsWith('AiCube') ? 1 : 0);
  await sb.connect();

  const gatt = makeFakeGatt(deviceName, { [GAN_V2_SERVICE]: [GAN_V2_READ, GAN_V2_WRITE] });
  const ourMoves: string[] = [];
  await ganV2Driver.start(gatt.asServer, (m) => ourMoves.push(m), { mac });
  const notify = gatt.char(GAN_V2_SERVICE, GAN_V2_READ);

  return {
    sb,
    crypto,
    notify,
    ourMoves,
    ourWrites: gatt.writes,
    feed(cipher) {
      sb.feedFrame(cipher, GAN_V2_READ);
      notify.emit(cipher);
    },
    cstimerMoves: () => sb.emittedMoves(),
  };
}

interface GanScenario {
  /** Ciphertext frames, in transmission order (already excludes dropped ones). */
  cipherFrames: number[][];
  /** Ground truth: what a correct decoder must emit, in order. */
  expected: string[];
}

/**
 * Build a randomised GAN v2 session: a mode-4 seed frame followed by mode-2
 * move frames, with dropped frames (the counter still advances), noise frames
 * (gyro / battery / hardware info) and an 8-bit counter that wraps.
 */
function buildGanScenario(sb: CstimerSandbox, crypto: GanCrypto, rand: () => number, opts: {
  rounds: number;
  startCnt: number;
  maxBurst?: number;
  dropRate?: number;
  noiseRate?: number;
}): GanScenario {
  const maxBurst = opts.maxBurst ?? 3;
  const dropRate = opts.dropRate ?? 0.25;
  const noiseRate = opts.noiseRate ?? 0.2;

  const cipherFrames: number[][] = [];
  const expected: string[] = [];
  const log: number[] = []; // 5-bit move codes, chronological

  // Seed: a mode-4 facelets frame carrying a REAL cube state (csTimer runs
  // CubieCube.verify() on it and drops the frame if it is not a valid cube).
  const seedMoves: number[] = [];
  for (let i = 0; i < 1 + Math.floor(rand() * 6); i++) seedMoves.push(Math.floor(rand() * 18));
  const st = cubieStateAfter(sb, seedMoves);
  cipherFrames.push(crypto.encrypt(ganV2FaceletFrame(opts.startCnt, st.ca, st.ea)));

  let prevFedCnt = opts.startCnt;
  let cnt = opts.startCnt;

  for (let r = 0; r < opts.rounds; r++) {
    if (rand() < noiseRate) {
      const pick = rand();
      const noise = pick < 0.34 ? ganV2GyroFrame(Math.floor(rand() * 4096))
        : pick < 0.67 ? ganV2BatteryFrame(Math.floor(rand() * 101))
          : ganV2HardwareFrame();
      cipherFrames.push(crypto.encrypt(noise));
    }

    const burst = 1 + Math.floor(rand() * maxBurst);
    for (let i = 0; i < burst; i++) {
      log.push(Math.floor(rand() * 12));
      cnt = (cnt + 1) & 0xff;
    }
    // Sliding window of the last 7 moves, NEWEST FIRST (csTimer's prevMoves).
    const win: number[] = [];
    for (let i = 0; i < 7; i++) win.push(log[log.length - 1 - i] ?? 0);
    const frame = ganV2MoveFrame(cnt, win);

    // Drop the frame: the cube keeps counting, the host just never sees it.
    // Never let the gap exceed the 7-move window in the deterministic scenario
    // (>7 is covered by a dedicated test).
    const gapIfFed = (cnt - prevFedCnt) & 0xff;
    if (rand() < dropRate && gapIfFed + maxBurst <= 7 && r < opts.rounds - 1) continue;

    cipherFrames.push(crypto.encrypt(frame));
    const emit = Math.min(gapIfFed, 7);
    for (const code of log.slice(log.length - emit)) expected.push(ganV2CodeToMove(code));
    prevFedCnt = cnt;
  }

  return { cipherFrames, expected };
}

describeIf('GAN v2 <-> csTimer gancube.js (v2 path)', () => {
  it('connect handshake: our encrypted requests are byte-identical to csTimer', async () => {
    const mac = 'AB:12:34:56:78:9A';
    const rig = await makeGanRig(mac);
    // csTimer's v2init sends hardware-info(5), facelets(4), battery(9).
    const theirs = rig.sb.writes.map((w) => w.bytes);
    const ours = rig.ourWrites.filter((w) => w.uuid === GAN_V2_WRITE).map((w) => w.bytes);
    expect(theirs.length).toBe(3);
    expect(ours.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(`req${i}=${ours[i].join(',')}`).toBe(`req${i}=${theirs[i].join(',')}`);
    }
  });

  it('handshake parity holds for AiCube (different base key/iv)', async () => {
    const mac = '11:22:33:44:55:66';
    const rig = await makeGanRig(mac, 'AiCube-778899AABBCC');
    const theirs = rig.sb.writes.map((w) => w.bytes);
    const ours = rig.ourWrites.filter((w) => w.uuid === GAN_V2_WRITE).map((w) => w.bytes);
    for (let i = 0; i < 3; i++) {
      expect(`aicube${i}=${ours[i].join(',')}`).toBe(`aicube${i}=${theirs[i].join(',')}`);
    }
  });

  it('a mode-4 facelets frame seeds the counter without emitting a move', async () => {
    const rig = await makeGanRig('00:11:22:33:44:55');
    const st = cubieStateAfter(rig.sb, [0, 3, 6]);
    rig.feed(rig.crypto.encrypt(ganV2FaceletFrame(42, st.ca, st.ea)));
    expect(rig.cstimerMoves()).toEqual([]);
    expect(rig.ourMoves).toEqual([]);
    // ...and the next single move IS emitted, proving the seed landed.
    rig.feed(rig.crypto.encrypt(ganV2MoveFrame(43, [5, 0, 0, 0, 0, 0, 0])));
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'seed');
    // code 5 = face index 5>>1 = 2 ("F"), direction bit set -> "F'".
    expect(rig.ourMoves).toEqual(["F'"]);
  });

  for (const seedName of ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']) {
    it(`randomised session matches csTimer byte-for-byte (seed=${seedName})`, async () => {
      const rand = xorshift32(fnv1a32(seedName));
      const mac = randMac(rand);
      const rig = await makeGanRig(mac);
      const sc = buildGanScenario(rig.sb, rig.crypto, rand, {
        rounds: 40,
        startCnt: Math.floor(rand() * 256),
      });
      for (const f of sc.cipherFrames) rig.feed(f);

      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `gan/${seedName}`);
      // Independent ground truth: neither side may be "wrong in the same way".
      expectSameMoves(rig.cstimerMoves(), sc.expected, `gan-truth/${seedName}`);
      expect(sc.expected.length).toBeGreaterThan(30);
    });
  }

  it('8-bit move-counter wraparound (255 -> 0) is handled identically', async () => {
    const rand = xorshift32(fnv1a32('wrap'));
    const rig = await makeGanRig(randMac(rand));
    const sc = buildGanScenario(rig.sb, rig.crypto, rand, {
      rounds: 30,
      startCnt: 250, // guarantees several wraps over 30 rounds
      dropRate: 0.1,
    });
    for (const f of sc.cipherFrames) rig.feed(f);
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'wrap');
    expectSameMoves(rig.cstimerMoves(), sc.expected, 'wrap-truth');
  });

  it('a gap larger than the 7-move window clamps identically on both sides', async () => {
    const rig = await makeGanRig('DE:AD:BE:EF:00:01');
    const st = cubieStateAfter(rig.sb, []);
    rig.feed(rig.crypto.encrypt(ganV2FaceletFrame(0, st.ca, st.ea)));

    // 20 moves happened; only the frame after the 20th arrives. Both sides can
    // only recover the last 7 (the window size).
    const log: number[] = [];
    for (let i = 0; i < 20; i++) log.push(i % 12);
    const win: number[] = [];
    for (let i = 0; i < 7; i++) win.push(log[log.length - 1 - i]);
    rig.feed(rig.crypto.encrypt(ganV2MoveFrame(20, win)));

    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'clamp');
    expect(rig.ourMoves.length).toBe(7);
    expect(rig.ourMoves).toEqual(log.slice(13).map(ganV2CodeToMove));
  });

  it('duplicate move frames (same counter) are ignored by both', async () => {
    const rig = await makeGanRig('01:02:03:04:05:06');
    const st = cubieStateAfter(rig.sb, [9]);
    rig.feed(rig.crypto.encrypt(ganV2FaceletFrame(7, st.ca, st.ea)));
    const f = rig.crypto.encrypt(ganV2MoveFrame(8, [2, 0, 0, 0, 0, 0, 0]));
    rig.feed(f);
    rig.feed(f);
    rig.feed(f);
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'dup');
    expect(rig.ourMoves).toEqual(['R']);
  });

  it('frames encrypted with the WRONG mac are rejected identically', async () => {
    const rand = xorshift32(fnv1a32('wrongkey'));
    const goodMac = 'A0:B1:C2:D3:E4:F5';
    const rig = await makeGanRig(goodMac);
    const st = cubieStateAfter(rig.sb, []);
    rig.feed(rig.crypto.encrypt(ganV2FaceletFrame(100, st.ca, st.ea)));

    // Re-key the fixture generator to a different MAC => the cube's frames now
    // decrypt to noise on both sides. Emitted streams must still agree.
    for (let i = 0; i < 40; i++) {
      rig.crypto.rekey(randMac(rand));
      const win: number[] = [];
      for (let k = 0; k < 7; k++) win.push(Math.floor(rand() * 12));
      rig.feed(rig.crypto.encrypt(ganV2MoveFrame(101 + i, win)));
    }
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'wrongkey');
  });

  it('gyro / hardware / battery frames never produce a move', async () => {
    const rig = await makeGanRig('0F:0E:0D:0C:0B:0A');
    const st = cubieStateAfter(rig.sb, []);
    rig.feed(rig.crypto.encrypt(ganV2FaceletFrame(5, st.ca, st.ea)));
    rig.feed(rig.crypto.encrypt(ganV2GyroFrame(0x123)));
    rig.feed(rig.crypto.encrypt(ganV2HardwareFrame()));
    rig.feed(rig.crypto.encrypt(ganV2BatteryFrame(63)));
    expect(rig.cstimerMoves()).toEqual([]);
    expect(rig.ourMoves).toEqual([]);
    // csTimer surfaced the battery level; so did we.
    expect(rig.sb.batteryEvents.length).toBe(1);
  });
});

/* ================================================================== */
/*  QiYi                                                              */
/* ================================================================== */

interface QiyiRig {
  sb: CstimerSandbox;
  crypto: QiyiCrypto;
  notify: FakeCharacteristic;
  ourMoves: string[];
  ourWrites: FakeWrite[];
  feed(cipher: number[]): void;
  cstimerMoves(): string[];
}

const QIYI_DEVICE = 'QY-QYSC-2-A1B2';
/** csTimer's `initMac` default for this name: 'CC:A3:00:00:' + name tail. */
const QIYI_NAME_MAC = 'CC:A3:00:00:A1:B2';

async function makeQiyiRig(deviceName = QIYI_DEVICE, mac: string | null = QIYI_NAME_MAC): Promise<QiyiRig> {
  const sb = await createCstimerSandbox({
    hardware: 'qiyicube.js',
    deviceName,
    services: { [QIYI_SERVICE]: [QIYI_CHAR] },
    mac,
  });
  const crypto = installQiyiCrypto(sb);
  await sb.connect();
  qiyiResetCube(sb);

  const gatt = makeFakeGatt(deviceName, { [QIYI_SERVICE]: [QIYI_CHAR] });
  const ourMoves: string[] = [];
  await qiyiDriver.start(gatt.asServer, (m) => ourMoves.push(m), { mac });
  const notify = gatt.char(QIYI_SERVICE, QIYI_CHAR);

  return {
    sb,
    crypto,
    notify,
    ourMoves,
    ourWrites: gatt.writes,
    feed(cipher) {
      sb.feedFrame(cipher, QIYI_CHAR);
      notify.emit(cipher);
    },
    cstimerMoves: () => sb.emittedMoves(),
  };
}

interface QiyiScenario {
  cipherFrames: number[][];
  /** csTimer-truth move stream (the oracle), oldest first. */
  expected: string[];
}

/**
 * Randomised QiYi session: one hello frame, then state-change frames with a
 * 9-slot move history. Dropped frames are recovered from the history window;
 * the gap is capped at 10 (csTimer's `todoMoves.length < 10`) so the cube state
 * inside csTimer stays in sync with the facelet we put in the frame.
 */
function buildQiyiScenario(sb: CstimerSandbox, crypto: QiyiCrypto, rand: () => number, opts: {
  rounds: number;
  dropRate?: number;
}): QiyiScenario {
  const dropRate = opts.dropRate ?? 0.3;
  const cipherFrames: number[][] = [];
  const expected: string[] = [];

  let ts = 1000 + Math.floor(rand() * 5000);
  const solved = qiyiResetCube(sb);
  cipherFrames.push(crypto.build(qiyiFrameBody({ opcode: 2, ts, facelet: solved, battery: 88 })));
  let lastFedTs = ts;

  const log: Array<{ mv: number; ts: number }> = [];
  for (let r = 0; r < opts.rounds; r++) {
    const burst = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < burst; i++) {
      const mv = 1 + Math.floor(rand() * 12);
      ts += 50 + Math.floor(rand() * 900);
      log.push({ mv, ts });
      qiyiApplyMoves(sb, [mv]);
    }
    const facelet = qiyiApplyMoves(sb, []); // current tracker state
    const history: QiyiHistorySlot[] = [];
    for (let i = 1; i <= 9; i++) {
      const e = log[log.length - 1 - i];
      history.push(e ? { ts: e.ts, mv: e.mv } : { ts: 0, mv: 0 });
    }
    const cur = log[log.length - 1];
    const body = qiyiFrameBody({
      opcode: 3, ts: cur.ts, facelet, curMove: cur.mv, battery: 88, history,
    });

    const pending = log.filter((e) => e.ts > lastFedTs).length;
    // Keep the recoverable gap inside csTimer's 10-entry window.
    if (rand() < dropRate && pending + 3 <= 10 && r < opts.rounds - 1) continue;

    cipherFrames.push(crypto.build(body));
    const take = Math.min(pending, 10);
    for (const e of log.slice(log.length - take)) expected.push(qiyiMoveByteToMove(e.mv).trim());
    lastFedTs = cur.ts;
  }

  return { cipherFrames, expected };
}

describeIf('QiYi <-> csTimer qiyicube.js', () => {
  it('hello packet: our encrypted MAC handshake is byte-identical to csTimer', async () => {
    const rig = await makeQiyiRig();
    await new Promise((r) => setTimeout(r, 0));
    const theirs = rig.sb.writes.map((w) => w.bytes);
    const ours = rig.ourWrites.map((w) => w.bytes);
    expect(theirs.length).toBe(1);
    expect(ours.length).toBe(1);
    expect(`hello=${ours[0].join(',')}`).toBe(`hello=${theirs[0].join(',')}`);
  });

  it('hello (opcode 2) frame emits no moves on either side', async () => {
    const rig = await makeQiyiRig();
    const solved = qiyiResetCube(rig.sb);
    rig.feed(rig.crypto.build(qiyiFrameBody({ opcode: 2, ts: 1000, facelet: solved, battery: 70 })));
    expect(rig.cstimerMoves()).toEqual([]);
    expect(rig.ourMoves).toEqual([]);
  });

  /* ----------------------------------------------------------------
   * FIXED BUG (was: QiYi turn direction inverted in `qiyi.ts`).
   *
   *   csTimer  (qiyicube.js:199)  var power = [0, 2][todoMoves[i][0] & 1];
   *                               -> odd  move byte => power 2 => "X'"
   *                               -> even move byte => power 0 => "X"
   *   ours BEFORE (qiyi.ts:174)   power = (mv & 1) !== 0 ? 0 : 2
   *   ours AFTER                  power = (mv & 1) !== 0 ? 2 : 0
   *
   * The two tests below are the regression pins: the first walks all 12 move
   * bytes through both implementations, the second asserts we are NOT the
   * mirror image (which is what re-introducing the bug would produce).
   * ---------------------------------------------------------------- */

  /** Drive move bytes 1..12 through both sides; returns the rig. */
  async function sweepAllMoveBytes(): Promise<QiyiRig> {
    const rig = await makeQiyiRig();
    const solved = qiyiResetCube(rig.sb);
    rig.feed(rig.crypto.build(qiyiFrameBody({ opcode: 2, ts: 1000, facelet: solved, battery: 70 })));
    let ts = 1000;
    for (let mv = 1; mv <= 12; mv++) {
      ts += 500;
      const facelet = qiyiApplyMoves(rig.sb, [mv]);
      rig.feed(rig.crypto.build(qiyiFrameBody({
        opcode: 3, ts, facelet, curMove: mv, battery: 70,
        history: [{ ts: 0, mv: 0 }],
      })));
    }
    return rig;
  }

  it('move direction matches csTimer for every move byte 1..12', async () => {
    const rig = await sweepAllMoveBytes();
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'qiyi-direction');
  });

  it('REGRESSION PIN: the QiYi move table is csTimer’s, not the mirror', async () => {
    const rig = await sweepAllMoveBytes();
    const theirs = rig.cstimerMoves();
    // csTimer's ground truth for move bytes 1..12 (odd byte -> prime).
    expect(theirs).toEqual([
      "L'", 'L', "R'", 'R', "D'", 'D', "U'", 'U', "F'", 'F', "B'", 'B',
    ]);
    expect(rig.ourMoves).toEqual(theirs);
    // The axis choice was never wrong, so an equal-faces assertion alone would
    // NOT catch a re-inversion. Assert the directions explicitly too.
    expect(rig.ourMoves.map(faceOnly)).toEqual(theirs.map(faceOnly));
    const flip = (m: string): string => (m.endsWith("'") ? m.slice(0, -1) : `${m}'`);
    expect(rig.ourMoves).not.toEqual(theirs.map(flip));
  });

  for (const seedName of ['qi-alpha', 'qi-bravo', 'qi-charlie', 'qi-delta']) {
    it(`randomised session matches csTimer move-for-move (seed=${seedName})`, async () => {
      const rand = xorshift32(fnv1a32(seedName));
      const rig = await makeQiyiRig();
      const sc = buildQiyiScenario(rig.sb, rig.crypto, rand, { rounds: 35 });
      for (const f of sc.cipherFrames) rig.feed(f);

      const theirs = rig.cstimerMoves();
      // csTimer itself must agree with the independently-computed truth: this
      // proves the harness (history window, drop recovery, CRC, AES) is right.
      expectSameMoves(theirs, sc.expected, `qiyi-truth/${seedName}`);
      expect(theirs.length).toBeGreaterThan(35);
      // Our driver picks the same faces in the same order, decodes the same
      // directions, and recovers exactly the same dropped-frame history.
      expectSameMoves(rig.ourMoves.map(faceOnly), theirs.map(faceOnly), `qiyi-face/${seedName}`);
      expectSameMoves(rig.ourMoves, theirs, `qiyi-full/${seedName}`);
    });
  }

  it('garbage / wrong-key frames are dropped identically', async () => {
    const rand = xorshift32(fnv1a32('qi-garbage'));
    const rig = await makeQiyiRig();
    const solved = qiyiResetCube(rig.sb);
    rig.feed(rig.crypto.build(qiyiFrameBody({ opcode: 2, ts: 1000, facelet: solved, battery: 70 })));

    for (let i = 0; i < 40; i++) {
      const n = 16 * (1 + Math.floor(rand() * 6));
      const junk: number[] = [];
      for (let k = 0; k < n; k++) junk.push(Math.floor(rand() * 256));
      // Already-encrypted-looking noise: neither magic nor CRC will hold.
      rig.feed(junk);
    }
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'qiyi-garbage');
    expect(rig.cstimerMoves()).toEqual([]);
  });

  it('a CRC-corrupt frame is dropped by both', async () => {
    const rig = await makeQiyiRig();
    const solved = qiyiResetCube(rig.sb);
    rig.feed(rig.crypto.build(qiyiFrameBody({ opcode: 2, ts: 1000, facelet: solved, battery: 70 })));
    const facelet = qiyiApplyMoves(rig.sb, [3]);
    const body = qiyiFrameBody({
      opcode: 3, ts: 2000, facelet, curMove: 3, battery: 70, history: [{ ts: 0, mv: 0 }],
    });
    // Sanity: the pristine frame WOULD have produced a move.
    const good = rig.crypto.build(body);
    // Mangling a ciphertext byte scrambles a whole AES block, so the plaintext
    // CRC that both implementations verify no longer holds.
    const mangled = good.slice();
    mangled[3] = (mangled[3] ^ 0xa5) & 0xff;
    rig.feed(mangled);
    expect(rig.cstimerMoves()).toEqual([]);
    expect(rig.ourMoves).toEqual([]);
    // Now the untampered frame goes through on both sides.
    rig.feed(good);
    expect(rig.cstimerMoves().length).toBe(1);
    expect(rig.ourMoves.length).toBe(1);
  });
});

/* ================================================================== */
/*  GoCube / Rubik's Connected (plaintext)                             */
/* ================================================================== */

async function makeGoCubeRig(deviceName = 'GoCube-AB12') {
  const sb = await createCstimerSandbox({
    hardware: 'gocube.js',
    deviceName,
    services: { [GOCUBE_SERVICE]: [GOCUBE_WRITE, GOCUBE_READ] },
  });
  await sb.connect();
  const gatt = makeFakeGatt(deviceName, { [GOCUBE_SERVICE]: [GOCUBE_WRITE, GOCUBE_READ] });
  const ourMoves: string[] = [];
  await gocubeDriver.start(gatt.asServer, (m) => ourMoves.push(m));
  const notify = gatt.char(GOCUBE_SERVICE, GOCUBE_READ);
  return {
    sb,
    ourMoves,
    ourWrites: gatt.writes,
    feed(bytes: number[]) { sb.feedFrame(bytes, GOCUBE_READ); notify.emit(bytes); },
    cstimerMoves: () => sb.emittedMoves(),
  };
}

describeIf('GoCube / Rubik\'s Connected <-> csTimer gocube.js', () => {
  it('single- and multi-move frames decode identically', async () => {
    const rig = await makeGoCubeRig();
    rig.feed(goCubeMoveFrame([{ code: 0 }]));
    rig.feed(goCubeMoveFrame([{ code: 1 }, { code: 6 }, { code: 11 }]));
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'gocube-basic');
    expect(rig.cstimerMoves()).toEqual([0, 1, 6, 11].map((c) => goCubeCodeToMove(c).trim()));
  });

  for (const seedName of ['go-alpha', 'go-bravo', 'go-charlie']) {
    it(`randomised move stream matches csTimer (seed=${seedName})`, async () => {
      const rand = xorshift32(fnv1a32(seedName));
      const rig = await makeGoCubeRig();
      const expected: string[] = [];
      for (let f = 0; f < 60; f++) {
        const n = 1 + Math.floor(rand() * 4);
        const recs: Array<{ code: number; tick: number }> = [];
        for (let i = 0; i < n; i++) {
          const code = Math.floor(rand() * 12);
          recs.push({ code, tick: Math.floor(rand() * 256) });
          expected.push(goCubeCodeToMove(code).trim());
        }
        rig.feed(goCubeMoveFrame(recs));
      }
      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `gocube/${seedName}`);
      expectSameMoves(rig.cstimerMoves(), expected, `gocube-truth/${seedName}`);
      expect(expected.length).toBeGreaterThan(60);
    });
  }

  it('malformed frames (bad magic / trailer / too short) are dropped by both', async () => {
    const rig = await makeGoCubeRig();
    const good = goCubeMoveFrame([{ code: 4 }]);
    rig.feed([...good.slice(0, 0), 0x2b, ...good.slice(1)]);      // bad magic
    rig.feed([...good.slice(0, good.length - 2), 0x0e, 0x0a]);    // bad 0x0D
    rig.feed([...good.slice(0, good.length - 1), 0x0b]);          // bad 0x0A
    rig.feed([0x2a, 0x0d, 0x0a]);                                 // too short
    expect(rig.cstimerMoves()).toEqual([]);
    expect(rig.ourMoves).toEqual([]);
    rig.feed(good);
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'gocube-recover');
    expect(rig.ourMoves.length).toBe(1);
  });

  it('state / quaternion / battery frames never produce a move', async () => {
    const rig = await makeGoCubeRig();
    // msgType 2 needs 6*9 payload bytes of face colours (values 0..5).
    const state: number[] = [];
    for (let a = 0; a < 6; a++) for (let i = 0; i < 9; i++) state.push(a);
    rig.feed(goCubeFrame(2, state));
    rig.feed(goCubeFrame(3, [1, 2, 3, 4, 5, 6, 7, 8]));
    rig.feed(goCubeFrame(5, [77]));
    expect(rig.cstimerMoves()).toEqual([]);
    expect(rig.ourMoves).toEqual([]);
  });

  it('DOCUMENTED DIVERGENCE: keep-alive write cadence differs (moves still match)', async () => {
    const rig = await makeGoCubeRig();
    for (let i = 0; i < 10; i++) rig.feed(goCubeMoveFrame([{ code: i % 12 }]));
    await new Promise((r) => setTimeout(r, 0));
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'gocube-cadence');
    // csTimer starts `moveCntFree` at 100, so it re-requests the state on the
    // very FIRST move and then every 21 moves. We start the counter at 0 and
    // only test it once per notification, so after 10 single-move frames we
    // have sent only the initial kick. Move decoding is unaffected.
    expect(rig.sb.writes.length).toBe(1 + 1); // init kick + first-move re-ack
    expect(rig.ourWrites.length).toBe(1);     // init kick only
  });
});

/* ================================================================== */
/*  MoYu AI (MHC, plaintext)                                           */
/* ================================================================== */

async function makeMoyuRig(deviceName = 'MHC-Test') {
  const services = { [MOYU_SERVICE]: [MOYU_WRITE, MOYU_READ, MOYU_TURN, MOYU_GYRO] };
  const sb = await createCstimerSandbox({ hardware: 'moyucube.js', deviceName, services });
  await sb.connect();
  const gatt = makeFakeGatt(deviceName, services);
  const ourMoves: string[] = [];
  await moyuDriver.start(gatt.asServer, (m) => ourMoves.push(m));
  const notify = gatt.char(MOYU_SERVICE, MOYU_TURN);
  return {
    sb,
    ourMoves,
    feed(bytes: number[]) { sb.feedFrame(bytes, MOYU_TURN); notify.emit(bytes); },
    cstimerMoves: () => sb.emittedMoves(),
  };
}

describeIf('MoYu AI <-> csTimer moyucube.js', () => {
  it('rotation accumulator crosses the 5-step boundary identically', async () => {
    const rig = await makeMoyuRig();
    let ts = 0;
    // dir byte 81 -> round(81/36) = 2 steps. Three frames take face 0 from
    // 0 -> 2 -> 4 -> 6, and only the 4->6 transition emits a move.
    for (let i = 0; i < 6; i++) {
      ts += 65536;
      rig.feed(moyuTurnFrame([{ ts, face: 0, dir: 81 }]));
    }
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'moyu-boundary');
    expect(rig.cstimerMoves().length).toBeGreaterThan(0);
  });

  for (const seedName of ['my-alpha', 'my-bravo', 'my-charlie']) {
    it(`randomised turn stream matches csTimer (seed=${seedName})`, async () => {
      const rand = xorshift32(fnv1a32(seedName));
      const rig = await makeMoyuRig();
      let ts = 0;
      for (let f = 0; f < 80; f++) {
        const n = 1 + Math.floor(rand() * 3);
        const recs = [];
        for (let i = 0; i < n; i++) {
          ts += 1000 + Math.floor(rand() * 20000);
          recs.push({
            ts,
            face: Math.floor(rand() * 6),
            // Stay inside 0..127: see the signed/unsigned divergence below.
            dir: Math.floor(rand() * 128),
          });
        }
        rig.feed(moyuTurnFrame(recs));
      }
      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `moyu/${seedName}`);
      expect(rig.cstimerMoves().length).toBeGreaterThan(20);
    });
  }

  it('truncated packets (n_moves larger than the payload) are dropped by both', async () => {
    const rig = await makeMoyuRig();
    rig.feed([3, 0, 0, 0, 0, 0, 81]); // claims 3 moves, carries 1
    rig.feed([]);
    expect(rig.cstimerMoves()).toEqual([]);
    expect(rig.ourMoves).toEqual([]);
  });

  /* ----------------------------------------------------------------
   * FIXED BUG (was: MoYu rotation delta read as a SIGNED int8).
   *
   *   csTimer (moyucube.js:80)  var dir = Math.round(data.getUint8(offset + 5) / 36);
   *                             -> byte 0xE2 (226) => dir = +6
   *   ours BEFORE (moyu.ts:88)  dirSigned = raw > 127 ? raw - 256 : raw
   *                             -> byte 0xE2 => -30 => dir = -1
   *   ours AFTER                dir = Math.round(dv.getUint8(offset + 5) / 36)
   *
   * With the signed reading, every delta byte > 127 disagreed on BOTH the
   * emitted move and the stored `faceStatus` accumulator, so the streams
   * desynchronised from that point on — moves went missing for good.
   * ---------------------------------------------------------------- */
  it('delta bytes > 127 decode like csTimer (unsigned, not int8)', async () => {
    const rig = await makeMoyuRig();
    rig.feed(moyuTurnFrame([{ ts: 65536, face: 0, dir: 0xe2 }]));
    // csTimer reads 226 -> +6 steps -> crosses the boundary -> emits "D".
    expect(rig.cstimerMoves()).toEqual(['D']);
    // An int8 reading would give -30 -> -1 step -> no crossing -> nothing.
    expect(rig.ourMoves).not.toEqual([]);
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'moyu-unsigned');
  });

  it('REGRESSION PIN: high delta bytes keep faceStatus in sync across frames', async () => {
    const rig = await makeMoyuRig();
    // Every byte here is >= 0x80, i.e. exactly the range the int8 bug broke.
    // The accumulator must walk 0 -> 6 -> 12%9=3 -> 9%9=0 -> 5 on face 0,
    // so csTimer emits on the 1st and 4th frame; a signed reading would run
    // the accumulator backwards and emit nothing at all.
    for (const dir of [0xe2, 0xe2, 0xe2, 0xff]) {
      rig.feed(moyuTurnFrame([{ ts: 65536, face: 0, dir }]));
    }
    expect(rig.cstimerMoves().length).toBeGreaterThan(0);
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'moyu-facestatus');
  });
});

/* ================================================================== */
/*  Giiker / Mi Smart Magic Cube (plaintext)                           */
/* ================================================================== */

async function makeGiikerRig(baseline: number[], deviceName = 'Gi123456') {
  const services = {
    [GIIKER_DATA_SERVICE]: [GIIKER_NOTIFY],
    [GIIKER_RW_SERVICE]: [GIIKER_READ, GIIKER_WRITE],
  };
  const sb = await createCstimerSandbox({ hardware: 'giikercube.js', deviceName, services });
  // csTimer reads the characteristic once during init and parses it, so both
  // sides must see the SAME baseline or the first diff is meaningless.
  sb.setReadValue(GIIKER_NOTIFY, baseline);
  await sb.connect();

  const gatt = makeFakeGatt(deviceName, services);
  const notify = gatt.char(GIIKER_DATA_SERVICE, GIIKER_NOTIFY);
  notify.readBytes = baseline;
  const ourMoves: string[] = [];
  await giikerDriver.start(gatt.asServer, (m) => ourMoves.push(m));
  return {
    sb,
    ourMoves,
    feed(bytes: number[]) { sb.feedFrame(bytes, GIIKER_NOTIFY); notify.emit(bytes); },
    cstimerMoves: () => sb.emittedMoves(),
  };
}

describeIf('Giiker <-> csTimer giikercube.js', () => {
  /** A rolling 4-move window, newest first, as the cube reports it. */
  function window4(log: GiikerMove[]): GiikerMove[] {
    const w: GiikerMove[] = [];
    for (let i = 0; i < 4; i++) w.push(log[log.length - 1 - i] ?? { face: 0, dir: 0 });
    return w;
  }

  it('one move per notification decodes identically', async () => {
    const log: GiikerMove[] = [{ face: 4, dir: 1 }, { face: 2, dir: 3 }, { face: 6, dir: 1 }, { face: 1, dir: 2 }];
    const rig = await makeGiikerRig(giikerStateFrame({ moves: window4(log) }));
    const seq: GiikerMove[] = [
      { face: 3, dir: 1 }, { face: 5, dir: 3 }, { face: 2, dir: 2 }, { face: 6, dir: 3 }, { face: 4, dir: 1 },
    ];
    for (const m of seq) {
      log.push(m);
      rig.feed(giikerStateFrame({ moves: window4(log) }));
    }
    const theirs = rig.cstimerMoves();
    // csTimer emits one callback per frame, including the init readValue.
    expect(theirs).toEqual([
      giikerMoveToString(log[3]).trim(),
      ...seq.map((m) => giikerMoveToString(m).trim()),
    ]);
    expectSameMoves(rig.ourMoves, theirs, 'giiker-basic');
  });

  for (const seedName of ['gi-alpha', 'gi-bravo', 'gi-charlie']) {
    it(`randomised move stream matches csTimer (seed=${seedName})`, async () => {
      const rand = xorshift32(fnv1a32(seedName));
      const log: GiikerMove[] = [];
      for (let i = 0; i < 4; i++) {
        log.push({ face: 1 + Math.floor(rand() * 6), dir: 1 + Math.floor(rand() * 3) });
      }
      const rig = await makeGiikerRig(giikerStateFrame({ moves: window4(log) }));
      const expected = [giikerMoveToString(log[log.length - 1]).trim()];
      for (let f = 0; f < 60; f++) {
        const m = { face: 1 + Math.floor(rand() * 6), dir: 1 + Math.floor(rand() * 3) };
        log.push(m);
        expected.push(giikerMoveToString(m).trim());
        rig.feed(giikerStateFrame({ moves: window4(log) }));
      }
      expectSameMoves(rig.cstimerMoves(), expected, `giiker-truth/${seedName}`);
      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `giiker/${seedName}`);
    });
  }

  /**
   * csTimer's `toHexVal` de-obfuscates when `raw[18] == 0xA7`, using a 36-byte
   * table indexed by the two nibbles of `raw[19]`. Build the ciphertext by
   * running that transform backwards. (csTimer's decrypt has no `& 0xff`, but
   * the extra high bits never reach the nibbles it reads, so this inverse is
   * exact.)
   */
  const GIIKER_KEY = [176, 81, 104, 224, 86, 137, 237, 119, 38, 26, 193, 161, 210, 126, 150, 81,
    93, 13, 236, 249, 89, 235, 88, 24, 113, 81, 214, 131, 130, 199, 2, 169, 39, 165, 171, 41];
  function obfuscate(plain18: number[], k1: number, k2: number): number[] {
    const raw: number[] = [];
    for (let i = 0; i < 18; i++) raw.push((plain18[i] - GIIKER_KEY[i + k1] - GIIKER_KEY[i + k2]) & 0xff);
    raw.push(0xa7, ((k1 & 0xf) << 4) | (k2 & 0xf));
    return raw;
  }

  async function obfuscatedRun() {
    const log: GiikerMove[] = [
      { face: 1, dir: 1 }, { face: 2, dir: 1 }, { face: 3, dir: 1 }, { face: 4, dir: 1 },
    ];
    const rig = await makeGiikerRig(obfuscate(giikerStateFrame({ moves: window4(log) }).slice(0, 18), 3, 9));
    const seq: GiikerMove[] = [{ face: 5, dir: 2 }, { face: 6, dir: 3 }, { face: 1, dir: 1 }];
    for (let i = 0; i < seq.length; i++) {
      log.push(seq[i]);
      rig.feed(obfuscate(giikerStateFrame({ moves: window4(log) }).slice(0, 18), (i * 5) % 16, (i * 3 + 2) % 16));
    }
    return {
      rig,
      expected: [giikerMoveToString(log[3]).trim(), ...seq.map((m) => giikerMoveToString(m).trim())],
    };
  }

  /* ----------------------------------------------------------------
   * FIXED BUG (was: our Giiker driver dropped EVERY 0xA7-obfuscated frame).
   *
   *   csTimer (giikercube.js:84)  raw = raw.slice(0, 18) after decrypting,
   *                               so `valhex` is 36 nibbles and the move
   *                               window it reads is `valhex.slice(32, 40)`
   *                               -> only 2 entries -> ONE move per frame.
   *   ours BEFORE (giiker.ts:173) `if (valhex.length < 40) return;`
   *                               -> 36 < 40, so the frame was discarded and
   *                                  no move was ever emitted.
   *   ours AFTER                  `if (valhex.length < 36) return;` plus a
   *                               variable-length history window (4 moves on
   *                               plain frames, 2 on de-obfuscated ones).
   *
   * Net effect of the bug: on the obfuscated Giiker / Mi Smart firmware our
   * timer saw a connected cube that never reported a turn. The decrypt code in
   * `toHexVal` was present but its output was thrown away one function later.
   * ---------------------------------------------------------------- */
  it('0xA7-obfuscated frames decode like csTimer', async () => {
    const { rig, expected } = await obfuscatedRun();
    // csTimer decodes all four (init readValue + 3 notifications).
    expect(rig.cstimerMoves()).toEqual(expected);
    // Anything that drops obfuscated frames emits [] here.
    expect(rig.ourMoves).not.toEqual([]);
    expectSameMoves(rig.ourMoves, rig.cstimerMoves(), 'giiker-obfuscated');
  });

  /**
   * REGRESSION PIN for the guard constant. Runs csTimer's OWN `toHexVal` (a
   * self-contained function inside `execMain`, sliced out by brace matching)
   * so the 40-vs-36 contract comes from upstream, not from our reading of it.
   * A `< 40` guard cannot survive this test plus the one above.
   */
  it('csTimer’s toHexVal yields 40 nibbles plain / 36 de-obfuscated', async () => {
    const rig = await makeGiikerRig(giikerStateFrame({ moves: [{ face: 1, dir: 1 }] }));
    rig.sb.run(`
      ${extractFunction(rig.sb.source('hardware/giikercube.js'), 'toHexVal')}
      function __hex(bytes) {
        var ab = new ArrayBuffer(bytes.length);
        var u8 = new Uint8Array(ab);
        for (var i = 0; i < bytes.length; i++) u8[i] = bytes[i] & 0xff;
        return toHexVal(new DataView(ab));
      }
    `);
    const plain = giikerStateFrame({ moves: [{ face: 2, dir: 1 }, { face: 3, dir: 2 }] });
    const hex = (frame: number[]): number[] => {
      rig.sb.run(`__hexIn = ${JSON.stringify(frame)};`);
      return Array.from(rig.sb.run<ArrayLike<number>>('__hex(__hexIn)'), Number);
    };
    const plainHex = hex(plain);
    const obfHex = hex(obfuscate(plain.slice(0, 18), 3, 9));
    expect(plainHex.length).toBe(40);
    expect(obfHex.length).toBe(36);
    // ...and the newest move still sits at nibbles 32/33 in BOTH variants, so
    // the emitted stream is variant-independent.
    expect(plainHex.slice(32, 34)).toEqual([2, 1]);
    expect(obfHex.slice(32, 34)).toEqual([2, 1]);
  });
});

/* ================================================================== */
/*  Meta: the harness itself must be load-bearing                      */
/* ================================================================== */

describeIf('parity harness self-checks', () => {
  let sb: CstimerSandbox;
  beforeAll(async () => {
    sb = await createCstimerSandbox({
      hardware: 'gancube.js',
      deviceName: 'GAN-000000000000',
      services: { [GAN_V2_SERVICE]: [GAN_V2_READ, GAN_V2_WRITE] },
      mac: '00:00:00:00:00:00',
    });
  });

  it('runs csTimer’s real source, not a copy', () => {
    const src = sb.source('hardware/gancube.js');
    expect(src).toContain('function parseV2Data(value)');
    expect(src).toContain("GiikerCube.regCubeModel({");
    expect(sb.regModel.prefix).toEqual(['GAN', 'MG', 'AiCube']);
  });

  it('the ported CubieCube agrees with csTimer’s cube algebra', () => {
    // U4 = identity, and the solved facelet round-trips.
    const four = cubieStateAfter(sb, [0, 0, 0, 0]);
    expect(four.ca).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(four.ea).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    const solvedFacelet = sb.run<string>('new mathlib.CubieCube().toFaceCube()');
    expect(solvedFacelet).toBe(sb.run<string>('mathlib.SOLVED_FACELET'));
    // A scrambled state must still verify (this is the gate csTimer applies to
    // GAN mode-4 frames; a broken port would silently disable that path).
    const ok = sb.run<number>(`
      (function() {
        var cur = new mathlib.CubieCube();
        var mv = [3, 9, 6, 12, 1, 16, 4];
        for (var i = 0; i < mv.length; i++) {
          var out = new mathlib.CubieCube();
          mathlib.CubieCube.CubeMult(cur, mathlib.CubieCube.moveCube[mv[i]], out);
          cur = out;
        }
        return cur.verify();
      })()
    `);
    expect(ok).toBe(0);
  });

  it('an intentionally-invalid cube state is REJECTED by csTimer’s mode-4 gate', async () => {
    const rig = await makeGanRig('AA:BB:CC:DD:EE:FF');
    // Two corners swapped -> parity violation -> verify() != 0.
    const bad = { ca: [1, 0, 2, 3, 4, 5, 6, 7], ea: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] };
    rig.feed(rig.crypto.encrypt(ganV2FaceletFrame(9, bad.ca, bad.ea)));
    // csTimer refused to seed; a following move frame therefore emits nothing.
    rig.feed(rig.crypto.encrypt(ganV2MoveFrame(10, [2, 0, 0, 0, 0, 0, 0])));
    expect(rig.cstimerMoves()).toEqual([]);
    // DOCUMENTED DIVERGENCE: our driver seeds `prevMoveCnt` from any mode-4
    // frame without running CubieCube.verify(), so it *does* emit here.
    expect(rig.ourMoves).toEqual(['R']);
  });
});
