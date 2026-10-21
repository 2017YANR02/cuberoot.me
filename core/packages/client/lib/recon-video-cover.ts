// 视频封面解析 + 代理取图(YouTube 直链 / B 站 BV / 抖音)。
// 复盘卡片(ReconCard)与成绩弹窗(AttemptPopover→VideoCoverThumb)共用,避免重复造轮子。
// b23.tv 短链不含 BV id、无法取封面,视作无封面(由调用方渲染回退内容)。

import { getBiliCover, getDouyinCover } from '@/lib/recon-api';

export type CoverKind = 'yt' | 'bili' | 'douyin';
export interface CoverRef { kind: CoverKind; id: string }

/** 单条 URL → 封面引用(yt 直链 id / bili BV / douyin 原 URL);无法取封面 → null。 */
export function videoCoverInfo(url: string): CoverRef | null {
  const u = url.trim();
  if (!u) return null;
  if (/youtu\.?be/i.test(u)) {
    const m = u.match(/(?:v=|youtu\.be\/|\/(?:embed|shorts|live|v)\/)([A-Za-z0-9_-]{6,})/);
    if (m) return { kind: 'yt', id: m[1] };
  }
  const bv = u.match(/(BV[A-Za-z0-9]+)/);
  if (bv) return { kind: 'bili', id: bv[1] };
  if (/douyin\.com/i.test(u)) return { kind: 'douyin', id: u };
  return null;
}

// 保留全部候选，首选接口或图片失败时可继续尝试同条复盘的其他视频。
export function reconCoverCandidates(videoUrl: string | undefined, isZh: boolean): CoverRef[] {
  const covers: CoverRef[] = [];
  const seen = new Set<string>();
  for (const line of videoUrl?.split('\n') ?? []) {
    const info = videoCoverInfo(line);
    if (!info) continue;
    const key = `${info.kind}:${info.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    covers.push(info);
  }
  const order: CoverKind[] = isZh ? ['bili', 'douyin', 'yt'] : ['yt', 'bili', 'douyin'];
  return covers.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

export function pickReconCover(videoUrl: string | undefined, isZh: boolean): CoverRef | null {
  return reconCoverCandidates(videoUrl, isZh)[0] ?? null;
}

/** YouTube 封面有直链规律;B 站/抖音需走后端代理(模块级缓存按 key 去重,避免重复拉取)。 */
export function coverSyncSrc(cover: CoverRef): string | null {
  return cover.kind === 'yt' ? `https://img.youtube.com/vi/${cover.id}/mqdefault.jpg` : null;
}

/** Only known thumbnail providers; leave signed/unknown CDN URLs untouched. */
export function coverPreviewSrc(cover: CoverRef | null, src: string): string | null {
  if (cover?.kind === 'yt') return `https://img.youtube.com/vi/${cover.id}/default.jpg`;
  if (cover?.kind !== 'bili') return null;
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || !/(^|\.)hdslb\.com$/.test(url.hostname)) return null;
    url.pathname = `${url.pathname.split('@')[0]}@64w_36h_1c.webp`;
    return url.href;
  } catch {
    return null;
  }
}

const biliCoverCache = new Map<string, Promise<Awaited<ReturnType<typeof getBiliCover>> | null>>();
export function loadBiliVideo(bvid: string) {
  let p = biliCoverCache.get(bvid);
  if (!p) {
    p = getBiliCover(bvid).catch(() => null).then(video => {
      if (!video?.pic && !video?.title) biliCoverCache.delete(bvid);
      return video;
    });
    biliCoverCache.set(bvid, p);
  }
  return p;
}

export function loadBiliCover(bvid: string): Promise<string | null> {
  return loadBiliVideo(bvid).then(video => video?.pic || null);
}

const videoTitleCache = new Map<string, Promise<string | null>>();
/** Titles are source metadata, not translated labels or titles inferred from a solve. */
export function loadVideoTitle(url: string): Promise<string | null> {
  const cover = videoCoverInfo(url);
  if (!cover || cover.kind === 'douyin') return Promise.resolve(null);
  const key = `${cover.kind}:${cover.id}`;
  let pending = videoTitleCache.get(key);
  if (!pending) {
    pending = (cover.kind === 'bili'
      ? loadBiliVideo(cover.id).then(video => video?.title || null)
      : fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${cover.id}`)}&format=json`, {
        signal: AbortSignal.timeout(8000), credentials: 'omit',
      }).then(async response => {
        if (!response.ok) return null;
        const data = await response.json() as { title?: unknown };
        return typeof data.title === 'string' ? data.title : null;
      }))
      .catch(() => null).then(title => {
        if (!title) videoTitleCache.delete(key);
        return title;
      });
    videoTitleCache.set(key, pending);
  }
  return pending;
}

const douyinCoverCache = new Map<string, Promise<string | null>>();
export function loadDouyinCover(url: string): Promise<string | null> {
  let p = douyinCoverCache.get(url);
  if (!p) {
    p = getDouyinCover(url).then((r) => r.pic || null).catch(() => null).then(pic => {
      if (!pic) douyinCoverCache.delete(url);
      return pic;
    });
    douyinCoverCache.set(url, p);
  }
  return p;
}
