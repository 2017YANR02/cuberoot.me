'use client';

import { useEffect, useRef } from 'react';

const WIDTH = 144;
const HEIGHT = 81;

/** Decode on a separate media element so preview seeks never move the playing video. */
export function VideoSourceFilmstrip({ source, start = 0, end, thumbnails, count = 10 }: {
  source?: string | File;
  start?: number;
  end?: number;
  thumbnails?: string[];
  count?: number;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const cached = thumbnails?.length === count && Array.from(thumbnails).every(Boolean);
  useEffect(() => {
    if (cached || !source) return;
    const tiles = strip.current?.querySelectorAll('canvas');
    if (!tiles?.length) return;
    const video = document.createElement('video');
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    let tile = 0;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    function release() {
      video.onloadedmetadata = video.onseeked = video.onerror = null;
      if (video.hasAttribute('src')) {
        video.removeAttribute('src');
        video.load();
        if (typeof source !== 'string') URL.revokeObjectURL(url);
      }
    }
    function seek() {
      const limit = Math.min(end ?? video.duration, video.duration);
      if (!Number.isFinite(limit) || limit <= start) { release(); return; }
      video.currentTime = start + (limit - start) * (tile + 0.5) / count;
    }
    video.onloadedmetadata = seek;
    video.onseeked = () => {
      if (!video.videoWidth || !video.videoHeight) { release(); return; }
      const ratio = Math.min(video.videoWidth / WIDTH, video.videoHeight / HEIGHT);
      const w = WIDTH * ratio, h = HEIGHT * ratio;
      tiles[tile].getContext('2d')?.drawImage(video, (video.videoWidth - w) / 2, (video.videoHeight - h) / 2, w, h, 0, 0, WIDTH, HEIGHT);
      if (++tile < count) seek();
      else release();
    };
    video.onerror = release;
    video.src = url;
    return release;
  }, [source, start, end, cached, count]);
  return <div ref={strip} className="video-source-filmstrip" aria-hidden="true">
    {cached ? thumbnails.map((src, index) => <img key={index} src={src} alt="" draggable={false} />)
      : Array.from({ length: count }, (_, index) => <canvas key={index} width={WIDTH} height={HEIGHT} />)}
  </div>;
}
