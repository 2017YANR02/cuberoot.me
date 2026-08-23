import { describe, expect, it } from 'vitest';
import { parseSq1Tokens } from '@cuberoot/shared/sq1-notation';
import { parsePyraMoves } from '@/app/[lang]/sim/engine/pyra/pyraState';
import { parseSkewbMoves } from '@/app/[lang]/sim/engine/skewb/skewbState';
import { parseFtoEifAlgorithm } from '@/lib/fto-eif-image';
import {
  CUBE_ALL_MOVES,
  FTO_FACE_MOVES,
  FTO_MACRO_MOVES,
  FTO_ROTATION_MOVES,
  FTO_SLICE_MOVES,
  FTO_WIDE_MOVES,
  PYRAMINX_EXTENSION_MOVES,
  PYRAMINX_WCA_MOVES,
  SKEWB_EXTENSION_MOVES,
  SKEWB_WCA_MOVES,
  SQUARE1_MOVES,
} from '@/lib/move-notation-catalog';

describe('shared move notation catalog', () => {
  it('covers every requested cube move family and explicit repeat example', () => {
    expect(CUBE_ALL_MOVES).toHaveLength(76);
    expect(CUBE_ALL_MOVES).toEqual(expect.arrayContaining([
      'E', 'M', 'S', 'x', 'y', 'z', "U2'", 'R3', "R3'",
    ]));
    expect(new Set(CUBE_ALL_MOVES).size).toBe(CUBE_ALL_MOVES.length);
    expect(CUBE_ALL_MOVES.filter(move => /3'?$/.test(move))).toEqual([
      'L3', "L3'", 'R3', "R3'",
    ]);
  });

  it('contains every valid Square-1 pair in the WCA numeric range plus slash', () => {
    expect(SQUARE1_MOVES).toHaveLength(144);
    expect(SQUARE1_MOVES).toContain('(-5,-5)');
    expect(SQUARE1_MOVES).toContain('(6,6)');
    expect(SQUARE1_MOVES).not.toContain('(0,0)');
    expect(parseSq1Tokens(SQUARE1_MOVES.join(' '))).toHaveLength(144);
  });

  it('only exposes Pyraminx and Skewb moves accepted by their existing engines', () => {
    const pyraminx = [...PYRAMINX_WCA_MOVES, ...PYRAMINX_EXTENSION_MOVES];
    const skewb = [...SKEWB_WCA_MOVES, ...SKEWB_EXTENSION_MOVES];
    expect(parsePyraMoves(pyraminx.join(' '))).toHaveLength(pyraminx.length);
    expect(parseSkewbMoves(skewb.join(' '))).toHaveLength(skewb.length);
  });

  it('only exposes FTO moves accepted by the shared EIF parser', () => {
    const moves = [
      ...FTO_FACE_MOVES,
      ...FTO_WIDE_MOVES,
      ...FTO_SLICE_MOVES,
      ...FTO_ROTATION_MOVES,
      ...FTO_MACRO_MOVES,
    ];
    expect(parseFtoEifAlgorithm(moves.join(' ')).invalid).toEqual([]);
    expect(new Set(moves).size).toBe(moves.length);
  });
});
