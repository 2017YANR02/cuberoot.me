'use client';

import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pause, Play, Settings } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { VideoSeekBar } from './VideoSeekBar';
import './lesson-video-player.css';

export function useVideoControlsVisibility(playing: boolean | undefined) {
  const [visible, setVisible] = useState(true);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reveal = useCallback(() => {
    clearTimeout(idle.current);
    setVisible(true);
    idle.current = setTimeout(() => setVisible(false), 2600);
  }, []);
  useEffect(() => {
    if (playing !== undefined) reveal();
    return () => clearTimeout(idle.current);
  }, [playing, reveal]);
  return {
    visible, reveal,
    surfaceEvents: {
      onPointerEnter: reveal, onPointerLeave: reveal, onPointerMove: reveal,
      onPointerDown: reveal, onFocus: reveal,
    },
  };
}

export function VideoSettingsButton({ open, ...props }: ComponentProps<'button'> & { open: boolean }) {
  const t = useT();
  return <button {...props} type="button" className={`lesson-video-button lesson-video-icon lesson-video-settings${open ? ' is-open' : ''}`}
    aria-label={t('设置', 'Settings')} aria-haspopup="dialog" aria-expanded={open}><Settings aria-hidden /></button>;
}

interface Props {
  playing: boolean;
  label?: string;
  visibility: ReturnType<typeof useVideoControlsVisibility>;
  keepVisible?: boolean;
  position: number;
  total: number;
  buffered?: number;
  step: number;
  time: string;
  onSeek: (position: number) => void;
  onPlay: () => void;
  playDisabled?: boolean;
  afterPlay?: ReactNode;
  filmstrip?: ReactNode;
  actions: ReactNode;
}

export function VideoPlaybackControls({ playing, label, visibility, keepVisible, position, total, buffered = 0,
  step, time, onSeek, onPlay, playDisabled, afterPlay, filmstrip, actions }: Props) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const playLabel = playing ? t('暂停', 'Pause') : t('播放', 'Play');
  return <div className="video-player-bottom-overlay lesson-video-controls" role="group" aria-label={label ?? t('视频播放控件', 'Video playback controls')}
    data-visible={visibility.visible || hovered || !!keepVisible}
    onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(true); }}
    onPointerMove={event => event.stopPropagation()}
    onPointerLeave={() => { setHovered(false); visibility.reveal(); }}>
    <VideoSeekBar position={position} total={total} buffered={buffered} step={step} time={time} onSeek={onSeek} filmstrip={filmstrip} />
    <div className="lesson-video-toolbar">
      <div className="lesson-video-left">
        <button type="button" className="lesson-video-button lesson-video-icon"
          aria-label={playLabel} onClick={onPlay} disabled={playDisabled}>
          {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        </button>
        {afterPlay}
        <span className="lesson-video-time">{time}</span>
      </div>
      <div className="lesson-video-right">{actions}</div>
    </div>
  </div>;
}
