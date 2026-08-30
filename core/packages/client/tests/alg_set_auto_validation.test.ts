import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../components/AlgCategoryView.tsx', import.meta.url), 'utf8');

describe('alg set automatic validation markers', () => {
  it('scans loaded sets only for administrators', () => {
    const effect = source.slice(
      source.indexOf('/** 管理员进入 set 时自动扫。'),
      source.indexOf('/**\n   * `#<case 名>`'),
    );

    expect(effect).toContain('if (!isAdmin || !data || !validPuzzle)');
    expect(effect).toContain('scanCases(puzzleParam, set, data.cases');
    expect(effect).toContain('setInvalidAlgs(m)');
    expect(effect).toContain('validationRefreshKey, isAdmin');
  });

  it('passes validation failures to cards and rows only for administrators', () => {
    expect(source).toContain("${isAdmin && c.id != null && invalidIds.has(c.id) ? ' is-invalid' : ''}");
    expect(source).toContain('title={isAdmin && c.id != null && invalidIds.has(c.id)');
    expect(source).toContain('invalid={isAdmin && c.id != null && trueIdx >= 0');
  });
});
