import { getWcaPerson, searchWcaPersons } from '@cuberoot/shared/wca-person';
import { describe, expect, it, vi } from 'vitest';

describe('shared WCA person adapter', () => {
  it('normalizes WCA search and direct-person response variants', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(JSON.stringify(url.includes('?q=') ? [
        { person: { wca_id: '2017GENG01', name: 'Xuanyi Geng (耿暄一)', country: { iso2: 'CN' } } },
        { person: { id: 'INVALID', name: 'Ignored' } },
      ] : {
        person: { id: '2009ZEMD01', name: 'Feliks Zemdegs', country_iso2: 'AU' },
      }), { status: 200 });
    }) as typeof fetch;

    await expect(searchWcaPersons(' Xuanyi Geng ', 5, fetcher)).resolves.toEqual([{
      id: '2017GENG01',
      name: 'Xuanyi Geng (耿暄一)',
      country_iso2: 'CN',
    }]);
    await expect(getWcaPerson('2009zemd01', fetcher)).resolves.toEqual({
      id: '2009ZEMD01',
      name: 'Feliks Zemdegs',
      country_iso2: 'AU',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('fails closed for invalid ids and transport errors', async () => {
    const fetcher = vi.fn(async () => { throw new Error('offline'); }) as typeof fetch;
    await expect(getWcaPerson('not-an-id', fetcher)).resolves.toBeNull();
    await expect(searchWcaPersons('nobody', 8, fetcher)).resolves.toEqual([]);
  });
});
