import { useState } from 'react';
import dynamic from 'next/dynamic';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import type { TimerReplay as ReplayClip } from '@/lib/video-recon/engine/timer-replay';

const TimerReplay = dynamic(() => import('../../video-recon/TimerReplay').then(module => module.TimerReplay), { ssr: false });
const ignorePosition = () => {};

export default function CameraSourceReplay({ clip }: { clip: ReplayClip }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!clip.reconstruction || clip.missingImages === clip.frames.length) return null;
  return <details data-no-timer onToggle={event => setOpen(event.currentTarget.open)}>
    <MoreToggle as="summary">{t('查看相机画面', 'View camera footage')}</MoreToggle>
    {open && <TimerReplay clip={clip} reconstruction={clip.reconstruction} onPosition={ignorePosition} sourceOnly />}
  </details>;
}
