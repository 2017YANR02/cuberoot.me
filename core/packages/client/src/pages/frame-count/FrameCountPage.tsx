/**
 * @module FrameCountPage
 * 数帧工具 — ReconViewer 风格，支持多 Solve 和 Split Mark。
 * 加载本地视频，逐帧控制，标记帧，计算精确时间差。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import mediaInfoFactory from 'mediainfo.js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { useFrameBuffer } from './useFrameBuffer';

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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.13 1L6 16a2 2 0 002 2h15" />
    <path d="M1 6.13L16 6a2 2 0 012 2v15" />
  </svg>
);

const IconExport = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const THUMBNAIL_COUNT = 25;

// ── 类型定义 ──────────────────────────────────────────────────────────────

interface Mark {
  frame: number;
}

interface Solve {
  name: string;
  marks: Mark[];
}




/** 旋转角度循环: 0 → 90 → 180 → 270 → 0 */
type RotationDeg = 0 | 90 | 180 | 270;
const NEXT_ROTATION: Record<RotationDeg, RotationDeg> = { 0: 90, 90: 180, 180: 270, 270: 0 };

/** WCA 时间→帧数公式 */
function timeToFrames(time: number, fps: number): number {
  const truncated = Math.floor(time * 100) / 100;
  return Math.ceil((truncated + 0.009) * fps);
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
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [videoName, setVideoName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [totalFrames, setTotalFrames] = useState(0);

  // WebCodecs 帧缓冲 canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [useCanvasDisplay, setUseCanvasDisplay] = useState(false);



  // 帧计数状态
  const [videoFps, setVideoFps] = useState(60);

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


  // 图像变换（独立状态）
  const [rotation, setRotation] = useState<RotationDeg>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<{ top: number; left: number; bottom: number; right: number } | null>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);

  // 缩放 + 平移（鼠标滚轮缩放，鼠标/触摸拖动平移）
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  // Ref 跟踪最新值，避免快速滚轮事件中闭包捕获的值过时
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  // Timeline trimmer
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const trimTrackRef = useRef<HTMLDivElement>(null);
  const trimDragRef = useRef<{ side: 'left' | 'right' | 'seek'; startX: number; startVal: number } | null>(null);

  // FFmpeg export
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // wrapper 的 transform（translate 在 scale 之前，translate 单位是屏幕像素）
  const getZoomStyle = useCallback((): React.CSSProperties => {
    if (zoom <= 1 && pan.x === 0 && pan.y === 0) return {};
    return {
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: 'center center',
    };
  }, [zoom, pan]);

  // 滚轮缩放 — 鼠标位置为不动点（支持鼠标滚轮 + 触控板双指缩放）
  const handleVideoZoom = useCallback((e: WheelEvent) => {
    if (e.shiftKey || cropMode) return;
    e.preventDefault();
    e.stopPropagation();
    const target = wrapperRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();

    // getBoundingClientRect() 返回的是变换后的 rect
    // rect center = naturalCenter + panX（因为 translate 在 scale 之前）
    // 所以要减去当前 pan 才能得到鼠标相对于未变换中心的偏移
    const curPan = panRef.current;
    const curZoom = zoomRef.current;
    const mx = e.clientX - (rect.left + rect.width / 2) + curPan.x;
    const my = e.clientY - (rect.top + rect.height / 2) + curPan.y;

    const factor = e.deltaY > 0 ? 1 / 1.18 : 1.18;
    const newZoom = Math.max(1, Math.min(8, curZoom * factor));

    if (newZoom <= 1) {
      zoomRef.current = 1;
      panRef.current = { x: 0, y: 0 };
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    // 不动点公式：newPan = mx*(1-r) + prevPan*r，其中 r = newZoom/prevZoom
    const r = newZoom / curZoom;
    const newPan = {
      x: mx * (1 - r) + curPan.x * r,
      y: my * (1 - r) + curPan.y * r,
    };
    zoomRef.current = newZoom;
    panRef.current = newPan;
    setZoom(newZoom);
    setPan(newPan);
  }, [cropMode]);

  // 拖动开始（鼠标 + 触摸）
  const handlePanStart = useCallback((clientX: number, clientY: number) => {
    if (cropMode) return;
    isPanningRef.current = true;
    lastPanPosRef.current = { x: clientX, y: clientY };
  }, [cropMode]);

  // 拖动移动
  const handlePanMove = useCallback((clientX: number, clientY: number) => {
    if (!isPanningRef.current) return;
    const dx = clientX - lastPanPosRef.current.x;
    const dy = clientY - lastPanPosRef.current.y;
    lastPanPosRef.current = { x: clientX, y: clientY };
    setPan(prev => {
      const next = { x: prev.x + dx, y: prev.y + dy };
      panRef.current = next;
      return next;
    });
  }, []);

  // 拖动结束
  const handlePanEnd = useCallback(() => {
    isPanningRef.current = false;
  }, []);
  const [solveTime, setSolveTime] = useState('');
  const [wcaEndFrame, setWcaEndFrame] = useState(0);

  // ── WebCodecs 帧缓冲 ──
  const { getFrame, prefetch, isReady: frameBufferReady, samples: fbSamples, decoderConfig: fbDecoderConfig } = useFrameBuffer(videoFile, videoFps);

  // ── 计算值 ──

  const activeSolve = solves[activeSolveIdx] || solves[0];
  const solveTimeNum = parseFloat(solveTime) || 0;
  const wcaFrames = solveTimeNum > 0 && videoFps > 0 ? timeToFrames(solveTimeNum, videoFps) : 0;
  const wcaStartFrame = Math.max(0, wcaEndFrame - wcaFrames);

  // 图像 transform CSS（应用到 video 元素）
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
    if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
    if (flipH) transforms.push('scaleX(-1)');
    if (flipV) transforms.push('scaleY(-1)');
    return {
      transform: transforms.length > 0 ? transforms.join(' ') : 'none',
      clipPath: (cropRect && !cropMode)
        ? `inset(${cropRect.top}% ${cropRect.right}% ${cropRect.bottom}% ${cropRect.left}%)`
        : undefined,
    };
  }, [rotation, flipH, flipV, cropRect, cropMode]);




  // ── Toast ──

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }, []);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => showToast(`Copied ${label}`));
  }, [showToast]);

  // ── 视频控制 ──

  const seekRafRef = useRef(0);
  const seekToFrame = useCallback((frame: number) => {
    const video = videoRef.current;
    if (!video || videoFps <= 0) return;
    const f = Math.max(0, frame);
    // 立即更新 UI
    currentFrameRef.current = f;
    setCurrentFrame(f);
    
    cancelAnimationFrame(seekRafRef.current);

    if (frameBufferReady) {
      // Tier 1: WebCodecs 绝对索引渲染（无视底层游标）
      prefetch(f, 30);
      const tryRender = () => {
        if (currentFrameRef.current !== f) return; // Superceded
        const bmp = getFrame(f);
        if (bmp) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (ctx && canvas) {
            canvas.width = bmp.width;
            canvas.height = bmp.height;
            ctx.drawImage(bmp, 0, 0);
          }
          setUseCanvasDisplay(true);
          // 仅兜底音轨和进度同步，采用 +0.5 半帧安全偏移
          video.currentTime = (f + 0.5) / videoFps;
        } else {
          seekRafRef.current = requestAnimationFrame(tryRender);
        }
      };
      tryRender();
    } else {
      // Tier 2: 纯 Video 降级方案容差策略 (A/V 同步偏移的最终防线)
      if (!seekingRef.current) {
        seekingRef.current = true;
        const doSeek = () => {
          const target = currentFrameRef.current;
          video.addEventListener('seeked', () => {
            seekingRef.current = false;
            if (currentFrameRef.current !== target) {
              seekingRef.current = true;
              doSeek();
            }
          }, { once: true });
          video.currentTime = (target + 0.5) / videoFps;
          setUseCanvasDisplay(false);
        };
        doSeek();
      }
    }
  }, [videoFps, frameBufferReady, getFrame, prefetch]);

  // 用 ref 追踪帧号，避免快速连按时闭包中 currentFrame 过时
  const currentFrameRef = useRef(0);
  const seekingRef = useRef(false);
  const holdPlayingRef = useRef(false); // 长按 D/A 时播放中


  // 同步 ref（播放、拖动等路径更新帧号时）
  useEffect(() => { currentFrameRef.current = currentFrame; }, [currentFrame]);

  const stepFrames = useCallback((n: number) => {
    const video = videoRef.current;
    if (!video || videoFps <= 0) return;

    // 统一用 seek — play+pause 方式在高帧率视频下不精确
    video.pause();
    setIsPlaying(false);
    currentFrameRef.current = Math.max(0, currentFrameRef.current + n);
    // Clamp within trim range
    const effEnd = trimEnd || totalFrames;
    if (trimStart > 0 || effEnd < totalFrames) {
      currentFrameRef.current = Math.max(trimStart, Math.min(currentFrameRef.current, effEnd));
    }
    // 立即更新 UI 帧号（不等 seek 完成）
    setCurrentFrame(currentFrameRef.current);
    
    cancelAnimationFrame(seekRafRef.current);

    if (frameBufferReady) {
      const target = currentFrameRef.current;
      prefetch(target, 30);
      const tryRender = () => {
        if (currentFrameRef.current !== target) return; 
        const bmp = getFrame(target);
        if (bmp) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (ctx && canvas) {
            canvas.width = bmp.width;
            canvas.height = bmp.height;
            ctx.drawImage(bmp, 0, 0);
          }
          setUseCanvasDisplay(true);
          video.currentTime = (target + 0.5) / videoFps;
        } else {
          seekRafRef.current = requestAnimationFrame(tryRender);
        }
      };
      tryRender();
    } else {
      if (!seekingRef.current) {
        seekingRef.current = true;
        const doSeek = () => {
          const target = currentFrameRef.current;
          video.addEventListener('seeked', () => {
            seekingRef.current = false;
            if (currentFrameRef.current !== target) {
              seekingRef.current = true;
              doSeek();
            }
          }, { once: true });
          video.currentTime = (target + 0.5) / videoFps;
          setUseCanvasDisplay(false);
        };
        doSeek();
      }
    }
  }, [videoFps, trimStart, trimEnd, totalFrames, frameBufferReady, getFrame, prefetch]);

  const stepSeconds = useCallback((s: number) => {
    const video = videoRef.current;
    if (!video || videoFps <= 0) return;
    const newTime = Math.max(0, video.currentTime + s);
    video.currentTime = newTime;
    setCurrentFrame(Math.floor(newTime * videoFps));
    setUseCanvasDisplay(false);
  }, [videoFps]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { 
      video.muted = false; 
      video.play(); 
      setIsPlaying(true); 
      setUseCanvasDisplay(false);
    }
    else { 
      video.pause(); 
      setIsPlaying(false); 
    }
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
    // 防止重复标记同一帧
    if (solves[activeSolveIdx]?.marks.some(m => m.frame === currentFrame)) return;
    setSolves(prev => {
      const next = [...prev];
      const solve = { ...next[activeSolveIdx] };
      solve.marks = [...solve.marks, { frame: currentFrame }].sort((a, b) => a.frame - b.frame);
      next[activeSolveIdx] = solve;
      return next;
    });
    showToast(`Mark added at frame ${currentFrame}`);
    // WCA 自动跳转：填写了 Time 时，M 标记 End Frame 后自动跳转到 Start Frame 并自动 Add
    if (solveTimeNum > 0 && videoFps > 0) {
      setWcaEndFrame(currentFrame);
      const frames = timeToFrames(solveTimeNum, videoFps);
      const startFrame = Math.max(0, currentFrame - frames);
      seekToFrame(startFrame);
      // 自动添加 startFrame 的 mark（如果不重复）
      setSolves(prev => {
        const next = [...prev];
        const solve = { ...next[activeSolveIdx] };
        if (!solve.marks.some(m => m.frame === startFrame)) {
          solve.marks = [...solve.marks, { frame: startFrame }].sort((a, b) => a.frame - b.frame);
          next[activeSolveIdx] = solve;
        }
        return next;
      });
    }
  }, [activeSolveIdx, currentFrame, solves, showToast, solveTimeNum, videoFps, seekToFrame]);

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
        // 只在播放时由 video 驱动 currentFrame；手动 step 时 video 被 pause，RVFC 不会干扰
        if (videoFps > 0 && !video.paused) {
          setCurrentFrame(Math.floor(video.currentTime * videoFps));
        }
        handle = video.requestVideoFrameCallback(onFrame);
      };
      handle = video.requestVideoFrameCallback(onFrame);
      return () => video.cancelVideoFrameCallback(handle);
    } else {
      const onTimeUpdate = () => {
        if (videoFps > 0 && !video.paused) {
          setCurrentFrame(Math.floor(video.currentTime * videoFps));
        }
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
    setVideoFile(file);

    setVideoName(file.name);
    setCurrentFrame(0);
    setIsPlaying(false);
    setUseCanvasDisplay(false);


    setSolves([{ name: 'Solve 1', marks: [] }]);
    setActiveSolveIdx(0);
    setSelectedMarkIdx(null);
    const detected = await detectFpsFromFile(file);
    if (detected && detected > 0) {
      setVideoFps(detected);
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
      const key = e.key.toLowerCase();

      // 长按 D/A：流畅播放
      if (e.repeat && (key === 'd' || key === '.' || key === 'a' || key === ',')) {
        e.preventDefault();
        const video = videoRef.current;
        if (video && !holdPlayingRef.current) {
          holdPlayingRef.current = true;
          video.muted = true;
          // 打断 stepFrames 的 seeked 链，避免冲突
          seekingRef.current = false;
          if (key === 'a' || key === ',') {
            // 向后：WebCodecs 帧缓冲 + seeked 链 fallback
            // 关键：保持统一节奏，不在 rAF 和 seeked 之间交替
            let hitCount = 0, missCount = 0;

            // prefetch 全偏后退方向
            console.log(`[StepBack] START frame=${currentFrameRef.current}, bufferReady=${frameBufferReady}`);
            if (frameBufferReady) {
              prefetch(currentFrameRef.current, 60, 'backward');
            }

            const stepBack = () => {
              if (!holdPlayingRef.current) {
                console.log(`[StepBack] STOP — hits: ${hitCount}, misses: ${missCount}`);
                return;
              }
              const f = Math.max(0, currentFrameRef.current - 1);

              const bitmap = frameBufferReady ? getFrame(f) : null;
              if (bitmap) {
                // 缓冲命中 — 渲染到 canvas
                currentFrameRef.current = f;
                setCurrentFrame(f);
                hitCount++;
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext('2d');
                if (ctx && canvas) {
                  canvas.width = bitmap.width;
                  canvas.height = bitmap.height;
                  ctx.drawImage(bitmap, 0, 0);
                }
                setUseCanvasDisplay(true);

                // 每消费 10 帧，触发新一轮 prefetch 补充缓存
                if (hitCount % 10 === 0) {
                  prefetch(f, 60, 'backward');
                }
                requestAnimationFrame(stepBack);
              } else if (frameBufferReady) {
                // 缓冲 READY 但当前帧还没解码 — 不走 seeked 链
                // 保持当前画面冻住，rAF 下一帧重试（等 prefetch 完成）
                missCount++;
                if (missCount <= 3) {
                  console.log(`[StepBack] WAIT frame=${f}, prefetch in progress...`);
                }
                requestAnimationFrame(stepBack);
              } else {
                // WebCodecs 不可用 — 传统 seeked 链 fallback
                currentFrameRef.current = f;
                setCurrentFrame(f);
                missCount++;
                setUseCanvasDisplay(false);
                video.addEventListener('seeked', stepBack, { once: true });
                video.currentTime = f / videoFps;
              }
            };
            stepBack();
          } else {
            video.play();
            setIsPlaying(true);
            setUseCanvasDisplay(false);
          }
        }
        return;
      }

      switch (key) {
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

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((key === 'd' || key === '.' || key === 'a' || key === ',') && holdPlayingRef.current) {
        holdPlayingRef.current = false;
        const video = videoRef.current;
        if (video) {
          video.pause();
          video.muted = true;
          setIsPlaying(false);

          if (useCanvasDisplay) {
            // 从 canvas 回到 video：同步 video.currentTime 到当前帧
            const f = currentFrameRef.current;
            video.currentTime = f / videoFps;
            setUseCanvasDisplay(false);
          } else {
            const f = Math.floor(video.currentTime * videoFps);
            currentFrameRef.current = f;
            setCurrentFrame(f);
          }

          // 触发 prefetch 以备下次后退
          if (frameBufferReady) {
            prefetch(currentFrameRef.current, 30);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [togglePlay, stepFrames, stepSeconds, currentFrame, addMark, addSolve, copyToClipboard, videoFps, totalFrames, frameBufferReady, getFrame, prefetch, useCanvasDisplay]);

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

  // 视频区域缩放 — 非 passive 以阻止浏览器默认缩放（触控板双指缩放）+ 阻止页面滚动
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      // 鼠标在视频上时，始终阻止页面滚动和浏览器缩放
      e.preventDefault();
      // shift+scroll 由 window 级别的 frame-stepping handler 处理
      if (e.shiftKey) return;
      handleVideoZoom(e);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [handleVideoZoom, videoSrc]);

  // ── 生成缩略图 ──
  useEffect(() => {
    if (!videoSrc || totalFrames <= 0 || videoFps <= 0) return;
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.src = videoSrc;
    const canvas = document.createElement('canvas');
    const ctx2 = canvas.getContext('2d')!;
    const thumbArr: string[] = [];
    let cancelled = false;

    video.addEventListener('loadedmetadata', () => {
      const dur = video.duration;
      if (!dur || dur <= 0) return;
      canvas.width = 120;
      canvas.height = Math.round(120 * (video.videoHeight / video.videoWidth) || 68);
      let idx = 0;
      const times = Array.from({ length: THUMBNAIL_COUNT }, (_, i) => (i / (THUMBNAIL_COUNT - 1)) * dur);

      const grabNext = () => {
        if (cancelled || idx >= times.length) {
          if (!cancelled) setThumbnails([...thumbArr]);
          video.src = '';
          return;
        }
        video.currentTime = times[idx];
      };

      video.addEventListener('seeked', () => {
        ctx2.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbArr.push(canvas.toDataURL('image/jpeg', 0.5));
        idx++;
        grabNext();
      });
      grabNext();
    });

    return () => { cancelled = true; };
  }, [videoSrc, totalFrames, videoFps]);

  // ── Timeline trim 拖拽 ──
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = trimDragRef.current;
      const track = trimTrackRef.current;
      if (!d || !track || totalFrames <= 0) return;
      e.preventDefault();
      const rect = track.getBoundingClientRect();
      const dx = e.clientX - d.startX;
      const frameDelta = Math.round((dx / rect.width) * totalFrames);
      if (d.side === 'left') {
        const raw = Math.max(0, Math.min(d.startVal + frameDelta, (trimEnd || totalFrames) - 1));
        setTrimStart(raw);
        seekToFrame(raw);
      } else if (d.side === 'right') {
        const raw = Math.max(trimStart + 1, Math.min(d.startVal + frameDelta, totalFrames));
        setTrimEnd(raw);
        seekToFrame(raw);
      } else {
        // Clamp seek within trim range
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const effEnd = trimEnd || totalFrames;
        const frame = Math.max(trimStart, Math.min(Math.round(frac * totalFrames), effEnd));
        seekToFrame(frame);
      }
    };
    const onUp = () => { trimDragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [totalFrames, trimStart, trimEnd, seekToFrame]);

  // ── Export logic ──
  const handleExport = useCallback(async () => {
    if (!videoFile || !videoSrc || exporting) return;
    setExporting(true);
    setExportProgress(0);

    const es = trimStart;
    const ee = trimEnd || totalFrames;
    const hasTrim = es > 0 || (trimEnd > 0 && trimEnd < totalFrames);
    const startTime = hasTrim && videoFps > 0 ? es / videoFps : 0;
    const endTime = hasTrim && videoFps > 0 ? ee / videoFps : (videoRef.current?.duration || 0);
    const baseName = videoFile.name.replace(/\.[^.]+$/, '');

    try {
      if (cropRect) {
        // ── Crop export: WebCodecs pipeline (GPU hardware accelerated, frame-perfect) ──
        // VideoDecoder (GPU HEVC decode) → OffscreenCanvas crop → VideoEncoder (GPU H.264) → mp4-muxer
        // Zero frame drops, zero duplicates, original timestamps preserved, faster than realtime.
        if (!frameBufferReady || fbSamples.length === 0 || !fbDecoderConfig) {
          throw new Error('WebCodecs not ready. Please wait for video to fully load.');
        }
        showToast('Exporting (WebCodecs GPU)...');

        const vid = videoRef.current!;
        const vw = vid.videoWidth;
        const vh = vid.videoHeight;
        // Crop dimensions (must be even for H.264)
        let cropW = Math.round(((100 - cropRect.left - cropRect.right) / 100) * vw);
        let cropH = Math.round(((100 - cropRect.top - cropRect.bottom) / 100) * vh);
        cropW = cropW & ~1;
        cropH = cropH & ~1;
        const cx = Math.round((cropRect.left / 100) * vw);
        const cy = Math.round((cropRect.top / 100) * vh);

        // Frame range
        const startIdx = Math.max(0, es);
        const endIdx = Math.min(fbSamples.length - 1, ee - 1);
        const exportCount = endIdx - startIdx + 1;
        if (exportCount <= 0) throw new Error('No frames in selected range');

        // Find nearest keyframe at or before startIdx (needed for decoder pre-roll)
        let keyIdx = startIdx;
        while (keyIdx > 0 && !fbSamples[keyIdx].isSync) keyIdx--;

        // Set up mp4-muxer
        const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
        const muxTarget = new ArrayBufferTarget();
        const muxer = new Muxer({
          target: muxTarget,
          video: {
            codec: 'avc',
            width: cropW,
            height: cropH,
          },
          fastStart: 'in-memory',
          firstTimestampBehavior: 'offset',
        });

        // OffscreenCanvas for crop drawing
        const cvs = new OffscreenCanvas(cropW, cropH);
        const ctx2d = cvs.getContext('2d')!;

        // Base timestamp (output starts from 0)
        const baseTs = Math.trunc(fbSamples[startIdx].timestamp);

        // Timestamp → sample index map for robust frame identification
        // Key must be Math.trunc() because SampleInfo.timestamp is float but
        // VideoDecoder outputs integer μs timestamps — without rounding, ~2/3 of
        // frames fail the Map lookup and get silently dropped.
        const tsMap = new Map<number, number>();
        for (let i = keyIdx; i <= endIdx; i++) {
          tsMap.set(Math.trunc(fbSamples[i].timestamp), i);
        }

        // VideoEncoder → muxer
        const encoder = new VideoEncoder({
          output: (chunk, meta) => { muxer.addVideoChunk(chunk, meta ?? undefined); },
          error: (e) => console.error('[Export] Encoder error:', e),
        });
        encoder.configure({
          codec: 'avc1.640033', // H.264 High Profile Level 5.1 (supports up to 4K crop)
          width: cropW,
          height: cropH,
          bitrate: 16_000_000,
          framerate: videoFps,
        });

        // VideoDecoder → crop → encode
        let processedCount = 0;
        await new Promise<void>((resolveExport, rejectExport) => {
          const decoder = new VideoDecoder({
            output: (frame: VideoFrame) => {
              try {
                const idx = tsMap.get(frame.timestamp);
                if (idx === undefined || idx < startIdx || idx > endIdx) {
                  frame.close(); // pre-roll frame, skip
                  return;
                }
                // Draw cropped region
                ctx2d.drawImage(frame as any, cx, cy, cropW, cropH, 0, 0, cropW, cropH);
                frame.close();

                // Create new VideoFrame from cropped canvas with exact original timestamp
                const croppedFrame = new VideoFrame(cvs, {
                  timestamp: Math.trunc(fbSamples[idx].timestamp) - baseTs,
                  duration: Math.trunc(fbSamples[idx].duration),
                });
                encoder.encode(croppedFrame, { keyFrame: processedCount % 60 === 0 });
                croppedFrame.close();

                processedCount++;
                setExportProgress(Math.round((processedCount / exportCount) * 100));
              } catch (e) {
                rejectExport(e as Error);
              }
            },
            error: (e) => rejectExport(new Error(`Decoder error: ${e.message}`)),
          });

          decoder.configure(fbDecoderConfig);

          // Feed encoded samples from keyframe through end
          for (let i = keyIdx; i <= endIdx; i++) {
            const s = fbSamples[i];
            decoder.decode(new EncodedVideoChunk({
              type: s.isSync ? 'key' : 'delta',
              timestamp: s.timestamp,
              duration: s.duration,
              data: s.data,
            }));
          }

          decoder.flush().then(async () => {
            decoder.close();
            await encoder.flush();
            encoder.close();
            resolveExport();
          }).catch(rejectExport);
        });

        // Finalize MP4 and download
        muxer.finalize();
        const mp4Buf = muxTarget.buffer;
        console.log('[Export] WebCodecs output:', mp4Buf.byteLength, 'bytes,', processedCount, 'frames');
        const blob = new Blob([mp4Buf], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_crop.mp4`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // ── Trim-only: fast stream copy with ffmpeg.wasm ──
        if (!ffmpegRef.current) {
          showToast('Loading FFmpeg engine...');
          const ff = new FFmpeg();
          ff.on('progress', ({ progress }) => setExportProgress(Math.round(progress * 100)));
          ff.on('log', ({ message }) => console.log('[ffmpeg]', message));
          const coreURL = await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript');
          const wasmURL = await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm');
          const workerURL = await toBlobURL('/ffmpeg/ffmpeg-core.worker.js', 'text/javascript');
          await ff.load({ coreURL, wasmURL, workerURL });
          ffmpegRef.current = ff;
        }
        const ff = ffmpegRef.current;
        const inputName = 'input' + (videoFile.name.substring(videoFile.name.lastIndexOf('.')) || '.mp4');
        const inputData = await fetchFile(videoFile);
        console.log('[Export] Input file size:', inputData.length, 'bytes');
        await ff.writeFile(inputName, inputData);

        // Build args — -ss BEFORE -i for input-level seeking (avoids frozen keyframe gap)
        const ffArgs: string[] = [];
        if (hasTrim && videoFps > 0) {
          ffArgs.push('-ss', startTime.toFixed(4));
        }
        ffArgs.push('-i', inputName);
        if (hasTrim && videoFps > 0) {
          ffArgs.push('-t', (endTime - startTime).toFixed(4));
        }
        ffArgs.push('-c', 'copy', '-movflags', '+faststart', 'output.mp4');

        console.log('[Export] ffmpeg args:', ffArgs.join(' '));
        const exitCode = await ff.exec(ffArgs);
        console.log('[Export] ffmpeg exit code:', exitCode);
        if (exitCode !== 0) throw new Error(`FFmpeg exited with code ${exitCode}`);

        const outData = await ff.readFile('output.mp4');
        const buf = outData instanceof Uint8Array ? new Uint8Array(outData) : new TextEncoder().encode(outData as string);
        console.log('[Export] Output file size:', buf.length, 'bytes');
        const blob = new Blob([buf], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_export.mp4`;
        a.click();
        URL.revokeObjectURL(url);

        await ff.deleteFile(inputName);
        await ff.deleteFile('output.mp4');
      }
      showToast('Export complete!');
    } catch (err) {
      console.error('Export failed:', err);
      showToast(`Export failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [videoFile, videoSrc, exporting, trimStart, trimEnd, totalFrames, videoFps, cropRect, showToast, frameBufferReady, fbSamples, fbDecoderConfig]);

  // 总帧数
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoaded = () => {
      if (videoFps > 0 && isFinite(video.duration)) setTotalFrames(Math.round(video.duration * videoFps));
      // Safari/iOS 不会自动渲染第一帧，需要主动 seek 触发解码
      if (video.paused && video.currentTime === 0) {
        video.currentTime = 0.001;
      }
      // 首次加载：prefetch 起始帧
      if (frameBufferReady) {
        prefetch(0, 30);
      }
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadedmetadata', onLoaded);
    if (video.duration && isFinite(video.duration) && videoFps > 0) setTotalFrames(Math.round(video.duration * videoFps));
    return () => { video.removeEventListener('play', onPlay); video.removeEventListener('pause', onPause); video.removeEventListener('loadedmetadata', onLoaded); };
  }, [videoSrc, videoFps, frameBufferReady, prefetch]);

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
                {/* 顶部工具栏：文件名 + FPS/Crop/Image 设置 */}
                <div className="fc-video-toolbar">
                  <span className="fc-video-label">{videoName}</span>
                  <div className="fc-input-unit-wrap">
                    <input
                      className="fc-tab-input fc-toolbar-time"
                      type="number" step="0.01" min={0} placeholder="Time"
                      value={solveTime}
                      onChange={(e) => setSolveTime(e.target.value)}
                    />
                    {solveTime && <span className="fc-input-suffix">s</span>}
                  </div>

                  <div className="fc-toolbar-controls">
                    {/* FPS */}
                    <div className="fc-input-unit-wrap">
                      <input
                        className="fc-tab-input fc-toolbar-time"
                        type="number" min={1} step="any" value={videoFps}
                        onChange={(e) => setVideoFps(parseFloat(e.target.value) || 0)}
                        placeholder="FPS"
                      />
                      {videoFps > 0 && <span className="fc-input-suffix">fps</span>}
                    </div>

                    <div className="fc-toolbar-sep" />

                    {/* 图像变换按钮 */}
                    <button
                      className={`fc-toolbar-icon ${flipV ? 'active' : ''}`}
                      title="倒放 (Flip Vertical)"
                      onClick={() => setFlipV(v => !v)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M17 8l-5-5-5 5M17 16l-5 5-5-5"/></svg>
                    </button>
                    <button
                      className={`fc-toolbar-icon ${flipH ? 'active' : ''}`}
                      title="镜像 (Flip Horizontal)"
                      onClick={() => setFlipH(v => !v)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>
                    </button>
                    <button
                      className="fc-toolbar-icon"
                      title={`旋转 90° (${rotation}°)`}
                      onClick={() => setRotation(prev => NEXT_ROTATION[prev])}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                    </button>

                    {/* Crop — 切换裁切模式 */}
                    <button
                      className={`fc-toolbar-icon ${cropMode ? 'active' : ''}`}
                      title={cropMode ? 'Exit Crop' : 'Crop'}
                      onClick={() => {
                        if (cropMode) { setCropMode(false); }
                        else { setCropMode(true); setCropRect(null); }
                      }}
                    >
                      <IconCrop />
                    </button>


                  </div>

                  <button className="fc-change-video" onClick={() => fileInputRef.current?.click()}>
                    New
                  </button>
                  <button className="fc-export-btn" onClick={handleExport} disabled={exporting} title="Export as MP4">
                    <IconExport />
                    {exporting ? `${exportProgress}%` : 'Export'}
                  </button>
                </div>
                {/* 视频 wrapper — 紧贴视频尺寸，crop overlay / zoom / pan 都在这里 */}
                <div
                  ref={wrapperRef}
                  className={`fc-video-wrapper${cropMode ? '' : (zoom > 1 ? ' fc-panning' : ' fc-pannable')}`}
                  style={getZoomStyle()}
                  onMouseDown={(e) => { if (!cropMode) { e.preventDefault(); handlePanStart(e.clientX, e.clientY); } }}
                  onMouseMove={(e) => handlePanMove(e.clientX, e.clientY)}
                  onMouseUp={handlePanEnd}
                  onMouseLeave={handlePanEnd}
                  onTouchStart={(e) => { if (!cropMode) handlePanStart(e.touches[0].clientX, e.touches[0].clientY); }}
                  onTouchMove={(e) => { e.preventDefault(); handlePanMove(e.touches[0].clientX, e.touches[0].clientY); }}
                  onTouchEnd={handlePanEnd}
                >
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    preload="auto"
                    style={{
                      ...getVideoStyle(),
                      ...(useCanvasDisplay ? { visibility: 'hidden' as const } : {}),
                    }}
                  />

                  {/* WebCodecs 帧缓冲 canvas — 后退时覆盖 video */}
                  <canvas
                    ref={canvasRef}
                    className={`fc-canvas-overlay${useCanvasDisplay ? ' active' : ''}`}
                    style={getVideoStyle()}
                  />


                  {/* Crop overlay — 现在相对于视频而非容器 */}
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
                      onMouseUp={() => {
                        cropStartRef.current = null;
                        // 鼠标松开立即生效，自动退出 cropMode
                        setCropMode(false);
                      }}
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
                </div>
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
              {/* iOS-style timeline trimmer */}
              <div className="fc-timeline-trimmer" ref={trimTrackRef}>
                {/* Thumbnail filmstrip */}
                <div className="fc-timeline-filmstrip">
                  {thumbnails.map((src, i) => (
                    <img key={i} src={src} className="fc-timeline-thumb" alt="" draggable={false} />
                  ))}
                </div>

                {/* Dimmed areas outside trim range */}
                {(() => {
                  const effEnd = trimEnd || totalFrames;
                  const leftPct = totalFrames > 0 ? (trimStart / totalFrames) * 100 : 0;
                  const rightPct = totalFrames > 0 ? ((totalFrames - effEnd) / totalFrames) * 100 : 0;
                  return (
                    <>
                      <div className="fc-timeline-dim fc-timeline-dim-left" style={{ width: `${leftPct}%` }} />
                      <div className="fc-timeline-dim fc-timeline-dim-right" style={{ width: `${rightPct}%` }} />
                      {/* Yellow border between handles */}
                      <div className="fc-trim-border" style={{ left: `${leftPct}%`, width: `${100 - leftPct - rightPct}%` }} />
                    </>
                  );
                })()}

                {/* Left trim handle */}
                <div
                  className="fc-trim-handle fc-trim-handle-left"
                  style={{ left: `calc(${totalFrames > 0 ? (trimStart / totalFrames) * 100 : 0}% - 14px)` }}
                  onMouseDown={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    trimDragRef.current = { side: 'left', startX: e.clientX, startVal: trimStart };
                  }}
                >
                  <span className="fc-trim-chevron">‹</span>
                </div>

                {/* Right trim handle */}
                <div
                  className="fc-trim-handle fc-trim-handle-right"
                  style={{ left: `${totalFrames > 0 ? ((trimEnd || totalFrames) / totalFrames) * 100 : 100}%` }}
                  onMouseDown={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    trimDragRef.current = { side: 'right', startX: e.clientX, startVal: trimEnd || totalFrames };
                  }}
                >
                  <span className="fc-trim-chevron">›</span>
                </div>

                {/* Playhead with time tooltip */}
                {totalFrames > 0 && (() => {
                  const effEnd = trimEnd || totalFrames;
                  const clampedFrame = Math.max(trimStart, Math.min(currentFrame, effEnd));
                  const pct = (clampedFrame / totalFrames) * 100;
                  return (
                    <div className="fc-timeline-playhead" style={{ left: `${pct}%` }}>
                      <span className="fc-playhead-tooltip">{formatTime(currentFrame / videoFps)} ({currentFrame})</span>
                    </div>
                  );
                })()}

                {/* Click/drag to seek overlay */}
                <div
                  className="fc-timeline-seek-area"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const track = trimTrackRef.current;
                    if (!track || totalFrames <= 0) return;
                    const rect = track.getBoundingClientRect();
                    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const effEnd = trimEnd || totalFrames;
                    const frame = Math.max(trimStart, Math.min(Math.round(frac * totalFrames), effEnd));
                    seekToFrame(frame);
                    trimDragRef.current = { side: 'seek', startX: e.clientX, startVal: frame };
                  }}
                />

                {/* Mark indicators */}
                {activeSolve.marks.map((m, i) => {
                  if (totalFrames <= 0) return null;
                  const pct = (m.frame / totalFrames) * 100;
                  return (
                    <div key={i} className="fc-marker fc-marker-mark" style={{ left: `${pct}%` }} title={`Mark ${i}: ${m.frame}`} />
                  );
                })}
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
                <button className="fc-action-btn" onClick={addMark} disabled={activeSolve.marks.some(m => m.frame === currentFrame)}>Add</button>
                <button className="fc-action-btn" onClick={() => selectedMarkIdx !== null && removeMark(selectedMarkIdx)} disabled={selectedMarkIdx === null}>Remove</button>
                <button className="fc-action-btn" onClick={updateMark} disabled={selectedMarkIdx === null}>Update</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 底部 WCA 面板 ── */}
      {videoSrc && (
        <div className="fc-bottom-panel">
          <div className="fc-tab-bar">
            <button className={`fc-tab active`}>WCA</button>
          </div>

          <div className="fc-tab-content">
            <div className="fc-wca-grid">
              <span className="fc-tab-label">Frames</span>
              <div className="fc-wca-field">
                <span className="fc-tab-value">{wcaFrames || '—'}</span>
                <span className="fc-tab-unit">⌈(⌊t⌋₂+.009)×fps⌉</span>
              </div>

              <span className="fc-tab-label">End Frame</span>
              <div className="fc-wca-field">
                <input
                  className="fc-tab-input"
                  type="number" min={0} value={wcaEndFrame}
                  onChange={(e) => setWcaEndFrame(parseInt(e.target.value) || 0)}
                />
                <button className="fc-tab-btn" onClick={() => seekToFrame(wcaEndFrame)} title="Go to end frame">
                  Go
                </button>
              </div>

              <span className="fc-tab-label">Start Frame</span>
              <div className="fc-wca-field">
                <span className="fc-tab-value">{wcaEndFrame > 0 && wcaFrames > 0 ? wcaStartFrame : '—'}</span>
                <span className="fc-wca-formula">
                  = {wcaEndFrame > 0 ? wcaEndFrame : <em>End Frame</em>} − {wcaFrames > 0 ? wcaFrames : <em>Frames</em>}
                </span>
                <button className="fc-tab-btn" onClick={() => seekToFrame(wcaStartFrame)} title="Go to start frame" disabled={!(wcaEndFrame > 0 && wcaFrames > 0)}>
                  Go
                </button>
              </div>
            </div>
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
