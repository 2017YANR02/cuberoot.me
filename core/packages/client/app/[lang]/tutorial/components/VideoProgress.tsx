'use client';

import { useRef } from 'react';
import ProgressSlider from '@/components/ProgressSlider';
import { tr } from '@/i18n/tr';
import VideoControls from './VideoControls';
import './video-progress.css';

/** Timeline controls for staged teaching videos, not standalone algorithms. */
export default function VideoProgress({ time, duration, playing, onPlayingChange, onSeek, onReplay }: {
  time: number; duration: number; playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  onSeek: (time: number) => void; onReplay: () => void;
}) {
  const resumeAfterScrub = useRef(false);
  const scrubTime = useRef(time);
  const finished = time >= duration;
  const replay = () => { onReplay(); onPlayingChange(true); };
  return <div className="tutorial-video-progress">
    <VideoControls playing={playing && !finished}
      onTogglePlay={() => { if (finished) replay(); else onPlayingChange(!playing); }} onReplay={replay} />
    <ProgressSlider value={time} max={duration} keyboardStep={500}
      onChange={value => { scrubTime.current = value; onSeek(value); }}
      onInteractionStart={() => { scrubTime.current = time; resumeAfterScrub.current = playing && !finished; onPlayingChange(false); }}
      onInteractionEnd={() => onPlayingChange(resumeAfterScrub.current && scrubTime.current < duration)}
      formatValue={value => tr({ zh: `${(value / 1000).toFixed(1)} 秒`, en: `${(value / 1000).toFixed(1)} seconds` })}
      ariaLabel={tr({ zh: '演示进度', en: 'Animation progress' })} />
  </div>;
}
