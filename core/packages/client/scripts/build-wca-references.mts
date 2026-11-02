/** Build only retrieved, reviewed reading content; unavailable sources never become empty pages. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RegulationReference } from '../lib/regulation-references';
import { sanitize } from './wca-content.mts';

const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entriesDir = resolve(client, '../../../docs/wca-reference-translations/entries');
const out = resolve(client, 'app/[lang]/regulation/_data');
const ids = new Set<string>();
const references: RegulationReference[] = readdirSync(entriesDir).filter(name => name.endsWith('.json')).sort().map(name => {
  const entry = JSON.parse(readFileSync(resolve(entriesDir, name), 'utf8'));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || ids.has(entry.id)) throw new Error(`Invalid or duplicate reference: ${name}`);
  ids.add(entry.id);
  if (!['summary', 'translation'].includes(entry.contentKind)) throw new Error(`Missing content kind: ${name}`);
  for (const url of [entry.sourceUrl, ...(entry.aliases ?? [])]) {
    if (!/^https?:$/.test(new URL(url).protocol)) throw new Error(`Invalid source URL: ${name}`);
  }
  for (const lang of ['zh', 'en'] as const) {
    if (!entry.title?.[lang]?.trim() || !entry.html?.[lang]?.replace(/<[^>]*>/g, '').trim()) throw new Error(`Missing ${lang} content: ${name}`);
  }
  return {
    id: entry.id, sourceUrl: entry.sourceUrl, ...(entry.aliases?.length ? { aliases: entry.aliases } : {}),
    date: entry.date ?? '', title: entry.title,
    html: { zh: sanitize(entry.html.zh), en: sanitize(entry.html.en) }, contentKind: entry.contentKind,
  };
});
writeFileSync(resolve(out, 'references.json'), JSON.stringify(references) + '\n');
writeFileSync(resolve(out, 'references-index.json'), JSON.stringify(references.map(({ html, ...metadata }) => metadata)) + '\n');
// Keep the shared resolver in sync with the set of real, statically generated pages.
const { buildRegulationLinkIndex } = await import('./build-regulation-link-index.mts');
buildRegulationLinkIndex();
console.log(JSON.stringify({ references: references.length }));
