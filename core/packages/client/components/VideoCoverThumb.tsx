'use client';
// 单条视频链接 → 小封面缩略图(可点开外链)。成绩弹窗 AttemptPopover 的「比赛视频」区用。
// 封面解析/代理取图复用 lib/recon-video-cover(与复盘卡片同一份);无封面(b23 短链/其他平台)→ 占位图标。
// 外链用真 <a target=_blank>(中键可开),stopPropagation 防冒泡关弹窗。样式见 result-change.css 的 .att-vid-*。

import { useEffect, useMemo, useState } from 'react';
import { Video } from 'lucide-react';
import { videoCoverInfo, coverSyncSrc, loadBiliCover, loadDouyinCover } from '@/lib/recon-video-cover';

export function VideoCoverThumb({ url, pending, pendingLabel }: {
  url: string;
  pending?: boolean;
  pendingLabel?: string;
}) {
  const cover = useMemo(() => videoCoverInfo(url), [url]);
  const ytSrc = cover ? coverSyncSrc(cover) : null;
  const [asyncSrc, setAsyncSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAsyncSrc(null);
    setFailed(false);
    if (cover?.kind !== 'bili' && cover?.kind !== 'douyin') return;
    let alive = true;
    const loader = cover.kind === 'bili' ? loadBiliCover(cover.id) : loadDouyinCover(cover.id);
    void loader.then((pic) => {
      if (!alive) return;
      if (pic) setAsyncSrc(pic); else setFailed(true);
    });
    return () => { alive = false; };
  }, [cover]);

  const imgSrc = failed ? null : (ytSrc ?? asyncSrc);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="att-vid-thumb"
      title={url}
      onClick={(e) => e.stopPropagation()}
    >
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="att-vid-thumb-img" src={imgSrc} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="att-vid-thumb-fallback"><Video size={26} /></span>
      )}
      {pending && <span className="att-vid-thumb-pending">{pendingLabel ?? '…'}</span>}
    </a>
  );
}
