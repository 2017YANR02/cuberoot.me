'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { tr } from '@/i18n/tr';
import '@/components/PlaybackBar.css';

/** Controls for the tutorial timeline, independent of its cube players. */
export default function VideoControls({ playing, onTogglePlay, onReplay }: {
  playing: boolean; onTogglePlay: () => void; onReplay: () => void;
}) {
  const playLabel = tr(playing ? { zh: '暂停', en: 'Pause' } : { zh: '播放', en: 'Play' });
  const replayLabel = tr({ zh: '重播', en: 'Replay' });
  return <div className="playback-bar-controls tutorial-video-controls">
      <button type="button" className="playback-bar-btn" aria-label={playLabel} onClick={onTogglePlay}>
        {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      </button>
      <button type="button" className="playback-bar-btn" aria-label={replayLabel} onClick={onReplay}>
        <RotateCcw size={14} aria-hidden="true" />
      </button>
  </div>;
}
