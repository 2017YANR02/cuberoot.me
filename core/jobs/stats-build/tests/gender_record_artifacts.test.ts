import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../../stats/records/history/gender/', import.meta.url);
const continents = ['africa', 'asia', 'europe', 'northAmerica', 'oceania', 'southAmerica'];
type Gender = 'm' | 'f';
type Row = {
  e: string; t: 's' | 'a'; v: number; l: string; p: string; pc: string; c: string; d: string;
  a: number[] | null;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, root), 'utf8')) as T;
}

function rowKey(row: Row): string {
  return `${row.e}|${row.t}|${row.v}|${row.p}|${row.c}|${row.d}`;
}

describe('gendered national record artifacts', () => {
  const manifest = readJson<{ countries: Record<Gender, string[]> }>('manifest.json');

  for (const gender of ['m', 'f'] as const) {
    // Full country corpus: keep every row assertion even on shared CI runners.
    it(`${gender}: lists exactly the nonempty country files and preserves each regional progression`, () => {
      const countries = manifest.countries[gender];
      expect(countries.length).toBeGreaterThan(0);
      expect(countries).toEqual([...new Set(countries)].sort());
      const directory = fileURLToPath(new URL(`${gender}/country/`, root));
      expect(readdirSync(directory).filter(name => name.endsWith('.json')).sort())
        .toEqual(countries.map(code => `${code}.json`).sort());

      const countryKeys = new Map<string, Set<string>>();
      for (const code of countries) {
        const { rows } = readJson<{ rows: Row[] }>(`${gender}/country/${code}.json`);
        expect(rows.length, `${gender}/${code} has no records`).toBeGreaterThan(0);
        const groups = new Map<string, Row[]>();
        for (const row of rows) {
          expect(row.pc, `${gender}/${code}: wrong athlete country`).toBe(code);
          expect(['WR', 'AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR', 'NR']).toContain(row.l);
          expect(row.a === null || Array.isArray(row.a)).toBe(true);
          const key = `${row.e}|${row.t}`;
          groups.set(key, [...(groups.get(key) ?? []), row]);
        }
        for (const group of groups.values()) {
          let best = Infinity;
          let bestDate = '';
          for (const row of group.sort((a, b) => a.d.localeCompare(b.d) || a.v - b.v)) {
            expect(row.v < best || (row.v === best && row.d === bestDate),
              `${gender}/${code}/${row.e}/${row.t}: not a record progression`).toBe(true);
            best = row.v;
            bestDate = row.d;
          }
        }
        countryKeys.set(code, new Set(rows.map(rowKey)));
      }

      for (const path of ['world.json', ...continents.map(slug => `continent/${slug}.json`)]) {
        const { rows } = readJson<{ rows: Row[] }>(`${gender}/${path}`);
        for (const row of rows) {
          const keys = countryKeys.get(row.pc);
          if (keys) expect(keys.has(rowKey(row)), `${gender}/${path}: missing from ${row.pc}`).toBe(true);
        }
      }
    }, 30_000);
  }
});
