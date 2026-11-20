/** Read-only check of this review round and its generated website data. */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { shortenWcaPostTitle } from '../../../../core/packages/client/scripts/wca-post-title.mts';
const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, '../../../..');
const read = (p: string): any => JSON.parse(readFileSync(p, 'utf8'));
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const report = read(resolve(dir, 'final-report.json'));
const baseline = read(resolve(dir, 'baseline.json')).records;
const errors: string[] = [];
const check = (ok: unknown, message: string) => { if (!ok) errors.push(message); };
const dataDir = resolve(root, 'core/packages/client/app/[lang]/regulation/_data');
const posts = read(resolve(dataDir, 'posts.json'));
const logs = read(resolve(dataDir, 'logs.json'));
const index = read(resolve(dataDir, 'posts-index.json'));
const linkedPosts = new Map<string, string>();
for (const row of read(resolve(dir, '../wca-post-translations/progress.json')).entries) {
  if (row.status === 'linked_existing_disciplinary') linkedPosts.set(row.key, row.existingKey);
}
const remainingEventNames: any[] = [];
check(report.entries.length === baseline.length, 'Review coverage count');
check(new Set(report.entries.map((r: any) => r.key)).size === baseline.length, 'Duplicate review key');
for (const b of baseline) {
  const r = report.entries.find((r: any) => r.key === b.key);
  const record = read(resolve(root, b.path));
  check(r?.inputTranslationHash === b.translationHash && r?.sourceHash === b.sourceHash, 'Review input: ' + b.key);
  check(record.source.hash === b.sourceHash, 'Original source changed: ' + b.key);
  check(r?.verdict === 'pass' && r?.reviewedTranslationHash === hash(record.translation), 'Current review binding: ' + b.key);
  check(r?.reviewedContentHash === hash({ title: record.translation.title, content: record.translation.content }), 'Reviewed content: ' + b.key);
  const isPost = b.path.includes('/wca-post-translations/');
  const article = isPost ? posts.find((p: any) => p.sourceKey === b.key) : logs.find((p: any) => p.id === b.key);
  const originalTitle = { zh: record.translation.title, en: record.source.title };
  const expectedTitle = isPost ? shortenWcaPostTitle(originalTitle, record.source.content) : originalTitle;
  check(article?.title.zh === expectedTitle.zh && article?.title.en === expectedTitle.en, 'Generated title: ' + b.key);
  if (isPost) check(article?.translationHash === r?.reviewedTranslationHash, 'Generated article hash: ' + b.key);
  const text = (record.translation.title + '\n' + record.translation.content)
    .replace(/(?:https?:\/\/|mailto:)[^\s)<>\]"']+/g, '')
    // This is an official competition proper name, not an untranslated event label.
    .replaceAll('Mississauga Blindfolded 2024', '');
  for (const match of text.matchAll(/\b(?:Skewb|Megaminx|Pyraminx|Clock|Fewest Moves|One[- ]Handed|Blindfolded)\b/gi)) {
    remainingEventNames.push({ key: b.key, term: match[0] });
  }
}
for (const post of posts) {
  const indexedTitle = index.find((p: any) => p.id === post.id)?.title;
  check(indexedTitle?.zh === post.title.zh && indexedTitle?.en === post.title.en, 'Index/detail title mismatch: ' + post.id);
  const logKey = linkedPosts.get(post.sourceKey);
  if (logKey) {
    const log = logs.find((l: any) => l.id === logKey);
    const title = log && shortenWcaPostTitle(log.title, log.html.en);
    check(title?.zh === post.title.zh && title?.en === post.title.en && log.html.zh === post.html.zh && log.html.en === post.html.en,
      'Reused disciplinary content mismatch: ' + post.id);
  }
}
for (const article of [...posts, ...logs]) {
  for (const language of ['zh', 'en']) {
    check(!/href="mailto:(?:mailto:|https?:)/i.test(article.html[language]), 'Malformed generated mail link: ' + article.id);
  }
}
check(remainingEventNames.length === 0, 'Unlocalized event names remain');
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), ok: errors.length === 0,
  reviewed: report.entries.length, corrected: report.entries.filter((r: any) => r.changed).length,
  sourceConcerns: report.entries.filter((r: any) => r.sourceConcern).length,
  generatedPosts: posts.length, generatedLogs: logs.length, remainingEventNames, errors,
  scope: '哈希、覆盖、索引/正文/复用纪律公告一致性及明确项目名检查；语义审校依据是逐篇proposal及独立复核记录。' }, null, 2));
if (errors.length) process.exitCode = 1;
