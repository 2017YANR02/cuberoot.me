/**
 * QiYi cube-state reporting.
 * =========================================================================
 *
 * Every QiYi frame — the connect handshake AND every state change — carries
 * the cube's own 54 facelets. csTimer seeds its model from the handshake
 * (`qiyicube.js:170-178`) and prefers the reported facelets over its own
 * replay whenever the two disagree (`qiyicube.js:210-218`).
 *
 * We used to throw all of that away: the driver read the timestamp and the
 * battery out of those frames and dropped the facelets on the floor, so
 * connecting to an already-scrambled QiYi cube left the host believing it was
 * solved — the same defect class as the GAN v3/v4 bug in Sprint 1.
 *
 * The oracle for the decode is csTimer's OWN `parseFacelet`, lifted out of
 * `hardware/qiyicube.js` and run in the sandbox, so this tests our port rather
 * than testing my reading of it against itself.
 */

import { describe, it, expect } from 'vitest';
import { qiyiDriver } from '@/app/[lang]/timer/_lib/bluetooth/qiyi';
import { CubeStateTracker } from '@/app/[lang]/timer/_lib/bluetooth/state_track';
import { toFaceletString } from '@/app/[lang]/timer/_lib/cube/state';
import { makeFakeGatt } from '@/tests/_fake_gatt';
import {
  createCstimerSandbox, cstimerFileExists, extractFunction, type CstimerSandbox,
} from '@/tests/_cstimer_sandbox';
import {
  installQiyiCrypto, qiyiFrameBody, qiyiApplyMoves, qiyiResetCube,
  faceletToNibbles, QIYI_SERVICE, QIYI_CHAR, type QiyiCrypto,
} from '@/tests/_bt_frame_fixtures';

const HAVE_CSTIMER = cstimerFileExists();
const describeIf = HAVE_CSTIMER ? describe : describe.skip;

const DEVICE = 'QY-QYSC-2-A1B2';
const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

interface Rig {
  sb: CstimerSandbox;
  crypto: QiyiCrypto;
  /** Moves the driver reported, oldest first. */
  moves: string[];
  /** Every facelet string the driver reported via `onState`, in order. */
  states: string[];
  /** Interleaved event log — proves ordering, not just contents. */
  order: string[];
  feed(cipher: number[]): void;
  /** csTimer's own `parseFacelet`, as the decode oracle. */
  oracleParse(faceletBytes: number[]): string;
}

async function makeRig(): Promise<Rig> {
  const sb = await createCstimerSandbox({
    hardware: 'qiyicube.js',
    deviceName: DEVICE,
    services: { [QIYI_SERVICE]: [QIYI_CHAR] },
    mac: 'CC:A3:00:00:A1:B2',
  });
  const crypto = installQiyiCrypto(sb);
  await sb.connect();
  qiyiResetCube(sb);

  // csTimer's real decoder, pulled out of its source and installed as-is.
  sb.run(`
    var __qyOracle = (function() {
      ${extractFunction(sb.source('hardware/qiyicube.js'), 'parseFacelet')}
      return parseFacelet;
    })();
  `);

  const gatt = makeFakeGatt(DEVICE, { [QIYI_SERVICE]: [QIYI_CHAR] });
  const moves: string[] = [];
  const states: string[] = [];
  const order: string[] = [];
  await qiyiDriver.start(
    gatt.asServer,
    (m) => { moves.push(m); order.push(`move:${m}`); },
    { onState: (f) => { states.push(f); order.push('state'); } },
  );
  const notify = gatt.char(QIYI_SERVICE, QIYI_CHAR);

  return {
    sb, crypto, moves, states, order,
    feed: (cipher) => notify.emit(cipher),
    oracleParse: (bytes) => {
      sb.run(`__qyFaceBytes = ${JSON.stringify(bytes)};`);
      return sb.run<string>('__qyOracle(__qyFaceBytes)');
    },
  };
}

describeIf('QiYi reports the cube state it is actually in', () => {
  it('the connect handshake seeds the host with a SCRAMBLED cube, not a solved one', async () => {
    const rig = await makeRig();
    // The user scrambled before connecting — the overwhelmingly common case.
    const scrambled = qiyiApplyMoves(rig.sb, [1, 5, 9, 3, 7]);
    expect(scrambled).not.toBe(SOLVED);

    rig.feed(rig.crypto.build(qiyiFrameBody({
      opcode: 2, ts: 1000, facelet: scrambled, battery: 70,
    })));

    expect(rig.states).toEqual([scrambled]);
    expect(rig.moves).toEqual([]);       // a handshake is not a turn

    // And it is adoptable: the tracker ends up in exactly that state.
    const tracker = new CubeStateTracker();
    expect(tracker.adoptFacelets(rig.states[0])).toBe(true);
    expect(toFaceletString(tracker.getFaces())).toBe(scrambled);
    expect(tracker.isSolved()).toBe(false);
  });

  it('decodes facelets identically to csTimer\'s own parseFacelet', async () => {
    const rig = await makeRig();
    for (const mvs of [[], [1], [1, 4, 7], [2, 2, 2, 2], [11, 6, 3, 9, 5, 12]]) {
      qiyiResetCube(rig.sb);
      const facelet = qiyiApplyMoves(rig.sb, mvs);
      const bytes = faceletToNibbles(facelet);

      rig.states.length = 0;
      rig.feed(rig.crypto.build(qiyiFrameBody({ opcode: 2, ts: 2000, facelet })));

      const theirs = rig.oracleParse(bytes);
      expect(`${mvs}: ${rig.states[0]}`).toBe(`${mvs}: ${theirs}`);
    }
  });

  it('reports the state AFTER the move in the same frame, and in that order', async () => {
    const rig = await makeRig();
    const solved = qiyiResetCube(rig.sb);
    rig.feed(rig.crypto.build(qiyiFrameBody({ opcode: 2, ts: 1000, facelet: solved })));
    rig.order.length = 0;

    // Move byte 1: axis = [4,1,3,0,2,5][0] = 4 = "L", power = [0,2][1] = 2 = CCW.
    const after = qiyiApplyMoves(rig.sb, [1]);
    rig.feed(rig.crypto.build(qiyiFrameBody({
      opcode: 3, ts: 2000, facelet: after, curMove: 1,
    })));

    // Ordering is a contract, not a coincidence: the host fires "solved" off
    // the move, so handing it the finished state first would swallow the edge.
    expect(rig.order).toEqual(["move:L'", 'state']);
    expect(rig.states.at(-1)).toBe(after);
  });

  it('the reported state heals a host that has drifted out of sync', async () => {
    const rig = await makeRig();
    qiyiResetCube(rig.sb);

    // A host that missed a move: it thinks the cube is solved, the cube says
    // otherwise. Adopting the report is what fixes it — without this the rest
    // of the session is wrong by exactly the moves that went missing.
    const truth = qiyiApplyMoves(rig.sb, [3, 7, 11]);
    const tracker = new CubeStateTracker();
    expect(tracker.isSolved()).toBe(true);

    rig.feed(rig.crypto.build(qiyiFrameBody({
      opcode: 3, ts: 3000, facelet: truth, curMove: 11,
    })));

    expect(tracker.adoptFacelets(rig.states.at(-1)!)).toBe(true);
    expect(toFaceletString(tracker.getFaces())).toBe(truth);
  });

  it('refuses a payload that is not a cube rather than adopting garbage', async () => {
    const rig = await makeRig();
    const body = qiyiFrameBody({ opcode: 2, ts: 1000, facelet: SOLVED });
    // Nibble 0xF is outside the 6-colour alphabet — what a wrong key decodes to.
    body[7] = 0xff;
    rig.feed(rig.crypto.build(body));
    expect(rig.states).toEqual([]);

    // A frame whose nibbles are all in range but do not make nine of each
    // colour is also refused (54 stickers of one colour is not a cube).
    const rig2 = await makeRig();
    const monochrome = qiyiFrameBody({ opcode: 2, ts: 1000, facelet: 'U'.repeat(54) });
    rig2.feed(rig2.crypto.build(monochrome));
    expect(rig2.states).toEqual([]);
  });
});
