import { describe, expect, it } from 'vitest';
import {
  MAX_TEACHER_LOOKUP_IDS,
  mayReplaceTeacher,
  normalizeWcaId,
  parseTeacherLookupIds,
} from '../../server/src/utils/wca_teachers';

describe('WCA teacher input boundaries', () => {
  it('normalizes valid WCA IDs and rejects malformed or non-string input', () => {
    expect(normalizeWcaId(' 2017yanr02 ')).toBe('2017YANR02');
    expect(normalizeWcaId('2017YANR2')).toBeNull();
    expect(normalizeWcaId('u42')).toBeNull();
    expect(normalizeWcaId(null)).toBeNull();
  });

  it('accepts an empty lookup and de-duplicates IDs in input order', () => {
    expect(parseTeacherLookupIds(undefined)).toEqual([]);
    expect(parseTeacherLookupIds('')).toEqual([]);
    expect(parseTeacherLookupIds('2017yanr02, 2017YANR02, 2020TENG01')).toEqual([
      '2017YANR02',
      '2020TENG01',
    ]);
  });

  it('rejects malformed IDs and an oversized batch', () => {
    expect(parseTeacherLookupIds('2017YANR02,bad')).toBeNull();
    const oversized = Array.from({ length: MAX_TEACHER_LOOKUP_IDS + 1 }, (_, index) =>
      `2000TEST${String(index % 100).padStart(2, '0')}`,
    ).join(',');
    expect(parseTeacherLookupIds(oversized)).toBeNull();
  });
});

describe('teacher replacement permissions', () => {
  it('lets members fill an empty relation or preserve their own relation', () => {
    expect(mayReplaceTeacher(false, '2017YANR02', null)).toBe(true);
    expect(mayReplaceTeacher(false, '2017YANR02', '2017YANR02')).toBe(true);
  });

  it('prevents members from replacing another teacher and lets admins replace any relation', () => {
    expect(mayReplaceTeacher(false, '2017YANR02', '2020TENG01')).toBe(false);
    expect(mayReplaceTeacher(true, '2017YANR02', '2020TENG01')).toBe(true);
  });
});
