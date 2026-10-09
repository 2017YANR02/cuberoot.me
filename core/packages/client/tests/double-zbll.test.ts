import { describe, expect, it } from 'vitest';
import { decodeDoubleZbll, DOUBLE_ZBLL_RECORD_BYTES } from '@cuberoot/shared/double-zbll';

describe('Double ZBLL fixed-record format', () => {
  it('keeps ordered top/bottom pairs distinct', () => {
    const bytes = new Uint8Array(4 * DOUBLE_ZBLL_RECORD_BYTES);
    bytes.set([3, 3, 0, 5], DOUBLE_ZBLL_RECORD_BYTES); // R U R'
    bytes.set([2, 7, 10], 2 * DOUBLE_ZBLL_RECORD_BYTES); // F2 D2
    expect(decodeDoubleZbll(bytes, 2, 0, 1)).toBe("R U R'");
    expect(decodeDoubleZbll(bytes, 2, 1, 0)).toBe('F2 D2');
    expect(() => decodeDoubleZbll(bytes, 2, 0, 0)).toThrow('Missing');
  });
  it('rejects truncated files, missing cases and invalid moves', () => {
    const bytes = new Uint8Array(21); bytes.set([1, 18]);
    expect(() => decodeDoubleZbll(bytes, 1, 0, 0)).toThrow('move');
    expect(() => decodeDoubleZbll(bytes.slice(1), 1, 0, 0)).toThrow('corpus');
    expect(() => decodeDoubleZbll(bytes, 1, -1, 0)).toThrow('index');
    expect(() => decodeDoubleZbll(bytes, 1, 0, 1)).toThrow('index');
  });
});
