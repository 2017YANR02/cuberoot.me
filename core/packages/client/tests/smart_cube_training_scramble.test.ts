import { describe, expect, it } from 'vitest';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { hintSmartCubeScramble, verifySmartCubeScramble } from '@cuberoot/shared/smart-cube/scramble-hint';
import { applyColorNeutral, CUBE_ORIENTATIONS, orientCubeFacelets, timerTrainerCases, timerSmartCubeTrainingOrientation, timerSmartCubeAttemptScramble } from '@cuberoot/shared/timer';
import { applyMoves, applyScramble, solved, toFaceletString, type CubeFaces } from '@cuberoot/shared/timer/reconstruct/state';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';

// Independent sticker model: execute the written notation, then physically
// rotate its centers back into the device frame (no production normalizer).
const orientations = [''];
const centers = new Set(['UF']);
for (let i = 0; i < orientations.length; i++) {
  for (const axis of ['x', 'y', 'z']) {
    const alg = `${orientations[i]} ${axis}`.trim();
    const state = applyScramble(3, alg);
    const key = state.U[4] + state.F[4];
    if (!centers.has(key)) { centers.add(key); orientations.push(alg); }
  }
}
const orientationMoves = orientations.map(parseScramble);
function canonical(state: CubeFaces): string {
  for (const moves of orientationMoves) {
    const rotated = applyMoves(state, 3, moves);
    if (rotated.U[4] === 'U' && rotated.F[4] === 'F') return toFaceletString(rotated);
  }
  throw new Error('No canonical center orientation');
}
const after = (alg: string) => canonical(applyScramble(3, alg));

describe('smart cube training notation', () => {
  it('matches the sticker model for every move family and suffix', () => {
    expect(orientations).toHaveLength(24);
    for (const family of ['U', 'R', 'F', 'D', 'L', 'B', 'u', 'r', 'f', 'd', 'l', 'b', 'Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw', 'M', 'E', 'S', 'x', 'y', 'z']) {
      for (const suffix of ['', "'", '2', "2'"]) {
        const alg = `R U ${family}${suffix} F L'`;
        expect(smartCubeTargetFacelets(alg), alg).toBe(after(alg));
      }
    }
    for (const invalid of ['R potato U', '3Rw U', 'R @ U']) {
      expect(smartCubeTargetFacelets(invalid)).toBeNull();
      expect(hintSmartCubeScramble(invalid, after(''))).toBeNull();
    }
    expect(normalizeWcaScramble("2Rw U 2Rw'")).toBe("L F L'");
  });

  it('uses yellow-top green-front by default, keeps WCA unchanged and records physical scrambles', () => {
    expect(timerSmartCubeTrainingOrientation('zbll')).toBe('z2');
    expect(timerSmartCubeTrainingOrientation('333')).toBe('');
    expect(timerSmartCubeTrainingOrientation('zbll', '')).toBe('');
    expect(timerSmartCubeAttemptScramble('zbll', 'r U', '')).toBe('L F');
    const recorded = timerSmartCubeAttemptScramble('zbll', 'R U');
    expect(recorded).toBe('L D');
    expect(after(`${recorded} D' L'`)).toBe(after(''));
    expect(after("R U D' L'")).not.toBe(after(''));
    const display = orientCubeFacelets(after(''), 'z2');
    expect(display[4]).toBe('D');
    expect(display[22]).toBe('F');
  });

  it('guides physical turns in all 24 training grips while displaying the same local moves', () => {
    const scramble = "r U2' R' U' R U' r' U R U2' R' U2' R' F R F'";
    const tokens = normalizeWcaScramble(scramble)!.split(' ');
    for (const { value: orientation } of CUBE_ORIENTATIONS) {
      for (let i = 0; i <= tokens.length; i++) {
        const physical = after(`${orientation} ${tokens.slice(0, i).join(' ')}`);
        const hint = hintSmartCubeScramble(scramble, physical, after(''), orientation);
        expect(hint?.done, `${orientation} prefix ${i}`).toEqual(tokens.slice(0, i));
        expect(hint?.current).toBe(tokens[i] ?? null);
      }
    }
  });

  it('maps physical correction paths into the training frame, including non-self-inverse grips', () => {
    const target = smartCubeTargetFacelets('R U', 'y')!;
    expect(target).toBe(after('B U'));
    const fixup = { fromFacelets: after('F'), scramble: "F' B U" };
    const result = verifySmartCubeScramble('R U', target, after('F'), fixup, 'y');
    expect(result.correctionActive).toBe(true);
    expect(result.hint).toMatchObject({ current: "L'", pending: ['R', 'U'] });
    expect(verifySmartCubeScramble('R U', target, after('B'), fixup, 'y').hint?.current).toBe('U');
    expect(verifySmartCubeScramble('R U', target, target, fixup, 'y').match).toBe(true);
  });

  it('displays only physical face turns and advances every displayed step', () => {
    const scramble = "r U2' R' U' R U' r' U R U2' R' U2' R' F R F'";
    const tokens = normalizeWcaScramble(scramble)!.split(' ');
    expect(tokens.every((token) => /^[URFDLB](2|')?$/.test(token))).toBe(true);
    for (let i = 0; i <= tokens.length; i++) {
      const hint = hintSmartCubeScramble(scramble, after(tokens.slice(0, i).join(' ')));
      expect(hint, `prefix ${i}`).not.toBeNull();
      expect(hint!.done).toEqual(tokens.slice(0, i));
      expect(hint!.current).toBe(tokens[i] ?? null);
    }
    expect(hintSmartCubeScramble(scramble, after('r U'))?.current).toBe("F2");
  });

  it('expands middle layers into explicit outer turns, omits rotations, and waits for half turns', () => {
    const mixed = "x M2 U S' R2' E2 F r U";
    expect(after(normalizeWcaScramble(mixed)!)).toBe(after(mixed));
    expect(normalizeWcaScramble(mixed)).toBe("R2 L2 B D' U F2 R2 L2 D F D");
    const scramble = "M2 U";
    expect(hintSmartCubeScramble(scramble, after('R'))?.current).toBe('R2');
    expect(hintSmartCubeScramble(scramble, after('R2'))?.current).toBe('L2');
    expect(hintSmartCubeScramble(scramble, after('R2 L'))?.current).toBe('L2');
    expect(hintSmartCubeScramble(scramble, after('R2 L2'))?.current).toBe('D');
    expect(hintSmartCubeScramble('x r U', after(''))?.current).toBe('L');
    expect(hintSmartCubeScramble('R x', after('R'))?.complete).toBe(true);
  });

  for (const event of ['oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2'] as const) {
    it(`${event}: every case target and displayed prefix stay on the guidance path`, () => {
      for (const item of timerTrainerCases(event)) {
        const scramble = invertAlg(item.solutionAlg);
        const target = after(scramble);
        expect(smartCubeTargetFacelets(scramble), `${event}/${item.id}`).toBe(target);
        for (const [index, { value: orientation }] of CUBE_ORIENTATIONS.entries()) {
          expect(after(applyColorNeutral(scramble, 'six', () => index / 24)), `${event}/${item.id}/${orientation}`).toBe(after(`${orientation} ${scramble}`));
          expect(smartCubeTargetFacelets(scramble, orientation), `${event}/${item.id}/${orientation}`).toBe(after(`${orientation} ${scramble}`));
        }
        let state = solved(3);
        const tokens = normalizeWcaScramble(scramble)!.split(/\s+/).filter(Boolean);
        expect(tokens.every((token) => /^[URFDLB](2|')?$/.test(token))).toBe(true);
        for (let i = 0; i <= tokens.length; i++) {
          const hint = hintSmartCubeScramble(scramble, canonical(state));
          expect(hint, `${event}/${item.id} prefix ${i}`).not.toBeNull();
          expect([...hint!.done, ...(hint!.current ? [hint!.current] : []), ...hint!.pending]).toEqual(tokens);
          if (i < tokens.length) state = applyMoves(state, 3, parseScramble(tokens[i]));
        }
        expect(verifySmartCubeScramble(scramble, target, target, null).match).toBe(true);
      }
    });
  }

  it('LL: every OLL/PLL combination produces a reachable guided target', () => {
    for (const oll of timerTrainerCases('oll')) {
      for (const pll of timerTrainerCases('pll')) {
        const scramble = invertAlg(`${oll.solutionAlg} ${pll.solutionAlg}`);
        const target = after(scramble);
        expect(smartCubeTargetFacelets(scramble), `${oll.id}/${pll.id}`).toBe(target);
        expect(hintSmartCubeScramble(scramble, target)).not.toBeNull();
      }
    }
  });
});
