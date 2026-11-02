/** Small browser index derived from the actual published reading destinations. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const data = resolve(dirname(fileURLToPath(import.meta.url)), '../app/[lang]/regulation/_data');
type Content = { id: string; sourceUrl: string; kind?: string; supplements?: Content[] };
const read = <T>(name: string): T => JSON.parse(readFileSync(resolve(data, name), 'utf8'));

export function buildRegulationLinkIndex() {
  const posts = read<Content[]>('posts.json');
  const logs = read<Content[]>('logs.json');
  const full = read<{ articles: { id: string; clauses: { id: string }[] }[] }>('reg-clauses/_full.json');
  const sources = new Map<string, string>();
  const addSupplements = (row: Content, destination: string) => {
    for (const supplement of row.supplements ?? []) {
      sources.set(supplement.sourceUrl, `${destination}#${encodeURIComponent(`supplement-${supplement.id}`)}`);
    }
  };
  const postIds = new Set(posts.map(post => post.id));
  for (const row of logs) {
    const destination = `/regulation/logs?kind=${row.kind}&entry=${encodeURIComponent(row.id)}`;
    if (!row.sourceUrl.match(/\/incidents\/\d+\/?$/) && !postIds.has(row.sourceUrl.split('/').at(-1)!)) {
      sources.set(row.sourceUrl, destination);
    }
    addSupplements(row, destination);
  }
  // Announcements are the canonical reading destination for duplicated log items.
  for (const row of posts) addSupplements(row, `/regulation/post/${row.id}`);
  sources.set('https://forum.worldcubeassociation.org/t/statement-from-the-wca-integrity-committee-regarding-a-recent-investigation/68143', '/regulation/post/wic-investigation-2026');
  const archive = sources.get('https://www.worldcubeassociation.org/archive/forum_topics/388#p1640');
  if (archive) sources.set('https://www.worldcubeassociation.org/forum/viewtopic.php?f=9&t=388', archive);
  if (existsSync(resolve(data, 'references-index.json'))) {
    for (const reference of read<(Content & { aliases?: string[] })[]>('references-index.json')) {
      for (const source of [reference.sourceUrl, ...(reference.aliases ?? [])]) {
        if (!sources.has(source)) sources.set(source, `/regulation/reference/${reference.id}`);
      }
    }
  }
  const result = {
    posts: [...postIds].sort(),
    incidents: logs.filter(row => row.kind === 'incidents').map(row => row.id.slice('incidents:'.length)).sort((a, b) => Number(a) - Number(b)),
    anchors: full.articles.flatMap(article => [`article-${article.id}`, ...article.clauses.map(clause => clause.id)]),
    sources: [...sources].sort(([a], [b]) => a.localeCompare(b)),
  };
  writeFileSync(resolve(data, 'link-index.json'), JSON.stringify(result) + '\n');
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildRegulationLinkIndex();
