/**
 * 公式富文本(`AlgEntry.algHtml`)的白名单清洗。
 *
 * 库里的 algHtml 保留了 docx 里的手法标注:下划线 / 删除线 / 波浪线 / 加粗 / 上下标。
 * 这些标签会走 `dangerouslySetInnerHTML`,所以渲染前必须过一遍白名单 —— 只留这 6 个标签、
 * 且只留 `<u class="wavy">` 这一个属性,其余标签与属性一律剥掉。
 *
 * 单一来源:公式库列表(AlgCategoryView)与记忆模式(MemoryTrainer)共用这一份。
 */
import { algHtmlText, sanitizeAlgHtml } from '@cuberoot/shared/alg-html';
export { algHtmlText, sanitizeAlgHtml } from '@cuberoot/shared/alg-html';

export interface AlgTextEdit { start: number; end: number; text: string }

/** Edit move text while retaining the markup of every untouched character.
 * New merged moves have no inferred finger assignment; source markup remains
 * available on the original entry. Never carry a deleted move's finger onto
 * a different move merely because it occupied the same string position.
 */
export function editAlgHtmlText(html: string, edits: readonly AlgTextEdit[]): string {
  if (!edits.length) return html;
  const chars: Array<{ text: string; tags: string[] }> = [];
  const tags: string[] = [];
  for (const part of sanitizeAlgHtml(html).split(/(<[^>]*>)/g)) {
    if (part.startsWith('</')) { tags.pop(); continue; }
    if (part.startsWith('<')) { tags.push(part); continue; }
    for (const text of algHtmlText(part).split('')) chars.push({ text, tags: [...tags] });
  }
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    chars.splice(edit.start, edit.end - edit.start, ...edit.text.split('').map(text => ({ text, tags: [] })));
  }
  let out = '';
  let active: string[] = [];
  const close = (tag: string) => `</${tag.match(/^<([a-z]+)/)![1]}>`;
  for (const char of chars) {
    let common = 0;
    while (common < active.length && active[common] === char.tags[common]) common++;
    out += active.slice(common).reverse().map(close).join('');
    out += char.tags.slice(common).join('');
    out += char.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    active = char.tags;
  }
  return out + active.reverse().map(close).join('');
}
