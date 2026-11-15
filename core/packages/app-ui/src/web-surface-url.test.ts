import { describe, expect, it } from 'vitest';
import { installedWebEntryUrl } from './web-surface-url';

describe('installed website language entry', () => {
  it.each([
    ['https://cuberoot.me/', 'en', 'https://cuberoot.me/en'],
    ['https://cuberoot.me/account', 'en', 'https://cuberoot.me/en/account'],
    ['https://cuberoot.me/zh/account', 'zh', 'https://cuberoot.me/zh/account'],
    ['https://cuberoot.me/zh/account', 'en', 'https://cuberoot.me/en/account'],
    ['https://cuberoot.me/en', 'zh', 'https://cuberoot.me/zh'],
  ] as const)('enters %s with explicit %s without relying on language cookies', (href, language, expected) => {
    expect(installedWebEntryUrl(href, language)).toBe(expected);
  });

  it('preserves tool deep-link state and anchors while the host owns entry language', () => {
    const url = new URL(installedWebEntryUrl(
      'https://cuberoot.me/timer?event=pll&training=%2Falg%2F3x3%2Fpll%2Frun&train.mode=memo&case=A&case=B&lang=zh#results',
      'en',
    ));
    expect(url.pathname).toBe('/en/timer');
    expect(url.searchParams.get('event')).toBe('pll');
    expect(url.searchParams.get('training')).toBe('/alg/3x3/pll/run');
    expect(url.searchParams.get('train.mode')).toBe('memo');
    expect(url.searchParams.getAll('case')).toEqual(['A', 'B']);
    expect(url.searchParams.has('lang')).toBe(false);
    expect(url.hash).toBe('#results');
    expect(installedWebEntryUrl(url.href, 'en')).toBe(url.href);
  });
});
