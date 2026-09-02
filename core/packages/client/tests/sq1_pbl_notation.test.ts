import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SQ1_PBL_MNEMONIC_GROUPS,
  SQ1_PBL_MNEMONIC_SOURCE,
  SQ1_PBL_MNEMONIC_VARIANT_NOTE,
  SQ1_PBL_UNDEFINED_MNEMONICS,
} from '@/lib/sq1-pbl-mnemonics';
import { generatedSq1KarnaukhNotation, sq1KarnaukhNotation } from '@/lib/sq1-pbl-notation';

type SourceCase = {
  recommendation: { algorithm: string } | null;
};

const source = JSON.parse(readFileSync(
  new URL('../data/sq1-pbl/cases.json', import.meta.url),
  'utf8',
)) as { cases: SourceCase[] };

const entries = SQ1_PBL_MNEMONIC_GROUPS.flatMap(group =>
  group.entries.map(entry => ({ group: group.id, ...entry })),
);
const bySymbol = new Map(entries.map(entry => [entry.symbol, entry]));

describe('SQ1 PBL mnemonic guide', () => {
  it('locks every Help-sheet definition and source coordinate', () => {
    expect(SQ1_PBL_MNEMONIC_GROUPS).toHaveLength(5);
    expect(entries).toHaveLength(103);
    expect(new Set(entries.map(entry => entry.symbol))).toHaveLength(103);

    const digest = createHash('sha256')
      .update(JSON.stringify(entries))
      .digest('hex');
    expect(digest).toBe('1b24eaf411f7339cb645e940875c01099017e37e57eb59d13d7127e330e3c386');

    expect(bySymbol.get('\\')).toMatchObject({ expansion: 'Down starting slice', sourceCell: 'B18:C18' });
    expect(bySymbol.get('//')).toMatchObject({ expansion: 'Cancels into e.g. JJ//RJ', sourceCell: 'B41:C41' });
    expect(bySymbol.get('bJj')).toMatchObject({ expansion: '0-1/-3,0/3,3/0,-3/0,1', sourceCell: 'K25:L25' });
    expect(bySymbol.get('RJ')).toMatchObject({ expansion: '\\3,3/1,-2/-1,2/-3,-3/', sourceCell: 'M24:N24' });
  });

  it('preserves source alternatives and the unresolved variant note verbatim', () => {
    expect(bySymbol.get('JJ')?.sourceNote).toBe('Alt: /3,0/-3,-3/0,3/');
    expect(bySymbol.get('jJ')?.sourceNote).toBe('Alt: 1,0/3,0/-3,-3/0,3/-1,0');
    expect(bySymbol.get('Jj')?.sourceNote).toBe('Alt: 0,-1/3,0/-3,-3/0,3/0,1');
    expect(bySymbol.get('jj')?.sourceNote).toBe('Alt: 1,-1/3,0/-3,-3/0,3/-1,1');
    expect(SQ1_PBL_MNEMONIC_VARIANT_NOTE).toEqual({
      sourceCell: 'Help!K37',
      text: 'nN Nn nn shenanigans also apply here\n\nsame with pN/pN which is just pN',
    });
  });

  it('keeps every source-undefined form explicit and separate from defined mnemonics', () => {
    expect(SQ1_PBL_UNDEFINED_MNEMONICS).toHaveLength(31);
    expect(new Set(SQ1_PBL_UNDEFINED_MNEMONICS)).toHaveLength(31);
    expect(SQ1_PBL_UNDEFINED_MNEMONICS.filter(symbol => bySymbol.has(symbol))).toEqual([]);

    const recommendationText = source.cases
      .map(item => item.recommendation?.algorithm ?? '')
      .join('\n');
    for (const symbol of SQ1_PBL_UNDEFINED_MNEMONICS) {
      expect(recommendationText, symbol).toContain(symbol);
    }
  });

  it('keeps all recommendation lines as source notes instead of executable notation', () => {
    const recommendations = source.cases
      .map(item => item.recommendation?.algorithm)
      .filter((algorithm): algorithm is string => Boolean(algorithm));
    const lines = recommendations.flatMap(algorithm =>
      algorithm.split(/\r?\n/).filter(line => line.trim().length > 0),
    );

    expect(recommendations).toHaveLength(963);
    expect(lines).toHaveLength(1393);
  });

  it('separates Karnaukh notation from the legacy source label', () => {
    expect(sq1KarnaukhNotation('3,0/', {
        en: 'Source mnemonic: 0-1 D\' e\n01',
        zh: '原表助记：0-1 D\' e\n01',
    })).toEqual({ en: '0-1 D\' e\n01', zh: '0-1 D\' e\n01' });
    expect(sq1KarnaukhNotation('')).toBeNull();
  });

  it('generates readable Karnaukh notation for every numeric SQ1 set', () => {
    expect(generatedSq1KarnaukhNotation('(3,0)/(0,-3)/(2,-1)/(-4,2)/(5,2)/(-5,-2)'))
      .toBe("U D' u t' K K'");
    expect(generatedSq1KarnaukhNotation('(6,-5)/(0,1)')).toBe('6-5 01');
    expect(generatedSq1KarnaukhNotation('/(3,0)/')).toBe('/ U /');
  });

  it('points to the original Help ranges and keeps UI navigation discoverable', () => {
    expect(SQ1_PBL_MNEMONIC_SOURCE).toMatchObject({
      definitionRange: 'Help!B18:N43',
      headingsRange: 'Help!C15:C17',
      introductionCell: 'Help!F6',
    });

    const category = readFileSync(new URL('../components/AlgCategoryView.tsx', import.meta.url), 'utf8');
    const detail = readFileSync(new URL('../app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx', import.meta.url), 'utf8');
    const page = readFileSync(new URL('../app/[lang]/alg/sq1/karnaukh-notation/page.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../app/[lang]/alg/alg.css', import.meta.url), 'utf8');

    expect(category).toContain('href="/alg/sq1/karnaukh-notation"');
    expect(detail).toContain('href="/alg/sq1/karnaukh-notation"');
    expect(page).not.toMatch(/AlgPlayer|parseSq1|applySq1/);
    expect(css).toMatch(/\.alg-alg-note\s*\{[^}]*white-space:\s*pre-line/s);
    expect(css).toMatch(/\.alg-alg-text\.is-karnaukh\s*\{[^}]*white-space:\s*pre-line/s);
  });
});
