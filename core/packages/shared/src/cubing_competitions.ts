/** Fields shared by the offline name index and the live Chinese-name fallback. */
export interface CubingCompetitionName {
  alias: string;
  name: string;
  nameZh: string;
  startDate: string;
  wcaCompetitionId: string;
}

/** cubing.com now embeds its paginated list in Nuxt's reference-array payload. */
export function parseCubingCompetitionList(html: string): { competitions: CubingCompetitionName[]; totalPages: number } {
  const payload = html.match(/<script\b[^>]*\bid="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (payload) {
    const values: unknown = JSON.parse(payload);
    if (!Array.isArray(values)) throw new Error('Invalid cubing.com payload');
    const list = values.find(value => value && typeof value === 'object' && 'competitions' in value && 'total' in value);
    const refs: unknown = list && values[list.competitions];
    const total: unknown = list && values[list.total];
    if (!Array.isArray(refs) || !refs.length || typeof total !== 'number' || !Number.isSafeInteger(total) || total < refs.length) {
      throw new Error('Missing cubing.com competition list');
    }
    const competitions: CubingCompetitionName[] = [];
    for (const ref of refs) {
      const row = values[ref];
      if (!row || typeof row !== 'object') throw new Error('Invalid cubing.com competition');
      const field = (key: string): string => typeof values[row[key]] === 'string' ? values[row[key]] : '';
      if (field('type') !== 'WCA') continue;
      const comp = { alias: field('alias'), name: field('name'), nameZh: field('nameZh'), startDate: field('startDate'), wcaCompetitionId: field('wcaCompetitionId') };
      if (!comp.alias || !comp.nameZh || !/^\d{4}-\d{2}-\d{2}$/.test(comp.startDate)) throw new Error('Incomplete cubing.com competition name');
      competitions.push(comp);
    }
    // The Nuxt list uses 100 rows per page, including on the final short page.
    return { competitions, totalPages: Math.ceil(total / 100) };
  }

  // Retain old cached pages while the upstream deployment rolls out.
  const competitions: CubingCompetitionName[] = [];
  const rowPattern = /<td>(\d{4}-\d{2}-\d{2})(?:~(?:\d{4}-)?(?:\d{2}-)?\d{2})?<\/td>\s*<td>\s*<a[^>]*class="comp-type-\w+"[^>]*href="https:\/\/cubing\.com\/(?:competition|live)\/([^"?]+)"[^>]*>(.*?)<\/a>/gs;
  for (const match of html.matchAll(rowPattern)) {
    const nameZh = match[3]!.replace(/<[^>]+>/g, '').trim();
    if (nameZh.includes('WCA')) competitions.push({ alias: match[2]!, nameZh, startDate: match[1]!, name: '', wcaCompetitionId: '' });
  }
  if (!competitions.length) throw new Error('Unrecognized or empty cubing.com competition list');
  const pages = [...html.matchAll(/page=(\d+)/g)].map(match => Number(match[1]));
  return { competitions, totalPages: Math.max(1, ...pages) };
}

/** A failed or partial refresh must never erase the historical translations. */
export function mergeCompetitionNames(previous: Record<string, string>, fresh: Record<string, string>): Record<string, string> {
  if (!Object.keys(fresh).length) throw new Error('Refusing to publish an empty competition-name refresh');
  return Object.fromEntries(Object.entries({ ...previous, ...fresh }).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}
