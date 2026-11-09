import { describe, expect, it, vi } from 'vitest';
import { acceptanceApiOrigin, acceptanceRequest } from '../src/push-acceptance/config';

describe('acceptance API isolation', () => {
  it('rejects production, DNS aliases, public IPs, URL auth and unexpected paths', () => {
    for (const value of ['https://api.cuberoot.me', 'https://dev.cuberoot.me', 'http://example.test', 'http://8.8.8.8', 'http://127.0.0.1@api.cuberoot.me', 'http://a:b@127.0.0.1', 'http://127.0.0.1/path', 'http://127.0.0.1/?next=prod']) {
      expect(() => acceptanceApiOrigin(value)).toThrow();
    }
    expect(acceptanceApiOrigin('http://127.0.0.1:3339')).toBe('http://127.0.0.1:3339');
    expect(acceptanceApiOrigin('https://192.168.1.3:3339')).toBe('https://192.168.1.3:3339');
  });
  it('omits cookies, refuses redirects and never falls back when the API lacks its fixture marker', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    const request = acceptanceRequest('http://127.0.0.1:3339', fetcher);
    await expect(request('GET', '/__acceptance/status', undefined, 'fixture')).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
    await expect(request('GET', '//api.cuberoot.me/v1/auth/me')).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
