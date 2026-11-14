'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { tr } from '@/i18n/tr';
import '@/components/PlaybackBar.css';

/** Controls for the F2L lesson timeline, independent of its cube players. */
export default function VideoControls({ playing, disabled, onTogglePlay, onReplay }: {
  playing: boolean; disabled?: boolean; onTogglePlay: () => void; onReplay: () => void;
}) {
  const playLabel = tr(playing ? { zh: '暂停', en: 'Pause' } : { zh: '播放', en: 'Play' });
  const replayLabel = tr({ zh: '重播', en: 'Replay' });
  return <div className="playback-bar-controls f2l-video-controls">
      <button type="button" className="playback-bar-btn" aria-label={playLabel} disabled={disabled} onClick={onTogglePlay}>
        {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      </button>
      <button type="button" className="playback-bar-btn" aria-label={replayLabel} disabled={disabled} onClick={onReplay}>
        <RotateCcw size={14} aria-hidden="true" />
      </button>
  </div>;
}
