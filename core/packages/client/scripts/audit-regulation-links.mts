/** Offline coverage audit of saved reading references, not source-attribution metadata. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { resolveRegulationHref } from '../lib/regulation-links';

const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(client, '../../..');
const regulation = resolve(client, 'app/[lang]/regulation');
const read = (path: string) => JSON.parse(readFileSync(resolve(regulation, '_data', path), 'utf8'));
const references = new Map<string, Set<string>>();
const add = (url: string, location: string) => {
  if (!/^(?:https?:|mailto:)/.test(url)) return;
  if (!references.has(url)) references.set(url, new Set());
  references.get(url)!.add(location);
};
const markdown = (text: string, location: string) => {
  for (const match of text.matchAll(/\[[^\]]+\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) add(match[1], location);
};
for (const file of ['posts.json', 'logs.json', 'references.json']) {
  for (const article of read(file)) {
    for (const section of [article, ...(article.supplements ?? [])]) {
      for (const [lang, html] of Object.entries(section.html)) {
        const { document } = parseHTML(`<html><body>${html}</body></html>`);
        for (const a of document.querySelectorAll('a[href]')) add(a.getAttribute('href')!, `${file}:${section.id}:${lang}`);
      }
    }
  }
}
const full = read('reg-clauses/_full.json');
for (const article of full.articles) for (const clause of article.clauses) {
  for (const lang of ['zh', 'en']) markdown(clause[lang], `full:${clause.id}:${lang}`);
}
for (const [i, note] of full.notes.entries()) for (const lang of ['zh', 'en']) markdown(note[lang].body, `full:note-${i}:${lang}`);
markdown(readFileSync(resolve(client, 'public/regulation/wca-translation-reference.md'), 'utf8'), 'translation-reference');

// Authored JSX contains attribution too; list those separately for manual inspection.
const authoredSources: { file: string; urls: string[] }[] = [];
function walk(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) { if (!entry.name.startsWith('_data')) walk(path); continue; }
    if (!entry.name.endsWith('.tsx')) continue;
    const urls = [...new Set([...readFileSync(path, 'utf8').matchAll(/https?:\/\/[^\s'"<>`]+/g)].map(m => m[0]))];
    if (urls.length) authoredSources.push({ file: relative(root, path), urls });
  }
}
walk(regulation);

function category(url: string, destination: string | null) {
  if (destination) return 'internal';
  if (url.startsWith('mailto:')) return 'contact';
  const parsed = new URL(url);
  if (/\/regulations\/(?:history|historical|regulations(?:%5C_)?(?:history)?\d{4}[^/]*\.html)/i.test(parsed.pathname)) return 'historical-version';
  if (parsed.hostname === 'forum.worldcubeassociation.org') return 'forum';
  if (/^(?:drive|docs)\.google\.com$/.test(parsed.hostname)) return 'google-document';
  if (/\.pdf$/i.test(parsed.pathname)) return 'document';
  if (/github\.com$/.test(parsed.hostname)) return 'source-code-or-discussion';
  if (/\/regulations(?:\/|$)/.test(parsed.pathname) && /worldcubeassociation\.org$/.test(parsed.hostname)) return 'unmapped-rule-reference';
  return 'other-external';
}
const entries = [...references].sort(([a], [b]) => a.localeCompare(b)).map(([url, usedBy]) => {
  const destination = resolveRegulationHref(url, 'en');
  return { url, destination, category: category(url, destination), usedBy: [...usedBy].sort() };
});
const counts: Record<string, number> = {};
for (const entry of entries) counts[entry.category] = (counts[entry.category] ?? 0) + 1;
const report = {
  scope: 'Unique saved-body URLs across announcements, logs, collected references, full clauses and translation reference. JSX sources listed separately include explicit attribution links.',
  counts, entries, authoredSources,
};
const target = process.argv.indexOf('--output');
if (target !== -1) {
  if (!process.argv[target + 1]) throw new Error('--output needs a path');
  writeFileSync(resolve(process.cwd(), process.argv[target + 1]), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ uniqueBodyUrls: entries.length, counts, authoredFiles: authoredSources.length }));
