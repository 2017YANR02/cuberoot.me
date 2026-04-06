/**
 * @module FrameCountPage
 * 数帧工具 — ReconViewer 风格，支持多 Solve 和 Split Mark。
 * 加载本地视频，逐帧控制，标记帧，计算精确时间差。
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

// ── 类型定义 ──────────────────────────────────────────────────────────────

interface Mark {
  frame: number;
}

interface Solve {
  name: string;
  marks: Mark[];
}



type BottomTab = 'setup' | 'image' | 'wca';

/** 图像变换选项 */
const IMAGE_TRANSFORMS = [
  { value: 'none', label: 'No Rotation' },
  { value: 'cw90', label: '90° CW' },
  { value: 'ccw90', label: '90° CCW' },
  { value: '180', label: '180°' },
  { value: 'flipH', label: 'Flip Horizontal' },
  { value: 'flipV', label: 'Flip Vertical' },
] as const;

type TransformValue = typeof IMAGE_TRANSFORMS[number]['value'];

/** WCA 时间→帧数公式 */
function timeToFrames(time: number, fps: number): number {
  const truncated = Math.floor(time * 100) / 100;
  return Math.ceil((truncated + 0.009) * fps) + 1;
}

// ── 时间格式化 ────────────────────────────────────────────────────────────

/** 格式化秒数为 mm:ss.mmm */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '00:00:000';
  const negative = seconds < 0;
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60).toString().padStart(2, '0');
  const s = Math.floor(abs % 60).toString().padStart(2, '0');
  const ms = Math.round((abs % 1) * 1000).toString().padStart(3, '0');
  const formatted = `${m}:${s}:${ms}`;
  return negative ? `-${formatted}` : formatted;
}

// ── MediaInfo FPS 检测 ──────────────────────────────────────────────────

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
    if (videoTrack.FrameRate_Num && videoTrack.FrameRate_Den) {
      return Math.round((videoTrack.FrameRate_Num / videoTrack.FrameRate_Den) * 100) / 100;
    }
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
  { section: 'Marking' },
  { action: 'Add Split Mark', keys: ['M'] },
  { action: 'Add Solve', keys: ['+'] },
  { section: 'Playback' },
  { action: 'Play / Pause', keys: ['K'] },
  { action: 'Forward 1 frame', keys: ['D'] },
  { action: 'Back 1 frame', keys: ['A'] },
  { action: 'Forward 10 frames', keys: ['E'] },
  { action: 'Back 10 frames', keys: ['Q'] },
  { action: 'Forward 1 frame (alt)', keys: ['.'] },
  { action: 'Back 1 frame (alt)', keys: [','] },
  { action: 'Scroll ±1 frame', keys: ['Shift', 'Scroll'] },
  { action: 'Forward 1 second', keys: ['L'] },
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

  // 播放速率
  const [playbackRate, setPlaybackRate] = useState(1);

  // 多 Solve 管理
  const [solves, setSolves] = useState<Solve[]>([{ name: 'Solve 1', marks: [] }]);
  const [activeSolveIdx, setActiveSolveIdx] = useState(0);
  const [selectedMarkIdx, setSelectedMarkIdx] = useState<number | null>(null);

  // UI 状态
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BottomTab>('setup');

  // 图像变换
  const [imageTransform, setImageTransform] = useState<TransformValue>('none');
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<{ top: number; left: number; bottom: number; right: number } | null>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);

  // WCA 模式（sliding 违规检测）
  const [solveTime, setSolveTime] = useState('');
  const [wcaEndFrame, setWcaEndFrame] = useState(0);

  // ── 计算值 ──

  const activeSolve = solves[activeSolveIdx] || solves[0];
  const solveTimeNum = parseFloat(solveTime) || 0;
  const wcaFrames = solveTimeNum > 0 && videoFps > 0 ? timeToFrames(solveTimeNum, videoFps) : 0;
  const wcaStartFrame = Math.max(0, wcaEndFrame - wcaFrames);

  // 图像 transform CSS
  const getVideoStyle = useCallback((): React.CSSProperties => {
    const transforms: string[] = [];
    // 裁切放大
    if (cropRect && !cropMode) {
      const visibleW = 100 - cropRect.left - cropRect.right;
      const visibleH = 100 - cropRect.top - cropRect.bottom;
      if (visibleW > 0 && visibleH > 0) {
        const scale = Math.min(100 / visibleW, 100 / visibleH);
        const centerX = cropRect.left + visibleW / 2;
        const centerY = cropRect.top + visibleH / 2;
        transforms.push(`scale(${scale}) translate(${50 - centerX}%, ${50 - centerY}%)`);
      }
    }
    switch (imageTransform) {
      case 'cw90': transforms.push('rotate(90deg)'); break;
      case 'ccw90': transforms.push('rotate(-90deg)'); break;
      case '180': transforms.push('rotate(180deg)'); break;
      case 'flipH': transforms.push('scaleX(-1)'); break;
      case 'flipV': transforms.push('scaleY(-1)'); break;
    }
    return {
      transform: transforms.length > 0 ? transforms.join(' ') : 'none',
      clipPath: cropRect
        ? `inset(${cropRect.top}% ${cropRect.right}% ${cropRect.bottom}% ${cropRect.left}%)`
        : undefined,
    };
  }, [imageTransform, cropRect, cropMode]);

  // ── Toast ──

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }, []);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => showToast(`Copied ${label}`));
  }, [showToast]);

  // ── 视频控制 ──

  const seekToFrame = useCallback((frame: number) => {
    const video = videoRef.current;
    if (!video || videoFps <= 0) return;
    const f = Math.max(0, frame);
    video.currentTime = f / videoFps;
    setCurrentFrame(f);
  }, [videoFps]);

  const stepFrames = useCallback((n: number) => {
    const video = videoRef.current;
    if (!video || videoFps <= 0) return;
    video.pause();
    setIsPlaying(false);
    const newFrame = Math.max(0, currentFrame + n);
    video.currentTime = newFrame / videoFps;
    setCurrentFrame(newFrame);
  }, [currentFrame, videoFps]);

  const stepSeconds = useCallback((s: number) => {
    const video = videoRef.current;
    if (!video || videoFps <= 0) return;
    const newTime = Math.max(0, video.currentTime + s);
    video.currentTime = newTime;
    setCurrentFrame(Math.round(newTime * videoFps));
  }, [videoFps]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); setIsPlaying(true); }
    else { video.pause(); setIsPlaying(false); }
  }, []);

  const changeRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  // ── Solve 管理 ──

  const addSolve = useCallback(() => {
    setSolves(prev => {
      const newSolves = [...prev, { name: `Solve ${prev.length + 1}`, marks: [] }];
      setActiveSolveIdx(newSolves.length - 1);
      return newSolves;
    });
    setSelectedMarkIdx(null);
    showToast('Solve added');
  }, [showToast]);

  const removeSolve = useCallback(() => {
    if (solves.length <= 1) { showToast('Cannot remove last solve'); return; }
    setSolves(prev => {
      const next = prev.filter((_, i) => i !== activeSolveIdx);
      setActiveSolveIdx(Math.min(activeSolveIdx, next.length - 1));
      return next;
    });
    setSelectedMarkIdx(null);
    showToast('Solve removed');
  }, [solves.length, activeSolveIdx, showToast]);

  const addMark = useCallback(() => {
    setSolves(prev => {
      const next = [...prev];
      const solve = { ...next[activeSolveIdx] };
      solve.marks = [...solve.marks, { frame: currentFrame }].sort((a, b) => a.frame - b.frame);
      next[activeSolveIdx] = solve;
      return next;
    });
    showToast(`Mark added at frame ${currentFrame}`);
  }, [activeSolveIdx, currentFrame, showToast]);

  const removeMark = useCallback((idx: number) => {
    setSolves(prev => {
      const next = [...prev];
      const solve = { ...next[activeSolveIdx] };
      solve.marks = solve.marks.filter((_, i) => i !== idx);
      next[activeSolveIdx] = solve;
      return next;
    });
    setSelectedMarkIdx(null);
  }, [activeSolveIdx]);

  const updateMark = useCallback(() => {
    if (selectedMarkIdx === null) return;
    setSolves(prev => {
      const next = [...prev];
      const solve = { ...next[activeSolveIdx] };
      solve.marks = solve.marks.map((m, i) => i === selectedMarkIdx ? { frame: currentFrame } : m).sort((a, b) => a.frame - b.frame);
      next[activeSolveIdx] = solve;
      return next;
    });
    showToast(`Mark ${selectedMarkIdx} updated to frame ${currentFrame}`);
  }, [activeSolveIdx, selectedMarkIdx, currentFrame, showToast]);

  // ── 视频帧同步 ──

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    const hasRVFC = typeof video.requestVideoFrameCallback === 'function';
    if (hasRVFC) {
      let handle: number;
      const onFrame = () => {
        if (videoFps > 0) setCurrentFrame(Math.round(video.currentTime * videoFps));
        handle = video.requestVideoFrameCallback(onFrame);
      };
      handle = video.requestVideoFrameCallback(onFrame);
      return () => video.cancelVideoFrameCallback(handle);
    } else {
      const onTimeUpdate = () => {
        if (videoFps > 0) setCurrentFrame(Math.round(video.currentTime * videoFps));
      };
      video.addEventListener('timeupdate', onTimeUpdate);
      return () => video.removeEventListener('timeupdate', onTimeUpdate);
    }
  }, [videoSrc, videoFps]);

  // ── 文件加载 ──

  const loadFile = useCallback(async (file: File) => {
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoName(file.name);
    setCurrentFrame(0);
    setIsPlaying(false);
    setFpsAutoDetected(false);
    setSolves([{ name: 'Solve 1', marks: [] }]);
    setActiveSolveIdx(0);
    setSelectedMarkIdx(null);
    const detected = await detectFpsFromFile(file);
    if (detected && detected > 0) {
      setVideoFps(detected);
      setFpsAutoDetected(true);
    }
  }, [videoSrc]);

  // ── 拖放 / 文件选择 ──

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) loadFile(file);
  }, [loadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }, [loadFile]);

  // ── 快捷键 ──

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      switch (e.key.toLowerCase()) {
        case 'k': e.preventDefault(); togglePlay(); break;
        case 'd': case '.': e.preventDefault(); stepFrames(1); break;
        case 'a': case ',': e.preventDefault(); stepFrames(-1); break;
        case 'e': e.preventDefault(); stepFrames(10); break;
        case 'q': e.preventDefault(); stepFrames(-10); break;
        case 'm': e.preventDefault(); addMark(); break;
        case '+': case '=': e.preventDefault(); addSolve(); break;
        case 'l': e.preventDefault(); stepSeconds(1); break;
        case 'c': e.preventDefault(); copyToClipboard(String(currentFrame), `frame ${currentFrame}`); break;
        case 'escape': setShowShortcuts(false); break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, stepFrames, stepSeconds, currentFrame, addMark, addSolve, copyToClipboard]);

  // Shift+滚轮逐帧
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey || !videoSrc) return;
      e.preventDefault();
      if (e.deltaY > 0) stepFrames(1); else if (e.deltaY < 0) stepFrames(-1);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [stepFrames, videoSrc]);

  // 总帧数
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoaded = () => {
      if (videoFps > 0 && isFinite(video.duration)) setTotalFrames(Math.round(video.duration * videoFps));
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadedmetadata', onLoaded);
    if (video.duration && isFinite(video.duration) && videoFps > 0) setTotalFrames(Math.round(video.duration * videoFps));
    return () => { video.removeEventListener('play', onPlay); video.removeEventListener('pause', onPause); video.removeEventListener('loadedmetadata', onLoaded); };
  }, [videoSrc, videoFps]);

  // ── Marks 计算 ──

  const marksWithDiffs = activeSolve.marks.map((m, i, arr) => {
    const prev = i > 0 ? arr[i - 1] : null;
    const diffFrames = prev ? m.frame - prev.frame : null;
    const diffTime = diffFrames !== null && videoFps > 0 ? diffFrames / videoFps : null;
    return { ...m, diffFrames, diffTime };
  });

  const totalMarkFrames = activeSolve.marks.length >= 2
    ? activeSolve.marks[activeSolve.marks.length - 1].frame - activeSolve.marks[0].frame
    : 0;
  const totalMarkTime = videoFps > 0 ? totalMarkFrames / videoFps : 0;

  // ── Render ──

  return (
    <div
      className="frame-count-page"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="fc-header">
        <Link to="/" className="fc-back"><IconBack /> Back</Link>
        <span className="fc-title">Frame Count</span>
        <button className="fc-shortcuts-btn" onClick={() => setShowShortcuts(true)}>
          <IconKeyboard /> Shortcuts
        </button>
      </header>

      {/* ── 主体：视频 + 右侧面板 ── */}
      <div className="fc-main">
        {/* 左侧：视频区域 */}
        <div className="fc-video-col">
          <div className={`fc-panel fc-video-zone ${dragging ? 'dragging' : ''}`}>
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
                  style={getVideoStyle()}
                />
                {/* 视频 overlay — 帧号/时间 */}
                <div className="fc-video-overlay">
                  {formatTime(currentFrame / videoFps)} ({currentFrame})
                </div>
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
                        top: Math.min(s.y, y), left: Math.min(s.x, x),
                        bottom: 100 - Math.max(s.y, y), right: 100 - Math.max(s.x, x),
                      });
                    }}
                    onMouseUp={() => { cropStartRef.current = null; }}
                  >
                    {cropRect && (
                      <div className="fc-crop-selection" style={{
                        top: `${cropRect.top}%`, left: `${cropRect.left}%`,
                        right: `${cropRect.right}%`, bottom: `${cropRect.bottom}%`,
                      }} />
                    )}
                    <span className="fc-crop-hint">Drag to select crop area</span>
                  </div>
                )}
              </>
            ) : (
              <div className={`fc-drop-hint ${dragging ? 'dragging' : ''}`} onClick={() => fileInputRef.current?.click()}>
                <IconUpload />
                <span className="fc-drop-text">Drop a video file here</span>
                <span className="fc-drop-sub">or click to select a file</span>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="video/*" className="fc-file-input" onChange={handleFileSelect} />
          </div>

          {/* ── 控制栏 ── */}
          {videoSrc && (
            <div className="fc-panel fc-controls-wrap">
              <div className="fc-progress-bar">
                <input
                  type="range" className="fc-progress-slider"
                  min={0} max={totalFrames || 1} value={currentFrame}
                  onChange={(e) => seekToFrame(parseInt(e.target.value))}
                  style={{
                    '--progress': totalFrames > 0 ? `${(currentFrame / totalFrames) * 100}%` : '0%',
                  } as React.CSSProperties}
                />
                {/* Mark indicators on progress bar */}
                {activeSolve.marks.map((m, i) => totalFrames > 0 && (
                  <div key={i} className="fc-marker fc-marker-mark" style={{ left: `${(m.frame / totalFrames) * 100}%` }} title={`Mark ${i}: ${m.frame}`} />
                ))}
              </div>

              <div className="fc-controls">
                <button className="fc-ctrl-btn" title="Back 10 frames (Q)" onClick={() => stepFrames(-10)}><IconSkipBack /></button>
                <button className="fc-ctrl-btn" title="Back 1 frame (A)" onClick={() => stepFrames(-1)}><IconFrameBack /></button>
                <button className="fc-ctrl-btn play-btn" title="Play/Pause (K)" onClick={togglePlay}>
                  {isPlaying ? <IconPause /> : <IconPlay />}
                </button>
                <button className="fc-ctrl-btn" title="Forward 1 frame (D)" onClick={() => stepFrames(1)}><IconFrameForward /></button>
                <button className="fc-ctrl-btn" title="Forward 10 frames (E)" onClick={() => stepFrames(10)}><IconSkipForward /></button>

                <div className="fc-ctrl-sep" />

                <div className="fc-rate-group">
                  {PLAYBACK_RATES.map((r) => (
                    <button key={r} className={`fc-rate-btn ${playbackRate === r ? 'active' : ''}`} onClick={() => changeRate(r)}>{r}x</button>
                  ))}
                </div>

                <div className="fc-ctrl-sep" />

                <span className="fc-ctrl-info">
                  {formatTime(currentFrame / videoFps)} <strong>({currentFrame})</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：Solve 面板 */}
        {videoSrc && (
          <div className="fc-solve-col">
            {/* Solve 选择器 */}
            <div className="fc-panel fc-solve-header">
              <select
                className="fc-solve-select"
                value={activeSolveIdx}
                onChange={(e) => { setActiveSolveIdx(parseInt(e.target.value)); setSelectedMarkIdx(null); }}
              >
                {solves.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
              </select>
              <button className="fc-solve-btn" title="Add Solve (+)" onClick={addSolve}>+</button>
              <button className="fc-solve-btn" title="Remove Solve" onClick={removeSolve}>−</button>
            </div>

            {/* Marks 列表 */}
            <div className="fc-panel fc-marks-panel">
              <div className="fc-marks-list">
                {marksWithDiffs.length === 0 && (
                  <div className="fc-marks-empty">No marks yet. Press <kbd>M</kbd> to add.</div>
                )}
                {marksWithDiffs.map((m, i) => (
                  <div key={i}>
                    <div
                      className={`fc-mark-row ${selectedMarkIdx === i ? 'selected' : ''}`}
                      onClick={() => { setSelectedMarkIdx(i); seekToFrame(m.frame); }}
                    >
                      <span className="fc-mark-idx">{i}:</span>
                      <span className="fc-mark-time">{formatTime(m.frame / videoFps)}</span>
                      <span className="fc-mark-frame">({m.frame})</span>
                      {m.diffFrames !== null && (
                        <span className="fc-mark-diff">{m.diffFrames}f ({m.diffTime!.toFixed(3)}s)</span>
                      )}
                    </div>
                  </div>
                ))}
                {activeSolve.marks.length >= 2 && (
                  <div className="fc-mark-total">
                    <span className="fc-mark-idx">Total:</span>
                    <span className="fc-mark-diff">{totalMarkFrames}f ({totalMarkTime.toFixed(3)}s)</span>
                  </div>
                )}
              </div>

              {/* Mark 操作按钮 */}
              <div className="fc-mark-actions">
                <button className="fc-action-btn" onClick={addMark}>Add</button>
                <button className="fc-action-btn" onClick={() => selectedMarkIdx !== null && removeMark(selectedMarkIdx)} disabled={selectedMarkIdx === null}>Remove</button>
                <button className="fc-action-btn" onClick={updateMark} disabled={selectedMarkIdx === null}>Update</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 底部标签面板 ── */}
      {videoSrc && (
        <div className="fc-bottom-panel">
          <div className="fc-tab-bar">
            <button className={`fc-tab ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}>Setup</button>
            <button className={`fc-tab ${activeTab === 'image' ? 'active' : ''}`} onClick={() => setActiveTab('image')}>Image</button>
            <button className={`fc-tab ${activeTab === 'wca' ? 'active' : ''}`} onClick={() => setActiveTab('wca')}>WCA</button>
          </div>

          <div className="fc-tab-content">
            {activeTab === 'setup' && (
              <div className="fc-tab-row">
                <span className="fc-tab-label">FPS</span>
                <input
                  className="fc-tab-input"
                  type="number" min={1} step="any" value={videoFps}
                  onChange={(e) => { setVideoFps(parseFloat(e.target.value) || 0); setFpsAutoDetected(false); }}
                />
                {fpsAutoDetected && <span className="fc-fps-auto">Auto</span>}

                <div className="fc-tab-sep" />

                <button
                  className={`fc-tab-btn ${cropMode ? 'active' : ''}`}
                  onClick={() => {
                    if (cropMode) { setCropMode(false); if (cropRect) showToast('Crop applied'); }
                    else { setCropMode(true); setCropRect(null); }
                  }}
                >
                  <IconCrop /> {cropMode ? 'Apply Crop' : 'Set Crop'}
                </button>
                {cropRect && !cropMode && (
                  <button className="fc-tab-btn" onClick={() => { setCropRect(null); showToast('Crop cleared'); }}>✕ Clear</button>
                )}
              </div>
            )}

            {activeTab === 'image' && (
              <div className="fc-tab-row">
                <select
                  className="fc-tab-select"
                  value={imageTransform}
                  onChange={(e) => setImageTransform(e.target.value as TransformValue)}
                >
                  {IMAGE_TRANSFORMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                <div className="fc-tab-sep" />

                {(imageTransform !== 'none' || cropRect) && (
                  <button className="fc-tab-btn reset" onClick={() => {
                    setImageTransform('none');
                    setCropRect(null); setCropMode(false);
                    showToast('Image settings reset');
                  }}>Reset All</button>
                )}
              </div>
            )}

            {activeTab === 'wca' && (
              <div className="fc-wca-grid">
                <span className="fc-tab-label">Solve Time</span>
                <div className="fc-wca-field">
                  <input
                    className="fc-tab-input"
                    type="number" step="0.01" min={0} placeholder="e.g. 4.89"
                    value={solveTime}
                    onChange={(e) => setSolveTime(e.target.value)}
                  />
                  <span className="fc-tab-unit">sec</span>
                </div>

                <span className="fc-tab-label">Frames</span>
                <div className="fc-wca-field">
                  <span className="fc-tab-value">{wcaFrames}</span>
                  <span className="fc-tab-unit">⌈(⌊t⌋₂+.009)×fps⌉+1</span>
                </div>

                <span className="fc-tab-label">End Frame</span>
                <div className="fc-wca-field">
                  <input
                    className="fc-tab-input"
                    type="number" min={0} value={wcaEndFrame}
                    onChange={(e) => setWcaEndFrame(parseInt(e.target.value) || 0)}
                  />
                  <button className="fc-tab-btn" onClick={() => setWcaEndFrame(currentFrame)} title="Mark current frame as end">
                    ] Mark
                  </button>
                  <button className="fc-tab-btn" onClick={() => seekToFrame(wcaEndFrame)} title="Go to end frame">
                    Go
                  </button>
                </div>

                <span className="fc-tab-label">Start Frame</span>
                <div className="fc-wca-field">
                  <span className="fc-tab-value">{wcaStartFrame}</span>
                  <button className="fc-tab-btn" onClick={() => seekToFrame(wcaStartFrame)} title="Go to start frame">
                    Go
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="fc-toast">{toast}</div>}

      {/* 快捷键弹窗 */}
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
