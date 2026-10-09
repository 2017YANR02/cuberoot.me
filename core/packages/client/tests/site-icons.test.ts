import { describe, expect, it } from 'vitest';
import {
  SITE_ICON_CACHE_STORAGE_PREFIX,
  siteIconSources,
} from '@/app/[lang]/site/site-icons';

describe('site favicon fallback', () => {
  it('uses only icon sources that report a missing favicon as an error', () => {
    const sources = siteIconSources('https://mycube.club/tools');

    expect(sources).toEqual([
      'https://mycube.club/favicon.ico',
      'https://s2.googleusercontent.com/s2/favicons?domain_url=https%3A%2F%2Fmycube.club&sz=64&alt=404',
    ]);
    expect(sources.every((source) => !source.includes('duckduckgo.com'))).toBe(true);
  });

  it('invalidates cached results from the placeholder-producing source chain', () => {
    expect(SITE_ICON_CACHE_STORAGE_PREFIX).toBe('cuberoot.site-icon.v2:');
  });

  it('falls back to the letter avatar when the site URL is invalid', () => {
    expect(siteIconSources('not a url')).toEqual([]);
  });
});
