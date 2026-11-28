import { readFileSync, writeFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

type Bilingual = { zh: string; en: string };
type Article = { id: string; html: Bilingual; supplements: { title: Bilingual; html: Bilingual }[] };
const data = new URL('../app/[lang]/regulation/_data/', import.meta.url);

function plainText(html: string) {
  const { document } = parseHTML('<html><body>' + html + '</body></html>');
  return document.body.innerText.replace(/\s+/g, ' ').trim();
}

export function buildWcaPostSearch() {
  const posts: Article[] = JSON.parse(readFileSync(new URL('posts.json', data), 'utf8'));
  const index = Object.fromEntries(posts.map(post => [post.id,
    (['zh', 'en'] as const).map(lang => [
      plainText(post.html[lang]),
      ...post.supplements.flatMap(s => [s.title[lang], plainText(s.html[lang])]),
    ].join('\n')),
  ]));
  const statements: Record<string, { paragraphs: Bilingual[]; note?: Bilingual }> =
    JSON.parse(readFileSync(new URL('forum-statements.json', data), 'utf8'));
  for (const [id, { paragraphs, note }] of Object.entries(statements)) {
    index[id] = (['zh', 'en'] as const).map(lang =>
      [...paragraphs.map(p => p[lang]), note?.[lang]].filter(Boolean).join('\n')
    );
  }
  writeFileSync(new URL('posts-search.json', data), JSON.stringify(index) + '\n');
}
