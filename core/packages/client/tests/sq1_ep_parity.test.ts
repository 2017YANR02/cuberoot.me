import { describe, expect, it } from 'vitest';
import {
  classifySq1EpParity,
  partitionSq1EpCases,
  sq1EpNumericCaseName,
  sq1EpNumericLayerName,
} from '@/lib/sq1-ep-parity';

const EVEN = ['Solved', 'Ua', 'Ub', 'Z', 'H'];
const ODD = ['Adj', 'Opp', 'O+', 'O-', 'W'];

describe('SQ1 EP parity classification', () => {
  it('classifies every same-parity layer pairing as no parity', () => {
    for (const group of [EVEN, ODD]) {
      for (const top of group) {
        for (const bottom of group) {
          expect(classifySq1EpParity(`${top} / ${bottom}`)).toBe('no-parity');
        }
      }
    }
  });

  it('classifies every mixed-parity layer pairing as parity', () => {
    for (const [topGroup, bottomGroup] of [[EVEN, ODD], [ODD, EVEN]]) {
      for (const top of topGroup) {
        for (const bottom of bottomGroup) {
          expect(classifySq1EpParity(`${top} & ${bottom}`)).toBe('parity');
        }
      }
    }
  });

  it('accepts either catalog separator and rejects incomplete or unknown names', () => {
    expect(classifySq1EpParity('  Ua & Opp  ')).toBe('parity');
    expect(classifySq1EpParity('Opp / Adj')).toBe('no-parity');
    expect(classifySq1EpParity('Opp')).toBeNull();
    expect(classifySq1EpParity('Opp / Mystery')).toBeNull();
    expect(classifySq1EpParity(' / Opp')).toBeNull();
  });

  it('partitions no-parity cases before parity cases while preserving source order', () => {
    const source = [
      { name: 'Ua / Opp' },
      { name: 'Opp / Adj' },
      { name: 'Mystery' },
      { name: 'Solved / H' },
      { name: 'W / Ua' },
    ];

    expect(partitionSq1EpCases(source)).toEqual({
      noParity: [source[1], source[3]],
      parity: [source[0], source[4]],
      unclassified: [source[2]],
    });
  });

  it('uses a standalone half-width plus sign for the numeric H name', () => {
    expect(sq1EpNumericLayerName('H')).toBe('+');
    expect(sq1EpNumericCaseName('Solved / Solved')).toBe('0.0');
    expect(sq1EpNumericCaseName('Ua / H')).toBe('3+.+');
    expect(sq1EpNumericCaseName('H & Opp')).toBe('+.1');
    expect(sq1EpNumericCaseName('O+ & Z')).toBe('4+.//');
    expect(sq1EpNumericCaseName('Mystery / H')).toBeNull();
  });
});
