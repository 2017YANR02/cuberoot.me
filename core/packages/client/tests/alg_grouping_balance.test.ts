import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cubeOnly, hasBalancedGrouping } from '@cuberoot/shared/alg-notation';

const FORMULA_FIELDS = new Set(['alg', 'algHtml', 'setup', 'scramble', 'standard']);

describe('algorithm fixture grouping', () => {
  it('has balanced grouping parentheses in every formula field', () => {
    const fixture = JSON.parse(readFileSync(
      new URL('./fixtures/alg-case-alignment.json', import.meta.url),
      'utf8',
    )) as unknown;
    const invalid: string[] = [];

    function visit(value: unknown, path: string): void {
      if (Array.isArray(value)) {
        value.forEach((child, index) => visit(child, `${path}[${index}]`));
        return;
      }
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const childPath = path ? `${path}.${key}` : key;
        if (FORMULA_FIELDS.has(key) && typeof child === 'string'
          && !hasBalancedGrouping(cubeOnly(child))) invalid.push(childPath);
        else visit(child, childPath);
      }
    }

    visit(fixture, '');
    expect(invalid).toEqual([]);
  });
});
