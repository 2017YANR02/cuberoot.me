export const RECORD_PLACE_VERSION = 1 as const;

export const RECORD_METRICS = ['wr', 'cr', 'nr'] as const;
export type RecordMetric = (typeof RECORD_METRICS)[number];

export interface RecordCounts {
  wr: number;
  cr: number;
  nr: number;
}

export interface CountryRecordCounts extends RecordCounts {
  iso2: string;
}

export interface CityRecordCounts extends CountryRecordCounts {
  city: string;
}

export interface RecordPlacesData {
  version: typeof RECORD_PLACE_VERSION;
  countries: CountryRecordCounts[];
  cities: CityRecordCounts[];
}

export interface RecordPlaceSourceRow {
  iso2: string | null;
  city: string | null;
  singleRecord: string | null;
  averageRecord: string | null;
}

const CONTINENTAL_RECORDS = new Set(['AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR']);
const MULTI_REGIONS = new Set(['XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW']);

function metricForRecord(level: string | null): RecordMetric | null {
  if (level === 'WR') return 'wr';
  if (level && CONTINENTAL_RECORDS.has(level)) return 'cr';
  if (level === 'NR') return 'nr';
  return null;
}

function emptyCounts(): RecordCounts {
  return { wr: 0, cr: 0, nr: 0 };
}

function addRecord(counts: RecordCounts, level: string | null): boolean {
  const metric = metricForRecord(level);
  if (!metric) return false;
  counts[metric]++;
  return true;
}

function normalizeIso2(raw: string | null): string | null {
  const iso2 = (raw ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso2) || MULTI_REGIONS.has(iso2)) return null;
  return iso2;
}

function usableCity(raw: string | null): string | null {
  const city = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!city || /^multiple cities\b/i.test(city)) return null;
  return city;
}

/** Build venue-based record counts from WCA result markers. */
export function buildRecordPlaces(rows: Iterable<RecordPlaceSourceRow>): RecordPlacesData {
  const countries = new Map<string, RecordCounts>();
  const cities = new Map<string, CityRecordCounts>();

  for (const row of rows) {
    const iso2 = normalizeIso2(row.iso2);
    if (!iso2) continue;

    const levels = [row.singleRecord, row.averageRecord];
    const countryCounts = countries.get(iso2) ?? emptyCounts();
    const city = usableCity(row.city);
    const cityKey = city ? `${iso2}\0${city.toLocaleLowerCase('en')}` : null;
    const cityCounts = city && cityKey
      ? (cities.get(cityKey) ?? { iso2, city, ...emptyCounts() })
      : null;

    let hasRecord = false;
    for (const level of levels) {
      hasRecord = addRecord(countryCounts, level) || hasRecord;
      if (cityCounts) addRecord(cityCounts, level);
    }
    if (!hasRecord) continue;

    countries.set(iso2, countryCounts);
    if (cityCounts && cityKey) cities.set(cityKey, cityCounts);
  }

  return {
    version: RECORD_PLACE_VERSION,
    countries: [...countries].map(([iso2, counts]) => ({ iso2, ...counts }))
      .sort((a, b) => a.iso2.localeCompare(b.iso2, 'en')),
    cities: [...cities.values()].sort((a, b) =>
      a.iso2.localeCompare(b.iso2, 'en') || a.city.localeCompare(b.city, 'en')
    ),
  };
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isCountryRow(value: unknown): value is CountryRecordCounts {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<CountryRecordCounts>;
  return typeof row.iso2 === 'string' && /^[A-Z]{2}$/.test(row.iso2)
    && isCount(row.wr) && isCount(row.cr) && isCount(row.nr);
}

function isCityRow(value: unknown): value is CityRecordCounts {
  if (!isCountryRow(value)) return false;
  return typeof (value as Partial<CityRecordCounts>).city === 'string'
    && (value as CityRecordCounts).city.trim().length > 0;
}

export function isRecordPlacesData(value: unknown): value is RecordPlacesData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RecordPlacesData>;
  return data.version === RECORD_PLACE_VERSION
    && Array.isArray(data.countries) && data.countries.every(isCountryRow)
    && Array.isArray(data.cities) && data.cities.every(isCityRow);
}
