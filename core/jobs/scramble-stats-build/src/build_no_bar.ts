/** Full scan of the same WCA export used by intake; no solver tables required. */
import { createReadStream } from 'node:fs';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot, wcaDir } from '../pipeline_paths.mjs';
import { decodeWcaTsvField } from './wca_tsv.mjs';
import { isNoBarScramble } from './no_bar.js';

const EVENTS = ['222', '333', '333oh', '333bf', '333mbf', '333fm', '333ft', '333mbo'];
type Example = { id: string; scramble: string; competition: string; event: string; round: string; group: string; number: number; extra: boolean; cube: number };
type Counts = { total: number; matches: number; examples: Example[] };

export async function buildNoBar(source: string, exportDate: string) {
  const events: Record<string, Counts> = Object.fromEntries(EVENTS.map(event => [event, { total: 0, matches: 0, examples: [] }]));
  const input = createReadStream(source, 'utf8');
  const reader = createInterface({ input, crlfDelay: Infinity });
  let columns: Record<string, number> | undefined;
  let scanned = 0;
  const seen = new Set<string>();
  try {
    for await (const line of reader) {
      if (!line) continue;
      const cells = line.split('\t');
      if (!columns) {
        columns = Object.fromEntries(cells.map((name, i) => [name, i]));
        for (const key of ['id', 'scramble', 'event_id', 'competition_id', 'round_type_id', 'group_id', 'scramble_num', 'is_extra']) {
          if (columns[key] === undefined) throw new Error(`Missing column ${key}`);
        }
        continue;
      }
      const cell = (key: string) => cells[columns![key]] ?? '';
      const event = cell('event_id');
      if (!events[event]) continue;
      const rawId = cell('id');
      if (seen.has(rawId)) throw new Error(`Duplicate WCA scramble ID ${rawId}`);
      seen.add(rawId);
      const raw = decodeWcaTsvField(cell('scramble'));
      const scrambles = event === '333mbf' || event === '333mbo'
        ? raw.replaceAll('|', '\n').split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [raw.trim()];
      if (!scrambles.length) throw new Error(`Empty multi-blind row ${rawId}`);
      for (const [index, scramble] of scrambles.entries()) {
        const bucket = events[event];
        bucket.total++;
        let match: boolean;
        try { match = isNoBarScramble(scramble, event === '222' ? 2 : 3); }
        catch (error) { throw new Error(`WCA ${rawId}, cube ${index + 1}: ${String(error)}`); }
        if (match) {
          bucket.matches++;
          // All rare 3x3 matches; 2x2 has many, retain a documented deterministic preview.
          if (event !== '222' || bucket.examples.length < 12) bucket.examples.push({
            id: `${rawId}${String(index + 1).padStart(3, '0')}`, scramble,
            competition: cell('competition_id'), event, round: cell('round_type_id'),
            group: cell('group_id'), number: Number(cell('scramble_num')), extra: cell('is_extra') === '1', cube: index + 1,
          });
        }
      }
      if (++scanned % 200_000 === 0) console.log(`[no-bar] ${scanned} WCA rows`);
    }
  } finally { reader.close(); input.destroy(); }
  if (!columns || !events['333'].total) throw new Error('No 3x3 WCA data');
  const family = Object.entries(events).filter(([event]) => event !== '222');
  const three = {
    total: family.reduce((sum, [, row]) => sum + row.total, 0),
    matches: family.reduce((sum, [, row]) => sum + row.matches, 0),
  };
  return {
    meta: { schemaVersion: 1, exportDate, definition: 'All orthogonally adjacent stickers on every face differ, including centers; diagonals excluded.',
      counting: 'WCA scramble occurrences, including extras; multi-blind split into individual cubes; repeated sequences are not deduplicated.',
      twoExampleLimit: 12, sourceRows: scanned },
    three, events,
  };
}

async function main() {
  const source = join(wcaDir, 'incremental/tsv/Scrambles.tsv');
  const exportDate = (await readFile(join(wcaDir, 'incremental/tsv/.export_date'), 'utf8')).trim();
  const result = await buildNoBar(source, exportDate);
  const output = join(repoRoot, 'stats/scramble/no_bar.json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(`${output}.tmp`, `${JSON.stringify(result)}\n`);
  await rename(`${output}.tmp`, output);
  console.log(JSON.stringify({ exportDate, three: result.three, events: Object.fromEntries(Object.entries(result.events).map(([key, value]) => [key, { total: value.total, matches: value.matches }])) }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
