import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('page delivery without permission dependencies', () => {
  it.each(['/zh/timer', '/zh/comp-sim', '/zh/alg/3x3', '/zh/partnership'])(
    'does not turn an API timeout into a page failure: %s', async path => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetcher = vi.fn(async () => { throw new DOMException('private-error', 'TimeoutError'); });
      vi.stubGlobal('fetch', fetcher);
      const result = await proxy(new NextRequest(`https://cuberoot.me${path}?secret=private-query`, {
        headers: { cookie: 'cuberoot_page_session=private-cookie' },
      }));
      expect(result.status).toBe(200);
      expect(result.headers.get('Retry-After')).toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    },
  );
});
