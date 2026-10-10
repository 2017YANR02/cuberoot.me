import { describe, expect, it } from 'vitest';
import { fetchCompetitionPages, retainCatalogDetails } from '../src/upcoming_catalog';

const comp = (id: string) => ({ id, start_date: '2026-12-10', end_date: '2026-12-13' });

describe('upcoming catalog publication boundary', () => {
  it('includes OC2026 from a later page and deduplicates overlaps', async () => {
    const pages = [[comp('A'), comp('B')], [comp('B'), comp('OC2026')], []];
    expect((await fetchCompetitionPages(async (page) => pages[page - 1], 2)).map((c) => c.id))
      .toEqual(['A', 'B', 'OC2026']);
  });

  it.each([1, 2])('rejects failure on page %s instead of returning partial results', async (failedPage) => {
    await expect(fetchCompetitionPages(async (page) => page === failedPage ? {} : [comp('A')], 1))
      .rejects.toThrow(`page ${failedPage} failed`);
  });

  it('rejects an exception after the first page', async () => {
    await expect(fetchCompetitionPages(async (page) => {
      if (page === 2) throw new Error('network failure');
      return [comp('A')];
    }, 1)).rejects.toThrow('network failure');
  });

  it('rejects an empty catalog and malformed records', async () => {
    await expect(fetchCompetitionPages(async () => [])).rejects.toThrow('Empty');
    await expect(fetchCompetitionPages(async () => [{ id: 'broken' }])).rejects.toThrow('Invalid');
  });

  it('rejects repeated pages and a full last page at the safety limit', async () => {
    await expect(fetchCompetitionPages(async () => [comp('A')], 1)).rejects.toThrow('repeated');
    await expect(fetchCompetitionPages(async (page) => [comp(String(page))], 1, 2)).rejects.toThrow('exceeded');
  });

  it('updates the official catalog while preserving registration details', () => {
    const previous = [{ id: 'OC2026', latitude_degrees: 1, longitude_degrees: 2,
      name: 'Old name', registered: 259, rounds: { '3': 4 }, elevation: 50 }];
    const fresh = [{ id: 'OC2026', latitude_degrees: 1, longitude_degrees: 2, name: 'New name' }];
    expect(retainCatalogDetails(fresh, previous)).toEqual([{ ...previous[0], name: 'New name' }]);
    expect(retainCatalogDetails([], previous)).toEqual([]); // cancelled/expired entries are not resurrected
    expect(retainCatalogDetails([{ ...fresh[0]!, latitude_degrees: 3 }], previous)[0]).not.toHaveProperty('elevation');
  });
});
