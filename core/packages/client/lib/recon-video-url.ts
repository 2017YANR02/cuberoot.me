import { videoCoverInfo } from '@/lib/recon-video-cover';

/** Canonicalize known video links without changing uploads or other providers. */
export function normalizeReconVideoUrls(value: string): string {
  return value.split('\n').map(line => {
    const text = line.trim();
    let url: URL;
    try { url = new URL(text); } catch { return line; }
    if (!['https:', 'http:'].includes(url.protocol)) return line;
    const info = videoCoverInfo(text);
    let canonical: URL;
    let retained: string[];
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'].includes(url.hostname)
      && info?.kind === 'yt' && /^[A-Za-z0-9_-]{11}$/.test(info.id)) {
      canonical = new URL(`https://youtu.be/${info.id}`);
      retained = ['t', 'start', 'end'];
    } else if (['bilibili.com', 'www.bilibili.com', 'm.bilibili.com'].includes(url.hostname)
      && /^\/video\/(BV[A-Za-z0-9]+|av\d+)\/?$/.test(url.pathname)) {
      canonical = new URL(`https://www.bilibili.com${url.pathname.replace(/\/$/, '')}`);
      retained = ['p', 't', 'start_progress'];
    } else return line;
    for (const key of retained) {
      const parameter = url.searchParams.get(key);
      if (parameter) canonical.searchParams.set(key, parameter);
    }
    if (/^#t=/.test(url.hash)) canonical.hash = url.hash;
    return canonical.toString();
  }).join('\n');
}

/** Blank lines separate independent videos; lines within a group are alternate
 * sources for the same video. Legacy single-block values retain their meaning.
 * Keep empty groups while editing so Add video can create an empty input. */
export function splitReconVideoGroups(value: string): string[] {
  return value.replace(/\r\n?/g, '\n').split(/\n[\t ]*\n/);
}

export function reconVideoGroups(value: string): string[][] {
  return splitReconVideoGroups(value)
    .map(group => [...new Set(group.split('\n').map(url => url.trim()).filter(Boolean))])
    .filter(group => group.length > 0);
}

/** Uploads are independent videos unless the author explicitly groups them. */
export function appendReconVideo(value: string, url: string): string {
  const groups = reconVideoGroups(value);
  if (groups.some(group => group.includes(url))) return value;
  return [...groups.map(group => group.join('\n')), url].join('\n\n');
}
