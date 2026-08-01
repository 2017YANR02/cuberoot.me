'use client';

// 公式讲解视频的站内播放器。上游是在起手那一格点开的浮层,这里做成公式行上的一个图标。
//
// 源有三种:抖音 / Google Drive / YouTube,同一条公式常常几种都有(1363 条带视频,743 条
// 不止一个源)。上游的做法是探测「是不是在墙内」然后只留抖音;这里不发探测请求 ——
// 按界面语言把源排个序(中文优先抖音),三个源都留着让人自己翻,打不开就下一个。

import { useEffect, useState, type JSX } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import type { AlgToUrl } from '../_lib/blddb';

type Video = AlgToUrl[string][number];

/** 源的显示名 —— 打不开时至少知道该翻到哪个。 */
function sourceName(url: string): string {
  if (url.includes('douyin')) return tr({ zh: '抖音', en: 'Douyin' });
  if (url.includes('youtube')) return 'YouTube';
  if (url.includes('drive.google')) return 'Google Drive';
  try {
    return new URL(url).host;
  } catch {
    return tr({ zh: '视频', en: 'Video' });
  }
}

/** 中文界面把抖音排前面(墙内只有它稳),英文界面反过来。 */
export function orderVideos(videos: readonly Video[], isZh: boolean): Video[] {
  const rank = (v: Video) => (v.url.includes('douyin') ? (isZh ? 0 : 1) : (isZh ? 1 : 0));
  return [...videos].sort((a, b) => rank(a) - rank(b));
}

interface Props {
  alg: string;
  videos: Video[];
  onClose: () => void;
}

export function AlgVideoModal({ alg, videos, onClose }: Props): JSX.Element | null {
  const [index, setIndex] = useState(0);
  useModalDismiss(onClose);

  // 换源要重建 iframe,否则某些播放器不认新 src。
  const current = videos[index];
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!current) return;
    const vw = Number(current.width) || 16;
    const vh = Number(current.height) || 9;
    const fit = () => {
      // 竖屏源(抖音 324x666)在手机上按宽铺满,横屏源按高;两边都留一成余量。
      const maxW = window.innerWidth * 0.9;
      const maxH = window.innerHeight * 0.82;
      const scale = Math.min(maxW / vw, maxH / vh);
      setBox({ w: Math.round(vw * scale), h: Math.round(vh * scale) });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [current]);

  if (!current) return null;

  return (
    <div className="bld-db-video-backdrop" onClick={onClose} role="presentation">
      <div
        className="bld-db-video-panel"
        style={box ? { width: box.w, height: box.h } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={tr({ zh: `${alg} 的讲解视频`, en: `Video for ${alg}` })}
      >
        <iframe
          key={current.url}
          src={current.url}
          title={alg}
          allow="autoplay; fullscreen"
          sandbox="allow-same-origin allow-scripts allow-popups"
        />
        {videos.length > 1 && (
          <>
            <button
              type="button"
              className="bld-db-video-nav is-prev"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              aria-label={tr({ zh: '上一个源', en: 'Previous source' })}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="bld-db-video-nav is-next"
              disabled={index === videos.length - 1}
              onClick={() => setIndex((i) => Math.min(videos.length - 1, i + 1))}
              aria-label={tr({ zh: '下一个源', en: 'Next source' })}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      <div className="bld-db-video-bar" onClick={(e) => e.stopPropagation()} role="presentation">
        <span className="bld-db-video-alg">{alg}</span>
        <span className="bld-db-video-source">
          {sourceName(current.url)}
          {videos.length > 1 && ` ${index + 1}/${videos.length}`}
        </span>
        <a href={current.url} target="_blank" rel="noopener noreferrer">
          {tr({ zh: '打不开?去源站', en: 'Open at source' })}
        </a>
        <button
          type="button"
          className="bld-db-video-close"
          onClick={onClose}
          aria-label={tr({ zh: '关闭', en: 'Close' })}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
