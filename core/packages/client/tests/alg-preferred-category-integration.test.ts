import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../components/AlgCategoryView.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../components/AlgCaseMetaContent.tsx', import.meta.url), 'utf8');

describe('primary algorithms on category lists', () => {
  it('shows the preferred formula in the list and keeps pin controls in case details', () => {
    expect(source).toContain('loadPreferred(puzzleParam as AlgPuzzle, sourceSet)');
    expect(source).toContain('const displayAlgsForOri = algsUnderFilter(c, oriIdx, allAlgsForOri)');
    expect(source).toContain('sortPreferredAlgs(displayAlgsForOri, preferredRef)');
    expect(source).toContain('showOtherAlgs ? algsForOri : algsForOri.slice(0, 1)');
    expect(source).toContain('className="alg-case-detail-link"');
    expect(source).not.toContain('<Pin ');
    expect(detailSource).toContain("tr({ zh: '置顶公式', en: 'Pin algorithm' })");
    expect(detailSource).toContain("tr({ zh: '已置顶', en: 'Pinned' })");
    expect(detailSource).toContain("<Pin size={13} fill={preferred ? 'currentColor' : 'none'}");
  });
});
