import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../components/AlgCategoryView.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../components/AlgCaseMetaContent.tsx', import.meta.url), 'utf8');

describe('primary algorithms on category lists', () => {
  it('loads preferences, pins the selected formula, and renders pin controls on both surfaces', () => {
    expect(source).toContain('loadPreferred(puzzleParam as AlgPuzzle, sourceSet)');
    expect(source).toContain('const displayAlgsForOri = algsUnderFilter(c, oriIdx, allAlgsForOri)');
    expect(source).toContain('sortPreferredAlgs(displayAlgsForOri, preferredRef)');
    expect(source).toContain('preferred={!rightHandOh && preferredAlgRef(entry) === preferredRef}');
    expect(source).toContain('onPreferredToggle={rightHandOh ? undefined : () => setPreferred(');
    expect(source).toContain("tr({ zh: '置顶公式', en: 'Pin algorithm' })");
    expect(source).toContain("<Pin size={14} fill={preferred ? 'currentColor' : 'none'}");
    expect(detailSource).toContain("tr({ zh: '置顶公式', en: 'Pin algorithm' })");
    expect(detailSource).toContain("tr({ zh: '已置顶', en: 'Pinned' })");
    expect(detailSource).toContain("<Pin size={13} fill={preferred ? 'currentColor' : 'none'}");
  });
});
