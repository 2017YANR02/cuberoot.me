// One discovery rule for CI sparse checkout and the record-filter contract test.
// Detect the shared contract as well as the legacy Continental section pattern,
// so a new generator using the old pattern cannot silently avoid validation.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function isRecordStatistic(source) {
  return /export\s+class\s+\w+\s+extends\b/.test(source)
    && /\brecordScope\b|\brecord_scopes\b|['"]Continental['"]/.test(source);
}

export function recordStatIds() {
  const directory = new URL('../jobs/stats-build/src/statistics/', import.meta.url);
  return readdirSync(directory)
    .filter(name => name.endsWith('.ts') && isRecordStatistic(readFileSync(new URL(name, directory), 'utf8')))
    .map(name => name.slice(0, -3))
    .sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(recordStatIds().map(id => `/stats/${id}.json\n`).join(''));
}
