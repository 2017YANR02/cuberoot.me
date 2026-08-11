/**
 * GAN v3 / v4 <-> csTimer parity — the two drivers the original parity harness
 * never covered.
 * =========================================================================
 *
 * Same contract as `bluetooth_parity.test.ts`: one ciphertext byte array goes
 * to csTimer's real `gancube.js` (running in a Node `vm`) and to our
 * TypeScript driver, and the two emitted move sequences must match.
 *
 * WHY THIS FILE EXISTS — the bug it pins:
 *
 *   csTimer seeds its move counter from the cube's FACELETS event
 *   (`initCubeState()`, gancube.js:421-433), so the first physical turn after
 *   connecting is a real move. Our v3/v4 drivers ignored the facelets event
 *   entirely, leaving `prevMoveCnt == -1` until the first MOVE event — which
 *   that branch then consumes as a baseline and DROPS.
 *
 *   Net effect on a GAN 12/13/14/16: the tracked state is permanently the true
 *   state times the inverse of the user's first turn. The scramble check says
 *   "与打乱不符" forever, and auto-stop-on-solved never fires.
 *
 *   GAN v2 always did this correctly (`gan_v2.ts` seeds on mode 4), which is
 *   why only the v3/v4 families were affected.
 *
 * Second bug pinned here: csTimer buffers moves and refuses to advance across a
 * counter gap, asking the cube for its move history instead
 * (`evictMoveBuffer` -> `requestMoveHistory`, gancube.js:676-739). Our drivers
 * applied whatever arrived and never asked for anything, so a single dropped
 * BLE notification desynced the model with no path back.
 */

import { describe, it, expect, vi } from 'vitest';
import { ganV3Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v3';
import { ganV4Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v4';
import { CubeStateTracker } from '@/app/[lang]/timer/_lib/bluetooth/state_track';
import { makeFakeGatt, type FakeCharacteristic, type FakeWrite } from '@/tests/_fake_gatt';
import { createCstimerSandbox, cstimerFileExists, type CstimerSandbox } from '@/tests/_cstimer_sandbox';
import {
  installGanCrypto, cubieStateAfter, type GanCrypto,
  GAN_V3_SERVICE, GAN_V3_READ, GAN_V3_WRITE,
  GAN_V4_SERVICE, GAN_V4_READ, GAN_V4_WRITE,
  ganV3MoveFrame, ganV3FaceletFrame, ganV3HistoryFrame, ganV3BatteryFrame, ganV3HardwareFrame,
  ganV4MoveFrame, ganV4FaceletFrame, ganV4HistoryFrame, ganV4BatteryFrame, ganV4GyroFrame,
  ganV4HardwareFrame,
  ganAxisPowToMove, ganHistoryAxisPowToMove,
} from '@/tests/_bt_frame_fixtures';

const HAVE_CSTIMER = cstimerFileExists();
const describeIf = HAVE_CSTIMER ? describe : describe.skip;
if (!HAVE_CSTIMER) {
  // eslint-disable-next-line no-console
  console.warn('[bluetooth_parity_gan_v34] csTimer clone not found — parity tests SKIPPED');
}

/* ================================================================== */
/*  Rig                                                                */
/* ================================================================== */

/** Everything a version needs, so one body of tests covers both protocols. */
interface Variant {
  name: 'v3' | 'v4';
  service: string;
  read: string;
  write: string;
  deviceName: string;
  driver: typeof ganV3Driver;
  moveFrame(cnt: number, axis: number, pow: number, ts?: number): number[];
  faceletFrame(cnt: number, ca: number[], ea: number[]): number[];
  historyFrame(start: number, moves: Array<{ axis: number; pow: number }>): number[];
  batteryFrame(pct: number): number[];
  hardwareFrame(): number[];
  /** Bytes of the move-history request csTimer would write. */
  historyRequest(startMoveCnt: number, numberOfMoves: number): number[];
}

const V3: Variant = {
  name: 'v3',
  service: GAN_V3_SERVICE, read: GAN_V3_READ, write: GAN_V3_WRITE,
  deviceName: 'GAN13-A1B2C3',
  driver: ganV3Driver,
  moveFrame: ganV3MoveFrame,
  faceletFrame: ganV3FaceletFrame,
  historyFrame: ganV3HistoryFrame,
  batteryFrame: ganV3BatteryFrame,
  hardwareFrame: ganV3HardwareFrame,
  historyRequest(start, num) {
    const req = new Array<number>(16).fill(0);
    req[0] = 0x68; req[1] = 0x03; req[2] = start & 0xff; req[4] = num & 0xff;
    return req;
  },
};

const V4: Variant = {
  name: 'v4',
  service: GAN_V4_SERVICE, read: GAN_V4_READ, write: GAN_V4_WRITE,
  deviceName: 'GAN14-A1B2C3',
  driver: ganV4Driver,
  moveFrame: ganV4MoveFrame,
  faceletFrame: ganV4FaceletFrame,
  historyFrame: ganV4HistoryFrame,
  batteryFrame: ganV4BatteryFrame,
  hardwareFrame: ganV4HardwareFrame,
  historyRequest(start, num) {
    const req = new Array<number>(20).fill(0);
    req[0] = 0xd1; req[1] = 0x04; req[2] = start & 0xff; req[4] = num & 0xff;
    return req;
  },
};

interface Rig {
  sb: CstimerSandbox;
  crypto: GanCrypto;
  notify: FakeCharacteristic;
  ourMoves: string[];
  /** Device-clock timestamps our driver reported, aligned with ourMoves. */
  ourStamps: (number | undefined)[];
  ourWrites: FakeWrite[];
  /** Feed one PLAINTEXT frame to both sides (encrypted with csTimer's crypto). */
  feed(plain: number[]): void;
  cstimerMoves(): string[];
  /** Writes our driver made to the command characteristic, minus the 3 hello frames. */
  ourCommandsAfterHello(): number[][];
  /** Writes csTimer made, minus its 3 hello frames. */
  theirCommandsAfterHello(): number[][];
}

async function makeRig(v: Variant, mac = 'AB:CD:EF:01:23:45'): Promise<Rig> {
  const sb = await createCstimerSandbox({
    hardware: 'gancube.js',
    deviceName: v.deviceName,
    // ONLY this version's service: csTimer's init() probes v2 -> v3 -> v4 and
    // takes the first hit, so exposing more than one would pick the wrong path.
    services: { [v.service]: [v.read, v.write] },
    mac,
  });
  const crypto = installGanCrypto(sb, mac, 0);
  await sb.connect();

  const gatt = makeFakeGatt(v.deviceName, { [v.service]: [v.read, v.write] });
  const ourMoves: string[] = [];
  const ourStamps: (number | undefined)[] = [];
  await v.driver.start(
    gatt.asServer,
    (m, ts) => { ourMoves.push(m); ourStamps.push(ts); },
    { mac },
  );
  const notify = gatt.char(v.service, v.read);

  const HELLO = 3;
  return {
    sb, crypto, notify, ourMoves, ourStamps,
    ourWrites: gatt.writes,
    feed(plain) {
      const cipher = crypto.encrypt(plain.slice());
      sb.feedFrame(cipher, v.read);
      notify.emit(cipher);
    },
    cstimerMoves: () => sb.emittedMoves(),
    ourCommandsAfterHello: () =>
      gatt.writes.filter((w) => w.uuid.toLowerCase() === v.write.toLowerCase())
        .slice(HELLO).map((w) => w.bytes),
    theirCommandsAfterHello: () => sb.writes.slice(HELLO).map((w) => w.bytes),
  };
}

/** A real, `verify()`-clean cube state to put in a facelets frame. */
function realState(sb: CstimerSandbox, moveCodes: number[]): { ca: number[]; ea: number[] } {
  return cubieStateAfter(sb, moveCodes);
}

function expectSameMoves(ours: string[], theirs: string[], label: string): void {
  expect(`${label}: ${ours.join(' ')}`).toBe(`${label}: ${theirs.join(' ')}`);
}

/* ================================================================== */
/*  Tests                                                              */
/* ================================================================== */

for (const v of [V3, V4]) {
  describeIf(`GAN ${v.name} <-> csTimer gancube.js`, () => {
    it('connect handshake is byte-identical to csTimer', async () => {
      const rig = await makeRig(v);
      const theirs = rig.sb.writes.map((w) => w.bytes);
      const ours = rig.ourWrites
        .filter((w) => w.uuid.toLowerCase() === v.write.toLowerCase())
        .map((w) => w.bytes);
      expect(theirs.length).toBe(3);
      expect(ours.length).toBe(3);
      // Bluefy is proven against csTimer's legacy `writeValue` path. Calling
      // `writeValueWithResponse` merely because that prototype method exists
      // can select a mode the characteristic does not support.
      expect(rig.ourWrites.filter((w) => w.uuid.toLowerCase() === v.write.toLowerCase())
        .every((w) => w.kind === 'plain')).toBe(true);
      for (let i = 0; i < 3; i++) {
        expect(`${v.name} req${i}=${ours[i].join(',')}`).toBe(`${v.name} req${i}=${theirs[i].join(',')}`);
      }
    });

    it('REGRESSION: the facelets snapshot seeds the counter, so the FIRST turn is not swallowed', async () => {
      const rig = await makeRig(v);
      const st = realState(rig.sb, [0, 3, 6]);

      // The cube reports its state at connect. Neither side may call this a move.
      rig.feed(v.faceletFrame(40, st.ca, st.ea));
      expect(rig.cstimerMoves()).toEqual([]);
      expect(rig.ourMoves).toEqual([]);

      // First physical turn after connecting. This is the move the old code
      // consumed as a baseline and dropped.
      rig.feed(v.moveFrame(41, 0, 0)); // U
      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `${v.name} first-turn`);
      expect(rig.ourMoves).toEqual(['U']);
    });

    it('reports the cube\'s own clock reading, not the arrival time', async () => {
      const rig = await makeRig(v);
      const st = realState(rig.sb, []);
      rig.feed(v.faceletFrame(0, st.ca, st.ea));

      // Timestamps a real cube would send: ~55 ms apart, i.e. a fast but
      // ordinary turn rate. Arrival order here is instantaneous, which is the
      // whole point — without the device clock these gaps are unrecoverable.
      const stamps = [1_000_000, 1_000_055, 1_000_110, 1_000_165];
      stamps.forEach((ts, i) => rig.feed(v.moveFrame(i + 1, i % 6, 0, ts)));

      expect(rig.ourMoves).toHaveLength(4);
      expect(rig.ourStamps).toEqual(stamps);
    });

    it('places a history-recovered move inside the interval it must have happened in', async () => {
      const rig = await makeRig(v);
      const st = realState(rig.sb, []);
      rig.feed(v.faceletFrame(0, st.ca, st.ea));
      rig.feed(v.moveFrame(1, 0, 0, 500_000));       // U, timed
      rig.feed(v.moveFrame(3, 2, 0, 500_120));       // F, counter 2 went missing

      // Nothing is applied while the hole is open.
      expect(rig.ourMoves).toEqual(['U']);
      // The cube answers with the missing window, NEWEST first. History frames
      // index "DUBFLR" (not "URFDLB"): 3 = F for the move we already have,
      // 5 = R for the one that went missing.
      rig.feed(v.historyFrame(3, [{ axis: 3, pow: 0 }, { axis: 5, pow: 0 }]));
      expect(rig.ourMoves).toEqual(['U', 'R', 'F']);

      expect(rig.ourStamps[0]).toBe(500_000);
      // BASELINE CHANGED, deliberately. This used to assert `undefined`, on the
      // grounds that a history frame reports the turn and not when it happened,
      // so anything we filled in would be invented. The premise was wrong:
      // blank does not stay blank downstream, `MoveClock` substitutes ARRIVAL
      // time — the instant the reply landed, which is after this turn AND after
      // the later turn that triggered the recovery. That fabricates a pause and
      // then collapses the next real gap to zero. The turn provably happened
      // between 500_000 and 500_120, so it is placed there (midpoint for a run
      // of one), which is csTimer's answer too (`tsLinearFit`, by regression).
      // See tests/gan_recovered_move_times.test.ts for the rule itself.
      expect(rig.ourStamps[1]).toBe(500_060);
      // The move that was merely HELD in the buffer keeps the timestamp its
      // own live frame carried; it was never missing, just early.
      expect(rig.ourStamps[2]).toBe(500_120);
    });

    it('a full 18-move scramble arrives move-for-move', async () => {
      const rig = await makeRig(v);
      const st = realState(rig.sb, []);
      rig.feed(v.faceletFrame(0, st.ca, st.ea));

      // Axis/pow pairs, chosen to hit every face and both directions.
      const turns: Array<[number, number]> = [
        [0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1],
        [0, 1], [1, 0], [2, 1], [3, 0], [4, 1], [5, 0],
        [2, 0], [2, 0], [1, 1], [1, 1], [0, 0], [3, 1],
      ];
      const expected: string[] = [];
      turns.forEach(([axis, pow], i) => {
        rig.feed(v.moveFrame(i + 1, axis, pow));
        expected.push(ganAxisPowToMove(axis, pow));
      });

      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `${v.name} scramble`);
      expect(rig.ourMoves).toEqual(expected);
    });

    it('REGRESSION: a dropped notification is recovered via a move-history request', async () => {
      const rig = await makeRig(v);
      const st = realState(rig.sb, [1, 4]);
      rig.feed(v.faceletFrame(10, st.ca, st.ea));

      rig.feed(v.moveFrame(11, 0, 0)); // U
      rig.feed(v.moveFrame(12, 1, 0)); // R
      expect(rig.ourMoves).toEqual(['U', 'R']);

      // Counter 13 never reaches the host (BLE drop). 14 arrives instead.
      rig.feed(v.moveFrame(14, 2, 1)); // F'
      // GAN command writes are serialized to satisfy Web Bluetooth's one-GATT-
      // operation-at-a-time rule, so the history request enters on a microtask.
      await Promise.resolve();

      // Neither side may apply 14 before the hole at 13 is filled...
      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `${v.name} gap-hold`);
      expect(rig.ourMoves).toEqual(['U', 'R']);

      // ...and both must ask the cube for the missing window, identically.
      const theirReq = rig.theirCommandsAfterHello();
      const ourReq = rig.ourCommandsAfterHello();
      expect(theirReq.length).toBeGreaterThan(0);
      expect(`${v.name} history-req=${ourReq.map((b) => b.join(',')).join('|')}`)
        .toBe(`${v.name} history-req=${theirReq.map((b) => b.join(',')).join('|')}`);

      // The cube answers with the window, NEWEST first (14 then 13). Counter 14
      // restates the move we already hold; the buffer must not double-apply it,
      // so what actually lands is the live event's F' plus the recovered 13.
      // (History axis order is "DUBFLR": 3 -> F, 5 -> R.)
      rig.feed(v.historyFrame(14, [
        { axis: 3, pow: 1 },  // F' — same move the live event at 14 carried
        { axis: 5, pow: 1 },  // R' — the move lost at counter 13
      ]));

      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `${v.name} recovered`);
      expect(rig.ourMoves).toEqual([
        'U', 'R',
        ganHistoryAxisPowToMove(5, 1), // R' — recovered from history
        "F'",                          // the held-back live move, now in order
      ]);
    });

    it('REGRESSION: a dropped FINAL move is found after idle and returns the tracker to solved', async () => {
      const rig = await makeRig(v);
      vi.useFakeTimers();
      try {
        const solved = realState(rig.sb, []);
        rig.feed(v.faceletFrame(0, solved.ca, solved.ea));

        // Counter 1 arrives, then counter 2 (R') physically solves the cube but
        // its BLE notification is lost. There is no later live move to reveal
        // the counter gap — the old implementation waited forever here.
        rig.feed(v.moveFrame(1, 1, 0)); // R
        expect(rig.ourMoves).toEqual(['R']);

        await vi.advanceTimersByTimeAsync(700);
        expect(rig.ourCommandsAfterHello().length).toBeGreaterThanOrEqual(1);

        // The idle state check reports counter 2. That must trigger a history
        // request even though no later move notification ever arrived.
        rig.feed(v.faceletFrame(2, solved.ca, solved.ea));
        await Promise.resolve();
        expect(rig.ourCommandsAfterHello().length).toBeGreaterThanOrEqual(2);

        // GAN history is newest-first. Slot 3 is padding/unknown; slot 2 is the
        // missed R', which completes the physical solve.
        rig.feed(v.historyFrame(3, [
          { axis: 7, pow: 0 },
          { axis: 5, pow: 1 },
        ]));
        expect(rig.ourMoves).toEqual(['R', "R'"]);

        const tracker = new CubeStateTracker();
        for (const move of rig.ourMoves) tracker.applyMove(move);
        expect(tracker.isSolved()).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('duplicate move frames (same counter) are ignored by both', async () => {
      const rig = await makeRig(v);
      const st = realState(rig.sb, [7]);
      rig.feed(v.faceletFrame(5, st.ca, st.ea));
      rig.feed(v.moveFrame(6, 4, 0)); // L
      rig.feed(v.moveFrame(6, 4, 0)); // retransmit
      rig.feed(v.moveFrame(6, 4, 0));
      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `${v.name} dupes`);
      expect(rig.ourMoves).toEqual(['L']);
    });

    it('the 8-bit counter wrapping 255 -> 0 is handled identically', async () => {
      const rig = await makeRig(v);
      const st = realState(rig.sb, [2, 5, 8]);
      rig.feed(v.faceletFrame(253, st.ca, st.ea));
      const seq: Array<[number, number, number]> = [
        [254, 0, 0], [255, 1, 0], [0, 2, 0], [1, 3, 0], [2, 4, 0],
      ];
      for (const [cnt, axis, pow] of seq) rig.feed(v.moveFrame(cnt, axis, pow));
      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `${v.name} wrap`);
      expect(rig.ourMoves).toEqual(['U', 'R', 'F', 'D', 'L']);
    });

    it('battery / hardware / gyro frames never produce a move', async () => {
      const rig = await makeRig(v);
      const st = realState(rig.sb, [11]);
      rig.feed(v.faceletFrame(1, st.ca, st.ea));
      rig.feed(v.batteryFrame(73));
      rig.feed(v.hardwareFrame());
      if (v.name === 'v4') rig.feed(ganV4GyroFrame());
      rig.feed(v.moveFrame(2, 5, 0)); // B
      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `${v.name} noise`);
      expect(rig.ourMoves).toEqual(['B']);
    });

    it('frames encrypted with the WRONG mac are rejected by both', async () => {
      const rig = await makeRig(v);
      const st = realState(rig.sb, [0]);
      rig.feed(v.faceletFrame(3, st.ca, st.ea));
      rig.crypto.rekey('00:00:00:00:00:01', 0);
      for (let i = 0; i < 6; i++) rig.feed(v.moveFrame(4 + i, 0, 0));
      expectSameMoves(rig.ourMoves, rig.cstimerMoves(), `${v.name} wrong-key`);
      expect(rig.ourMoves).toEqual([]);
    });
  });
}

describeIf('GAN v4 facelets payload', () => {
  it('carries the cube state csTimer reconstructs (a scrambled cube is not "solved")', async () => {
    const rig = await makeRig(V4);
    const st = realState(rig.sb, [0, 4, 8, 13]);
    rig.feed(ganV4FaceletFrame(7, st.ca, st.ea));

    // csTimer's callback carries the facelet string it rebuilt from the frame.
    const cbs = rig.sb.callbacks;
    expect(cbs.length).toBeGreaterThan(0);
    const facelet = cbs[cbs.length - 1].facelet;
    expect(facelet).toHaveLength(54);
    expect(facelet).not.toBe('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  });

  it('a solved-state facelets frame reconstructs to the solved facelet string', async () => {
    const rig = await makeRig(V4);
    const st = realState(rig.sb, []);
    rig.feed(ganV4FaceletFrame(0, st.ca, st.ea));
    const cbs = rig.sb.callbacks;
    expect(cbs[cbs.length - 1].facelet)
      .toBe('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  });
});
