import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../components/AlgCategoryView.tsx', import.meta.url), 'utf8');

describe('primary algorithms on category lists', () => {
  it('loads preferences, pins the selected formula, and renders a per-row star button', () => {
    expect(source).toContain('loadPreferred(puzzleParam as AlgPuzzle, sourceSet)');
    expect(source).toContain('sortPreferredAlgs(allAlgsForOri, preferredRef)');
    expect(source).toContain('preferred={preferredAlgRef(entry) === preferredRef}');
    expect(source).toContain('onPreferredToggle={() => setPreferred(');
    expect(source).toContain("tr({ zh: '设为主公式', en: 'Set as primary algorithm' })");
    expect(source).toContain("<Star size={14} fill={preferred ? 'currentColor' : 'none'}");
  });
});
