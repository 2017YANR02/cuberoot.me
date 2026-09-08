'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { AudioLines, Bug, Check, ChevronLeft, ChevronRight, CircleHelp, Code, Gauge, Info, Keyboard, Link, Maximize, Minimize, Moon, Pause, PictureInPicture2, Play, RectangleHorizontal, Repeat2, Settings, SlidersHorizontal, Subtitles, Volume1, Volume2, VolumeX } from 'lucide-react';
import { browserClipboardTransport } from '@cuberoot/timer-ui';
import { ClearButton } from '@/components/ClearButton';
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
  onPrevious?: () => void;
  autoPlay?: boolean;
  lessonId?: string;
  mediaId?: string;
  mimeType?: string;
  startTime?: number;
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function timeLabel(time: number) {
  const seconds = Number.isFinite(time) ? Math.max(0, Math.floor(time)) : 0;
  const minutes = Math.floor(seconds / 60);
  return `${minutes >= 60 ? `${Math.floor(minutes / 60)}:` : ''}${minutes >= 60 ? String(minutes % 60).padStart(2, '0') : minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function LessonVideoPlayer({ src, onError, onLoadedMetadata, autoContinue = false, onAutoContinueChange, onNext, onPrevious, autoPlay = false, lessonId, mediaId, mimeType, startTime = 0 }: Props) {
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
  const [theater, setTheater] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const shortcutDialog = useRef<HTMLDialogElement>(null);
  const frameDuration = useRef(1 / 30);
  const contextPanel = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [loop, setLoop] = useState(false);
  const [details, setDetails] = useState<'stats' | 'help' | null>(null);
  const [stats, setStats] = useState<ReturnType<typeof readStats> | null>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef({ x: 0, y: 0 });
  const suppressTap = useRef(false);
  const cancelLongPress = () => { if (longPress.current) clearTimeout(longPress.current); };
  useEffect(() => cancelLongPress, []);
  usePanelClamp(menu !== null, panel);
  usePanelClamp(contextMenu !== null, contextPanel);

  useEffect(() => {
    if (!shortcuts) return;
    const dialog = shortcutDialog.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
      else root.current?.focus({ preventScroll: true });
    };
  }, [shortcuts]);
  useEffect(() => {
    const element = video.current;
    frameDuration.current = 1 / 30;
    if (!element?.requestVideoFrameCallback) return;
    let last: VideoFrameCallbackMetadata | null = null;
    let handle = 0;
    const sample: VideoFrameRequestCallback = (_now, metadata) => {
      if (last && !element.paused && !element.seeking) {
        const frames = metadata.presentedFrames - last.presentedFrames;
        const interval = (metadata.mediaTime - last.mediaTime) / frames;
        if (frames > 0 && interval >= 1 / 240 && interval <= 1 / 12) frameDuration.current = interval;
      }
      last = metadata;
      handle = element.requestVideoFrameCallback(sample);
    };
    const reset = () => { last = null; };
    element.addEventListener('seeking', reset);
    handle = element.requestVideoFrameCallback(sample);
    return () => { element.cancelVideoFrameCallback(handle); element.removeEventListener('seeking', reset); };
  }, [src]);

  function readStats() {
    const element = video.current;
    if (!element) return null;
    const frames = element.getVideoPlaybackQuality?.();
    let bufferSeconds = 0;
    // Only the buffered range containing the playhead counts; gaps are not playable.
    for (let index = 0; index < element.buffered.length; index++) {
      if (element.buffered.start(index) <= element.currentTime && element.currentTime <= element.buffered.end(index)) {
        bufferSeconds = element.buffered.end(index) - element.currentTime;
        break;
      }
    }
    const viewport = element.getBoundingClientRect();
    return {
      mediaId: mediaId ?? null, lessonId: lessonId ?? null,
      viewport: `${Math.round(viewport.width)}×${Math.round(viewport.height)}`,
      resolution: `${element.videoWidth}×${element.videoHeight}`,
      totalFrames: frames?.totalVideoFrames ?? null, droppedFrames: frames?.droppedVideoFrames ?? null,
      volume: Math.round(element.volume * 100), muted: element.muted, playbackRate: element.playbackRate,
      currentTime: element.currentTime, duration: Number.isFinite(element.duration) ? element.duration : null,
      bufferSeconds, readyState: element.readyState, networkState: element.networkState,
      paused: element.paused, ended: element.ended, errorCode: element.error?.code ?? null,
      mimeType: mimeType ?? null, date: new Date().toISOString(),
    };
  }
  useEffect(() => {
    if (!details) return;
    const update = () => setStats(readStats());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [details, src, mediaId, lessonId, mimeType]);
  useEffect(() => {
    const element = video.current;
    if (element && element.readyState > 0 && Number.isFinite(startTime) && startTime >= 0 && Number.isFinite(element.duration)) {
      element.currentTime = Math.min(startTime, element.duration);
    }
  }, [startTime]);
  useLayoutEffect(() => {
    if (!contextMenu) return;
    const fit = () => {
      const container = root.current?.getBoundingClientRect();
      const popup = contextPanel.current;
      if (!container || !popup) return;
      const left = Math.max(8, -container.left + 8);
      const top = Math.max(8, -container.top + 8);
      const right = Math.min(container.width, window.innerWidth - container.left) - 8;
      const bottom = Math.min(container.height, window.innerHeight - container.top) - 8;
      popup.style.maxHeight = `${Math.max(0, bottom - top)}px`;
      popup.style.left = `${Math.max(left, Math.min(contextMenu.x, right - popup.offsetWidth))}px`;
      popup.style.top = `${Math.max(top, Math.min(contextMenu.y, bottom - popup.offsetHeight))}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (root.current) observer.observe(root.current);
    window.addEventListener('resize', fit);
    window.addEventListener('scroll', fit, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); window.removeEventListener('scroll', fit, true); };
  }, [contextMenu]);
  useEffect(() => {
    if (!contextMenu) return;
    const outside = (event: PointerEvent) => { if (!contextPanel.current?.contains(event.target as Node)) setContextMenu(null); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setContextMenu(null); root.current?.focus(); }
    };
    contextPanel.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [contextMenu]);

  const shareUrl = (withTime = false) => {
    // Share the authorized lesson page, never its expiring signed media URL or unrelated query values.
    const url = new URL(window.location.pathname, window.location.origin);
    if (lessonId) url.searchParams.set('lesson', lessonId);
    if (withTime) url.searchParams.set('t', String(Math.floor(video.current?.currentTime ?? 0)));
    return url.href;
  };
  const copy = async (text: string) => {
    setContextMenu(null);
    try { await browserClipboardTransport(text); setNotice(t('已复制', 'Copied')); }
    catch { setNotice(t('复制失败，请允许浏览器访问剪贴板后重试', 'Could not copy. Allow clipboard access and try again.')); }
  };
  const showDetails = (value: 'stats' | 'help') => { setDetails(value); setContextMenu(null); };

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
  const openShortcuts = () => { setMenu(null); setContextMenu(null); setShortcuts(true); };
  // Ignore typing and browser shortcuts; preserve native range/button keys.
  // Read media state at keydown time so rapid seeks never use a stale render.
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const element = video.current;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!element || event.defaultPrevented || event.isComposing || event.altKey || event.metaKey) return;
      if (target?.closest('textarea, select, [contenteditable]:not([contenteditable="false"]), input:not([type="range"])')) return;
      if (target && target !== document.body && target !== document.documentElement && !root.current?.contains(target) && !root.current?.closest('.platform-classroom')?.contains(target)) return;
      if (document.querySelector('.lesson-video-player') !== root.current && !root.current?.contains(target)) return;
      const key = event.key.toLowerCase();
      if (key === '?' && !event.ctrlKey) {
        event.preventDefault(); if (!event.repeat) openShortcuts(); return;
      }
      if (event.key === 'Escape') {
        if (shortcuts) { event.preventDefault(); setShortcuts(false); }
        else if (details) { event.preventDefault(); setDetails(null); root.current?.focus(); }
        else if (!menu && !contextMenu && document.pictureInPictureElement === element) { event.preventDefault(); void togglePip(); }
        return;
      }
      if (shortcuts || menu || contextMenu || target?.closest('[role="dialog"], dialog')) return;
      if (event.ctrlKey) {
        if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setNotice(t('此视频没有章节', 'This video has no chapters')); }
        return;
      }
      if (target?.closest('input[type="range"]') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      let action: (() => void) | undefined;
      let repeatable = false;
      if (event.shiftKey) {
        if (key === 'p') action = () => onPrevious ? onPrevious() : setNotice(t('已是第一课', 'This is the first lesson'));
        else if (key === 'n') action = () => onNext ? onNext() : setNotice(t('已是最后一课', 'This is the last lesson'));
        else if (['<', '>', ',', '.'].includes(key)) {
          repeatable = true;
          action = () => {
            const faster = key === '>' || key === '.';
            element.playbackRate = (faster ? PLAYBACK_RATES.find(value => value > element.playbackRate) : [...PLAYBACK_RATES].reverse().find(value => value < element.playbackRate)) ?? element.playbackRate;
            setNotice(`${element.playbackRate}×`);
          };
        } else if (key === '+') action = () => setNotice(t('此视频没有字幕', 'This video has no subtitles'));
      } else if (key === 'k' || (key === ' ' && !target?.closest('button, a'))) action = () => { void togglePlay(); };
      else if (['j', 'l', 'arrowleft', 'arrowright'].includes(key)) {
        repeatable = true;
        action = () => seek(element.currentTime + (key === 'j' ? -10 : key === 'l' ? 10 : key === 'arrowleft' ? -5 : 5));
      } else if (/^[0-9]$/.test(key)) action = () => seek(duration * Number(key) / 10);
      else if (key === ',' || key === '.') {
        repeatable = true;
        action = () => { if (element.paused) seek(element.currentTime + (key === ',' ? -1 : 1) * frameDuration.current); };
      } else if (key === 'm') action = toggleMute;
      else if (key === 'f') action = () => { void toggleFullscreen(); };
      else if (key === 't') action = () => setTheater(value => !value);
      else if (key === 'i') action = () => { void togglePip(); };
      else if (key === 'arrowup' || key === 'arrowdown') {
        repeatable = true;
        action = () => { element.volume = Math.min(1, Math.max(0, element.volume + (key === 'arrowup' ? .05 : -.05))); element.muted = false; };
      } else if (key === 'c' || key === '+' || key === '-' || key === '=') action = () => setNotice(t('此视频没有字幕', 'This video has no subtitles'));
      if (action) { event.preventDefault(); if (!event.repeat || repeatable) { action(); reveal(); } }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });
  const shortcutGroups: { title: string; rows: [string, string, boolean?][] }[] = [
    { title: t('播放', 'Playback'), rows: [
      [t('在播放和暂停之间切换', 'Toggle play / pause'), 'k / Space'],
      [t('快退 10 秒', 'Rewind 10 seconds'), 'j'], [t('快进 10 秒', 'Forward 10 seconds'), 'l'],
      [t('上一个视频', 'Previous video'), 'P (Shift + p)', !onPrevious],
      [t('下一个视频', 'Next video'), 'N (Shift + n)', !onNext],
      [t('上一帧（暂停时）', 'Previous frame (while paused)'), ','], [t('下一帧（暂停时）', 'Next frame (while paused)'), '.'],
      [t('减慢播放速度', 'Decrease playback speed'), '< (Shift + ,)'], [t('加快播放速度', 'Increase playback speed'), '> (Shift + .)'],
      [t('跳转至视频的某个时间点（例如 7 为总时长的 70%）', 'Seek to a point in the video (e.g. 7 for 70%)'), '0…9'],
      [t('跳到上一章', 'Previous chapter'), 'Ctrl + ←', true], [t('跳到下一章', 'Next chapter'), 'Ctrl + →', true],
    ] },
    { title: t('常规', 'General'), rows: [
      [t('切换全屏模式', 'Toggle fullscreen'), 'f'], [t('切换影院模式', 'Toggle theater mode'), 't'],
      [t('切换迷你播放器', 'Toggle miniplayer'), 'i', !canPip],
      [t('关闭迷你播放器或当前对话框', 'Close miniplayer or current dialog'), 'Esc'],
      [t('静音／取消静音', 'Mute / unmute'), 'm'],
      [t('增大／减小音量', 'Increase / decrease volume'), '↑ / ↓'],
      [t('显示键盘快捷键', 'Show keyboard shortcuts'), '? (Shift + /)'],
    ] },
    { title: t('字幕', 'Subtitles'), rows: [
      [t('开启／关闭字幕', 'Toggle subtitles'), 'c', true], [t('放大字体', 'Increase font size'), '+', true], [t('缩小字体', 'Decrease font size'), '-', true],
    ] },
    { title: t('全景视频', '360° video'), rows: [
      [t('向上平移', 'Pan up'), 'w', true], [t('向左平移', 'Pan left'), 'a', true],
      [t('向下平移', 'Pan down'), 's', true], [t('向右平移', 'Pan right'), 'd', true],
      [t('放大', 'Zoom in'), t('] 或数字小键盘 +', '] or Numpad +'), true], [t('缩小', 'Zoom out'), t('[ 或数字小键盘 -', '[ or Numpad -'), true],
    ] },
  ];
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
  const controlsVisible = visible || !playing || menu !== null || contextMenu !== null;

  // allow-static-onclick: root captures synthetic touch clicks; playback actions are real buttons.
  return <div ref={root} className={`lesson-video-player${controlsVisible ? ' controls-visible' : ''}${theater ? ' is-theater' : ''}`} tabIndex={0}
    aria-label={t('视频播放器', 'Video player')} onPointerMove={reveal} onPointerDown={() => { suppressTap.current = false; reveal(); }} onFocus={reveal}
    onClickCapture={event => {
      // Touch release can retarget its synthesized click to a newly opened menu item.
      if (suppressTap.current) { suppressTap.current = false; event.preventDefault(); event.stopPropagation(); }
    }}
    onContextMenu={event => {
      if ((event.target as HTMLElement).closest('.lesson-video-details, dialog')) return;
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      setMenu(null);
      setContextMenu({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    }}
    onKeyDown={event => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault(); setMenu(null); setContextMenu({ x: 16, y: 16 }); return;
      }
    }}>
    <video ref={video} src={src} playsInline preload="metadata" autoPlay={autoPlay} loop={loop} onError={onError}
      onLoadedMetadata={event => {
        const element = event.currentTarget;
        setDuration(Number.isFinite(element.duration) ? element.duration : 0);
        setResolution(element.videoHeight);
        if (Number.isFinite(startTime) && startTime >= 0 && Number.isFinite(element.duration)) element.currentTime = Math.min(startTime, element.duration);
        onLoadedMetadata(event);
      }}
      onDurationChange={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onTimeUpdate={event => setCurrent(event.currentTarget.currentTime)}
      onProgress={event => { const element = event.currentTarget; if (element.buffered.length) setBuffered(element.buffered.end(element.buffered.length - 1)); }}
      onVolumeChange={event => { setVolume(event.currentTarget.volume); setMuted(event.currentTarget.muted); }}
      onRateChange={event => setRate(event.currentTarget.playbackRate)}
      onPlay={() => { setPlaying(true); reveal(); }} onPause={() => setPlaying(false)}
      onEnded={() => { setPlaying(false); if (!loop && autoContinue && sleepMinutes === 0) onNext?.(); }} />
    <button type="button" className="lesson-video-surface" aria-label={playing ? t('暂停视频', 'Pause video') : t('播放视频', 'Play video')}
      tabIndex={-1}
      onPointerDown={event => {
        suppressTap.current = false;
        if (event.pointerType !== 'touch') return;
        cancelLongPress();
        touchStart.current = { x: event.clientX, y: event.clientY };
        const bounds = root.current!.getBoundingClientRect();
        const position = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        longPress.current = setTimeout(() => { suppressTap.current = true; setMenu(null); setContextMenu(position); }, 550);
      }}
      onPointerMove={event => { if (Math.hypot(event.clientX - touchStart.current.x, event.clientY - touchStart.current.y) > 10) cancelLongPress(); }}
      onPointerUp={cancelLongPress} onPointerCancel={cancelLongPress} onPointerLeave={cancelLongPress}
      onClick={() => void togglePlay()} onDoubleClick={() => void toggleFullscreen()} />
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
          <button type="button" className="lesson-video-icon lesson-video-theater" aria-label={t('影院模式', 'Theater mode')} aria-pressed={theater} data-tooltip={t('影院模式 (t)', 'Theater mode (t)')} onClick={() => setTheater(!theater)}><RectangleHorizontal /></button>
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
        <button type="button" className="lesson-video-menu-row" onClick={openShortcuts}><Keyboard /><span>{t('键盘快捷键', 'Keyboard shortcuts')}</span><small>?</small></button>
      </> : <>
        <button type="button" className="lesson-video-menu-back" onClick={() => setMenu('main')}><ChevronLeft />{menu === 'speed' ? t('播放速度', 'Playback speed') : menu === 'sleep' ? t('休眠定时器', 'Sleep timer') : t('画质', 'Quality')}</button>
        {menu === 'speed' && PLAYBACK_RATES.map(value => <button type="button" className="lesson-video-option" key={value} aria-pressed={rate === value} onClick={() => { if (video.current) video.current.playbackRate = value; setMenu('main'); }}><Check visibility={rate === value ? 'visible' : 'hidden'} />{value === 1 ? t('正常', 'Normal') : `${value}×`}</button>)}
        {menu === 'sleep' && [0, 10, 15, 20, 30, 45, 60].map(value => <button type="button" className="lesson-video-option" key={value} aria-pressed={sleepMinutes === value} onClick={() => { setSleepMinutes(value); setMenu('main'); }}><Check visibility={sleepMinutes === value ? 'visible' : 'hidden'} />{value ? t(`${value} 分钟`, `${value} minutes`) : t('关闭', 'Off')}</button>)}
        {menu === 'quality' && <><button type="button" className="lesson-video-option" aria-pressed="true" onClick={() => setMenu('main')}><Check />{t('原画', 'Original')} {resolution ? `${resolution}p` : ''}</button><p className="lesson-video-menu-note">{t('当前视频仅提供原始画质', 'Only the original quality is available for this video')}</p></>}
      </>}
    </div>}
    {contextMenu && <div ref={contextPanel} className="lesson-video-context" role="menu" aria-label={t('视频菜单', 'Video menu')}
      onKeyDown={event => {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }
        if (event.key === 'Tab') setContextMenu(null);
      }}>
      <button type="button" role="menuitemcheckbox" aria-checked={loop} onClick={() => { setLoop(!loop); setContextMenu(null); }}><Repeat2 /><span>{t('循环播放', 'Loop')}</span>{loop && <Check className="lesson-video-context-check" />}</button>
      <button type="button" role="menuitem" disabled={!canPip} onClick={() => { setContextMenu(null); void togglePip(); }}><PictureInPicture2 /><span>{t('迷你播放器', 'Miniplayer')}</span></button>
      <button type="button" role="menuitem" onClick={() => void copy(shareUrl())}><Link /><span>{t('复制视频网址', 'Copy video URL')}</span></button>
      <button type="button" role="menuitem" onClick={() => void copy(shareUrl(true))}><Link /><span>{t('复制当前时间的视频网址', 'Copy video URL at current time')}</span></button>
      <button type="button" role="menuitem" onClick={() => void copy(`<iframe src="${shareUrl().replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" title="CubeRoot" width="560" height="315" style="max-width:100%;border:0" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`)}><Code /><span>{t('复制嵌入代码', 'Copy embed code')}</span></button>
      <button type="button" role="menuitem" onClick={() => void copy(JSON.stringify(readStats(), null, 2))}><Bug /><span>{t('复制调试信息', 'Copy debug info')}</span></button>
      <button type="button" role="menuitem" onClick={() => showDetails('help')}><CircleHelp /><span>{t('排查播放问题', 'Troubleshoot playback issue')}</span></button>
      <button type="button" role="menuitem" onClick={() => showDetails('stats')}><Info /><span>{t('详细统计信息', 'Stats for nerds')}</span></button>
    </div>}
    {details && stats && <div className="lesson-video-details" role="dialog" aria-label={details === 'stats' ? t('详细统计信息', 'Stats for nerds') : t('排查播放问题', 'Troubleshoot playback issue')}>
      <ClearButton variant="standalone" className="lesson-video-details-close" ariaLabel={t('关闭统计与诊断', 'Close statistics and diagnostics')} onClick={() => setDetails(null)} />
      {details === 'stats' ? <dl>
        <dt>{t('视频 ID', 'Video ID')}</dt><dd>{stats.mediaId ?? stats.lessonId ?? '—'}</dd>
        <dt>{t('视口 / 帧数', 'Viewport / Frames')}</dt><dd>{stats.viewport} / {stats.droppedFrames === null ? t('未提供', 'Unavailable') : t(`丢失 ${stats.droppedFrames} / 共 ${stats.totalFrames} 帧`, `${stats.droppedFrames} dropped of ${stats.totalFrames}`)}</dd>
        <dt>{t('当前 / 原始分辨率', 'Current / Original Res')}</dt><dd>{stats.resolution} / {stats.resolution}</dd>
        <dt>{t('音量 / 静音', 'Volume / Muted')}</dt><dd>{stats.volume}% / {stats.muted ? t('是', 'Yes') : t('否', 'No')}</dd>
        <dt>{t('格式 / 编解码器', 'Format / Codecs')}</dt><dd>{stats.mimeType ?? '—'} / {t('浏览器未提供', 'Not exposed by browser')}</dd>
        <dt>{t('色彩', 'Color')}</dt><dd>{t('浏览器未提供', 'Not exposed by browser')}</dd>
        <dt>{t('连接速度', 'Connection Speed')}</dt><dd>{t('浏览器未提供', 'Not exposed by browser')}</dd>
        <dt>{t('网络状态', 'Network State')}</dt><dd>{[t('未初始化', 'Empty'), t('空闲', 'Idle'), t('加载中', 'Loading'), t('无可用源', 'No source')][stats.networkState] ?? '—'}</dd>
        <dt>{t('缓冲健康度', 'Buffer Health')}</dt><dd className="lesson-video-stat-meter"><meter min={0} max={Math.max(60, stats.bufferSeconds)} value={stats.bufferSeconds} />{stats.bufferSeconds.toFixed(2)} s</dd>
        <dt>{t('播放状态', 'Playback State')}</dt><dd>{stats.currentTime.toFixed(2)} / {stats.duration?.toFixed(2) ?? '—'} s, {stats.playbackRate}×, readyState {stats.readyState}</dd>
        <dt>{t('日期', 'Date')}</dt><dd>{stats.date}</dd>
      </dl> : <div className="lesson-video-help">
        <strong>{t('排查播放问题', 'Troubleshoot playback issue')}</strong>
        <p>{stats.errorCode ? t(`播放器错误代码：${stats.errorCode}。请重新加载课时；若仍失败，复制调试信息供排查。`, `Player error code: ${stats.errorCode}. Reload the lesson; if it still fails, copy debug info for investigation.`) : stats.readyState < 3 && !stats.ended ? t('视频缓冲不足，请检查网络并稍候再播放。', 'The video needs more buffered data. Check your connection and try again shortly.') : t('目前未检测到媒体错误。卡顿时可降低播放速度，或关闭其他占用资源的标签页。', 'No media error detected. For stuttering, reduce playback speed or close other busy tabs.')}</p>
        {stats.muted || stats.volume === 0 ? <p>{t('当前播放器已静音，请检查音量设置。', 'The player is muted. Check its volume settings.')}</p> : null}
        <p>{t('嵌入课程仍需登录并拥有课时访问权限。', 'Embedded lessons still require sign-in and lesson access.')}</p>
        <button type="button" onClick={() => void copy(JSON.stringify(readStats(), null, 2))}>{t('复制调试信息', 'Copy debug info')}</button>
      </div>}
    </div>}
    {/* allow-static-onclick: native dialog backdrop clicks are retargeted to the dialog. */}
    {shortcuts && <dialog ref={shortcutDialog} className="lesson-video-shortcuts" aria-label={t('键盘快捷键', 'Keyboard shortcuts')}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setShortcuts(false);
      }}
      onCancel={event => { event.preventDefault(); setShortcuts(false); }}>
      <h2>{t('键盘快捷键', 'Keyboard shortcuts')}</h2>
      <div className="lesson-video-shortcut-groups">{shortcutGroups.map(group => <section key={group.title}>
        <h3>{group.title}</h3>
        <dl>{group.rows.map(([label, keys, disabled]) => <div key={keys} className={disabled ? 'is-unavailable' : undefined}>
          <dt>{label}{disabled && <small>{t('不可用', 'Unavailable')}</small>}</dt><dd><kbd>{keys}</kbd></dd>
        </div>)}</dl>
      </section>)}</div>
      <p className="lesson-video-shortcut-note">{t('逐帧按播放采样估算帧长，采样前按 30 fps；当前视频未提供字幕、章节及全景数据。', 'Frame stepping uses sampled frame timing, or 30 fps before sampling. This video has no subtitles, chapters or 360° data.')}</p>
      <footer><button type="button" onClick={() => setShortcuts(false)}>{t('关闭', 'Close')}</button></footer>
    </dialog>}
  </div>;
}
