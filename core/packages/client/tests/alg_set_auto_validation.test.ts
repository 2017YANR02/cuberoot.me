import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../components/AlgCategoryView.tsx', import.meta.url), 'utf8');

describe('alg set automatic validation markers', () => {
  it('scans loaded sets only for administrators', () => {
    const effect = source.slice(
      source.indexOf('/** 管理员进入 set 时自动扫。'),
      source.indexOf('/**\n   * `#<case 名>`'),
    );

    expect(effect).toContain('if (!isAdmin || !data || !validPuzzle ||');
    expect(effect).toContain('scanCases(puzzleParam, set, subgroupParam');
    expect(effect).toContain('setInvalidAlgs(m)');
    expect(effect).toContain('validationRefreshKey, isAdmin');
  });

  it('passes validation failures to cards and rows only for administrators', () => {
    expect(source).toContain("${isAdmin && c.id != null && invalidIds.has(c.id) ? ' is-invalid' : ''}");
    expect(source).toContain('title={isAdmin && c.id != null && invalidIds.has(c.id)');
    expect(source).toContain('invalid={isAdmin && c.id != null && trueIdx >= 0');
  });

  it('uses the same refreshed public snapshot for every role without a second admin request', () => {
    const detail = readFileSync(new URL('../app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgSubOrCaseClient.tsx', import.meta.url), 'utf8');
    expect(detail).toContain('loadLibrarySource(puzzle as AlgPuzzle, set)');
    expect(detail).toContain('subscribeAlgLibrary(algLibraryKey(puzzle, set), refresh)');
    expect(detail).not.toContain('fresh: isAdmin');
  });
});
