/** Rebuild the website-language reference from its pinned, key-aligned snapshot. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(readFileSync(resolve(client, '../../../docs/wca-website-translations/snapshot.json'), 'utf8')) as {
  commit: string;
  capturedAt: string;
  source: { repository: string; en: { path: string; sha256: string }; zh: { path: string; sha256: string } };
  sections: { title: string; prefix: string; url: string; entries: { key: string; en: string; zh: string | null }[] }[];
};
const entries = snapshot.sections.flatMap(s => s.entries);
if (new Set(entries.map(e => e.key)).size !== entries.length) throw Error('Duplicate locale keys');

// Keep original wording and interpolation tokens. Remove presentation tags only;
// the snapshot retains the exact strings, including HTML, for source comparison.
function cell(value: string | null): string {
  if (value === null) return '（缺少官方中文 / Official Chinese unavailable）';
  return value
    .replace(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_match, _quote, href: string, label: string) => {
      const url = href.startsWith('/') ? `https://www.worldcubeassociation.org${href}` : href;
      return /^(https?:|mailto:)/.test(url) ? `[${label}](${url})` : `${label} (${href})`;
    })
    .replace(/<\/(?:p|li|div)>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replaceAll('|', '&#124;')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

const base = `${snapshot.source.repository}/blob/${snapshot.commit}`;
const sourceNotes = [
  '## WCA 官网双语素材 / WCA website bilingual corpus',
  '',
  `来源 / Source: World Cube Association and its translation contributors. Snapshot: **${snapshot.capturedAt}**; commit: \`${snapshot.commit}\`.`,
  '',
  `原始语言文件 / Locale files: [English](${base}/${snapshot.source.en.path}) · [简体中文](${base}/${snapshot.source.zh.path}) · [上游许可证 / Upstream license](${base}/LICENSE)。`,
  '',
  `覆盖 / Coverage: **${snapshot.sections.length} 栏目 / sections, ${entries.length} 条 / entries**; ${entries.filter(e => !e.zh).length} missing Chinese strings. 按相同 locale key 对齐，不按页面位置猜配。 / Aligned by identical locale keys, not page position.`,
  '',
  '以下包含导航名称及其页面在官方语言文件中的正文、说明和界面文案；不包含人员名单、实时成绩、外链 PDF、工具本体或登录后的个人数据。翻译者和速拧历史栏目仅有标题可在这组语言文件中对齐；统计、隐私、免责声明仅收录导航名称，未将其正文标为已取得官方双语对照。 / Coverage is limited to strings present in these locale files. It excludes rosters, live results, linked PDFs, external tools and private account data. Translators and speedcubing history have only aligned titles here; statistics, privacy and disclaimer have navigation labels only, not aligned bodies.',
  '',
  '保留官方措辞及 %{…} 模板变量，仅转换 HTML 展示标记与链接；数值是快照内容，不是当前统计。原始字符串保存在仓库 docs/wca-website-translations/snapshot.json。 / Official wording and %{…} placeholders are retained; only HTML presentation and links are converted. Figures belong to the snapshot. Exact strings are saved in the repository snapshot.',
  '',
  '使用前先读[翻译参考](https://cuberoot.me/regulation/wca-translation-reference.md)。官方网页译文也需要语境核对：officers_and_board.officers_description 将 officers 译为“董事”，不能据此混同干事与董事；申诉委员会的 key 使用 wapc，但中英文职责说明仍写 WAC。历史公告保留当时缩写。 / Consult the reference first. The officers description conflates officers with directors in Chinese; the appeals key uses wapc while both descriptions still say WAC. Preserve historical acronyms and review context.',
  '',
  `English SHA-256: \`${snapshot.source.en.sha256}\`; Chinese SHA-256: \`${snapshot.source.zh.sha256}\`.`,
  '',
];
// Put the usable examples before the longer provenance and coverage notes.
const lines = [sourceNotes[0], '', sourceNotes[6], '', sourceNotes[4], ''];
for (const section of snapshot.sections) {
  lines.push(`### ${section.title}`, '', `[官网页面 / Website](${section.url}) · locale: \`${section.prefix}\``, '', '| English | 简体中文 | 来源键 / Source key |', '| --- | --- | --- |');
  for (const entry of section.entries) lines.push(`| ${cell(entry.en)} | ${cell(entry.zh)} | \`${entry.key}\` |`);
  lines.push('');
}
lines.push('### 来源与覆盖说明 / Provenance and coverage', '', ...[2, 8, 10, 12, 14].flatMap(index => [sourceNotes[index], '']));
writeFileSync(resolve(client, 'public/regulation/wca-website-bilingual.md'), lines.join('\n'));
console.log(`Exported ${entries.length} aligned website strings across ${snapshot.sections.length} sections.`);
