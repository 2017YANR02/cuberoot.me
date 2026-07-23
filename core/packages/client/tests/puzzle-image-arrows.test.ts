// Arrow DSL helpers behind the studio's click-to-draw editor.
//
// The editor authors on the solved wca net: a sticker click yields a StickerId
// (`U0`) that IS an arrow DSL point verbatim (mask-core header). Two clicks build
// `<from><to>-<color>`; re-picking the same directed pair erases it. These pure
// helpers (parse leading points, toggle-remove by pair) are what make that work,
// so they carry the correctness the UI relies on.
import { describe, it, expect } from 'vitest';
import { appendArrow, arrowPoints, removeArrowByPoints } from '@/lib/puzzle-image/arrows';

describe('arrowPoints', () => {
  it('plain same-face pair', () => {
    expect(arrowPoints('U0U2')).toEqual(['U0', 'U2']);
  });
  it('strips color / scale / influence suffixes', () => {
    expect(arrowPoints('U0U2-red')).toEqual(['U0', 'U2']);
    expect(arrowPoints('U0U2U4-s10-i5-ff0000')).toEqual(['U0', 'U2', 'U4']);
  });
  it('cross-face pair (numeric builder cannot express this)', () => {
    expect(arrowPoints('U0R2')).toEqual(['U0', 'R2']);
  });
  it('multi-digit indices (big cubes)', () => {
    expect(arrowPoints('U10U24')).toEqual(['U10', 'U24']);
  });
  it('empty / junk → []', () => {
    expect(arrowPoints('')).toEqual([]);
    expect(arrowPoints('-red')).toEqual([]);
  });
});

describe('removeArrowByPoints', () => {
  it('removes the matching point sequence, returns the rest', () => {
    expect(removeArrowByPoints('U0U2,U6U8', ['U0', 'U2'])).toBe('U6U8');
  });
  it('ignores color/scale suffixes when matching', () => {
    expect(removeArrowByPoints('U0U2-ff0000', ['U0', 'U2'])).toBe('');
    expect(removeArrowByPoints('U0U2U4-s10-i5-red', ['U0', 'U2', 'U4'])).toBe('');
  });
  it('directed: U0→R2 does not match R2→U0', () => {
    expect(removeArrowByPoints('U0R2', ['R2', 'U0'])).toBeNull();
    expect(removeArrowByPoints('U0R2', ['U0', 'R2'])).toBe('');
  });
  it('shape-exact: straight U0U8 ≠ curved U0U8U4 (same endpoints)', () => {
    // drawing a straight U0→U8 must NOT erase an existing curved U0→U8→U4
    expect(removeArrowByPoints('U0U8U4-red', ['U0', 'U8'])).toBeNull();
    // and the curved one erases only with the full 3-point match
    expect(removeArrowByPoints('U0U8U4-red', ['U0', 'U8', 'U4'])).toBe('');
  });
  it('no match / degenerate → null (caller adds instead)', () => {
    expect(removeArrowByPoints('U0U2', ['U6', 'U8'])).toBeNull();
    expect(removeArrowByPoints('', ['U0', 'U2'])).toBeNull();
    expect(removeArrowByPoints('U0U2', ['U0'])).toBeNull(); // <2 points
  });
  it('removes every entry sharing that exact sequence', () => {
    expect(removeArrowByPoints('U0U2-red,U6U8,U0U2-blue', ['U0', 'U2'])).toBe('U6U8');
  });
});

describe('append → toggle round-trip (the click-to-draw flow)', () => {
  it('straight: add then re-pick the pair erases exactly that arrow', () => {
    let arrows = '';
    arrows = appendArrow(arrows, 'U0R2-808080');      // 1st, cross-face straight
    arrows = appendArrow(arrows, 'F1F7-808080');      // 2nd
    expect(arrows).toBe('U0R2-808080,F1F7-808080');

    expect(removeArrowByPoints(arrows, ['U0', 'R2'])).toBe('F1F7-808080');
    // a fresh pair does NOT match → caller keeps it as an add
    expect(removeArrowByPoints(arrows, ['U0', 'R5'])).toBeNull();
  });
  it('curved: 3-point arrow round-trips on the exact triple', () => {
    const arrows = appendArrow('', 'U0U8U4-808080'); // 起→止→过
    expect(arrows).toBe('U0U8U4-808080');
    expect(removeArrowByPoints(arrows, ['U0', 'U8', 'U4'])).toBe('');
  });
});
