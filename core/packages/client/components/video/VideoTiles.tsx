'use client';
import Tiles from '@cuberoot/timer-ui/video/VideoTiles';
import { tr } from '@/i18n/tr';
export default function VideoTiles(props: { onLeave(): void; onCameraError(): void }) {
  return <Tiles {...props} language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'} />;
}
