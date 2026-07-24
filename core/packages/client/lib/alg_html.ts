/**
 * 公式富文本(`AlgEntry.algHtml`)的白名单清洗。
 *
 * 库里的 algHtml 保留了 docx 里的手法标注:下划线 / 删除线 / 波浪线 / 加粗 / 上下标。
 * 这些标签会走 `dangerouslySetInnerHTML`,所以渲染前必须过一遍白名单 —— 只留这 6 个标签、
 * 且只留 `<u class="wavy">` 这一个属性,其余标签与属性一律剥掉。
 *
 * 单一来源:公式库列表(AlgCategoryView)与记忆模式(MemoryTrainer)共用这一份。
 */
const ALG_HTML_TAG_WHITELIST = new Set(['u', 's', 'em', 'strong', 'sub', 'sup']);

export function sanitizeAlgHtml(html: string): string {
  return html.replace(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi, (_full, slash, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!ALG_HTML_TAG_WHITELIST.has(t)) return '';
    if (slash) return `</${t}>`;
    if (t === 'u' && /\bclass\s*=\s*["']?wavy["']?/i.test(attrs)) return '<u class="wavy">';
    return `<${t}>`;
  });
}
