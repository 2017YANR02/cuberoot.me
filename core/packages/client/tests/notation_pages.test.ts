import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { articleBySlug, regArticleHref } from '@/app/[lang]/regulation/_data/articles';

const completePage = readFileSync(new URL('../app/[lang]/notation/page.tsx', import.meta.url), 'utf8');
const algSetRoute = readFileSync(new URL('../app/[lang]/alg/[puzzle]/[set]/page.tsx', import.meta.url), 'utf8');

describe('notation route scopes', () => {
  it('retires the old 3x3-only route and keeps its display modes on /notation', () => {
    expect(existsSync(new URL('../app/[lang]/alg/3x3/notation/page.tsx', import.meta.url))).toBe(false);
    expect(algSetRoute).toContain('export const dynamicParams = false');
    expect(algSetRoute).toContain('if (!knownSet) notFound()');
    expect(completePage).toContain("formatAlgNotation(move, 'zh-compact')");
    expect(completePage).toContain('cubeMovesForOrder');
    expect(completePage).toContain('FTO_FACE_MOVES');
    expect(completePage).toContain("from '@/components/PuzzlePicker/PuzzlePicker'");
    expect(completePage).toContain("from '@/components/NxNOrderInput'");
    expect(completePage).toContain('groups={pickerGroups}');
    expect(completePage).toContain("useQueryState(\n    'puzzle'");
    expect(completePage).toContain("useQueryState(\n    'order'");
    expect(completePage).toContain('puzzleOrder={cubeOrder}');
    expect(completePage).not.toContain('alg-notation-modes');
    expect(completePage).not.toContain('className="notation-index"');
  });

  it('retires the regulation route and filters the unified guide to WCA notation', () => {
    expect(existsSync(new URL('../app/[lang]/regulation/notation/page.tsx', import.meta.url))).toBe(false);
    expect(completePage).toContain("useQueryState(\n    'wca'");
    expect(completePage).toContain('cubeWcaMovesForOrder');
    expect(completePage).toContain('wcaOnly ? PYRAMINX_WCA_MOVES');
    expect(completePage).toContain('wcaOnly ? SKEWB_WCA_MOVES');
    expect(completePage).toContain("label={t('仅 WCA 记号', 'WCA notation only')}");
    expect(completePage).toContain('WCA 第 12a 条说明');
    expect(completePage).not.toContain('/regulation/notation');
    expect(regArticleHref(articleBySlug('notation')!)).toBe('/notation?wca=true');
  });
});
