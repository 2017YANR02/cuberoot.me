import { describe, expect, it } from 'vitest';
import { applySq1Scramble } from '@cuberoot/shared/sq1-notation';
import {
  isSq1Sliceable,
  nextSq1SliceableLayerRotation,
  rotateSq1StateLayer,
  sq1ParityBreakdown,
} from '@/lib/sq1-tools';

describe('SQ1 inspector parity analysis', () => {
  it('blocks parity until the final position is sliceable', () => {
    const misaligned = applySq1Scramble('(2, 0)');
    expect(isSq1Sliceable(misaligned)).toBe(false);
    expect(sq1ParityBreakdown(misaligned)).toBeNull();
  });

  it('matches Squanmate\'s solved six-factor parity fixture', () => {
    expect(sq1ParityBreakdown(applySq1Scramble(''))).toEqual({
      odd: true,
      total: 7,
      factors: [
        { key: 'top-corner-order', count: 0, pieceIds: [4, 6, 0], sides: ['B', 'R', 'F'] },
        { key: 'top-edge-order', count: 1, pieceIds: [5, 7, 1], sides: ['R', 'F', 'L'] },
        { key: 'bottom-corner-order', count: 1, pieceIds: [9, 11, 13], sides: ['F', 'R', 'B'] },
        { key: 'bottom-edge-order', count: 1, pieceIds: [8, 10, 12], sides: ['F', 'R', 'B'] },
        { key: 'top-edges-in-odd-edge-positions', count: 2, pieceIds: [5, 1] },
        { key: 'top-corners-in-odd-corner-positions', count: 2, pieceIds: [4, 0] },
      ],
    });
  });

  it('locks a nontrivial sliceable six-factor fixture', () => {
    expect(sq1ParityBreakdown(applySq1Scramble('(3, 0)'))).toEqual({
      odd: true,
      total: 7,
      factors: [
        { key: 'top-corner-order', count: 1, pieceIds: [2, 4, 6], sides: ['L', 'B', 'R'] },
        { key: 'top-edge-order', count: 0, pieceIds: [3, 5, 7], sides: ['B', 'R', 'F'] },
        { key: 'bottom-corner-order', count: 1, pieceIds: [9, 11, 13], sides: ['F', 'R', 'B'] },
        { key: 'bottom-edge-order', count: 1, pieceIds: [8, 10, 12], sides: ['F', 'R', 'B'] },
        { key: 'top-edges-in-odd-edge-positions', count: 2, pieceIds: [3, 7] },
        { key: 'top-corners-in-odd-corner-positions', count: 2, pieceIds: [2, 6] },
      ],
    });
  });

  it('jumps each +/- control to the nearest sliceable layer position', () => {
    const solved = applySq1Scramble('');
    expect(nextSq1SliceableLayerRotation(solved, 'top', 'positive')).toBe(1);
    expect(nextSq1SliceableLayerRotation(solved, 'top', 'negative')).toBe(-2);

    const misaligned = applySq1Scramble('(2, 0)');
    for (const direction of ['negative', 'positive'] as const) {
      const amount = nextSq1SliceableLayerRotation(misaligned, 'top', direction);
      expect(amount).not.toBeNull();
      const aligned = rotateSq1StateLayer(misaligned, 'top', amount!);
      expect(isSq1Sliceable(aligned)).toBe(true);
      expect(sq1ParityBreakdown(aligned)?.factors).toHaveLength(6);
    }
  });
});
