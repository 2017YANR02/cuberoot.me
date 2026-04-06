/**
 * @module FrameCountPage
 * 数帧工具 — 加载本地视频，逐帧控制，标记起止帧，计算精确时间。
 * 灵感来源：somewes.com/frame-count/，功能裁剪为魔方速拧场景。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './frame-count.css';

// ── SVG Icons ────────────────────────────────────────────────────────────────

const IconBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconKeyboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <line x1="6" y1="8" x2="6" y2="8" /><line x1="10" y1="8" x2="10" y2="8" />
    <line x1="14" y1="8" x2="14" y2="8" /><line x1="18" y1="8" x2="18" y2="8" />
    <line x1="6" y1="12" x2="6" y2="12" /><line x1="10" y1="12" x2="10" y2="12" />
    <line x1="14" y1="12" x2="14" y2="12" /><line x1="18" y1="12" x2="18" y2="12" />
    <line x1="8" y1="16" x2="16" y2="16" />
  </svg>
);

const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6,4 20,12 6,20" />
  </svg>
);

const IconPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

const IconSkipBack = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="11,4 1,12 11,20" />
    <polygon points="22,4 12,12 22,20" />
  </svg>
);

const IconSkipForward = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="2,4 12,12 2,20" />
    <polygon points="13,4 23,12 13,20" />
  </svg>
);

const IconStepBack = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="16,4 6,12 16,20" />
    <rect x="4" y="4" width="2" height="16" rx="1" />
  </svg>
);

const IconStepForward = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="8,4 18,12 8,20" />
    <rect x="18" y="4" width="2" height="16" rx="1" />
  </svg>
);

const IconFrameBack = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="14,4 6,12 14,20" />
  </svg>
);

const IconFrameForward = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="10,4 18,12 10,20" />
  </svg>
);

// ── 时间格式化 ────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00.000';
  const negative = seconds < 0;
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const formatted = `${m}:${s.toFixed(3).padStart(6, '0')}`;
  return negative ? `-${formatted}` : formatted;
}

/**
 * 自动检测视频帧率。
 * 优先使用 getVideoPlaybackQuality().totalVideoFrames — 该计数器包含
 * 所有解码帧（含被丢弃的帧），不受显示器刷新率限制，
 * 因此能正确检测 120fps / 240fps 等高帧率视频。
 * 若 Quality API 不可用则 fallback 到 requestVideoFrameCallback 帧间隔分析。
 */
function detectFps(video: HTMLVideoElement): Promise<number | null> {
  return new Promise((resolve) => {
    const wasMuted = video.muted;
    const savedTime = video.currentTime;
    let resolved = false;

    const finish = (fps: number | null) => {
      if (resolved) return;
      resolved = true;
      video.pause();
      video.muted = wasMuted;
      video.currentTime = savedTime;
      resolve(fps);
    };

    // 超时保护
    const timeout = setTimeout(() => finish(null), 4000);

    /** 吸附到常见帧率 */
    const snapFps = (rawFps: number): number => {
      const commonFps = [24, 25, 29.97, 30, 48, 50, 59.94, 60, 119.88, 120, 239.76, 240];
      let best = rawFps;
      let bestDist = Infinity;
      for (const cf of commonFps) {
        const dist = Math.abs(rawFps - cf);
        if (dist < bestDist) { bestDist = dist; best = cf; }
      }
      return bestDist < 2 ? best : Math.round(rawFps * 100) / 100;
    };

    /** 方案 A：getVideoPlaybackQuality — 计数所有解码帧，不受刷新率限制 */
    const detectViaQuality = () => {
      if (typeof video.getVideoPlaybackQuality !== 'function') {
        detectViaRVFC();
        return;
      }

      video.muted = true;
      video.currentTime = 0;
      video.playbackRate = 1;

      const startQuality = video.getVideoPlaybackQuality();
      const startTotal = startQuality.totalVideoFrames;
      const startTime = video.currentTime;

      // NOTE: 用 requestVideoFrameCallback 追踪播放进度，播放 ~0.5 秒后采样
      let sampleCount = 0;
      const SAMPLE_WAIT = 30; // 等待约 30 个显示帧（~0.5s @60Hz）

      const onFrame = () => {
        sampleCount++;
        if (sampleCount < SAMPLE_WAIT) {
          video.requestVideoFrameCallback(onFrame);
          return;
        }

        const endQuality = video.getVideoPlaybackQuality();
        const endTotal = endQuality.totalVideoFrames;
        const endTime = video.currentTime;
        const elapsed = endTime - startTime;
        const totalDecoded = endTotal - startTotal;

        if (elapsed > 0.1 && totalDecoded > 5) {
          const rawFps = totalDecoded / elapsed;
          clearTimeout(timeout);
          finish(snapFps(rawFps));
        } else {
          // 数据不足，fallback
          detectViaRVFC();
        }
      };

      video.play().then(() => {
        if (typeof video.requestVideoFrameCallback === 'function') {
          video.requestVideoFrameCallback(onFrame);
        } else {
          // 没有 RVFC，用 setTimeout 等 500ms
          setTimeout(() => {
            const endQuality = video.getVideoPlaybackQuality();
            const elapsed = video.currentTime - startTime;
            const totalDecoded = endQuality.totalVideoFrames - startTotal;
            if (elapsed > 0.1 && totalDecoded > 5) {
              clearTimeout(timeout);
              finish(snapFps(totalDecoded / elapsed));
            } else {
              finish(null);
            }
          }, 600);
        }
      }).catch(() => finish(null));
    };

    /** 方案 B（Fallback）：requestVideoFrameCallback 帧间隔分析 */
    const detectViaRVFC = () => {
      if (typeof video.requestVideoFrameCallback !== 'function') {
        finish(null);
        return;
      }

      video.muted = true;
      video.currentTime = 0;

      const timestamps: number[] = [];
      const SAMPLES = 15;

      const onFrame = (_now: number, metadata: VideoFrameCallbackMetadata) => {
        timestamps.push(metadata.mediaTime);
        if (timestamps.length < SAMPLES) {
          video.requestVideoFrameCallback(onFrame);
        } else {
          const deltas: number[] = [];
          for (let i = 1; i < timestamps.length; i++) {
            const d = timestamps[i] - timestamps[i - 1];
            if (d > 0) deltas.push(d);
          }
          if (deltas.length < 3) { clearTimeout(timeout); finish(null); return; }
          deltas.sort((a, b) => a - b);
          const median = deltas[Math.floor(deltas.length / 2)];
          clearTimeout(timeout);
          finish(snapFps(1 / median));
        }
      };

      video.play().then(() => {
        video.requestVideoFrameCallback(onFrame);
      }).catch(() => finish(null));
    };

    // 开始检测
    const start = () => {
      clearTimeout(timeout);
      // 重新设超时
      const t2 = setTimeout(() => finish(null), 4000);
      const origFinish = finish;
      // patch finish 清除新 timeout
      const wrappedFinish = (fps: number | null) => { clearTimeout(t2); origFinish(fps); };
      // 替换 — 但因为 finish 已有 resolved 保护，直接用即可
      void t2; void wrappedFinish;
      detectViaQuality();
    };

    if (video.readyState >= 3) {
      start();
    } else {
      video.addEventListener('canplay', () => start(), { once: true });
    }
  });
}

// ── 快捷键数据 ────────────────────────────────────────────────────────────

const PLAYBACK_RATES = [0.25, 0.5, 1, 1.5, 2] as const;

const SHORTCUTS = [
  { section: 'Playback' },
  { action: 'Play / Pause', keys: ['K'] },
  { action: 'Forward 1 frame', keys: ['.'] },
  { action: 'Back 1 frame', keys: [','] },
  { action: 'Forward 5 frames', keys: ['Shift', '.'] },
  { action: 'Back 5 frames', keys: ['Shift', ','] },
  { action: 'Forward 10 frames', keys: ['Ctrl', '.'] },
  { action: 'Back 10 frames', keys: ['Ctrl', ','] },
  { action: 'Forward 1 frame', keys: ['Shift', 'Scroll ↓'] },
  { action: 'Back 1 frame', keys: ['Shift', 'Scroll ↑'] },
  { action: 'Forward 1 second', keys: ['L'] },
  { action: 'Forward 5 seconds', keys: [';'] },
  { section: 'Frame Marking' },
  { action: 'Set start frame', keys: ['['] },
  { action: 'Set end frame', keys: [']'] },
  { action: 'Copy current frame', keys: ['C'] },
] as const;

// ── 组件 ──────────────────────────────────────────────────────────────────

export default function FrameCountPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 视频状态
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [totalFrames, setTotalFrames] = useState(0);

  // 帧计数状态
  const [videoFps, setVideoFps] = useState(60);
  const [fpsAutoDetected, setFpsAutoDetected] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [startFrame, setStartFrame] = useState(0);
  const [endFrame, setEndFrame] = useState(0);

  // 播放速率
  const [playbackRate, setPlaybackRate] = useState(1);

  // 快捷键弹窗 + Toast 通知
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // NOTE: 计算结果
  const frameCount = Math.max(0, endFrame - startFrame);
  const videoTime = videoFps > 0 ? frameCount / videoFps : 0;

  /** 显示短暂 Toast */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }, []);

  /** 复制文本到剪贴板 */
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => showToast(`Copied ${label}`));
  }, [showToast]);

  // ── 帧操作 ──────────────────────────────────────────────────────────

  /** 跳转到指定帧 */
  const seekToFrame = useCallback((frame: number) => {
    const video = videoRef.current;
    if (!video || videoFps <= 0) return;
    video.pause();
    setIsPlaying(false);
    video.currentTime = frame / videoFps;
    setCurrentFrame(frame);
  }, [videoFps]);

  /** 移动 N 帧 */
  const stepFrames = useCallback((n: number) => {
    const video = videoRef.current;
    if (!video || videoFps <= 0) return;
    video.pause();
    setIsPlaying(false);
    const newFrame = Math.max(0, currentFrame + n);
    video.currentTime = newFrame / videoFps;
    setCurrentFrame(newFrame);
  }, [currentFrame, videoFps]);

  /** 前进/后退 N 秒 */
  const stepSeconds = useCallback((s: number) => {
    const video = videoRef.current;
    if (!video || videoFps <= 0) return;
    const newTime = Math.max(0, video.currentTime + s);
    video.currentTime = newTime;
    setCurrentFrame(Math.round(newTime * videoFps));
  }, [videoFps]);

  /** 播放/暂停 */
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  /** 切换播放速率 */
  const changeRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  // ── 视频帧同步 ─────────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    // NOTE: 使用 requestVideoFrameCallback 实时追踪当前帧号
    const hasRVFC = typeof video.requestVideoFrameCallback === 'function';
    if (hasRVFC) {
      let handle: number;
      const onFrame = () => {
        if (videoFps > 0) {
          setCurrentFrame(Math.round(video.currentTime * videoFps));
        }
        handle = video.requestVideoFrameCallback(onFrame);
      };
      handle = video.requestVideoFrameCallback(onFrame);
      return () => video.cancelVideoFrameCallback(handle);
    } else {
      // Fallback: timeupdate 事件
      const onTimeUpdate = () => {
        if (videoFps > 0) {
          setCurrentFrame(Math.round(video.currentTime * videoFps));
        }
      };
      video.addEventListener('timeupdate', onTimeUpdate);
      return () => video.removeEventListener('timeupdate', onTimeUpdate);
    }
  }, [videoSrc, videoFps]);

  // ── 文件加载 ────────────────────────────────────────────────────────

  const loadFile = useCallback(async (file: File) => {
    // 释放之前的 object URL
    if (videoSrc) URL.revokeObjectURL(videoSrc);

    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoName(file.name);
    setCurrentFrame(0);
    setStartFrame(0);
    setEndFrame(0);
    setIsPlaying(false);
    setFpsAutoDetected(false);

    // 自动检测 FPS
    // NOTE: 需要等 video 元素更新 src 后再检测，用 setTimeout 延迟
    setTimeout(async () => {
      const video = videoRef.current;
      if (!video) return;
      const detected = await detectFps(video);
      if (detected && detected > 0) {
        setVideoFps(detected);
        setFpsAutoDetected(true);
      }
    }, 100);
  }, [videoSrc]);

  // ── 拖放处理 ────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      loadFile(file);
    }
  }, [loadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }, [loadFile]);

  // ── 键盘快捷键 ──────────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // NOTE: 在 input 内不拦截
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      switch (e.key.toLowerCase()) {
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case '.':
          e.preventDefault();
          if (e.ctrlKey) stepFrames(10);
          else if (e.shiftKey) stepFrames(5);
          else stepFrames(1);
          break;
        case ',':
          e.preventDefault();
          if (e.ctrlKey) stepFrames(-10);
          else if (e.shiftKey) stepFrames(-5);
          else stepFrames(-1);
          break;
        case '[':
          e.preventDefault();
          setStartFrame(currentFrame);
          break;
        case ']':
          e.preventDefault();
          setEndFrame(currentFrame);
          break;
        case 'c':
          e.preventDefault();
          copyToClipboard(String(currentFrame), `frame ${currentFrame}`);
          break;
        case 'l':
          e.preventDefault();
          stepSeconds(1);
          break;
        case ';':
          e.preventDefault();
          stepSeconds(5);
          break;
        case 'escape':
          setShowShortcuts(false);
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, stepFrames, stepSeconds, currentFrame, copyToClipboard]);

  // Shift+滚轮逐帧控制
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey || !videoSrc) return;
      e.preventDefault();
      if (e.deltaY > 0) stepFrames(1);
      else if (e.deltaY < 0) stepFrames(-1);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [stepFrames, videoSrc]);

  // 视频播放/暂停状态同步 + 总帧数获取
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoaded = () => {
      if (videoFps > 0 && isFinite(video.duration)) {
        setTotalFrames(Math.round(video.duration * videoFps));
      }
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadedmetadata', onLoaded);
    // 如果已经加载了
    if (video.duration && isFinite(video.duration) && videoFps > 0) {
      setTotalFrames(Math.round(video.duration * videoFps));
    }
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [videoSrc, videoFps]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div
      className="frame-count-page"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="fc-header">
        <Link to="/" className="fc-back">
          <IconBack /> Back
        </Link>
        <span className="fc-title">Frame Count</span>
        <button className="fc-shortcuts-btn" onClick={() => setShowShortcuts(true)}>
          <IconKeyboard /> Shortcuts
        </button>
      </header>

      <div className="fc-content">
        {/* ── 视频播放器 ── */}
        <div className="fc-panel fc-video-zone">
          {videoSrc ? (
            <>
              <span className="fc-video-label">{videoName}</span>
              <button className="fc-change-video" onClick={() => fileInputRef.current?.click()}>
                Change Video
              </button>
              <video ref={videoRef} src={videoSrc} preload="auto" />
            </>
          ) : (
            <div
              className={`fc-drop-hint ${dragging ? 'dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload />
              <span className="fc-drop-text">Drop a video file here</span>
              <span className="fc-drop-sub">or click to select a file</span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="fc-file-input"
            onChange={handleFileSelect}
          />
        </div>

        {/* ── 控制栏 ── */}
        {videoSrc && (
          <div className="fc-panel fc-controls-wrap">
            {/* Progress bar */}
            <div className="fc-progress-bar">
              <input
                type="range"
                className="fc-progress-slider"
                min={0}
                max={totalFrames || 1}
                value={currentFrame}
                onChange={(e) => seekToFrame(parseInt(e.target.value))}
                style={{
                  '--progress': totalFrames > 0 ? `${(currentFrame / totalFrames) * 100}%` : '0%',
                  '--start-pct': totalFrames > 0 ? `${(startFrame / totalFrames) * 100}%` : '0%',
                  '--end-pct': totalFrames > 0 ? `${(endFrame / totalFrames) * 100}%` : '0%',
                } as React.CSSProperties}
              />
              {/* Start/End markers overlay */}
              {startFrame > 0 && totalFrames > 0 && (
                <div className="fc-marker fc-marker-start" style={{ left: `${(startFrame / totalFrames) * 100}%` }} title={`Start: ${startFrame}`} />
              )}
              {endFrame > 0 && totalFrames > 0 && (
                <div className="fc-marker fc-marker-end" style={{ left: `${(endFrame / totalFrames) * 100}%` }} title={`End: ${endFrame}`} />
              )}
            </div>

            {/* Controls */}
            <div className="fc-controls">
              <button className="fc-ctrl-btn" title="Back 10 frames (Ctrl+,)" onClick={() => stepFrames(-10)}>
                <IconSkipBack />
              </button>
              <button className="fc-ctrl-btn" title="Back 5 frames (Shift+,)" onClick={() => stepFrames(-5)}>
                <IconStepBack />
              </button>
              <button className="fc-ctrl-btn" title="Back 1 frame (,)" onClick={() => stepFrames(-1)}>
                <IconFrameBack />
              </button>

              <button className="fc-ctrl-btn play-btn" title="Play/Pause (K)" onClick={togglePlay}>
                {isPlaying ? <IconPause /> : <IconPlay />}
              </button>

              <button className="fc-ctrl-btn" title="Forward 1 frame (.)" onClick={() => stepFrames(1)}>
                <IconFrameForward />
              </button>
              <button className="fc-ctrl-btn" title="Forward 5 frames (Shift+.)" onClick={() => stepFrames(5)}>
                <IconStepForward />
              </button>
              <button className="fc-ctrl-btn" title="Forward 10 frames (Ctrl+.)" onClick={() => stepFrames(10)}>
                <IconSkipForward />
              </button>

              <div className="fc-ctrl-sep" />

              {/* Playback rate */}
              <div className="fc-rate-group">
                {PLAYBACK_RATES.map((r) => (
                  <button
                    key={r}
                    className={`fc-rate-btn ${playbackRate === r ? 'active' : ''}`}
                    onClick={() => changeRate(r)}
                  >
                    {r}x
                  </button>
                ))}
              </div>

              <div className="fc-ctrl-sep" />

              <span className="fc-ctrl-info">
                Frame <strong>{currentFrame}</strong> &nbsp;/&nbsp; {formatTime(currentFrame / videoFps)}
              </span>
            </div>
          </div>
        )}

        {/* ── Timing Details + Results ── */}
        <div className="fc-data-row">
          {/* Timing Details */}
          <div className="fc-panel">
            <div className="fc-panel-title">Timing Details</div>

            <div className="fc-field">
              <span className="fc-label">Video FPS</span>
              <input
                className="fc-input"
                type="number"
                min={1}
                step="any"
                value={videoFps}
                onChange={(e) => { setVideoFps(parseFloat(e.target.value) || 0); setFpsAutoDetected(false); }}
              />
              {fpsAutoDetected && <span className="fc-fps-auto">Auto</span>}
            </div>

            <div className="fc-field">
              <span className="fc-label">Start Frame</span>
              <input
                className="fc-input"
                type="number"
                min={0}
                value={startFrame}
                onChange={(e) => setStartFrame(parseInt(e.target.value) || 0)}
              />
              <button className="fc-mark-btn start-mark" title="Mark current frame as start ([)" onClick={() => setStartFrame(currentFrame)}>
                [ Mark
              </button>
              <button className="fc-go-btn" title="Seek to start frame" onClick={() => seekToFrame(startFrame)}>Go</button>
            </div>

            <div className="fc-field">
              <span className="fc-label">End Frame</span>
              <input
                className="fc-input"
                type="number"
                min={0}
                value={endFrame}
                onChange={(e) => setEndFrame(parseInt(e.target.value) || 0)}
              />
              <button className="fc-mark-btn end-mark" title="Mark current frame as end (])" onClick={() => setEndFrame(currentFrame)}>
                ] Mark
              </button>
              <button className="fc-go-btn" title="Seek to end frame" onClick={() => seekToFrame(endFrame)}>Go</button>
            </div>

            <div className="fc-field">
              <span className="fc-label">Current Frame</span>
              <input
                className="fc-input"
                type="number"
                min={0}
                value={currentFrame}
                onChange={(e) => seekToFrame(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Results */}
          <div className="fc-panel">
            <div className="fc-panel-title">
              Results
              <button
                className="fc-copy-all-btn"
                onClick={() => copyToClipboard(
                  `Frame Count: ${frameCount}\nVideo Time: ${videoTime.toFixed(3)}s (${formatTime(videoTime)})\nStart: ${startFrame} (${formatTime(startFrame / videoFps)})\nEnd: ${endFrame} (${formatTime(endFrame / videoFps)})\nFPS: ${videoFps}`,
                  'results'
                )}
                title="Copy all results"
              >
                📋 Copy
              </button>
            </div>

            <div className="fc-result">
              <span className="fc-result-label">Frame Count</span>
              <span className="fc-result-value">{frameCount}</span>
              <span className="fc-result-unit">frames</span>
            </div>

            <div className="fc-result">
              <span className="fc-result-label">Video Time</span>
              <span className="fc-result-value highlight">{videoTime.toFixed(3)}</span>
              <span className="fc-result-unit">seconds</span>
            </div>

            <div className="fc-result">
              <span className="fc-result-label">Formatted</span>
              <span className="fc-result-value">{formatTime(videoTime)}</span>
            </div>

            <div className="fc-result">
              <span className="fc-result-label">Start Time</span>
              <span className="fc-result-value">{formatTime(startFrame / videoFps)}</span>
            </div>

            <div className="fc-result">
              <span className="fc-result-label">End Time</span>
              <span className="fc-result-value">{formatTime(endFrame / videoFps)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast 通知 */}
      {toast && <div className="fc-toast">{toast}</div>}

      {/* ── 快捷键弹窗 ── */}
      {showShortcuts && (
        <div className="fc-modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
            <button className="fc-modal-close" onClick={() => setShowShortcuts(false)}>✕</button>
            <h2>Keyboard Shortcuts</h2>
            {SHORTCUTS.map((item, i) =>
              'section' in item ? (
                <div key={i} className="fc-shortcut-section">{item.section}</div>
              ) : (
                <div key={i} className="fc-shortcut-row">
                  <span className="fc-shortcut-action">{item.action}</span>
                  <span className="fc-shortcut-keys">
                    {item.keys.map((k, j) => (
                      <span key={j}>
                        {j > 0 && <span style={{ color: '#6a7a9a', margin: '0 2px' }}>+</span>}
                        <kbd className="fc-kbd">{k}</kbd>
                      </span>
                    ))}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
