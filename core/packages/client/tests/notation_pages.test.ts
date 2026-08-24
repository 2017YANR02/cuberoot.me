import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const regulationPage = readFileSync(new URL('../app/[lang]/regulation/notation/page.tsx', import.meta.url), 'utf8');
const completePage = readFileSync(new URL('../app/[lang]/notation/page.tsx', import.meta.url), 'utf8');
const algSetRoute = readFileSync(new URL('../app/[lang]/alg/[puzzle]/[set]/page.tsx', import.meta.url), 'utf8');

describe('notation route scopes', () => {
  it('retires the old 3x3-only route and keeps its display modes on /notation', () => {
    expect(existsSync(new URL('../app/[lang]/alg/3x3/notation/page.tsx', import.meta.url))).toBe(false);
    expect(algSetRoute).toContain('export const dynamicParams = false');
    expect(algSetRoute).toContain('if (!knownSet) notFound()');
    expect(completePage).toContain("formatAlgNotation(alg, 'zh-compact')");
    expect(completePage).toContain("formatAlgNotation(alg, 'dumb')");
    expect(completePage).toContain('CUBE_ALL_MOVES');
    expect(completePage).toContain('FTO_FACE_MOVES');
  });

  it('limits the regulation page demos to Article 12 catalogs', () => {
    expect(regulationPage).toContain('CUBE_WCA_FACE_MOVES');
    expect(regulationPage).toContain('BIG_CUBE_WCA_MOVES');
    expect(regulationPage).not.toContain('CUBE_SLICE_MOVES');
    expect(regulationPage).not.toContain('PYRAMINX_EXTENSION_MOVES');
    expect(regulationPage).not.toContain('SKEWB_EXTENSION_MOVES');
    expect(regulationPage).not.toContain('BIG_CUBE_MOVES');
  });
});
