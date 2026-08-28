import { describe, expect, it } from 'vitest';

import { API_ORIGIN, SITE_HOST, SITE_ORIGIN } from '../src/lib/runtime-config';

describe('mini program runtime origins', () => {
  it('uses the configured HTTPS domains without trailing slashes', () => {
    expect(API_ORIGIN).toBe('https://api.cuberoot.me/v1');
    expect(SITE_ORIGIN).toBe('https://cuberoot.me');
    expect(SITE_HOST).toBe('cuberoot.me');
    expect(API_ORIGIN.endsWith('/')).toBe(false);
    expect(SITE_ORIGIN.endsWith('/')).toBe(false);
  });
});
