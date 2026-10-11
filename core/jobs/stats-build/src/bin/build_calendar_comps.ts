import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildCalendarData, type CalendarManifest } from '@cuberoot/shared/competition-calendar';
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(`${root}stats/${name}.json`, 'utf8'));
const { summary, months } = buildCalendarData(read('all_past_comps'), read('all_upcoming_comps'));
const directory = `${root}stats/comp_calendar`;
mkdirSync(directory, { recursive: true });
const manifest: CalendarManifest = { version: 1, ...summary, months: {} };
for (const [month, rows] of Object.entries(months)) {
  const contentHash = createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
  writeFileSync(`${directory}/${month}.json`, JSON.stringify({ ...rows, contentHash }) + '\n');
  manifest.months[month] = contentHash;
}
// Publish pointer last; clients fall back to complete data across a mixed deployment.
writeFileSync(`${directory}/index.json`, JSON.stringify(manifest) + '\n');
console.log(`Calendar: ${Object.keys(months).length} complete month windows`);
