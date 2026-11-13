// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import AlgRow, { AlgFormulaReadRow } from '@/components/AlgFormulaRow';

vi.mock('@/i18n/tr', () => ({ tr: (text: { en: string }) => text.en }));

it('renders combined and repeated tags once in their assigned positions', () => {
  const tags = ['beginner', 'mainstream', 'key', 'mainstream', 'beginner', 'key', 'custom', 'custom'];
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(createElement(AlgFormulaReadRow, { tags }, "U R U' R'"));
  expect([...host.querySelectorAll('.alg-tag')].map(el => el.className)).toEqual([
    'alg-tag alg-tag-mainstream', 'alg-tag alg-tag-beginner', 'alg-tag alg-tag-key', 'alg-tag alg-tag-custom',
  ]);
  expect(host.querySelectorAll('.lucide-flame')).toHaveLength(1);
  expect(host.querySelectorAll('.lucide-book-open')).toHaveLength(1);
  expect(host.querySelector('.alg-formula-value .lucide-flame')).toBeNull();
  expect(host.querySelector('.alg-formula-value .lucide-book-open')).toBeNull();
  expect(host.querySelector('.alg-formula-text .lucide-keyboard')).not.toBeNull();
  expect(host.querySelector('.alg-tag-custom')?.textContent).toBe('custom');

  const leading = host.querySelector('.alg-formula-body')!.innerHTML.split('<div class="alg-formula-value">')[0];
  host.innerHTML = renderToStaticMarkup(createElement(AlgRow, { tags }, createElement('input')));
  expect(host.querySelector('.alg-formula-body')!.innerHTML.split('<div class="alg-formula-value">')[0]).toBe(leading);
  expect(tags).toEqual(['beginner', 'mainstream', 'key', 'mainstream', 'beginner', 'key', 'custom', 'custom']);
});

it('keeps page and grouped callers from reintroducing a second tag renderer', () => {
  for (const file of [
    '../app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx',
    '../components/F2lSolutionGroups.tsx',
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    expect(source, file).toContain('<AlgFormulaReadRow tags={entry.tags}');
    expect(source, 'The row owns all display tags; callers pass raw tags only.').not.toContain('AlgTagLabel');
    expect(source).not.toMatch(/entry\.tags\?*\.(?:filter|map)/);
  }
});
