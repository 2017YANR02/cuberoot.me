/** Plain-text preview shared by forum API responses and server-rendered SEO. */
export function excerptFromMarkdown(markdown: string, maxLength = 120): string {
  const limit = Number.isInteger(maxLength) && maxLength > 0 ? maxLength : 120;
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')
    .replace(/^\s{0,3}>+\s?/gm, ' ')
    .replace(/[*_~|]+/g, '')
    .replace(/[>`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > limit ? `${plain.slice(0, limit).trimEnd()}…` : plain;
}
