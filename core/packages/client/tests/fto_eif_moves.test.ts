import { afterEach, describe, expect, it } from 'vitest';
import FtoCube from '@/app/[lang]/sim/engine/fto/FtoCube';
import { invertFtoAnimationMoves, type FtoAnimationMove } from '@/app/[lang]/sim/engine/fto/ftoAnimation';
import {
  EIF_TO_ENGINE_FACE,
  ftoEifTokenMoves,
  parseFtoEifMoveGroups,
} from '@/app/[lang]/sim/engine/fto/ftoEifMoves';
import { FTO_EIF_ACTION_SEQUENCES } from '@/lib/fto-eif-image';

const cubes: FtoCube[] = [];

function makeCube(): FtoCube {
  const cube = new FtoCube();
  cubes.push(cube);
  return cube;
}

function apply(cube: FtoCube, moves: readonly FtoAnimationMove[]): void {
  for (const move of moves) cube.applyMoveInstant(move);
}

function expectSamePose(actual: FtoCube, expected: FtoCube): void {
  expect(actual.pieces).toHaveLength(expected.pieces.length);
  actual.pieces.forEach((piece, index) => {
    const dot = Math.abs(piece.pivot.quaternion.dot(expected.pieces[index].pivot.quaternion));
    expect(dot).toBeCloseTo(1, 8);
  });
}

afterEach(() => {
  for (const cube of cubes.splice(0)) cube.dispose();
});

describe('FTO EIF animated move bridge', () => {
  it('locks the EIF face names to the shared simulator orientation', () => {
    expect(EIF_TO_ENGINE_FACE).toEqual({ U: 1, F: 7, R: 6, L: 5, D: 4, Bl: 2, Br: 3, B: 0 });
  });

  it('keeps one original EIF token per timeline group and reports invalid input', () => {
    const parsed = parseFtoEifMoveGroups("U Rw Fs' Uo Rt2 S H' nope");
    expect(parsed.tokens).toEqual(['U', 'Rw', "Fs'", 'Uo', 'Rt2', 'S', "H'"]);
    expect(parsed.groups).toHaveLength(parsed.tokens.length);
    expect(parsed.invalid).toEqual(['nope']);
    expect(parsed.groups[5]).toHaveLength(FTO_EIF_ACTION_SEQUENCES.S.length);
    expect(parsed.groups[6]).toHaveLength(FTO_EIF_ACTION_SEQUENCES["H'"].length);
  });

  it('canonicalizes common FTO aliases without changing their rendered pose', () => {
    const aliases = parseFtoEifMoveGroups("BL BR bl br rw RW BLw brw rs RO rt R’ T T' T2");
    expect(aliases.tokens).toEqual([
      'Bl', 'Br', 'Bl', 'Br', 'Rw', 'Rw', 'Blw', 'Brw', 'Rs', 'Ro', 'Rt', "R'", "Ft'", 'Ft', 'Ft2',
    ]);
    expect(aliases.invalid).toEqual([]);

    for (const [alias, canonical] of [['BL', 'Bl'], ['BRw', 'Brw'], ['rs', 'Rs'], ['rt', 'Rt']] as const) {
      const aliasCube = makeCube();
      const canonicalCube = makeCube();
      apply(aliasCube, ftoEifTokenMoves(alias)!);
      apply(canonicalCube, ftoEifTokenMoves(canonical)!);
      expectSamePose(aliasCube, canonicalCube);
    }

    for (const [alias, canonical] of [['T', "Ft'"], ["T'", 'Ft'], ['T2', 'Ft2']] as const) {
      const aliasCube = makeCube();
      const canonicalCube = makeCube();
      apply(aliasCube, ftoEifTokenMoves(alias)!);
      apply(canonicalCube, ftoEifTokenMoves(canonical)!);
      expectSamePose(aliasCube, canonicalCube);
    }
  });

  it('turns 2 as two physical 120-degree moves while vertex 2 is one 180-degree move', () => {
    expect(ftoEifTokenMoves('U2')).toHaveLength(2);
    expect(ftoEifTokenMoves('Rw2')).toHaveLength(2);
    expect(ftoEifTokenMoves('Rt2')).toEqual([
      expect.objectContaining({ kind: 'vertex-rotation', quarterTurns: 2 }),
    ]);
  });

  it.each(['Rw', 'Dw', 'Blw', 'Uo', 'Ro'])(
    '%s native layer animation is equivalent to its documented EIF expansion',
    (token) => {
      const nativeCube = makeCube();
      const expandedCube = makeCube();
      const native = ftoEifTokenMoves(token)!;
      const expanded = FTO_EIF_ACTION_SEQUENCES[token]
        .flatMap(move => ftoEifTokenMoves(move)!);

      apply(nativeCube, native);
      apply(expandedCube, expanded);
      expectSamePose(nativeCube, expandedCube);
    },
  );

  it('selects real face, slice, wide and whole-puzzle geometry groups', () => {
    const cube = makeCube();
    const face = ftoEifTokenMoves('R')![0];
    const slice = ftoEifTokenMoves('Rs')![0];
    const wide = ftoEifTokenMoves('Rw')![0];
    const whole = ftoEifTokenMoves('Ro')![0];
    const vertex = ftoEifTokenMoves('Rt')![0];
    const faceCount = cube.beginMove(face).length;
    const sliceCount = cube.beginMove(slice).length;

    expect(faceCount).toBeGreaterThan(0);
    expect(sliceCount).toBeGreaterThan(0);
    expect(cube.beginMove(wide)).toHaveLength(faceCount + sliceCount);
    expect(cube.beginMove(whole)).toHaveLength(cube.pieces.length);
    expect(cube.beginMove(vertex)).toHaveLength(cube.pieces.length);
  });

  it('returns exactly to the starting pose after a mixed algorithm and its inverse', () => {
    const cube = makeCube();
    const moves = parseFtoEifMoveGroups("U R' Rw Fs' Uo Rt2 S H'").groups.flat();
    apply(cube, moves);
    apply(cube, invertFtoAnimationMoves(moves));

    const solved = makeCube();
    expectSamePose(cube, solved);
    expect(cube.complete).toBe(true);
  });
});
