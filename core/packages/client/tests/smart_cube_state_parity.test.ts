/**
 * Three-way cube-state parity for the smart-cube pipeline.
 * =========================================================================
 *
 * For one and the same scramble, these three must agree on the resulting
 * 54-character facelet string:
 *
 *   1. VIRTUAL   — `applyScramble(3, s)`, the model that draws the scramble
 *                  preview and that the "与打乱不符" check compares against.
 *   2. SMART CUBE — the scramble replayed as quarter turns over BLE, through
 *                  the REAL GAN driver (encrypted frames, unmodified driver)
 *                  into `CubeStateTracker` — i.e. the full production path.
 *   3. csTimer    — the same quarter turns through csTimer's own `CubieCube`
 *                  in a Node `vm`, as an independent oracle.
 *
 * If (1) and (2) can disagree, the scramble check lies; that is exactly the
 * failure this suite exists to prevent. (3) keeps our own move model honest:
 * (1) and (2) share `_lib/cube/state.ts`, so on their own they could be wrong
 * together.
 *
 * A smart cube reports quarter turns only — `R2` reaches us as `R R` — so the
 * replay deliberately expands double turns rather than sending them whole.
 */

import { describe, it, expect } from 'vitest';
import { applyScramble, toFaceletString, fromFaceletString } from '@/app/[lang]/timer/_lib/cube/state';
import {
  applyCubieAlg, cubieStateToWire, cubieToFacelets, decodeCubieFacelets,
  isValidCubieState, solvedCubie,
} from '@/app/[lang]/timer/_lib/cube/cubie';
import { parseScramble } from '@/app/[lang]/timer/_lib/cube/moves';
import { CubeStateTracker } from '@/app/[lang]/timer/_lib/bluetooth/state_track';
import { ganV4Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v4';
import { makeFakeGatt } from '@/tests/_fake_gatt';
import { createCstimerSandbox, cstimerFileExists, type CstimerSandbox } from '@/tests/_cstimer_sandbox';
import {
  installGanCrypto, cubieStateAfter,
  GAN_V4_SERVICE, GAN_V4_READ, GAN_V4_WRITE,
  ganV4MoveFrame, ganV4FaceletFrame,
} from '@/tests/_bt_frame_fixtures';

const HAVE_CSTIMER = cstimerFileExists();
const describeIf = HAVE_CSTIMER ? describe : describe.skip;
if (!HAVE_CSTIMER) {
  // eslint-disable-next-line no-console
  console.warn('[smart_cube_state_parity] csTimer clone not found — oracle leg SKIPPED');
}

const SOLVED_FACELET = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/**
 * Real WCA scrambles. The first two are the ones from the bug report — the
 * user physically matched the preview and the app still said "与打乱不符".
 */
const SCRAMBLES = [
  "D2 L2 B2 L' F' U2 L' B L2 B' F U' R' B2 L2 B' D' L2",
  "D F' R D2 B2 U' R2 D2 B R' D' B2 U2 F U' L2 D' L'",
  "R U R' U' R' F R2 U' R' U' R U R' F'",
  "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  "U2 L2 D2 F2 U2 R2 B2 D2 F2 L2 U2",
  "R2 F2 B2 U2 D2 L2 R2 F2 B2",
];

/* ================================================================== */
/*  Scramble -> quarter-turn stream (what a smart cube actually sends) */
/* ================================================================== */

/** `R2` -> `['R','R']`, `R'` -> `["R'"]`. Rotations/wide moves are rejected. */
function toQuarterTurns(scramble: string): string[] {
  const out: string[] = [];
  for (const mv of parseScramble(scramble)) {
    if (mv.isRotation || mv.layers !== 1) {
      throw new Error(`toQuarterTurns: ${scramble} contains a move a smart cube cannot report`);
    }
    const n = Math.abs(mv.amount);
    const suffix = mv.amount < 0 ? "'" : '';
    for (let i = 0; i < n; i++) out.push(`${mv.face}${suffix}`);
  }
  return out;
}

/** `"U"` / `"U'"` -> the axis index + direction bit the GAN move event carries. */
function moveToAxisPow(move: string): { axis: number; pow: number } {
  const axis = 'URFDLB'.indexOf(move[0]);
  if (axis < 0) throw new Error(`moveToAxisPow: ${move}`);
  return { axis, pow: move.endsWith("'") ? 1 : 0 };
}

/** `"U"` / `"U'"` -> csTimer's `CubieCube.moveCube` index. */
function moveToCstimerIndex(move: string): number {
  const face = 'URFDLB'.indexOf(move[0]);
  return face * 3 + (move.endsWith("'") ? 2 : 0);
}

/* ================================================================== */
/*  The three legs                                                     */
/* ================================================================== */

/** LEG 1 — the virtual cube the preview and the scramble check both use. */
function virtualFacelets(scramble: string): string {
  return toFaceletString(applyScramble(3, scramble));
}

/**
 * LEG 2 — the production path: encrypted BLE frames -> real GAN v4 driver ->
 * `CubeStateTracker`. Nothing here reaches past the driver's public surface.
 */
async function smartCubeFacelets(sb: CstimerSandbox, scramble: string): Promise<string> {
  const mac = 'AB:CD:EF:01:23:45';
  const crypto = installGanCrypto(sb, mac, 0);
  const gatt = makeFakeGatt('GAN14-PARITY', { [GAN_V4_SERVICE]: [GAN_V4_READ, GAN_V4_WRITE] });
  const tracker = new CubeStateTracker();
  await ganV4Driver.start(gatt.asServer, (m) => { tracker.applyMove(m); }, { mac });
  const notify = gatt.char(GAN_V4_SERVICE, GAN_V4_READ);
  const feed = (plain: number[]): void => notify.emit(crypto.encrypt(plain.slice()));

  // The cube announces itself SOLVED at connect, exactly as it does in the
  // field — this is the event that seeds the move counter.
  const solvedState = cubieStateAfter(sb, []);
  feed(ganV4FaceletFrame(0, solvedState.ca, solvedState.ea));

  let cnt = 0;
  for (const mv of toQuarterTurns(scramble)) {
    const { axis, pow } = moveToAxisPow(mv);
    cnt = (cnt + 1) & 0xff;
    feed(ganV4MoveFrame(cnt, axis, pow));
  }
  return toFaceletString(tracker.getFaces());
}

/** LEG 3 — csTimer's own cube model, driven by the same quarter turns. */
function cstimerFacelets(sb: CstimerSandbox, scramble: string): string {
  const idx = toQuarterTurns(scramble).map(moveToCstimerIndex);
  sb.run(`__parityMoves = ${JSON.stringify(idx)};`);
  return sb.run<string>(`
    (function() {
      var cur = new mathlib.CubieCube();
      for (var i = 0; i < __parityMoves.length; i++) {
        var out = new mathlib.CubieCube();
        mathlib.CubieCube.CubeMult(cur, mathlib.CubieCube.moveCube[__parityMoves[i]], out);
        cur = out;
      }
      return cur.toFaceCube();
    })()
  `);
}

/* ================================================================== */
/*  Tests                                                              */
/* ================================================================== */

describe('facelet string round-trip', () => {
  it('a solved cube serialises to the canonical solved string', () => {
    expect(virtualFacelets('')).toBe(SOLVED_FACELET);
  });

  it('every scramble survives a serialise -> parse -> serialise round trip', () => {
    for (const s of SCRAMBLES) {
      const str = virtualFacelets(s);
      const back = fromFaceletString(str);
      expect(back, s).not.toBeNull();
      expect(toFaceletString(back!), s).toBe(str);
    }
  });

  it('malformed facelet strings are rejected rather than silently accepted', () => {
    expect(fromFaceletString('')).toBeNull();
    expect(fromFaceletString('U'.repeat(54))).toBeNull();          // nine of each, please
    expect(fromFaceletString(SOLVED_FACELET.slice(0, 53))).toBeNull();
    expect(fromFaceletString(`X${SOLVED_FACELET.slice(1)}`)).toBeNull();
  });
});

describe('the facelet string can be handed straight to visualcube', () => {
  // The corner live-cube view renders `toFaceletString(...)` as visualcube's
  // `fd`. That only works if visualcube's flat sticker array uses the same
  // face order AND the same per-face orientation we do. Its own docs number
  // stickers in a way that makes this non-obvious (the R face reads 12/15/18
  // across the top), so check it against visualcube's OWN simulation rather
  // than reasoning about the diagram.
  it('agrees with visualcube\'s own cube simulation, sticker for sticker', async () => {
    const { CubeData, parseAlgorithm, AllFaces } = await import('@cuberoot/visualcube');

    for (const alg of ['', 'R', "U'", 'R U', ...SCRAMBLES]) {
      // Seed each face with its own letter, then let visualcube turn it.
      const initial: Record<number, string[]> = {};
      'URFDLB'.split('').forEach((letter, i) => {
        initial[AllFaces[i]] = Array.from({ length: 9 }, () => letter);
      });
      const data = new CubeData(3, initial);
      for (const turn of parseAlgorithm(alg)) data.turn(turn);
      const theirs = AllFaces.map((f) => (data.faces[f] as string[]).join('')).join('');

      expect(`${alg || '(solved)'}: ${virtualFacelets(alg)}`).toBe(`${alg || '(solved)'}: ${theirs}`);
    }
  });
});

describe('source contract: the tracker advances before subscribers are told', () => {
  /**
   * `handleMove` used to call `onMove` and THEN apply the move, so anything
   * reading the cube state from inside its own onMove handler — the scramble
   * check does exactly that — saw the state as of one move ago. At the instant
   * a scramble is completed that is one move short, so the check reported
   * "doesn't match" on a correctly scrambled cube.
   *
   * There is no React test environment in this package, so this is guarded at
   * the source level: cheap, and it fails loudly the moment the order is
   * swapped back.
   */
  it('applyMove precedes the onMove notification in the hook', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('../app/[lang]/timer/_lib/bluetooth/index.ts', import.meta.url),
      'utf8',
    );
    const apply = src.indexOf('trackerRef.current.applyMove(move)');
    const notify = src.indexOf('onMoveRef.current?.(move, ts)');
    expect(apply, 'applyMove call not found — did handleMove get renamed?').toBeGreaterThan(-1);
    expect(notify, 'onMove notification not found').toBeGreaterThan(-1);
    expect(apply).toBeLessThan(notify);
  });
});

describe('the cubie move model matches the facelet move model', () => {
  /**
   * `_lib/cube/cubie.ts` turns cubes at the PIECE level; `_lib/cube/state.ts`
   * turns them at the FACELET level. They are independent implementations of
   * the same group, and the dev fake cube uses the piece-level one to produce
   * the wire-format states it broadcasts — so if it drifted, every
   * fake-cube-based verification would be measuring a lie.
   */
  const cubieFacelets = (alg: string): string => cubieToFacelets(applyCubieAlg(solvedCubie(), alg));

  it('agrees with the facelet model on every scramble', () => {
    for (const alg of ['', 'R', "U'", 'F2', 'R U R\' U\'', ...SCRAMBLES]) {
      expect(`${alg || '(solved)'}: ${cubieFacelets(alg)}`)
        .toBe(`${alg || '(solved)'}: ${virtualFacelets(alg)}`);
    }
  });

  it('respects the order of the moves it models', () => {
    expect(cubieFacelets('R R R R')).toBe(SOLVED_FACELET);
    expect(cubieFacelets('R2 R2')).toBe(SOLVED_FACELET);
    expect(cubieFacelets("R' R")).toBe(SOLVED_FACELET);
    // A sune has order 6; five of them must NOT be solved, six must be.
    const sune = "R U R' U R U2 R'";
    expect(cubieFacelets(Array(5).fill(sune).join(' '))).not.toBe(SOLVED_FACELET);
    expect(cubieFacelets(Array(6).fill(sune).join(' '))).toBe(SOLVED_FACELET);
  });

  it('survives the wire round trip the protocols use (7 corners + 11 edges)', () => {
    for (const alg of ['', 'R', ...SCRAMBLES]) {
      const st = applyCubieAlg(solvedCubie(), alg);
      expect(isValidCubieState(st), alg).toBe(true);
      const { corners, edges } = cubieStateToWire(st);
      expect(corners, alg).toHaveLength(7);
      expect(edges, alg).toHaveLength(11);
      // The 8th corner and 12th edge come back from the checksum alone.
      expect(decodeCubieFacelets(corners, edges), alg).toBe(virtualFacelets(alg));
    }
  });

  it('throws on notation a smart cube cannot report rather than skipping it', () => {
    expect(() => applyCubieAlg(solvedCubie(), 'x')).toThrow();
    expect(() => applyCubieAlg(solvedCubie(), 'Rw')).toThrow();
    expect(() => applyCubieAlg(solvedCubie(), 'M')).toThrow();
    expect(() => applyCubieAlg(solvedCubie(), 'R3')).toThrow();
  });
});

describeIf('scramble state parity: virtual cube vs smart cube vs csTimer', () => {
  for (const scramble of SCRAMBLES) {
    it(`all three agree on "${scramble}"`, async () => {
      const sb = await createCstimerSandbox({
        hardware: 'gancube.js',
        deviceName: 'GAN14-PARITY',
        services: { [GAN_V4_SERVICE]: [GAN_V4_READ, GAN_V4_WRITE] },
        mac: 'AB:CD:EF:01:23:45',
      });

      const virt = virtualFacelets(scramble);
      const smart = await smartCubeFacelets(sb, scramble);
      const cst = cstimerFacelets(sb, scramble);

      expect(virt).toHaveLength(54);
      expect(`smart=${smart}`).toBe(`smart=${virt}`);
      expect(`cstimer=${cst}`).toBe(`cstimer=${virt}`);
    });
  }

  it('a scramble followed by its inverse returns the smart cube to solved', async () => {
    const sb = await createCstimerSandbox({
      hardware: 'gancube.js',
      deviceName: 'GAN14-PARITY',
      services: { [GAN_V4_SERVICE]: [GAN_V4_READ, GAN_V4_WRITE] },
      mac: 'AB:CD:EF:01:23:45',
    });
    const scramble = SCRAMBLES[0];
    const inverse = toQuarterTurns(scramble)
      .reverse()
      .map((m) => (m.endsWith("'") ? m[0] : `${m}'`))
      .join(' ');
    expect(await smartCubeFacelets(sb, `${scramble} ${inverse}`)).toBe(SOLVED_FACELET);
  });
});
