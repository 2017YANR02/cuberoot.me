import { describe, expect, it } from 'vitest';

import { resolveWebRoute } from '../src/lib/web-routes';

describe('mini program web routes', () => {
  it('resolves only allowlisted website destinations', () => {
    expect(resolveWebRoute('alg')).toEqual({
      title: '公式库',
      url: 'https://cuberoot.me/zh/alg',
    });
    expect(resolveWebRoute('https://example.com')).toBeNull();
    expect(resolveWebRoute('__proto__')).toBeNull();
    expect(resolveWebRoute(null)).toBeNull();
  });
});
