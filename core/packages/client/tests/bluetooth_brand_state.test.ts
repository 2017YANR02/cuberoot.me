/**
 * "The cube already said where it is" — GoCube, Giiker and MoYu32.
 * =========================================================================
 *
 * Sprint 1 fixed this for GAN v3/v4 and Sprint 3 for QiYi: the protocols carry
 * the cube's own state, we were dropping it, and a cube that was scrambled
 * before it connected stayed wrong for the whole session. These are the three
 * remaining brands with a state frame.
 *
 * Each brand gets csTimer's OWN decoder as the oracle, not a re-reading of the
 * spec by me:
 *
 *   Giiker   the whole `giikercube.js` runs in the sandbox and hands its
 *            computed facelet to `GiikerCube.callback` — we compare strings.
 *            Note this is the only brand that reports state on EVERY frame.
 *   MoYu32   `parseFacelet` is lifted out of `moyu32cube.js` and called with
 *            the same bit string our decoder reads.
 *   GoCube   csTimer's msgType-2 branch is inline in `parseData`, so the oracle
 *            is built from its own `axisPerm` / `facePerm` / `faceOffset`
 *            declarations, sliced out of the source file. See the note on
 *            csTimer's own GoCube adoption bug below for why we cannot chain
 *            the oracle through its move path the way the QiYi test does.
 */

import { describe, it, expect } from 'vitest';
import { gocubeDriver, parseGoCubeFacelets } from '@/app/[lang]/timer/_lib/bluetooth/gocube';
import { giikerDriver } from '@/app/[lang]/timer/_lib/bluetooth/giiker';
import { createMoyu32State, decodeMoyu32Frame } from '@/app/[lang]/timer/_lib/bluetooth/moyu32';
import { CubeStateTracker } from '@/app/[lang]/timer/_lib/bluetooth/state_track';
import {
  applyCubieAlg, cubieToFacelets, solvedCubie, type CubieState,
} from '@/app/[lang]/timer/_lib/cube/cubie';
import { toFaceletString } from '@/app/[lang]/timer/_lib/cube/state';
import { makeFakeGatt } from '@/tests/_fake_gatt';
import {
  createCstimerSandbox, cstimerFileExists, extractFunction, extractVarDecl,
} from '@/tests/_cstimer_sandbox';
import {
  packBits, type BitWrite,
  GOCUBE_SERVICE, GOCUBE_READ, GOCUBE_WRITE, goCubeStateFrame, goCubeMoveFrame,
  GIIKER_DATA_SERVICE, GIIKER_NOTIFY, GIIKER_RW_SERVICE, GIIKER_READ, GIIKER_WRITE,
  giikerStateFrame, type GiikerMove,
} from '@/tests/_bt_frame_fixtures';

const HAVE_CSTIMER = cstimerFileExists();
const describeIf = HAVE_CSTIMER ? describe : describe.skip;

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/** A few reachable states to decode, as (name, cubie state) pairs. */
const SCRAMBLES: ReadonlyArray<readonly [string, string]> = [
  ['solved', ''],
  ['one turn', "R"],
  ['sexy', "R U R' U'"],
  ['sune', "R U R' U R U2 R'"],
  ['long', "R U2 D' B D' F2 L' R2 U B2 F' D L F2 R'"],
];

function stateOf(alg: string): CubieState {
  return applyCubieAlg(solvedCubie(), alg);
}

/* ================================================================== */
/*  GoCube — opcode 0x02                                              */
/* ================================================================== */

describe('GoCube reports its own 54 stickers', () => {
  it('decodes every state the fixture can build, round trip exact', () => {
    for (const [name, alg] of SCRAMBLES) {
      const facelet = cubieToFacelets(stateOf(alg));
      const frame = goCubeStateFrame(facelet);
      const dv = new DataView(Uint8Array.from(frame).buffer);
      // payloadLen is what the driver computes: byteLength - 6.
      expect(`${name}: ${parseGoCubeFacelets(dv, frame.length - 6)}`).toBe(`${name}: ${facelet}`);
    }
  });

  it('hands the connect-time dump to the host, which adopts a scrambled cube', async () => {
    const services = { [GOCUBE_SERVICE]: [GOCUBE_READ, GOCUBE_WRITE] };
    const gatt = makeFakeGatt('GoCube-ABC', services);
    const moves: string[] = [];
    const states: string[] = [];
    const order: string[] = [];
    await gocubeDriver.start(
      gatt.asServer,
      (m) => { moves.push(m); order.push(`move:${m}`); },
      { onState: (f) => { states.push(f); order.push('state'); } },
    );

    const truth = cubieToFacelets(stateOf("R U R' U' F' L2 D"));
    gatt.char(GOCUBE_SERVICE, GOCUBE_READ).emit(goCubeStateFrame(truth));

    expect(states).toEqual([truth]);
    expect(moves).toEqual([]);            // a state dump is not a turn

    const tracker = new CubeStateTracker();
    expect(tracker.adoptFacelets(states[0])).toBe(true);
    expect(toFaceletString(tracker.getFaces())).toBe(truth);
    expect(tracker.isSolved()).toBe(false);
  });

  it('refuses a dump that is truncated or not made of colours', async () => {
    const services = { [GOCUBE_SERVICE]: [GOCUBE_READ, GOCUBE_WRITE] };
    const gatt = makeFakeGatt('GoCube-ABC', services);
    const states: string[] = [];
    await gocubeDriver.start(gatt.asServer, () => {}, { onState: (f) => states.push(f) });
    const notify = gatt.char(GOCUBE_SERVICE, GOCUBE_READ);

    // Colour byte 6 is outside the 6-colour alphabet.
    const bad = goCubeStateFrame(SOLVED);
    bad[3] = 6;
    notify.emit(bad);
    expect(states).toEqual([]);

    // Half a dump: a notification that arrived split.
    notify.emit(goCubeStateFrame(SOLVED).slice(0, 30));
    expect(states).toEqual([]);

    // Nine of one colour missing — in range, but not a cube.
    const monochrome = goCubeStateFrame(SOLVED);
    for (let i = 3; i < 3 + 54; i++) monochrome[i] = 2; // all 'U'
    notify.emit(monochrome);
    expect(states).toEqual([]);
  });
});

describeIf('GoCube state decode vs csTimer', () => {
  /**
   * csTimer's own reader, rebuilt from the three tables in its source. Only the
   * loop is retyped; the tables — the part that is easy to get wrong — come
   * out of `gocube.js` itself, so a typo in our copy of them fails here.
   */
  async function makeOracle() {
    const services = { [GOCUBE_SERVICE]: [GOCUBE_READ, GOCUBE_WRITE] };
    const sb = await createCstimerSandbox({
      hardware: 'gocube.js', deviceName: 'GoCube-ABC', services,
    });
    const src = sb.source('hardware/gocube.js');
    sb.run(`
      var __gcOracle = (function() {
        ${extractVarDecl(src, 'axisPerm')}
        ${extractVarDecl(src, 'facePerm')}
        ${extractVarDecl(src, 'faceOffset')}
        return function(bytes) {
          var facelet = [];
          for (var a = 0; a < 6; a++) {
            var axis = axisPerm[a] * 9;
            var aoff = faceOffset[a];
            facelet[axis + 4] = "BFUDRL".charAt(bytes[a * 9]);
            for (var i = 0; i < 8; i++) {
              facelet[axis + facePerm[(i + aoff) % 8]] = "BFUDRL".charAt(bytes[a * 9 + i + 1]);
            }
          }
          return facelet.join('');
        };
      })();
    `);
    return {
      sb,
      decode(frame: number[]): string {
        const payload = frame.slice(3, 3 + 54);
        sb.run(`__gcBytes = ${JSON.stringify(payload)};`);
        return sb.run<string>('__gcOracle(__gcBytes)');
      },
    };
  }

  it('agrees with csTimer sticker for sticker', async () => {
    const oracle = await makeOracle();
    for (const [name, alg] of SCRAMBLES) {
      const facelet = cubieToFacelets(stateOf(alg));
      const frame = goCubeStateFrame(facelet);
      const dv = new DataView(Uint8Array.from(frame).buffer);
      const ours = parseGoCubeFacelets(dv, frame.length - 6);
      expect(`${name}: ${ours}`).toBe(`${name}: ${oracle.decode(frame)}`);
    }
  });

  /**
   * UPSTREAM BUG, pinned deliberately.
   *
   * csTimer's msgType-2 branch does `curCubie.fromFacelet(newFacelet)`
   * (gocube.js:107) — but `curCubie` is its SCRATCH cubie: the move branch
   * computes `CubeMult(prevCubie, move, curCubie)` and then swaps the two, so
   * the adopted state is overwritten by the very next turn and never read.
   * csTimer therefore keeps replaying from solved no matter what the cube says,
   * which is why this test cannot use its post-move facelet as an oracle for
   * adoption (only for the decode, above).
   *
   * If csTimer ever fixes this, this test goes red — that is the point: it is
   * the signal to re-check our own behaviour against theirs, not a failure.
   */
  it('csTimer decodes the dump but never adopts it (so we do not mirror that)', async () => {
    const oracle = await makeOracle();
    await oracle.sb.connect();
    oracle.sb.clearCaptured();

    const truth = cubieToFacelets(stateOf("R U R' U'"));
    oracle.sb.feedFrame(goCubeStateFrame(truth), GOCUBE_READ);

    // Move code 0: axis = axisPerm[0] = 5 = "B", power 0 = CW.
    oracle.sb.feedFrame(goCubeMoveFrame([{ code: 0 }]), GOCUBE_READ);

    const theirs = oracle.sb.callbacks.at(-1)?.facelet;
    expect(theirs).toBe(cubieToFacelets(stateOf('B')));           // from SOLVED
    expect(theirs).not.toBe(cubieToFacelets(stateOf("R U R' U' B"))); // not from the dump
  });
});

/* ================================================================== */
/*  Giiker — nibbles 0..30 of every frame                              */
/* ================================================================== */

/**
 * Turn a cubie state into the nibbles a Giiker would send. Inverse of
 * `parseGiikerState`: permutations are 1-based, and the four corners whose
 * `coMask` is -1 carry their twist negated mod 3.
 */
const GIIKER_CO_MASK = [-1, 1, -1, 1, 1, -1, 1, -1];

function giikerNibbles(st: CubieState) {
  return {
    cp: st.ca.map((v) => (v & 7) + 1),
    co: st.ca.map((v, i) => {
      const ori = v >> 3;
      return GIIKER_CO_MASK[i] === 1 ? ori : (3 - ori) % 3;
    }),
    ep: st.ea.map((v) => (v >> 1) + 1),
    eo: st.ea.map((v) => v & 1),
  };
}

const NO_MOVES: GiikerMove[] = [];

describe('Giiker reports its state in every notification', () => {
  async function makeRig(baseline: number[]) {
    const services = {
      [GIIKER_DATA_SERVICE]: [GIIKER_NOTIFY],
      [GIIKER_RW_SERVICE]: [GIIKER_READ, GIIKER_WRITE],
    };
    const gatt = makeFakeGatt('Gi123456', services);
    gatt.char(GIIKER_DATA_SERVICE, GIIKER_NOTIFY).readBytes = baseline;
    const moves: string[] = [];
    const states: string[] = [];
    const order: string[] = [];
    await giikerDriver.start(
      gatt.asServer,
      (m) => { moves.push(m); order.push(`move:${m}`); },
      { onState: (f) => { states.push(f); order.push('state'); } },
    );
    return {
      moves, states, order,
      feed: (bytes: number[]) => gatt.char(GIIKER_DATA_SERVICE, GIIKER_NOTIFY).emit(bytes),
    };
  }

  it('reads the pre-connect scramble out of the very first frame', async () => {
    const st = stateOf("R U R' U' F' L2 D");
    const rig = await makeRig(giikerStateFrame({ ...giikerNibbles(st), moves: NO_MOVES }));

    // The baseline read happens inside start(), so the state is already known
    // before the user touches the cube.
    expect(rig.states.length).toBe(1);
    const tracker = new CubeStateTracker();
    expect(tracker.adoptFacelets(rig.states[0])).toBe(true);
    expect(tracker.isSolved()).toBe(false);
  });

  it('puts the move before the state it produced', async () => {
    const solved = giikerNibbles(solvedCubie());
    const rig = await makeRig(giikerStateFrame({ ...solved, moves: NO_MOVES }));
    rig.order.length = 0;

    // face 5 = "R" in csTimer's "BDLURF" table, dir 1 = CW.
    const st = stateOf('R');
    rig.feed(giikerStateFrame({ ...giikerNibbles(st), moves: [{ face: 5, dir: 1 }] }));

    expect(rig.order).toEqual(['move:R', 'state']);
  });

  it('refuses nibbles that are not a cube', async () => {
    const solved = giikerNibbles(solvedCubie());
    const rig = await makeRig(giikerStateFrame({ ...solved, moves: NO_MOVES }));
    rig.states.length = 0;

    // Two corners claiming the same slot: a real cube cannot do this.
    const dup = { ...solved, cp: [1, 1, 3, 4, 5, 6, 7, 8] };
    rig.feed(giikerStateFrame({ ...dup, moves: NO_MOVES }));
    expect(rig.states).toEqual([]);

    // A single twisted corner: reachable-looking nibbles, unreachable cube.
    const twist = { ...solved, co: [1, 0, 0, 0, 0, 0, 0, 0] };
    rig.feed(giikerStateFrame({ ...twist, moves: NO_MOVES }));
    expect(rig.states).toEqual([]);

    // Permutation nibble 0 (1-based on the wire) is out of range.
    const zero = { ...solved, ep: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
    rig.feed(giikerStateFrame({ ...zero, moves: NO_MOVES }));
    expect(rig.states).toEqual([]);
  });
});

describeIf('Giiker state decode vs csTimer', () => {
  it('agrees with giikercube.js facelet for facelet', async () => {
    const services = {
      [GIIKER_DATA_SERVICE]: [GIIKER_NOTIFY],
      [GIIKER_RW_SERVICE]: [GIIKER_READ, GIIKER_WRITE],
    };
    const sb = await createCstimerSandbox({
      hardware: 'giikercube.js', deviceName: 'Gi123456', services,
    });
    const solvedFrame = giikerStateFrame({ ...giikerNibbles(solvedCubie()), moves: NO_MOVES });
    sb.setReadValue(GIIKER_NOTIFY, solvedFrame);
    await sb.connect();

    const gatt = makeFakeGatt('Gi123456', services);
    gatt.char(GIIKER_DATA_SERVICE, GIIKER_NOTIFY).readBytes = solvedFrame;
    const states: string[] = [];
    await giikerDriver.start(gatt.asServer, () => {}, { onState: (f) => states.push(f) });
    const notify = gatt.char(GIIKER_DATA_SERVICE, GIIKER_NOTIFY);

    for (const [name, alg] of SCRAMBLES) {
      const frame = giikerStateFrame({ ...giikerNibbles(stateOf(alg)), moves: NO_MOVES });
      sb.clearCaptured();
      states.length = 0;
      sb.feedFrame(frame, GIIKER_NOTIFY);
      notify.emit(frame);

      const theirs = sb.callbacks.at(-1)?.facelet;
      expect(`${name}: ${states.at(-1)}`).toBe(`${name}: ${theirs}`);
    }
  });

  /**
   * The Giiker numbers its stickers differently from Kociemba, so decoding its
   * frames with the default tables yields a state that is self-consistent and
   * wrong. This pins that the brand tables are doing real work — deleting them
   * would leave the test above passing only for the solved cube.
   */
  it('needs Giiker\'s own facelet tables, not the default ones', async () => {
    const services = {
      [GIIKER_DATA_SERVICE]: [GIIKER_NOTIFY],
      [GIIKER_RW_SERVICE]: [GIIKER_READ, GIIKER_WRITE],
    };
    const gatt = makeFakeGatt('Gi123456', services);
    const st = stateOf("R U R' U'");
    const frame = giikerStateFrame({ ...giikerNibbles(st), moves: NO_MOVES });
    gatt.char(GIIKER_DATA_SERVICE, GIIKER_NOTIFY).readBytes = frame;
    const states: string[] = [];
    await giikerDriver.start(gatt.asServer, () => {}, { onState: (f) => states.push(f) });

    expect(states.at(-1)).not.toBe(cubieToFacelets(st)); // default tables
  });
});

/* ================================================================== */
/*  MoYu32 — 0xA3 snapshot                                            */
/* ================================================================== */

/** Colour / face alphabet of the MoYu32 wire format. */
const MOYU32_ALPHABET = 'FBUDLR';
/** Face read order that makes the output come out URFDLB. */
const MOYU32_READ_ORDER = [2, 5, 0, 3, 4, 1];

/**
 * 0xA3 frame carrying a real facelet string. Inverse of csTimer's
 * `parseFacelet`: 48 stickers at 3 bits each from bit 8, faces in
 * `MOYU32_READ_ORDER`, centres omitted (they are implied by the face).
 */
function moyu32StateFrame(facelet: string, moveCnt = 0): Uint8Array {
  const writes: BitWrite[] = [[0, 8, 0xa3], [152, 8, moveCnt & 0xff]];
  for (let i = 0; i < 6; i++) {
    const face = MOYU32_READ_ORDER[i];
    const block = facelet.slice(i * 9, i * 9 + 9);
    if (block.charAt(4) !== MOYU32_ALPHABET.charAt(face)) {
      throw new Error(`moyu32StateFrame: centre ${block.charAt(4)} is not face ${face}`);
    }
    const wire = (block.slice(0, 4) + block.slice(5, 9)).split('');
    wire.forEach((ch, j) => {
      const colour = MOYU32_ALPHABET.indexOf(ch);
      if (colour < 0) throw new Error(`moyu32StateFrame: bad colour "${ch}"`);
      writes.push([8 + face * 24 + j * 3, 3, colour]);
    });
  }
  return Uint8Array.from(packBits(20, writes));
}

describe('MoYu32 0xA3 snapshot', () => {
  it('reports the state it carries, and still seeds the move counter', () => {
    const states: string[] = [];
    const dec = createMoyu32State((f) => states.push(f));
    const truth = cubieToFacelets(stateOf("R U R' U' F' L2 D"));

    expect(decodeMoyu32Frame(moyu32StateFrame(truth, 42), dec)).toEqual([]);
    expect(dec.prevMoveCnt).toBe(42);
    expect(states).toEqual([truth]);
  });

  it('is consumed only while the counter is unseeded, as in csTimer', () => {
    const states: string[] = [];
    const dec = createMoyu32State((f) => states.push(f));
    decodeMoyu32Frame(moyu32StateFrame(SOLVED, 7), dec);
    expect(states.length).toBe(1);

    // A second snapshot mid-session is ignored — csTimer gates the whole
    // branch on `prevMoveCnt == -1`, and adopting here would fight the move
    // stream that is now the authority.
    decodeMoyu32Frame(moyu32StateFrame(cubieToFacelets(stateOf('R')), 9), dec);
    expect(states.length).toBe(1);
    expect(dec.prevMoveCnt).toBe(7);
  });

  it('reports nothing rather than a fake cube when the bits are blank', () => {
    const states: string[] = [];
    const dec = createMoyu32State((f) => states.push(f));
    // All-zero facelet bits (a frame that never got filled in, or a wrong key)
    // read as 54 stickers of one colour.
    const blank = Uint8Array.from(packBits(20, [[0, 8, 0xa3], [152, 8, 3]]));
    expect(decodeMoyu32Frame(blank, dec)).toEqual([]);
    expect(states).toEqual([]);
    // The counter still seeds: losing the snapshot must not wedge the move
    // stream, which is the one thing worse than not knowing the state.
    expect(dec.prevMoveCnt).toBe(3);
  });
});

describeIf('MoYu32 state decode vs csTimer', () => {
  it('agrees with moyu32cube.js parseFacelet', async () => {
    const svc = '0783b03e-7735-b5a0-1760-a305d2795cb0';
    const sb = await createCstimerSandbox({
      hardware: 'moyu32cube.js',
      deviceName: 'WCU_MY32_A1B2',
      services: {
        [svc]: ['0783b03e-7735-b5a0-1760-a305d2795cb1', '0783b03e-7735-b5a0-1760-a305d2795cb2'],
      },
      mac: 'CF:30:16:00:A1:B2',
    });
    sb.run(`
      var __myOracle = (function() {
        ${extractFunction(sb.source('hardware/moyu32cube.js'), 'parseFacelet')}
        return parseFacelet;
      })();
    `);

    for (const [name, alg] of SCRAMBLES) {
      const facelet = cubieToFacelets(stateOf(alg));
      const frame = moyu32StateFrame(facelet);
      // csTimer reads frames as a big-endian bit STRING; bits 8..152 are the
      // 48 stickers.
      const bits = Array.from(frame)
        .map((b) => b.toString(2).padStart(8, '0'))
        .join('')
        .slice(8, 152);

      const states: string[] = [];
      const dec = createMoyu32State((f) => states.push(f));
      decodeMoyu32Frame(frame, dec);

      const theirs = sb.run<string>(`__myOracle(${JSON.stringify(bits)})`);
      expect(`${name}: ${states.at(-1)}`).toBe(`${name}: ${theirs}`);
    }
  });
});
