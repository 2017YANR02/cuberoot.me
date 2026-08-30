import { describe, expect, it } from 'vitest';
import {
  MAX_TEACHER_LOOKUP_EVENTS,
  MAX_TEACHER_LOOKUP_IDS,
  mayReplaceTeacher,
  normalizeNamedStudentId,
  normalizeNamedStudentName,
  normalizeWcaEventId,
  normalizeWcaId,
  parseTeacherLookupEvents,
  parseTeacherLookupIds,
  parseTeacherEventIds,
} from '../src/utils/wca_teachers';

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

  it('normalizes event IDs and rejects malformed or oversized event batches', () => {
    expect(normalizeWcaEventId(' 333OH ')).toBe('333oh');
    expect(normalizeWcaEventId('3x3/oh')).toBeNull();
    expect(normalizeWcaEventId('fakeevent')).toBeNull();
    expect(normalizeWcaEventId(null)).toBeNull();
    expect(parseTeacherLookupEvents(undefined)).toEqual([]);
    expect(parseTeacherLookupEvents('333, 333OH,333')).toEqual(['333', '333oh']);
    expect(parseTeacherLookupEvents('333,bad event')).toBeNull();
    const oversized = Array.from({ length: MAX_TEACHER_LOOKUP_EVENTS + 1 }, () => '333').join(',');
    expect(parseTeacherLookupEvents(oversized)).toBeNull();
  });

  it('normalizes named students and validates their event list', () => {
    expect(normalizeNamedStudentName('  小明\n 同学  ')).toBe('小明 同学');
    expect(normalizeNamedStudentName('   ')).toBeNull();
    expect(normalizeNamedStudentName('x'.repeat(161))).toBeNull();
    expect(normalizeNamedStudentId('550E8400-E29B-41D4-A716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(normalizeNamedStudentId('not-a-uuid')).toBeNull();
    expect(parseTeacherEventIds(['333', '333OH', '333'])).toEqual(['333', '333oh']);
    expect(parseTeacherEventIds([])).toBeNull();
    expect(parseTeacherEventIds(['333', 'not-an-event'])).toBeNull();
  });
});

describe('teacher replacement permissions', () => {
  it('lets members fill an absent relation or preserve their own relation', () => {
    expect(mayReplaceTeacher(false, '2017YANR02', undefined)).toBe(true);
    expect(mayReplaceTeacher(false, '2017YANR02', '2017YANR02')).toBe(true);
  });

  it('prevents members from replacing self-taught or another teacher and lets admins replace either', () => {
    expect(mayReplaceTeacher(false, '2017YANR02', null)).toBe(false);
    expect(mayReplaceTeacher(false, '2017YANR02', '2020TENG01')).toBe(false);
    expect(mayReplaceTeacher(true, '2017YANR02', null)).toBe(true);
    expect(mayReplaceTeacher(true, '2017YANR02', '2020TENG01')).toBe(true);
  });
});
