import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TestComparison from '@/app/[lang]/recon/ground-truth/TestComparison';
import type { ReconTestCase, ReconTestRow } from '@cuberoot/shared/recon-ground-truth';

const row: ReconTestRow = { moves: 'R U', label: 'test', colors: [], hrefs: [], diagrams: [] };
function render(actual?: ReconTestRow[]) {
  const sample: ReconTestCase = { id: 'sample', source: '', issue: '', expected: [row], actual, errors: [], status: actual ? 'passed' : 'not-run' };
  return renderToStaticMarkup(createElement(TestComparison, { regression: { sample, result: sample } }));
}
describe('regression comparison presentation', () => {
  it('shows identical complete results once', () => {
    expect(render([{ ...row }]).match(/<pre>/g)).toHaveLength(1);
  });
  it.each(['colors', 'hrefs', 'diagrams'] as const)('retains both sides when only %s differ', field => {
    expect(render([{ ...row, [field]: ['different'] }]).match(/<pre>/g)).toHaveLength(2);
  });
  it('does not treat a missing actual result as a match', () => {
    expect(render().match(/<pre>/g)).toHaveLength(2);
  });
});
