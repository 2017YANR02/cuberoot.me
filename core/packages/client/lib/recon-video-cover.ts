// 视频封面解析 + 代理取图(YouTube 直链 / B 站 BV / 抖音)。
// 复盘卡片(ReconCard)与成绩弹窗(AttemptPopover→VideoCoverThumb)共用,避免重复造轮子。
// b23.tv 短链不含 BV id、无法取封面,视作无封面(回退占位)。

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

// videoUrl 多行。按语言挑能出封面的视频:中文优先 B 站、英文优先 YouTube;
// 首选平台没有就退而用另一平台;两者皆无 → null(回退打乱图)。
export function pickReconCover(videoUrl: string | undefined, isZh: boolean): CoverRef | null {
  if (!videoUrl) return null;
  let yt: CoverRef | null = null;
  let bili: CoverRef | null = null;
  let douyin: CoverRef | null = null;
  for (const line of videoUrl.split('\n')) {
    const info = videoCoverInfo(line);
    if (!info) continue;
    if (info.kind === 'yt' && !yt) yt = info;
    else if (info.kind === 'bili' && !bili) bili = info;
    else if (info.kind === 'douyin' && !douyin) douyin = info;
  }
  const order: CoverKind[] = isZh ? ['bili', 'douyin', 'yt'] : ['yt', 'bili', 'douyin'];
  for (const k of order) {
    if (k === 'yt' && yt) return yt;
    if (k === 'bili' && bili) return bili;
    if (k === 'douyin' && douyin) return douyin;
  }
  return null;
}

/** YouTube 封面有直链规律;B 站/抖音需走后端代理(模块级缓存按 key 去重,避免重复拉取)。 */
export function coverSyncSrc(cover: CoverRef): string | null {
  return cover.kind === 'yt' ? `https://img.youtube.com/vi/${cover.id}/mqdefault.jpg` : null;
}

const biliCoverCache = new Map<string, Promise<string | null>>();
export function loadBiliCover(bvid: string): Promise<string | null> {
  let p = biliCoverCache.get(bvid);
  if (!p) {
    p = getBiliCover(bvid).then((r) => r.pic || null).catch(() => null);
    biliCoverCache.set(bvid, p);
  }
  return p;
}

const douyinCoverCache = new Map<string, Promise<string | null>>();
export function loadDouyinCover(url: string): Promise<string | null> {
  let p = douyinCoverCache.get(url);
  if (!p) {
    p = getDouyinCover(url).then((r) => r.pic || null).catch(() => null);
    douyinCoverCache.set(url, p);
  }
  return p;
}
