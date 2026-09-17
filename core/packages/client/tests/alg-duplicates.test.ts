import { describe, expect, it } from 'vitest';
import { duplicateAlgKey, findDuplicateAlgs } from '@cuberoot/shared/alg-notation';

describe('library duplicate formula identity', () => {
  it('matches the L formula despite nested parentheses, spacing and line breaks', () => {
    const first = "(F R' F' r) (U R U' r')";
    expect(duplicateAlgKey(first)).toBe(duplicateAlgKey(" F R' F' r\nU R U' r' "));
    expect(duplicateAlgKey("（(F R' F' r)）（U R U' r'）")).toBe(duplicateAlgKey(first));
    expect(duplicateAlgKey("FR'F'rURU'r'")).toBe(duplicateAlgKey(first));
    expect(duplicateAlgKey('(1, 0) / (3, 0)')).toBe(duplicateAlgKey('1,0/3,0'));
    expect(findDuplicateAlgs([{ alg: first }, { alg: 'R U' }, { alg: "F R' F' r U R U' r'" }])).toEqual([{ index: 2, first: 0 }]);
  });
  it.each([
    ['R U', "R U'"], ['R2', "R2'"], ['R U', 'r U'],
    ['R U', 'U R'], ['R U', "R U U'"], ['R U', "U R U"],
    ['(R U)2', 'R U2'], ["(R U)'", "R U'"],
    ['R[R2:@C] U', 'R U'], ['[R,U]', '[R:U]'],
    ['↑U', '↑ U'],
  ])('does not collapse distinct notation %s / %s', (a, b) => {
    expect(duplicateAlgKey(a)).not.toBe(duplicateAlgKey(b));
  });
  it('ignores empty editor rows and never mutates entries or metadata', () => {
    const entries = [{ alg: '', tags: ['oh'] }, { alg: 'R U', algHtml: '<u>R</u> U' }, { alg: '(R U)' }];
    const before = JSON.stringify(entries);
    expect(findDuplicateAlgs(entries)).toEqual([{ index: 2, first: 1 }]);
    expect(JSON.stringify(entries)).toBe(before);
  });
});
