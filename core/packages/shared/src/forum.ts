/**
 * 论坛短视频的唯一时长配置入口。客户端预检与服务端容器校验都必须引用这里。
 * 用户说“论坛视频时长限制改成 X”时只改这个值。
 */
export const FORUM_VIDEO_MAX_DURATION_SECONDS = 20;
export const FORUM_VIDEO_MAX_DURATION_MS = FORUM_VIDEO_MAX_DURATION_SECONDS * 1000;

/** Plain-text preview shared by forum API responses and server-rendered SEO. */
export function excerptFromMarkdown(markdown: string, maxLength = 120): string {
  const limit = Number.isInteger(maxLength) && maxLength > 0 ? maxLength : 120;
  const plain = stripMarkdownLinks(stripMarkdownLinks(markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' '), true))
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
  // Precompute delimiter boundaries once; failed/nested image prefixes must not
  // rescan the remainder of a post for each possible opening bracket.
  const n = markdown.length;
  const nonSpace = new Int32Array(n + 1);
  const urlEnd = new Int32Array(n + 1);
  const angleEnd = new Int32Array(n + 1);
  const quoteEnd = new Int32Array(n + 1);
  nonSpace[n] = urlEnd[n] = angleEnd[n] = quoteEnd[n] = n;
  for (let i = n - 1; i >= 0; i--) {
    const c = markdown[i];
    const space = /\s/.test(c);
    nonSpace[i] = space ? nonSpace[i + 1] : i;
    urlEnd[i] = space || c === ')' ? i : urlEnd[i + 1];
    angleEnd[i] = c === '>' ? i : angleEnd[i + 1];
    quoteEnd[i] = c === '"' || c === "'" ? i : quoteEnd[i + 1];
  }
  const closeImage = (end: number): number => {
    let cursor = nonSpace[end];
    if (cursor > end && (markdown[cursor] === '"' || markdown[cursor] === "'")) {
      const quote = quoteEnd[cursor + 1];
      if (quote < n && markdown[nonSpace[quote + 1]] === ')') return nonSpace[quote + 1] + 1;
    }
    return markdown[cursor] === ')' ? cursor + 1 : -1;
  };
  let cursor = 0;
  while (cursor < n) {
    const open = markdown.indexOf('![', cursor);
    if (open < 0) break;
    const bracket = markdown.indexOf(']', open + 2);
    if (bracket < 0) break;
    cursor = bracket + 1;
    if (markdown[cursor] !== '(') continue;
    const begin = nonSpace[cursor + 1];
    let url = '';
    let end = -1;
    if (markdown[begin] === '<' && angleEnd[begin + 1] > begin + 1 && angleEnd[begin + 1] < n) {
      end = closeImage(angleEnd[begin + 1] + 1);
      if (end >= 0) url = markdown.slice(begin + 1, angleEnd[begin + 1]);
    }
    if (end < 0 && urlEnd[begin] > begin) {
      end = closeImage(urlEnd[begin]);
      if (end >= 0) url = markdown.slice(begin, urlEnd[begin]);
    }
    if (end < 0) continue;
    cursor = end;
    url = url.trim();
    if (!/^(?:https?:\/\/|\/[^/])/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= limit) break;
  }
  return urls;
}

function stripMarkdownLinks(text: string, imagesOnly = false): string {
  let result = '';
  let cursor = 0;
  let search = 0;
  while (search < text.length) {
    const open = text.indexOf(imagesOnly ? '![' : '[', search);
    if (open < 0) break;
    const labelStart = open + (imagesOnly ? 2 : 1);
    const bracket = text.indexOf(']', labelStart);
    if (bracket < 0) break;
    search = bracket + 1;
    if (text[search] !== '(') continue;
    const close = text.indexOf(')', search + 1);
    if (close < 0) break;
    result += text.slice(cursor, open) + (imagesOnly ? ' ' : text.slice(labelStart, bracket));
    cursor = search = close + 1;
  }
  return result + text.slice(cursor);
}
