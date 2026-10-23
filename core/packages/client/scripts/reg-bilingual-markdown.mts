import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

type Bilingual = { en: string; zh: string };
type RegulationDocument = {
  version: Bilingual;
  articles: { id: string; heading: Bilingual; clauses: (Bilingual & { id: string; depth: number })[] }[];
};

const SOURCE = new URL('../app/[lang]/regulation/_data/reg-clauses/_full.json', import.meta.url);
const OUTPUT = new URL('../public/regulation/wca-regulations-bilingual.md', import.meta.url);
const BASE = 'https://cuberoot.me';

// Keep the source words intact. Only adapt compiler-specific link targets and
// escape table delimiters; English and Chinese references retain their locale.
export function tableCell(text: string, lang: 'en' | 'zh'): string {
  // The site's mirror owns stable clause and article IDs; upstream article
  // anchors include localized heading slugs and cannot be built from IDs alone.
  const base = `${BASE}/${lang === 'zh' ? 'zh/' : ''}regulation/full`;
  return text
    .replace(/\]\(regulations:regulation:([^)]+)\)/g, `](${base}#$1)`)
    .replace(/\]\(regulations:article:([^)]+)\)/g, `](${base}#article-$1)`)
    .replace(/\|/g, '&#124;')
    .replace(/\r?\n/g, '<br>');
}

export function bilingualMarkdown(doc: RegulationDocument, sourceHash: string): string {
  const clauses = doc.articles.flatMap(article => article.clauses);
  const ids = new Set<string>();
  for (const clause of clauses) {
    if (!clause.id || !clause.en || ids.has(clause.id)) {
      throw new Error(`Invalid or duplicate regulation clause: ${clause.id}`);
    }
    ids.add(clause.id);
  }
  if (!clauses.length || !doc.version.en || !doc.version.zh) throw new Error('Missing regulation text or versions');
  const missing = clauses.filter(clause => !clause.zh.trim()).length;
  const rows = [
    '# WCA 规则条款英中对照 / WCA Regulations: English–Chinese Parallel Clauses',
    '',
    `- 英文版本 / English version: ${doc.version.en}`,
    `- 中文版本 / Chinese version: ${doc.version.zh}`,
    `- 覆盖 / Coverage: ${doc.articles.length} chapters; ${clauses.length} clauses; ${missing} missing Chinese translations.`,
    '- 英文 / English: https://github.com/thewca/wca-regulations/blob/official/wca-regulations.md',
    '- 中文 / Chinese: https://github.com/thewca/wca-regulations-translations/blob/main/chinese/wca-regulations.md',
    '- 原文署名 / Source attribution: World Cube Association and Chinese translation contributors; see the original sources above.',
    '- 编排 / Compilation: CubeRoot. Clauses aligned by ID; formatting and reference URLs adapted for Markdown.',
    `- 本地数据 SHA-256 / Source data SHA-256: \`${sourceHash}\``,
    '',
    '本表保留网站双语快照的条款原文（含带 + 的条款），不包含前言说明；按编号对齐不代表逐句审核。中文来自 WCA 网站提供的翻译，不是权威版本；如有出入，以现行英文为准。版本分别列出，不保证两种语言同步或仍为最新。缺失译文明确标记，不用英文冒充中文。',
    '',
    'This export preserves the site snapshot’s numbered clauses, including + clauses, and excludes introductory notes. ID alignment is not a quality review. The Chinese translation is provided by the WCA website but is not authoritative. Current English rules take precedence. Versions are reported separately without guaranteeing synchronization or currency; missing translations are explicitly marked.',
    '',
    '翻译前先读 [术语、句式与原译疑点 / Terminology, phrasing and known discrepancies](https://cuberoot.me/regulation/wca-translation-reference.md)。不要将未经复核的对照直接视为无误的训练答案。 / Do not treat unreviewed aligned text as error-free training targets.',
    '',
    '生成入口 / Regenerate from the same site data: `cd core && pnpm --filter @cuberoot/client reg:clauses --from-json`。常规 `reg:clauses` 更新原文时也会生成此文件；不要手工编辑。 / Regular `reg:clauses` also refreshes this file; do not edit it by hand.',
    '',
  ];
  for (const article of doc.articles) {
    rows.push(`## ${article.heading.en} / ${article.heading.zh}`, '',
      '| 条款 / Clause | English | 简体中文 / Chinese |', '| --- | --- | --- |');
    for (const clause of article.clauses) {
      rows.push(`| [${clause.id}](${BASE}/regulation/full#${clause.id}) | ${tableCell(clause.en, 'en')} | ${clause.zh.trim() ? tableCell(clause.zh, 'zh') : '【缺少中文译文 / Chinese translation unavailable】'} |`);
    }
    rows.push('');
  }
  return rows.join('\n');
}

export function writeBilingualMarkdown(): void {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const hash = createHash('sha256').update(source).digest('hex');
  const markdown = bilingualMarkdown(JSON.parse(source) as RegulationDocument, hash);
  fs.mkdirSync(path.dirname(fileURLToPath(OUTPUT)), { recursive: true });
  fs.writeFileSync(OUTPUT, markdown);
  console.log('[reg:clauses] public/regulation/wca-regulations-bilingual.md');
}
