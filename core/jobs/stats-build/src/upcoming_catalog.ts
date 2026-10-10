/** Never return a partial catalog: callers may only publish after the last page. */
export async function fetchCompetitionPages(
  fetchPage: (page: number) => Promise<unknown>,
  perPage = 100,
  maxPages = 20,
): Promise<Record<string, unknown>[]> {
  const rows = new Map<string, Record<string, unknown>>();
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await fetchPage(page);
    if (!Array.isArray(batch)) throw new Error(`WCA competition page ${page} failed; catalog not replaced`);
    const before = rows.size;
    for (const row of batch) {
      if (!row || typeof row.id !== 'string' || !row.id
        || typeof row.start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.start_date)
        || typeof row.end_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.end_date)) {
        throw new Error(`Invalid competition on WCA page ${page}; catalog not replaced`);
      }
      rows.set(row.id, row);
    }
    if (batch.length > 0 && rows.size === before) {
      throw new Error(`WCA competition page ${page} repeated; catalog not replaced`);
    }
    if (batch.length < perPage) {
      if (!rows.size) throw new Error('Empty WCA catalog; catalog not replaced');
      return [...rows.values()];
    }
  }
  throw new Error(`WCA catalog exceeded ${maxPages} pages; catalog not replaced`);
}

/** A catalog-only refresh changes official fields but retains existing enrichment. */
export function retainCatalogDetails<T extends {
  id: string; latitude_degrees: number; longitude_degrees: number; elevation?: number;
}>(fresh: T[], previous: T[]): T[] {
  const byId = new Map(previous.map((comp) => [comp.id, comp]));
  return fresh.map((comp) => {
    const old = byId.get(comp.id);
    const merged = { ...old, ...comp };
    if (old && (old.latitude_degrees !== comp.latitude_degrees
      || old.longitude_degrees !== comp.longitude_degrees)) delete merged.elevation;
    return merged;
  });
}
