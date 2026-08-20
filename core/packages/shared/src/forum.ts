/**
 * 论坛短视频的唯一时长配置入口。客户端预检与服务端容器校验都必须引用这里。
 * 用户说“论坛视频时长限制改成 X”时只改这个值。
 */
export const FORUM_VIDEO_MAX_DURATION_SECONDS = 20;
export const FORUM_VIDEO_MAX_DURATION_MS = FORUM_VIDEO_MAX_DURATION_SECONDS * 1000;

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

/** Extract safe, displayable image URLs for the compact forum feed media grid. */
export function imageUrlsFromMarkdown(markdown: string, maxImages = 4): string[] {
  const limit = Number.isInteger(maxImages) && maxImages > 0 ? maxImages : 4;
  const urls: string[] = [];
  const seen = new Set<string>();
  const image = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g;
  for (const match of markdown.matchAll(image)) {
    const url = (match[1] ?? match[2] ?? '').trim();
    if (!/^(?:https?:\/\/|\/[^/])/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= limit) break;
  }
  return urls;
}
