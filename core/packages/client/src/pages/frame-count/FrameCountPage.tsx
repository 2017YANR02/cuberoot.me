/**
 * @module FrameCountPage
 * 数帧工具 — 加载本地视频，逐帧控制，标记起止帧，计算精确时间。
 * 灵感来源：somewes.com/frame-count/，功能裁剪为魔方速拧场景。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import mediaInfoFactory from 'mediainfo.js';
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

const IconCrop = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.13 1L6 16a2 2 0 002 2h15" />
    <path d="M1 6.13L16 6a2 2 0 012 2v15" />
  </svg>
);

// ── 常量类型 ──────────────────────────────────────────────────────────────

type Rotation = 0 | 90 | 180 | 270;
const ROTATION_OPTIONS: { value: Rotation; label: string }[] = [
  { value: 0, label: 'No Rotation' },
  { value: 90, label: '90° CW' },
  { value: 270, label: '90° CCW' },
  { value: 180, label: '180°' },
];

/** WCA 时间→帧数公式: ROUNDUP((ROUNDDOWN(time, 2) + 0.009) * fps) + 1 */
function timeToFrames(time: number, fps: number): number {
  const truncated = Math.floor(time * 100) / 100; // ROUNDDOWN(time, 2)
  return Math.ceil((truncated + 0.009) * fps) + 1;
}

const COMMON_FPS = [29.97, 59.94, 119.88, 239.76, 60, 120, 240, 30, 50, 48, 25, 24] as const;

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
 * 使用 MediaInfo.js (WASM) 直接解析文件容器元数据，获取精确帧率。
 * 不依赖浏览器播放采样，直接读取 MP4/MKV 容器内的 FrameRate 字段。
 */
async function detectFpsFromFile(file: File): Promise<number | null> {
  try {
    const mi = await mediaInfoFactory({
      locateFile: () => '/MediaInfoModule.wasm',
    });
    const getSize = () => file.size;
    const readChunk = async (chunkSize: number, offset: number) => {
      const buf = await file.slice(offset, offset + chunkSize).arrayBuffer();
      return new Uint8Array(buf);
    };

    const result = await mi.analyzeData(getSize, readChunk);
    mi.close();

    if (!result || typeof result === 'string') return null;

    const videoTrack = result.media?.track?.find(
      (t: { '@type': string }) => t['@type'] === 'Video'
    ) as { FrameRate?: number; FrameRate_Num?: number; FrameRate_Den?: number } | undefined;

    if (!videoTrack) return null;

    // 优先用 Num/Den 精确计算（如 120000/1001 = 119.880…）
    if (videoTrack.FrameRate_Num && videoTrack.FrameRate_Den) {
      return Math.round((videoTrack.FrameRate_Num / videoTrack.FrameRate_Den) * 100) / 100;
    }

    // 否则用 FrameRate 字段（float）
    if (videoTrack.FrameRate && videoTrack.FrameRate > 0) {
      return Math.round(videoTrack.FrameRate * 100) / 100;
    }

    return null;
  } catch (err) {
    console.warn('[FrameCount] MediaInfo detection failed:', err);
    return null;
  }
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

  // 时间→帧数计算器
  const [solveTime, setSolveTime] = useState('');

  // 图像变换
  const [rotation, setRotation] = useState<Rotation>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<{ top: number; left: number; bottom: number; right: number } | null>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);

  // NOTE: 计算结果
  const frameCount = Math.max(0, endFrame - startFrame);
  const videoTime = videoFps > 0 ? frameCount / videoFps : 0;

  // NOTE: CSS transform 字符串
  const videoTransform = [
    rotation !== 0 ? `rotate(${rotation}deg)` : '',
    flipH ? 'scaleX(-1)' : '',
    flipV ? 'scaleY(-1)' : '',
  ].filter(Boolean).join(' ') || 'none';

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

    // 自动检测 FPS（用 MediaInfo WASM 解析文件元数据，精确读取容器帧率）
    const detected = await detectFpsFromFile(file);
    if (detected && detected > 0) {
      setVideoFps(detected);
      setFpsAutoDetected(true);
    }
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
              <video
                ref={videoRef}
                src={videoSrc}
                preload="auto"
                style={{
                  transform: videoTransform,
                  clipPath: cropRect
                    ? `inset(${cropRect.top}% ${cropRect.right}% ${cropRect.bottom}% ${cropRect.left}%)`
                    : undefined,
                }}
              />
              {/* Crop overlay */}
              {cropMode && (
                <div
                  className="fc-crop-overlay"
                  onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    cropStartRef.current = { x, y };
                    setCropRect(null);
                  }}
                  onMouseMove={(e) => {
                    if (!cropStartRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
                    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
                    const s = cropStartRef.current;
                    setCropRect({
                      top: Math.min(s.y, y),
                      left: Math.min(s.x, x),
                      bottom: 100 - Math.max(s.y, y),
                      right: 100 - Math.max(s.x, x),
                    });
                  }}
                  onMouseUp={() => { cropStartRef.current = null; }}
                >
                  {cropRect && (
                    <div
                      className="fc-crop-selection"
                      style={{
                        top: `${cropRect.top}%`,
                        left: `${cropRect.left}%`,
                        right: `${cropRect.right}%`,
                        bottom: `${cropRect.bottom}%`,
                      }}
                    />
                  )}
                  <span className="fc-crop-hint">Drag to select crop area</span>
                </div>
              )}
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

          {/* Image Settings */}
          <div className="fc-panel fc-image-panel">
            <div className="fc-panel-title">Image Settings</div>

            <div className="fc-field">
              <span className="fc-label">Rotation</span>
              <div className="fc-rotation-group">
                {ROTATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`fc-rot-btn ${rotation === opt.value ? 'active' : ''}`}
                    onClick={() => setRotation(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fc-field">
              <span className="fc-label">Flip</span>
              <button
                className={`fc-flip-btn ${flipH ? 'active' : ''}`}
                onClick={() => setFlipH(!flipH)}
              >
                ↔ Horizontal
              </button>
              <button
                className={`fc-flip-btn ${flipV ? 'active' : ''}`}
                onClick={() => setFlipV(!flipV)}
              >
                ↕ Vertical
              </button>
            </div>

            <div className="fc-field">
              <span className="fc-label">Crop</span>
              <button
                className={`fc-crop-btn ${cropMode ? 'active' : ''}`}
                onClick={() => {
                  if (cropMode) {
                    // Apply: 退出裁切模式
                    setCropMode(false);
                    if (cropRect) showToast('Crop applied');
                  } else {
                    // Enter crop mode
                    setCropMode(true);
                    setCropRect(null);
                  }
                }}
              >
                <IconCrop /> {cropMode ? 'Apply Crop' : 'Set Crop'}
              </button>
              {cropRect && !cropMode && (
                <button
                  className="fc-crop-btn"
                  onClick={() => { setCropRect(null); showToast('Crop cleared'); }}
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {(rotation !== 0 || flipH || flipV || cropRect) && (
              <button
                className="fc-reset-btn"
                onClick={() => {
                  setRotation(0);
                  setFlipH(false);
                  setFlipV(false);
                  setCropRect(null);
                  setCropMode(false);
                  showToast('Image settings reset');
                }}
              >
                Reset All
              </button>
            )}
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

          {/* Time → Frames 计算器 */}
          <div className="fc-panel fc-t2f-panel">
            <div className="fc-panel-title">Time → Frames</div>
            <p className="fc-t2f-desc">
              Enter a solve time (seconds). Frame count is calculated using WCA convention:
              <code className="fc-formula">⌈(⌊time⌋₂ + 0.009) × fps⌉ + 1</code>
            </p>

            <div className="fc-field">
              <span className="fc-label">Solve Time (s)</span>
              <input
                className="fc-input"
                type="number"
                step="0.01"
                min={0}
                placeholder="e.g. 4.89"
                value={solveTime}
                onChange={(e) => setSolveTime(e.target.value)}
              />
            </div>

            {solveTime && parseFloat(solveTime) > 0 && (
              <div className="fc-t2f-table-wrap">
                <table className="fc-t2f-table">
                  <thead>
                    <tr>
                      <th>FPS</th>
                      <th>Frames</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMMON_FPS.map((fps) => {
                      const frames = timeToFrames(parseFloat(solveTime), fps);
                      const isActive = Math.abs(fps - videoFps) < 0.5;
                      return (
                        <tr key={fps} className={isActive ? 'fc-t2f-active' : ''}>
                          <td>{fps}</td>
                          <td>{frames}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                        {j > 0 && <span style={{ color: '#888', margin: '0 2px' }}>+</span>}
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
