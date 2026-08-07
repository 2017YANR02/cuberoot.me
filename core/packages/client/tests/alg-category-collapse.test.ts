import { describe, expect, it } from 'vitest';
import { collapseAlgGroupsByDefault } from '@/components/AlgCategoryView';

describe('algorithm group default collapse policy', () => {
  it('keeps SQ1 cubeshape groups expanded despite its large case count', () => {
    expect(collapseAlgGroupsByDefault('sq1', 'cs', 169, false)).toBe(false);
    expect(collapseAlgGroupsByDefault('sq1', 'csp', 179, false)).toBe(false);
    expect(collapseAlgGroupsByDefault('sq1', 'obl', 185, false)).toBe(false);
  });

  it('still collapses other large non-umbrella sets', () => {
    expect(collapseAlgGroupsByDefault('3x3', '1lll', 1000, false)).toBe(true);
  });

  it('does not collapse small or umbrella sets', () => {
    expect(collapseAlgGroupsByDefault('sq1', 'cs', 100, false)).toBe(false);
    expect(collapseAlgGroupsByDefault('3x3', 'zbll', 493, true)).toBe(false);
  });
});
