import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../components/AlgCategoryView.tsx', import.meta.url), 'utf8');

describe('alg set automatic validation markers', () => {
  it('scans every loaded set without an admin gate', () => {
    const effect = source.slice(
      source.indexOf('/** 当前 set 自动扫。'),
      source.indexOf('/**\n   * `#<case 名>`'),
    );

    expect(effect).toContain('scanCases(puzzleParam, set, data.cases');
    expect(effect).not.toContain('isAdmin');
    expect(effect).toContain('setInvalidAlgs(m)');
  });
});
