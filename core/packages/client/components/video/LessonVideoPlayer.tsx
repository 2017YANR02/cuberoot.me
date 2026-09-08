'use client';

import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { AudioLines, Check, ChevronLeft, ChevronRight, Gauge, Maximize, Minimize, Moon, Pause, PictureInPicture2, Play, Settings, SlidersHorizontal, Subtitles, Volume1, Volume2, VolumeX } from 'lucide-react';
import BoolToggle from '@/components/BoolToggle';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { useT } from '@/hooks/useT';
import './lesson-video-player.css';

interface Props {
  src: string;
  onError: (event: SyntheticEvent<HTMLVideoElement>) => void;
  onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
  autoContinue?: boolean;
  onAutoContinueChange?: (enabled: boolean) => void;
  onNext?: () => void;
  autoPlay?: boolean;
}

function timeLabel(time: number) {
  const seconds = Number.isFinite(time) ? Math.max(0, Math.floor(time)) : 0;
  const minutes = Math.floor(seconds / 60);
  return `${minutes >= 60 ? `${Math.floor(minutes / 60)}:` : ''}${minutes >= 60 ? String(minutes % 60).padStart(2, '0') : minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function LessonVideoPlayer({ src, onError, onLoadedMetadata, autoContinue = false, onAutoContinueChange, onNext, autoPlay = false }: Props) {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [menu, setMenu] = useState<'main' | 'speed' | 'sleep' | 'quality' | null>(null);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [canPip, setCanPip] = useState(false);
  const [resolution, setResolution] = useState(0);
  const [notice, setNotice] = useState('');
  usePanelClamp(menu !== null, panel);

  const reveal = () => {
    setVisible(true);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setVisible(false), 2600);
  };
  useEffect(() => () => { if (idle.current) clearTimeout(idle.current); }, []);
  useEffect(() => {
    setCanPip(Boolean(document.pictureInPictureEnabled));
    const element = video.current;
    const enterPip = () => setPip(true);
    const leavePip = () => setPip(false);
    element?.addEventListener('enterpictureinpicture', enterPip);
    element?.addEventListener('leavepictureinpicture', leavePip);
    const changed = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', changed);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      element?.removeEventListener('enterpictureinpicture', enterPip);
      element?.removeEventListener('leavepictureinpicture', leavePip);
    };
  }, []);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !settingsButton.current?.contains(event.target as Node)) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu(null); settingsButton.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menu]);
  useEffect(() => {
    if (sleepMinutes <= 0) return;
    const timeout = setTimeout(() => { video.current?.pause(); setSleepMinutes(0); setNotice(t('休眠定时器已暂停播放', 'Sleep timer paused playback')); }, sleepMinutes * 60_000);
    return () => clearTimeout(timeout);
  }, [sleepMinutes]); // The selected timer starts once; rendering does not restart it.
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timeout);
  }, [notice]);

  const togglePlay = async () => {
    const element = video.current;
    if (!element) return;
    if (!element.paused) element.pause();
    else try { await element.play(); } catch { setNotice(t('无法开始播放，请重试', 'Could not start playback. Try again.')); }
    reveal();
  };
  const seek = (time: number) => {
    // Unknown/live duration and non-finite input cannot be seeked safely.
    if (!video.current || !Number.isFinite(time) || duration <= 0) return;
    video.current.currentTime = Math.min(duration, Math.max(0, time));
    setCurrent(video.current.currentTime);
  };
  const toggleMute = () => { if (video.current) video.current.muted = !video.current.muted; };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else {
        const element = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
        if (element?.webkitEnterFullscreen) element.webkitEnterFullscreen();
        else setNotice(t('此浏览器不支持全屏', 'Fullscreen is unavailable in this browser'));
      }
    } catch { setNotice(t('无法进入全屏', 'Could not enter fullscreen')); }
  };
  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.current?.requestPictureInPicture();
    } catch { setNotice(t('画中画暂时不可用', 'Picture-in-picture is currently unavailable')); }
  };
  const screenshot = () => {
    const element = video.current;
    if (!element?.videoWidth || element.readyState < 2) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = element.videoWidth; canvas.height = element.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(element, 0, 0);
      const link = document.createElement('a');
      link.download = `lesson-${Math.floor(element.currentTime)}.png`;
      link.href = canvas.toDataURL('image/png'); link.click();
    } catch { setNotice(t('当前视频源不允许截图', 'This video source does not allow screenshots')); }
  };
  const quality = resolution ? `${resolution}p` : t('原画', 'Original');
  const speed = rate === 1 ? t('正常', 'Normal') : `${rate}×`;
  const sleep = sleepMinutes ? t(`${sleepMinutes} 分钟`, `${sleepMinutes} minutes`) : t('关闭', 'Off');
  const unavailable = t('当前视频不提供此功能', 'This feature is unavailable for this video');
  const controlsVisible = visible || !playing || menu !== null;

  return <div ref={root} className={`lesson-video-player${controlsVisible ? ' controls-visible' : ''}`} tabIndex={0}
    aria-label={t('视频播放器', 'Video player')} onPointerMove={reveal} onPointerDown={reveal} onFocus={reveal}
    onKeyDown={event => {
      if (event.target instanceof HTMLElement && event.target.closest('button, input, [role="dialog"]')) return;
      if (event.key === ' ' || event.key.toLowerCase() === 'k') { event.preventDefault(); void togglePlay(); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); seek(current + (event.key === 'ArrowLeft' ? -5 : 5)); reveal(); }
      else if (event.key.toLowerCase() === 'm') toggleMute();
      else if (event.key.toLowerCase() === 'f') void toggleFullscreen();
    }}>
    <video ref={video} src={src} playsInline preload="metadata" autoPlay={autoPlay} onError={onError}
      onLoadedMetadata={event => {
        const element = event.currentTarget;
        setDuration(Number.isFinite(element.duration) ? element.duration : 0);
        setResolution(element.videoHeight); onLoadedMetadata(event);
      }}
      onDurationChange={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onTimeUpdate={event => setCurrent(event.currentTarget.currentTime)}
      onProgress={event => { const element = event.currentTarget; if (element.buffered.length) setBuffered(element.buffered.end(element.buffered.length - 1)); }}
      onVolumeChange={event => { setVolume(event.currentTarget.volume); setMuted(event.currentTarget.muted); }}
      onRateChange={event => setRate(event.currentTarget.playbackRate)}
      onPlay={() => { setPlaying(true); reveal(); }} onPause={() => setPlaying(false)}
      onEnded={() => { setPlaying(false); if (autoContinue && sleepMinutes === 0) onNext?.(); }} />
    <button type="button" className="lesson-video-surface" aria-label={playing ? t('暂停视频', 'Pause video') : t('播放视频', 'Play video')}
      tabIndex={-1} onClick={() => void togglePlay()} onDoubleClick={() => void toggleFullscreen()} />
    {notice && <div className="lesson-video-notice" role="status">{notice}</div>}
    <div className="lesson-video-controls" onPointerMove={event => { event.stopPropagation(); setVisible(true); if (idle.current) clearTimeout(idle.current); }} onPointerLeave={reveal}>
      <div className="lesson-video-progress" style={{ '--played': `${duration ? current / duration * 100 : 0}%`, '--buffered': `${duration ? Math.min(100, buffered / duration * 100) : 0}%` } as CSSProperties}>
        <input type="range" aria-label={t('播放进度', 'Playback position')} aria-valuetext={`${timeLabel(current)} / ${timeLabel(duration)}`}
          min={0} max={duration || 1} step={0.1} value={Math.min(current, duration || 1)} disabled={!duration} onChange={event => seek(Number(event.target.value))} />
      </div>
      <div className="lesson-video-toolbar">
        <div className="lesson-video-left">
          <button type="button" className="lesson-video-icon" data-tooltip={playing ? t('暂停 (k)', 'Pause (k)') : t('播放 (k)', 'Play (k)')} aria-label={playing ? t('暂停', 'Pause') : t('播放', 'Play')} onClick={() => void togglePlay()}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
          <div className="lesson-video-volume">
            <button type="button" className="lesson-video-icon" data-tooltip={muted ? t('取消静音 (m)', 'Unmute (m)') : t('静音 (m)', 'Mute (m)')} aria-label={muted ? t('取消静音', 'Unmute') : t('静音', 'Mute')} onClick={toggleMute}>{muted || volume === 0 ? <VolumeX /> : volume < 0.5 ? <Volume1 /> : <Volume2 />}</button>
            <input type="range" aria-label={t('音量', 'Volume')} min={0} max={1} step={0.05} value={muted ? 0 : volume}
              style={{ '--volume': `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
              onChange={event => { if (video.current) { video.current.volume = Number(event.target.value); video.current.muted = false; } }} />
          </div>
          <span className="lesson-video-time">{timeLabel(current)} / {timeLabel(duration)}</span>
        </div>
        <div className="lesson-video-right">
          <button type="button" className="lesson-video-capture" onClick={screenshot} disabled={!resolution} data-tooltip={t('截图', 'Screenshot')}>Screenshot</button>
          {onAutoContinueChange && <span className="lesson-video-autoplay" data-tooltip={autoContinue ? t('自动播放模式已开启', 'Autoplay is on') : t('自动播放模式已关闭', 'Autoplay is off')}>
            <BoolToggle value={autoContinue} onChange={onAutoContinueChange} ariaLabel={t('自动播放下一课', 'Autoplay next lesson')} label={autoContinue ? <Play size={10} fill="currentColor" /> : <Pause size={10} fill="currentColor" />} />
          </span>}
          <button type="button" className="lesson-video-icon" aria-label={t('字幕不可用', 'Subtitles unavailable')} disabled title={t('此视频没有字幕', 'This video has no subtitles')}><Subtitles /></button>
          <button ref={settingsButton} type="button" className={`lesson-video-icon lesson-video-settings${menu ? ' is-open' : ''}`} aria-label={t('设置', 'Settings')} aria-expanded={menu !== null} aria-haspopup="dialog" data-tooltip={t('设置', 'Settings')} onClick={() => setMenu(menu ? null : 'main')}><Settings /></button>
          {canPip && <button type="button" className="lesson-video-icon lesson-video-pip" aria-label={t('画中画', 'Picture-in-picture')} aria-pressed={pip} data-tooltip={t('画中画', 'Picture-in-picture')} onClick={() => void togglePip()}><PictureInPicture2 /></button>}
          <button type="button" className="lesson-video-icon" aria-label={fullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏', 'Fullscreen')} data-tooltip={fullscreen ? t('退出全屏 (f)', 'Exit fullscreen (f)') : t('全屏 (f)', 'Fullscreen (f)')} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize /> : <Maximize />}</button>
        </div>
      </div>
    </div>
    {menu && <div ref={panel} className="lesson-video-menu" role="dialog" aria-label={t('播放设置', 'Playback settings')}>
      {menu === 'main' ? <>
        <div className="lesson-video-menu-row is-unavailable" title={unavailable}><AudioLines /><span>{t('稳定音量', 'Stable volume')}</span><BoolToggle value={false} onChange={() => {}} label="" ariaLabel={t('稳定音量不可用', 'Stable volume unavailable')} disabled /></div>
        <div className="lesson-video-menu-row is-unavailable" title={unavailable}><Volume2 /><span>{t('语音增强', 'Voice boost')}</span><BoolToggle value={false} onChange={() => {}} label="" ariaLabel={t('语音增强不可用', 'Voice boost unavailable')} disabled /></div>
        <button type="button" className="lesson-video-menu-row" disabled><Subtitles /><span>{t('字幕', 'Subtitles')}</span><small>{t('不可用', 'Unavailable')}</small></button>
        <button type="button" className="lesson-video-menu-row" onClick={() => setMenu('sleep')}><Moon /><span>{t('休眠定时器', 'Sleep timer')}</span><small>{sleep}</small><ChevronRight /></button>
        <button type="button" className="lesson-video-menu-row" onClick={() => setMenu('speed')}><Gauge /><span>{t('播放速度', 'Playback speed')}</span><small>{speed}</small><ChevronRight /></button>
        <button type="button" className="lesson-video-menu-row" onClick={() => setMenu('quality')}><SlidersHorizontal /><span>{t('画质', 'Quality')}</span><small>{quality}</small><ChevronRight /></button>
      </> : <>
        <button type="button" className="lesson-video-menu-back" onClick={() => setMenu('main')}><ChevronLeft />{menu === 'speed' ? t('播放速度', 'Playback speed') : menu === 'sleep' ? t('休眠定时器', 'Sleep timer') : t('画质', 'Quality')}</button>
        {menu === 'speed' && [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(value => <button type="button" className="lesson-video-option" key={value} aria-pressed={rate === value} onClick={() => { if (video.current) video.current.playbackRate = value; setMenu('main'); }}><Check visibility={rate === value ? 'visible' : 'hidden'} />{value === 1 ? t('正常', 'Normal') : `${value}×`}</button>)}
        {menu === 'sleep' && [0, 10, 15, 20, 30, 45, 60].map(value => <button type="button" className="lesson-video-option" key={value} aria-pressed={sleepMinutes === value} onClick={() => { setSleepMinutes(value); setMenu('main'); }}><Check visibility={sleepMinutes === value ? 'visible' : 'hidden'} />{value ? t(`${value} 分钟`, `${value} minutes`) : t('关闭', 'Off')}</button>)}
        {menu === 'quality' && <><button type="button" className="lesson-video-option" aria-pressed="true" onClick={() => setMenu('main')}><Check />{t('原画', 'Original')} {resolution ? `${resolution}p` : ''}</button><p className="lesson-video-menu-note">{t('当前视频仅提供原始画质', 'Only the original quality is available for this video')}</p></>}
      </>}
    </div>}
  </div>;
}
