import { describe, expect, it } from 'vitest';
import { editedAlgEntry } from '@/lib/alg_editor';
import { algHtmlText } from '@/lib/alg_html';
import { displayCaseAlg, displayCaseAlgHtml } from '@/lib/alg_display';
import type { AlgEntry } from '@cuberoot/shared/alg';

describe('editing displayed algorithms without losing canonical moves or marks', () => {
  const original: AlgEntry = { alg: "R U R' U' y2", algHtml: "R <u>U</u> R' U' y2", tags: ['oh'], altId: '123', setup: "R U' R'" };
  const shown = displayCaseAlg('3x3', 'pll', original.alg);
  const shownHtml = displayCaseAlgHtml('3x3', 'pll', original.algHtml!);

  it('returns an untouched entry intact, including hidden finishing moves', () => {
    expect(editedAlgEntry(original, shown, shownHtml, shown, shownHtml)).toBe(original);
  });
  it('saves mark-only edits while preserving hidden moves and metadata', () => {
    const edited = editedAlgEntry(original, shown, shownHtml, shown, "<em>R</em> <u class=\"wavy\">U</u> R'");
    expect(edited).toEqual({ ...original, algHtml: "<em>R</em> <u class=\"wavy\">U</u> R' U' y2" });
    expect(algHtmlText(edited.algHtml!)).toBe(original.alg);
  });
  it('lets users remove all marks without deleting hidden finishing moves', () => {
    const { algHtml: _, ...plain } = original;
    expect(editedAlgEntry(original, shown, shownHtml, shown, shown)).toEqual(plain);
  });
  it('does not resurrect stale marks or append a previous ending after moves change', () => {
    const edited = editedAlgEntry(original, shown, shownHtml, 'F R F\'', 'F <s>R</s> F\'');
    expect(edited).toEqual({ ...original, alg: "F R F'", algHtml: "F <s>R</s> F'" });
  });
  it('preserves bracketed endings and x/z rotations after editing only marks', () => {
    const entry = { alg: "x (R U') y2", algHtml: "x (<u>R</u> U') y2" };
    const text = displayCaseAlg('3x3', 'pll', entry.alg);
    const html = displayCaseAlgHtml('3x3', 'pll', entry.algHtml);
    const edited = editedAlgEntry(entry, text, html, text, 'x (<em>R</em>)');
    expect(edited.alg).toBe("x (R U') y2");
    expect(edited.algHtml).toBe("x (<em>R</em> U') y2");
  });
  it('keeps an untouched notation-formatted entry and sanitizes edited markup', () => {
    const sq1 = { alg: '(1,0) /' };
    expect(editedAlgEntry(sq1, '(1, 0) /', undefined, '(1, 0) /', '(1, 0) /')).toBe(sq1);
    const edited = editedAlgEntry({ alg: 'R' }, 'R', undefined, 'R', '<em onclick="bad()">R</em>');
    expect(edited.algHtml).toBe('<em>R</em>');
  });
});
