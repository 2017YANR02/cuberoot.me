// 守卫:recon 判重口径 = 同选手 + 同打乱(buildDuplicateQuery)。
// 这是 POST/PUT 拒绝重复提交 + check-duplicate 预警的同一份逻辑,口径一变两端齐变。
import { describe, it, expect } from 'vitest';
import { buildDuplicateQuery } from '../../server/src/utils/recon_helpers';

describe('buildDuplicateQuery (same player + same scramble)', () => {
  it('matches by person_id + wca_scramble', () => {
    const dup = buildDuplicateQuery({ person_id: '2015ABCD01', wca_scramble: "R U R' U'" });
    expect(dup).not.toBeNull();
    expect(dup!.sql).toContain('person_id = ?');
    expect(dup!.sql).toContain('"wca_scramble" = ?');
    expect(dup!.params).toEqual(['2015ABCD01', "R U R' U'"]);
  });

  it('falls back to person name when no WCA ID', () => {
    const dup = buildDuplicateQuery({ person: 'Liam Walton', wca_scramble: 'R U' });
    expect(dup!.sql).toContain('person = ?');
    expect(dup!.sql).not.toContain('person_id = ?');
    expect(dup!.params).toEqual(['Liam Walton', 'R U']);
  });

  it('prefers person_id over person when both present', () => {
    const dup = buildDuplicateQuery({ person_id: '2015X', person: 'Name', wca_scramble: 'R' });
    expect(dup!.params[0]).toBe('2015X');
  });

  it('falls back to optimal_scramble when no wca_scramble', () => {
    const dup = buildDuplicateQuery({ person_id: '2015X', optimal_scramble: 'R U2' });
    expect(dup!.sql).toContain('"optimal_scramble" = ?');
    expect(dup!.params).toEqual(['2015X', 'R U2']);
  });

  it('prefers wca_scramble over optimal_scramble', () => {
    const dup = buildDuplicateQuery({ person_id: '2015X', wca_scramble: 'R', optimal_scramble: 'L' });
    expect(dup!.sql).toContain('"wca_scramble" = ?');
    expect(dup!.params).toEqual(['2015X', 'R']);
  });

  it('returns null without a scramble (cannot dedupe — would falsely collide)', () => {
    expect(buildDuplicateQuery({ person_id: '2015X' })).toBeNull();
    expect(buildDuplicateQuery({ person_id: '2015X', wca_scramble: '   ' })).toBeNull();
    expect(buildDuplicateQuery({ person_id: '2015X', wca_scramble: null as unknown as string })).toBeNull();
  });

  it('returns null without a player', () => {
    expect(buildDuplicateQuery({ wca_scramble: 'R U' })).toBeNull();
    expect(buildDuplicateQuery({ person: '   ', wca_scramble: 'R U' })).toBeNull();
  });

  it('excludes self in edit mode', () => {
    const dup = buildDuplicateQuery({ person_id: '2015X', wca_scramble: 'R' }, 42);
    expect(dup!.sql).toContain('AND id != ?');
    expect(dup!.params).toEqual(['2015X', 'R', 42]);
  });

  it('ignores a non-finite excludeId', () => {
    const dup = buildDuplicateQuery({ person_id: '2015X', wca_scramble: 'R' }, NaN);
    expect(dup!.sql).not.toContain('AND id != ?');
    expect(dup!.params).toEqual(['2015X', 'R']);
  });
});
