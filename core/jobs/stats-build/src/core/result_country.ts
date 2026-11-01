/** Historical achievements belong to the country represented for that result. */
export interface CountryBest {
  wcaId: string;
  country: string;
  val: number;
  compId: string;
  date: string;
}

export function addCountryBest(bests: Map<string, CountryBest>, result: CountryBest): void {
  if (result.val <= 0) return;
  const key = `${result.wcaId}\x1f${result.country}`;
  const prev = bests.get(key);
  if (!prev || compareCountryBest(result, prev) < 0) bests.set(key, result);
}

function compareCountryBest(a: CountryBest, b: CountryBest): number {
  return a.val - b.val || a.date.localeCompare(b.date)
    || a.compId.localeCompare(b.compId) || a.wcaId.localeCompare(b.wcaId)
    || a.country.localeCompare(b.country);
}

/** One PB per person in each scope, including deduplication after a same-continent transfer. */
export function rankCountryBests(bests: Iterable<CountryBest>, continentOf: Map<string, string>) {
  const ordered = [...bests].sort(compareCountryBest);
  const world = new Map<string, CountryBest>();
  const countries = new Map<string, Map<string, CountryBest>>();
  const continents = new Map<string, Map<string, CountryBest>>();
  for (const item of ordered) {
    if (!world.has(item.wcaId)) world.set(item.wcaId, item);
    for (const [scopes, scope] of [
      [countries, item.country], [continents, continentOf.get(item.country)],
    ] as const) {
      if (!scope) continue;
      let persons = scopes.get(scope);
      if (!persons) { persons = new Map(); scopes.set(scope, persons); }
      if (!persons.has(item.wcaId)) persons.set(item.wcaId, item);
    }
  }
  const values = (persons: Map<string, CountryBest>) => [...persons.values()].map(r => r.val);
  const worldValues = values(world);
  const countryValues = new Map([...countries].map(([id, persons]) => [id, values(persons)]));
  const continentValues = new Map([...continents].map(([id, persons]) => [id, values(persons)]));
  const rank = (list: number[], value: number) => {
    let lo = 0, hi = list.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (list[mid]! < value) lo = mid + 1; else hi = mid; }
    return lo + 1;
  };
  return {
    world, countries, continents,
    ranks: (item: CountryBest) => ({
      wr: rank(worldValues, item.val),
      cr: rank(countryValues.get(item.country) ?? [], item.val),
      kr: rank(continentValues.get(continentOf.get(item.country) ?? '') ?? [], item.val),
    }),
  };
}
