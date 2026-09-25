import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';

describe('crawler traffic policy', () => {
  const configuredRules = robots().rules;
  const rules = Array.isArray(configuredRules) ? configuredRules : [configuredRules];
  const publicRule = rules.find((rule) => rule.userAgent === '*');

  it('covers both public language paths and calculator URL variants', () => {
    expect(publicRule?.disallow).toEqual(expect.arrayContaining([
      '/wca/comp/',
      '/zh/wca/comp/',
      '/wca/persons/',
      '/zh/wca/persons/',
      '/calc?',
      '/zh/calc?',
    ]));
    expect(publicRule?.allow).toEqual(expect.arrayContaining([
      '/wca/comp/stats',
      '/zh/wca/comp/stats',
      '/wca/comp/sources',
      '/zh/wca/comp/sources',
    ]));
    expect(publicRule?.disallow).not.toContain('/calc');
    expect(publicRule?.disallow).not.toContain('/zh/calc');
  });

  it('keeps the same path policy for Sogou', () => {
    const sogouRule = rules.find((rule) => rule.userAgent === 'Sogou web spider');
    expect(sogouRule?.disallow).toEqual(publicRule?.disallow);
    expect(sogouRule?.allow).toEqual(publicRule?.allow);
    expect(sogouRule?.crawlDelay).toBe(5);
  });
});
