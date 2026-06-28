// 守卫:recon 判重口径 = 同选手 + 同真打乱(buildDuplicateQuery)。
// 这是 POST/PUT「重复需说明原因」+ check-duplicate 预警的同一份逻辑,口径一变两端齐变。
// 占位打乱('?' 等)必须豁免:同一选手可合法有多条「打乱未知」的复盘(各为不同把)。
import { describe, it, expect } from 'vitest';
import { buildDuplicateQuery, isRealScramble, validateRow } from '../../server/src/utils/recon_helpers';

const SCR = "R U R' U' F2 L2 B";      // 真打乱(够长)
const SCR2 = "L U L' U' D2 R F";      // 另一条真打乱

describe('isRealScramble', () => {
  it('accepts a real scramble', () => {
    expect(isRealScramble(SCR)).toBe(true);
  });
  it('rejects placeholders and empties', () => {
    for (const s of ['?', '??', '???', '-', '.', 'n/a', 'N/A', 'tbd', 'none', 'unknown', '', '   ', null, undefined]) {
      expect(isRealScramble(s as unknown as string)).toBe(false);
    }
  });
});

describe('buildDuplicateQuery (same player + same scramble)', () => {
  it('matches by person_id + wca_scramble', () => {
    const dup = buildDuplicateQuery({ person_id: '2015ABCD01', wca_scramble: SCR });
    expect(dup).not.toBeNull();
    expect(dup!.sql).toContain('person_id = ?');
    expect(dup!.sql).toContain('"wca_scramble" = ?');
    expect(dup!.params).toEqual(['2015ABCD01', SCR]);
  });

  it('falls back to person name when no WCA ID', () => {
    const dup = buildDuplicateQuery({ person: 'Liam Walton', wca_scramble: SCR });
    expect(dup!.sql).toContain('person = ?');
    expect(dup!.sql).not.toContain('person_id = ?');
    expect(dup!.params).toEqual(['Liam Walton', SCR]);
  });

  it('prefers person_id over person when both present', () => {
    const dup = buildDuplicateQuery({ person_id: '2015X', person: 'Name', wca_scramble: SCR });
    expect(dup!.params[0]).toBe('2015X');
  });

  it('falls back to optimal_scramble when no wca_scramble', () => {
    const dup = buildDuplicateQuery({ person_id: '2015X', optimal_scramble: SCR2 });
    expect(dup!.sql).toContain('"optimal_scramble" = ?');
    expect(dup!.params).toEqual(['2015X', SCR2]);
  });

  it('prefers wca_scramble over optimal_scramble', () => {
    const dup = buildDuplicateQuery({ person_id: '2015X', wca_scramble: SCR, optimal_scramble: SCR2 });
    expect(dup!.sql).toContain('"wca_scramble" = ?');
    expect(dup!.params).toEqual(['2015X', SCR]);
  });

  it('returns null for placeholder scrambles (e.g. "?") — they are NOT duplicates', () => {
    expect(buildDuplicateQuery({ person_id: '2015X', wca_scramble: '?' })).toBeNull();
    expect(buildDuplicateQuery({ person_id: '2015X', wca_scramble: '   ' })).toBeNull();
    // '?' in wca but a real optimal → dedupe on the real one
    expect(buildDuplicateQuery({ person_id: '2015X', wca_scramble: '?', optimal_scramble: SCR2 })).not.toBeNull();
  });

  it('returns null without a real scramble', () => {
    expect(buildDuplicateQuery({ person_id: '2015X' })).toBeNull();
    expect(buildDuplicateQuery({ person_id: '2015X', wca_scramble: null as unknown as string })).toBeNull();
  });

  it('returns null without a player', () => {
    expect(buildDuplicateQuery({ wca_scramble: SCR })).toBeNull();
    expect(buildDuplicateQuery({ person: '   ', wca_scramble: SCR })).toBeNull();
  });

  it('excludes self in edit mode', () => {
    const dup = buildDuplicateQuery({ person_id: '2015X', wca_scramble: SCR }, 42);
    expect(dup!.sql).toContain('AND id != ?');
    expect(dup!.params).toEqual(['2015X', SCR, 42]);
  });

  it('ignores a non-finite excludeId', () => {
    const dup = buildDuplicateQuery({ person_id: '2015X', wca_scramble: SCR }, NaN);
    expect(dup!.sql).not.toContain('AND id != ?');
    expect(dup!.params).toEqual(['2015X', SCR]);
  });
});

describe('validateRow dup_reason', () => {
  it('accepts the two valid reasons and null/absent', () => {
    expect(validateRow({ dup_reason: 'repeat_scramble' })).toEqual([]);
    expect(validateRow({ dup_reason: 'different_comp' })).toEqual([]);
    expect(validateRow({ dup_reason: null })).toEqual([]);
    expect(validateRow({})).toEqual([]);
  });
  it('rejects an unknown reason', () => {
    expect(validateRow({ dup_reason: 'because' }).length).toBeGreaterThan(0);
  });
});
