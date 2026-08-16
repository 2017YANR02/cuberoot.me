const AUTO_MERGE_KM = 25;
const REVIEWED_MERGE_KM = 80;

export interface CityIdentityComp {
  id: string;
  country: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  start?: string;
}

export interface CompCityIdentity {
  /** Internal identity key. Consumers should display label and search aliases. */
  key: string;
  label: string;
  aliases: string[];
}

export interface CompCityIdentityAudit {
  competitions: number;
  identities: number;
  mergedIdentities: number;
  mergedAliases: number;
  splitNameGroups: number;
  repairedOutliers: number;
}

export interface CompCityIdentityResult {
  byCompId: Map<string, CompCityIdentity>;
  identities: CompCityIdentity[];
  audit: CompCityIdentityAudit;
}

interface Entry {
  id: string;
  country: string;
  city: string;
  full: string;
  core: string;
  admin: string;
  lat: number | null;
  lon: number | null;
  start: string;
}

// These pairs were reviewed against all competition coordinates. A global 50 km
// threshold is unsafe: Salem, Massachusetts and Salem, New Hampshire are 44.8 km apart.
const REVIEWED_ALIASES: ReadonlyArray<readonly [string, string, string]> = [
  ['CN', 'Hefei, Anhui', 'Anhui, Hefei'],
  ['CN', 'Chengdu', 'Chengdu, Sichuan'],
  ['CN', 'Suzhou', 'Suzhou, Jiangsu'],
  ['ID', 'Kediri', 'Kediri, East Java'],
  ['ID', 'Pekanbaru', 'Pekanbaru, Riau'],
  ['IE', 'Galway', 'Galway, Ireland'],
];

// Historical/local-language names still require geographic corroboration below.
const CORE_ALIASES = new Map<string, string>([
  ['AR\0ciudadautonomadebuenosaires', 'buenosaires'],
  ['AZ\0gəncə', 'ganja'],
  ['CH\0geneve', 'geneva'],
  ['CH\0liestalbl', 'liestal'],
  ['CO\0bogotadc', 'bogota'],
  ['CZ\0praha', 'prague'],
  ['DE\0koln', 'cologne'],
  ['DE\0munchen', 'munich'],
  ['DK\0arhus', 'aarhus'],
  ['DK\0københavn', 'copenhagen'],
  ['DZ\0alger', 'algiers'],
  ['GT\0ciudaddeguatemala', 'guatemala'],
  ['IL\0natanya', 'netanya'],
  ['IT\0firenze', 'florence'],
  ['IT\0milano', 'milan'],
  ['IT\0roma', 'rome'],
  ['KZ\0nursultan', 'astana'],
  ['KR\0goyangsigyeonggido', 'goyangsi'],
  ['KR\0suwonsigyeonggido', 'suwon'],
  ['MX\0cdmx', 'ciudaddemexico'],
  ['NL\0capelleaandenijssel', 'capelleaandeijssel'],
  ['PA\0ciudaddepanama', 'panama'],
  ['PL\0łodz', 'lodz'],
  ['PL\0warszawa', 'warsaw'],
  ['PT\0lisboa', 'lisbon'],
  ['RO\0bucuresti', 'bucharest'],
  ['RO\0contstanta', 'constanta'],
  ['RU\0ekaterinburg', 'yekaterinburg'],
  ['RU\0stpetersburg', 'saintpetersburg'],
  ['SE\0goteborg', 'gothenburg'],
  ['UA\0dnepr', 'dnipro'],
  ['UA\0dnipropetrovsk', 'dnipro'],
  ['UA\0kiev', 'kyiv'],
  ['UA\0khmelnytskiy', 'khmelnytskyi'],
  ['UA\0khmelnytskyy', 'khmelnytskyi'],
  ['UA\0kiyiv', 'kyiv'],
  ['UA\0uzhgorod', 'uzhhorod'],
]);

const MULTI_LOCATION_EXACT = new Set([
  'flere byer',
  'kyiv and kharkiv',
  'lieux multiples',
  'multiplas cidades',
  'multiples ciudades',
]);

function cleanCity(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeText(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeFull(raw: string): string {
  return normalizeText(raw).replace(/\s+/g, '');
}

function splitTopLevelCommas(raw: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char === '(') depth++;
    else if (char === ')' && depth > 0) depth--;
    else if (char === ',' && depth === 0) {
      parts.push(raw.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(raw.slice(start).trim());
  return parts.filter(Boolean);
}

function cityCore(raw: string, country: string): { core: string; admin: string } | null {
  const parts = splitTopLevelCommas(raw);
  if (parts.length === 0) return null;
  let primary = parts[0];
  const parenthetical = primary.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (parenthetical) {
    const prefix = parenthetical[1].trim();
    const inside = parenthetical[2].trim();
    // Seoul-style local script + Latin translation. Latin names such as
    // Serris (Paris) and Visp (VS) must retain the prefix.
    primary = /[A-Za-z]/.test(prefix) || !/[A-Za-z]/.test(inside) ? prefix : inside;
  }

  let core = normalizeText(primary)
    .replace(/^city of\s+/, '')
    .replace(/\s+(?:city|municipality)$/, '')
    .replace(/\s+\d{3,}$/, '')
    .replace(/\s+/g, '');
  if (!core) return null;
  core = CORE_ALIASES.get(`${country}\0${core}`) ?? core;
  return { core, admin: normalizeFull(parts.slice(1).join(' ')) };
}

export function isMultiLocationCity(raw: string | null | undefined): boolean {
  const normalized = normalizeText(cleanCity(raw ?? ''));
  if (!normalized) return false;
  if (/\bmultiple (?:cities|locations)\b/.test(normalized)) return true;
  return MULTI_LOCATION_EXACT.has(normalized);
}

function validCoordinate(lat: unknown, lon: unknown): [number, number] | null {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  if (lat === 0 && lon === 0) return null;
  return [lat, lon];
}

function distanceKm(a: Entry, b: Entry): number {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return Infinity;
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLon = (b.lon - a.lon) * radians;
  const lat1 = a.lat * radians;
  const lat2 = b.lat * radians;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

class DisjointSet {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = Array(size).fill(0) as number[];
  }

  find(value: number): number {
    let root = value;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[value] !== value) {
      const next = this.parent[value];
      this.parent[value] = root;
      value = next;
    }
    return root;
  }

  union(a: number, b: number): boolean {
    let left = this.find(a);
    let right = this.find(b);
    if (left === right) return false;
    if (this.rank[left] < this.rank[right]) [left, right] = [right, left];
    this.parent[right] = left;
    if (this.rank[left] === this.rank[right]) this.rank[left]++;
    return true;
  }
}

function componentMembers(entries: Entry[], dsu: DisjointSet): Map<number, number[]> {
  const components = new Map<number, number[]>();
  for (let i = 0; i < entries.length; i++) {
    const root = dsu.find(i);
    const members = components.get(root) ?? [];
    members.push(i);
    components.set(root, members);
  }
  return components;
}

function componentHasCoordinate(entries: Entry[], members: number[]): boolean {
  return members.some((index) => entries[index].lat != null && entries[index].lon != null);
}

function minComponentDistance(entries: Entry[], left: number[], right: number[]): number {
  let best = Infinity;
  for (const a of left) {
    for (const b of right) best = Math.min(best, distanceKm(entries[a], entries[b]));
  }
  return best;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * Resolve WCA city-name variants using country-scoped names and conservative
 * spatial evidence. Exact labels tolerate isolated bad coordinates; distinct
 * supported clusters remain separate, including same-name cities.
 */
export function resolveCompCityIdentities(comps: Iterable<CityIdentityComp>): CompCityIdentityResult {
  const seen = new Set<string>();
  const entries: Entry[] = [];
  for (const comp of comps) {
    if (!comp.id || seen.has(comp.id)) continue;
    seen.add(comp.id);
    const country = cleanCity(comp.country).toUpperCase();
    const city = cleanCity(comp.city);
    if (!/^[A-Z]{2}$/.test(country) || !city || isMultiLocationCity(city)) continue;
    const parsed = cityCore(city, country);
    if (!parsed) continue;
    const coordinate = validCoordinate(comp.latitude, comp.longitude);
    entries.push({
      id: comp.id,
      country,
      city,
      full: normalizeFull(city),
      core: parsed.core,
      admin: parsed.admin,
      lat: coordinate?.[0] ?? null,
      lon: coordinate?.[1] ?? null,
      start: comp.start ?? '',
    });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id, 'en'));

  const dsu = new DisjointSet(entries.length);
  const candidateGroups = new Map<string, number[]>();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const key = `${entry.country}\0${entry.core}`;
    const group = candidateGroups.get(key) ?? [];
    group.push(i);
    candidateGroups.set(key, group);
  }

  // Strong automatic evidence: the normalized city core agrees and at least
  // one pair of competition locations is within the conservative threshold.
  for (const group of candidateGroups.values()) {
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        if (distanceKm(entries[group[a]], entries[group[b]]) <= AUTO_MERGE_KM) {
          dsu.union(group[a], group[b]);
        }
      }
    }
  }

  // Five reviewed WCA source-city pairs have unusually wide venue coordinates.
  for (const [country, rawA, rawB] of REVIEWED_ALIASES) {
    const fullA = normalizeFull(rawA);
    const fullB = normalizeFull(rawB);
    const matching = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.country === country && (entry.full === fullA || entry.full === fullB));
    const components = componentMembers(entries, dsu);
    for (const left of matching.filter(({ entry }) => entry.full === fullA)) {
      for (const right of matching.filter(({ entry }) => entry.full === fullB)) {
        const leftMembers = components.get(dsu.find(left.index)) ?? [left.index];
        const rightMembers = components.get(dsu.find(right.index)) ?? [right.index];
        if (minComponentDistance(entries, leftMembers, rightMembers) <= REVIEWED_MERGE_KM) {
          dsu.union(left.index, right.index);
        }
      }
    }
  }

  let repairedOutliers = 0;

  // An exact raw label is a hard name node unless two independently supported
  // geographic components prove that WCA reused it for different cities.
  const byExactLabel = new Map<string, number[]>();
  for (let i = 0; i < entries.length; i++) {
    const key = `${entries[i].country}\0${entries[i].full}`;
    const group = byExactLabel.get(key) ?? [];
    group.push(i);
    byExactLabel.set(key, group);
  }
  for (const group of byExactLabel.values()) {
    const components = componentMembers(entries, dsu);
    const roots = sortedUnique(group.map((index) => String(dsu.find(index)))).map(Number);
    if (roots.length < 2) continue;
    const supported = roots.filter((root) => {
      const members = components.get(root) ?? [];
      return members.length >= 2 && componentHasCoordinate(entries, members);
    });
    if (supported.length >= 2) {
      const adminEvidence = supported.map((root) => new Set(
        (components.get(root) ?? []).map((index) => entries[index].admin).filter(Boolean),
      ));
      const independentlyDisambiguated = adminEvidence.every((admins) => admins.size > 0)
        && adminEvidence.every((admins, index) => adminEvidence.every((other, otherIndex) =>
          index === otherIndex || [...admins].every((admin) => !other.has(admin))
        ));
      if (independentlyDisambiguated) continue;
    }
    const target = supported[0] ?? roots[0];
    for (const root of roots) {
      if (root !== target && dsu.union(target, root)) repairedOutliers++;
    }
  }

  // A bare-name singleton can follow one unambiguous supported component. An
  // explicit conflicting state/province remains separate (Portland/Columbus).
  for (const group of candidateGroups.values()) {
    const components = componentMembers(entries, dsu);
    const roots = [...new Set(group.map((index) => dsu.find(index)))];
    const supported = roots.filter((root) => (components.get(root)?.length ?? 0) >= 2);
    if (supported.length !== 1) continue;
    const target = supported[0];
    const targetMembers = components.get(target) ?? [];
    const targetAdmins = new Set(targetMembers.map((index) => entries[index].admin).filter(Boolean));
    const targetLabels = new Set(targetMembers.map((index) => entries[index].full));
    for (const root of roots) {
      if (root === target) continue;
      const members = components.get(root) ?? [];
      const compatible = members.every((index) => {
        const entry = entries[index];
        return targetLabels.has(entry.full)
          || !entry.admin
          || targetAdmins.size === 0
          || targetAdmins.has(entry.admin);
      });
      if (compatible && dsu.union(target, root)) repairedOutliers++;
    }
  }

  const components = componentMembers(entries, dsu);
  const rootsByCore = new Map<string, Set<number>>();
  const rootsByFullLabel = new Map<string, Set<number>>();
  for (let i = 0; i < entries.length; i++) {
    const root = dsu.find(i);
    const entry = entries[i];
    const coreKey = `${entry.country}\0${entry.core}`;
    const labelKey = `${entry.country}\0${entry.full}`;
    const coreRoots = rootsByCore.get(coreKey) ?? new Set<number>();
    const labelRoots = rootsByFullLabel.get(labelKey) ?? new Set<number>();
    coreRoots.add(root);
    labelRoots.add(root);
    rootsByCore.set(coreKey, coreRoots);
    rootsByFullLabel.set(labelKey, labelRoots);
  }
  const identityByRoot = new Map<number, CompCityIdentity>();
  const identityKeyOwners = new Map<string, number>();
  const labelOwners = new Map<string, number>();
  for (const [root, members] of components) {
    const variants = new Map<string, { count: number; latest: string }>();
    for (const index of members) {
      const entry = entries[index];
      const current = variants.get(entry.city) ?? { count: 0, latest: '' };
      current.count++;
      if (entry.start > current.latest) current.latest = entry.start;
      variants.set(entry.city, current);
    }
    const rankedLabels = [...variants].sort((a, b) =>
      b[1].count - a[1].count
      || b[1].latest.localeCompare(a[1].latest, 'en')
      || a[0].localeCompare(b[0], 'en')
    );
    const country = entries[members[0]].country;
    const core = entries[members[0]].core;
    const splitCore = (rootsByCore.get(`${country}\0${core}`)?.size ?? 0) > 1;
    const isExclusive = (candidate: string) =>
      (rootsByFullLabel.get(`${country}\0${normalizeFull(candidate)}`)?.size ?? 0) === 1;
    const hasAdmin = (candidate: string) => Boolean(cityCore(candidate, country)?.admin);
    const labelCandidates = splitCore
      ? [
          ...rankedLabels.filter(([candidate]) => isExclusive(candidate) && hasAdmin(candidate)),
          ...rankedLabels.filter(([candidate]) => isExclusive(candidate) && !hasAdmin(candidate)),
          ...rankedLabels.filter(([candidate]) => !isExclusive(candidate)),
        ]
      : rankedLabels;
    let label = labelCandidates[0][0];
    for (const [candidate] of labelCandidates) {
      const owner = labelOwners.get(`${country}\0${candidate.toLocaleLowerCase('en')}`);
      if (owner == null || owner === root) { label = candidate; break; }
    }
    const labelKey = `${country}\0${label.toLocaleLowerCase('en')}`;
    if (labelOwners.has(labelKey) && labelOwners.get(labelKey) !== root) {
      throw new Error(`Unresolved duplicate city label: ${country} / ${label}`);
    }
    labelOwners.set(labelKey, root);
    const aliases = sortedUnique(variants.keys()).filter((alias) => alias !== label);
    const identityKey = `${country}\0${core}\0${normalizeFull(label)}`;
    const identityKeyOwner = identityKeyOwners.get(identityKey);
    if (identityKeyOwner != null && identityKeyOwner !== root) {
      throw new Error(`Unresolved duplicate city identity: ${country} / ${label}`);
    }
    identityKeyOwners.set(identityKey, root);
    const identity: CompCityIdentity = {
      key: identityKey,
      label,
      aliases,
    };
    identityByRoot.set(root, identity);
  }

  const byCompId = new Map<string, CompCityIdentity>();
  for (let i = 0; i < entries.length; i++) {
    const identity = identityByRoot.get(dsu.find(i));
    if (identity) byCompId.set(entries[i].id, identity);
  }
  const identities = [...identityByRoot.values()].sort((a, b) => a.key.localeCompare(b.key, 'en'));
  const splitNameGroups = [...candidateGroups.values()].filter((group) =>
    new Set(group.map((index) => dsu.find(index))).size > 1
  ).length;

  return {
    byCompId,
    identities,
    audit: {
      competitions: entries.length,
      identities: identities.length,
      mergedIdentities: identities.filter((identity) => identity.aliases.length > 0).length,
      mergedAliases: identities.reduce((sum, identity) => sum + identity.aliases.length, 0),
      splitNameGroups,
      repairedOutliers,
    },
  };
}
