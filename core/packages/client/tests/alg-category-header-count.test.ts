import { describe, expect, it } from 'vitest';
import { categoryHeaderCaseCount } from '@/components/AlgCategoryView';

describe('algorithm category header case count', () => {
  it('shows the full scoped count on umbrella subgroup pickers', () => {
    expect(categoryHeaderCaseCount(305, 0, true)).toBe(305);
  });

  it('keeps showing the filtered visible count on case lists', () => {
    expect(categoryHeaderCaseCount(305, 42, false)).toBe(42);
  });
});
