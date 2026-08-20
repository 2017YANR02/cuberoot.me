'use client';

import { Video } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { forumVideoUrl, type ForumVideo } from '@/lib/forum-api';
import './forum-video.css';

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.ceil(durationMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ForumVideoPlayer({ video, src }: { video: ForumVideo; src?: string }) {
  return (
    <figure className="forum-video">
      <video
        src={src ?? forumVideoUrl(video.token)}
        controls
        playsInline
        preload="metadata"
        aria-label={tr({ zh: '论坛视频', en: 'Forum video' })}
      />
      <figcaption>
        <Video size={13} aria-hidden="true" />
        {formatDuration(video.durationMs)}
      </figcaption>
    </figure>
  );
}
