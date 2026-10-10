import { describe, expect, it } from 'vitest';
import { fetchCompetitionPages, retainCatalogDetails, mergeSavedCatalog } from '../src/upcoming_catalog';

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

describe('saved catalog merge', () => {
  const saved = (id: string) => ({ ...comp(id), latitude_degrees: 1, longitude_degrees: 2,
    registered: 259, rounds: { '3': 4 }, elevation: 10 });

  it('keeps absent competitions and their details until positively cancelled', () => {
    const old = [saved('OC2026'), saved('Missing')];
    expect(mergeSavedCatalog([], old, new Set(), new Set(), '2026-10-10')).toEqual([old[1], old[0]]);
    expect(mergeSavedCatalog([], old, new Set(), new Set(['Missing']), '2026-10-10')).toEqual([old[0]]);
  });

  it('hands ended competitions to history only after history has them', () => {
    const old = [saved('OC2026')];
    expect(mergeSavedCatalog([], old, new Set(), new Set(), '2027-01-01')).toEqual(old);
    expect(mergeSavedCatalog([], old, new Set(['OC2026']), new Set(), '2026-12-12')).toEqual(old);
    expect(mergeSavedCatalog([], old, new Set(['OC2026']), new Set(), '2026-12-14')).toEqual([]);
  });

  it('updates a rescheduled competition without discarding saved enrichment', () => {
    const old = [saved('OC2026')];
    const fresh = [{ ...comp('OC2026'), start_date: '2027-01-01', end_date: '2027-01-03',
      latitude_degrees: 3, longitude_degrees: 2 }];
    expect(mergeSavedCatalog(fresh, old, new Set(), new Set(), '2026-10-10')).toEqual([
      { ...old[0], ...fresh[0], elevation: undefined },
    ]);
  });
});
