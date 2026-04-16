/**
 * @module FrameCountPage
 * 数帧工具 — ReconViewer 风格，支持多 Solve 和 Split Mark。
 * 加载本地视频，逐帧控制，标记帧，计算精确时间差。
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import mediaInfoFactory from 'mediainfo.js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { useFrameBuffer, IS_MOBILE } from './useFrameBuffer';
import { VideoInfoButton, DecodeErrorCard, LoadingProgressOverlay } from './VideoInfoPanels';

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

// ── 类型定义 ──────────────────────────────────────────────────────────────

interface Mark {
  frame: number;
}

interface Solve {
  name: string;
  marks: Mark[];
  time: string;
}




/** 旋转角度循环: 0 → 90 → 180 → 270 → 0 */
type RotationDeg = 0 | 90 | 180 | 270;
const NEXT_ROTATION: Record<RotationDeg, RotationDeg> = { 0: 90, 90: 180, 180: 270, 270: 0 };

/** WCA 时间→帧数公式 */
function timeToFrames(time: number, fps: number): number {
  const truncated = Math.floor(time * 100) / 100;
  return Math.ceil((truncated + 0.009) * fps);
}

// ── IndexedDB:持久化 FileSystemDirectoryHandle 列表(MRU,最多 N 个) ──
// 让用户在多个不同目录之间切换时,无需每次重新选 Folder
const FS_DB_NAME = 'frame-count-fs';
const FS_STORE = 'handles';
const FS_KEY = 'rememberedDirs';
const MAX_REMEMBERED_DIRS = 20;

function fsOpenDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(FS_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fsSaveDirs(dirs: FileSystemDirectoryHandle[]): Promise<void> {
  const db = await fsOpenDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FS_STORE, 'readwrite');
    tx.objectStore(FS_STORE).put(dirs, FS_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function fsLoadDirs(): Promise<FileSystemDirectoryHandle[]> {
  try {
    const db = await fsOpenDB();
    const result = await new Promise<FileSystemDirectoryHandle[]>((resolve, reject) => {
      const tx = db.transaction(FS_STORE, 'readonly');
      const req = tx.objectStore(FS_STORE).get(FS_KEY);
      req.onsuccess = () => {
        const v = req.result;
        if (Array.isArray(v)) resolve(v as FileSystemDirectoryHandle[]);
        else if (v) resolve([v as FileSystemDirectoryHandle]); // 兼容旧版单个 handle
        else resolve([]);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return [];
  }
}

/** 把 newDir 提到列表头去重,保留最近 N 个 */
async function fsPromoteDir(
  list: FileSystemDirectoryHandle[],
  newDir: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle[]> {
  const filtered: FileSystemDirectoryHandle[] = [];
  for (const d of list) {
    try {
      if (!(await newDir.isSameEntry(d))) filtered.push(d);
    } catch {
      filtered.push(d); // isSameEntry 失败保留(罕见)
    }
  }
  return [newDir, ...filtered].slice(0, MAX_REMEMBERED_DIRS);
}

/** 检查/请求目录的读写权限。返回是否最终拿到权限。 */
async function fsEnsurePermission(handle: FileSystemDirectoryHandle, prompt: boolean): Promise<boolean> {
  const h = handle as unknown as {
    queryPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
    requestPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
  };
  let perm = await h.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') return true;
  if (!prompt) return false;
  perm = await h.requestPermission({ mode: 'readwrite' });
  return perm === 'granted';
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
    // 预期的 fallback: MediaInfo 失败后由 mp4box 兜底, 不是真错误, 用 info 不污染警告列表
    console.info('[FrameCount] MediaInfo detection failed, falling back to mp4box:', err);
    return null;
  }
}

// ── 快捷键数据 ────────────────────────────────────────────────────────────

const PLAYBACK_RATES = [0.25, 0.5, 1, 1.5, 2] as const;

const SHORTCUTS = [
  { section: 'Marking' },
  { action: 'Add Split Mark', keys: ['M'] },
  { action: 'Add Solve', keys: ['+'] },
  { action: 'Prev mark (cross-solve)', keys: ['↑'] },
  { action: 'Next mark (cross-solve)', keys: ['↓'] },
  { section: 'Navigation' },
  { action: 'Prev Solve', keys: ['←'] },
  { action: 'Next Solve', keys: ['→'] },
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

// ── Timeline 缩略图 canvas 小组件 ──
// 把 ImageBitmap 画到 canvas, flex:1 让其自适应 filmstrip 宽度
function ThumbnailCanvas({ bitmap }: { bitmap: ImageBitmap }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !bitmap) return;
    if (c.width !== bitmap.width) c.width = bitmap.width;
    if (c.height !== bitmap.height) c.height = bitmap.height;
    const ctx = c.getContext('2d');
    if (ctx) ctx.drawImage(bitmap, 0, 0);
  }, [bitmap]);
  return <canvas ref={ref} className="fc-timeline-thumb" />;
}

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
  // 诊断: useCanvasDisplay 每次变化时,打印状态和 canvas 尺寸
  useEffect(() => {
    const c = canvasRef.current;
    console.log('[FCLog] useCanvasDisplay →', useCanvasDisplay, {
      canvasW: c?.width, canvasH: c?.height,
      blackRisk: useCanvasDisplay && (!c || c.width === 0 || c.height === 0),
    });
  }, [useCanvasDisplay]);



  // 帧计数状态
  const [videoFps, setVideoFps] = useState(60);

  const [currentFrame, setCurrentFrame] = useState(0);

  // 起表帧计算方法: 'fps' = WCA 公式 (time × fps); 'timestamp' = 用 sample timestamps 精确定位。
  // Add 钮 auto-seek 时选择哪一种;两种的预测结果始终并排显示以便对比。
  const [startFrameMethod, setStartFrameMethod] = useState<'fps' | 'timestamp'>('fps');

  // 播放速率
  const [playbackRate, setPlaybackRate] = useState(1);

  // 多 Solve 管理
  const [solves, setSolves] = useState<Solve[]>([{ name: 'Solve 1', marks: [], time: '' }]);
  const [activeSolveIdx, setActiveSolveIdx] = useState(0);
  const [selectedMarkIdx, setSelectedMarkIdx] = useState<number | null>(null);

  // File System Access — 通过 Folder 入口加载时,持有目录句柄以便自动读写 .splits.txt
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const videoNameInDirRef = useRef<string | null>(null);
  const [folderPickerVideos, setFolderPickerVideos] = useState<{ name: string; handle: FileSystemFileHandle }[] | null>(null);
  const folderPickerDirRef = useRef<FileSystemDirectoryHandle | null>(null);
  // 持久化记忆的目录句柄列表(IndexedDB,MRU 顺序)。拖放/选文件时遍历查找同名视频。
  const rememberedDirsRef = useRef<FileSystemDirectoryHandle[]>([]);

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
  // 双指 pinch 状态: 记录起点距离 + zoom + 中心 + pan
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    startPan: { x: number; y: number };
    midX: number;
    midY: number;
  } | null>(null);

  // Timeline trimmer
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const trimTrackRef = useRef<HTMLDivElement>(null);
  const trimDragRef = useRef<{ side: 'left' | 'right' | 'seek'; startX: number; startVal: number } | null>(null);
  // 拖动 playhead 时绕过 React, 直接操作 DOM 避免 setCurrentFrame 触发整个组件重渲染
  const playheadRef = useRef<HTMLDivElement>(null);
  const playheadTooltipRef = useRef<HTMLSpanElement>(null);

  // FFmpeg export
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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

  // 双指 pinch 缩放处理 (移动端 video wrapper) — 用结构化类型避免 React.Touch vs DOM Touch 冲突
  const handlePinchStart = useCallback((t1: { clientX: number; clientY: number }, t2: { clientX: number; clientY: number }) => {
    if (cropMode) return;
    const target = wrapperRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    const dist = Math.hypot(dx, dy);
    const cx = (t1.clientX + t2.clientX) / 2;
    const cy = (t1.clientY + t2.clientY) / 2;
    // 中心相对 wrapper 未变换中心的偏移 (与 wheel zoom 一致的算法)
    const midX = cx - (rect.left + rect.width / 2) + panRef.current.x;
    const midY = cy - (rect.top + rect.height / 2) + panRef.current.y;
    pinchRef.current = {
      startDist: dist,
      startZoom: zoomRef.current,
      startPan: { ...panRef.current },
      midX, midY,
    };
    isPanningRef.current = false;
  }, [cropMode]);

  const handlePinchMove = useCallback((t1: { clientX: number; clientY: number }, t2: { clientX: number; clientY: number }) => {
    const p = pinchRef.current;
    if (!p) return;
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    const dist = Math.hypot(dx, dy);
    if (dist === 0 || p.startDist === 0) return;
    const ratio = dist / p.startDist;
    const newZoom = Math.max(1, Math.min(8, p.startZoom * ratio));
    if (newZoom <= 1) {
      zoomRef.current = 1;
      panRef.current = { x: 0, y: 0 };
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    // 不动点公式: midX 在 startZoom/startPan 下的位置, 缩放后保持视觉位置不变
    const r = newZoom / p.startZoom;
    const newPan = {
      x: p.midX * (1 - r) + p.startPan.x * r,
      y: p.midY * (1 - r) + p.startPan.y * r,
    };
    zoomRef.current = newZoom;
    panRef.current = newPan;
    setZoom(newZoom);
    setPan(newPan);
  }, []);

  const handlePinchEnd = useCallback(() => {
    pinchRef.current = null;
  }, []);

  // iOS Safari 全局禁缩放: 拦截 gesture* 事件 (双指 pinch 和双击 zoom)
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', prevent);
    document.addEventListener('gesturechange', prevent);
    document.addEventListener('gestureend', prevent);
    return () => {
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('gesturechange', prevent);
      document.removeEventListener('gestureend', prevent);
    };
  }, []);
  // solveTime 派生自当前 active solve 的 time 字段 (每个 solve 自己的 time)
  const solveTime = solves[activeSolveIdx]?.time ?? '';
  const setSolveTime = useCallback((v: string) => {
    setSolves(prev => prev.map((s, i) => i === activeSolveIdx ? { ...s, time: v } : s));
  }, [activeSolveIdx]);

  // ── WebCodecs 帧缓冲 ──
  const { getFrame, prefetch, getKeyFrameThumb, keyFrameThumbs, isReady: frameBufferReady, decoderDead, loadProgress, parseFailed, audioInfo, vfrInfo, samples: fbSamples, decoderConfig: fbDecoderConfig, findStartFrameByTimestamp } = useFrameBuffer(videoFile, videoFps);

  // ── 从 mp4box samples 反推 fps —— iOS Safari 上 MediaInfo WASM 加载失败时的兜底 ──
  // FrameBuffer READY 后 samples 里每一帧都有精确 timestamp, 比 MediaInfo 读容器元数据更可靠。
  // 命中任一情况都会同步 videoFps: (1) MediaInfo 失败 fps 仍为默认 60; (2) MediaInfo 给的值和 mp4box 计算值偏差 >0.01。
  useEffect(() => {
    if (!frameBufferReady || fbSamples.length === 0) return;
    const last = fbSamples[fbSamples.length - 1];
    const durSec = (last.timestamp + last.duration) / 1_000_000;
    if (durSec <= 0) return;
    const realFps = Math.round((fbSamples.length / durSec) * 100) / 100;
    if (realFps > 0 && Math.abs(realFps - videoFps) > 0.01) {
      console.log(`[FCLog] fps auto-corrected from mp4box samples: ${videoFps} → ${realFps}`);
      setVideoFps(realFps);
    }
    // videoFps 故意不放进依赖 —— 只在 READY 或 sample 集变化时触发一次校正
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameBufferReady, fbSamples]);

  // Timeline 缩略图个数 — 按设备/方向自适应
  // 移动端竖屏 5 / 移动端横屏 7 / 桌面 10
  const [timelineThumbCount, setTimelineThumbCount] = useState(10);
  useEffect(() => {
    const computeCount = () => {
      const h = window.innerHeight;
      const isMobilePortrait = window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;
      const isMobileLandscape = window.matchMedia('(max-width: 1024px) and (orientation: landscape)').matches && h <= 600;
      if (isMobilePortrait) return 5;
      if (isMobileLandscape) return 7;
      return 10;
    };
    const update = () => setTimelineThumbCount(computeCount());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // Timeline thumbnails —— 一次计算后锁定,避免 phase2 解码中抽样位置抖动
  const [timelineThumbs, setTimelineThumbs] = useState<typeof keyFrameThumbs>([]);
  // 视频切换/count 改变/fps 改变 (frameIdx 坐标重映射) 时重置
  useEffect(() => {
    console.log('[FCLog] timelineThumbs RESET', { videoFile: !!videoFile, timelineThumbCount, videoFps });
    setTimelineThumbs([]);
  }, [videoFile, timelineThumbCount, videoFps]);
  // 有 thumbs 时按目标帧位置挑最近的一张填充
  useEffect(() => {
    if (timelineThumbs.length >= timelineThumbCount) return;
    if (keyFrameThumbs.length === 0 || totalFrames <= 0) return;
    const out: typeof keyFrameThumbs = [];
    for (let i = 0; i < timelineThumbCount; i++) {
      const targetPIdx = Math.round(
        (i / Math.max(1, timelineThumbCount - 1)) * (totalFrames - 1)
      );
      // 二分找最接近 targetPIdx 的缓存帧
      let best = keyFrameThumbs[0];
      let bestDist = Math.abs(best.frameIdx - targetPIdx);
      for (const t of keyFrameThumbs) {
        const d = Math.abs(t.frameIdx - targetPIdx);
        if (d < bestDist) { bestDist = d; best = t; }
      }
      out.push(best);
    }
    setTimelineThumbs(out);
  }, [keyFrameThumbs, totalFrames, timelineThumbCount, timelineThumbs.length]);

  // ── 计算值 ──

  const activeSolve = solves[activeSolveIdx] || solves[0];
  const solveTimeNum = parseFloat(solveTime) || 0;
  // wcaFrames unused — superseded by startFramePreview.framesBack
  // const wcaFrames = solveTimeNum > 0 && videoFps > 0 ? timeToFrames(solveTimeNum, videoFps) : 0;

  // 起表帧预测: 两种方法并排给出预测, end frame 取"最新一个 mark"或当前 currentFrame
  // 用于 UI 展示对比,实际 auto-seek 时再基于 startFrameMethod 选一个
  // timestamp 方法使用和 FPS 公式相同的 (⌊time⌋₂ + 0.009) 调整时间, 保证两种方法查询同一个"目标时间点"
  const startFramePreview = useMemo(() => {
    if (solveTimeNum <= 0 || videoFps <= 0) return null;
    const endFrame = activeSolve && activeSolve.marks.length > 0
      ? activeSolve.marks[activeSolve.marks.length - 1].frame
      : currentFrame;
    if (endFrame <= 0) return null;
    const truncatedTime = Math.floor(solveTimeNum * 100) / 100; // ⌊time⌋₂
    const adjustedTime = truncatedTime + 0.009;                 // 和 WCA 公式一致的目标时差
    const framesBack = timeToFrames(solveTimeNum, videoFps);
    const byFps = Math.max(0, endFrame - framesBack);
    const byTsRaw = fbSamples.length > 0 ? findStartFrameByTimestamp(endFrame, adjustedTime) : null;
    const byTs = byTsRaw !== null ? Math.max(0, byTsRaw) : null;
    // End sample 的 timestamp (秒), 用于 timestamp 方法的公式展示
    const endSampleTs = fbSamples.length > endFrame && endFrame >= 0
      ? fbSamples[endFrame].timestamp / 1_000_000
      : null;
    const targetTs = endSampleTs !== null ? endSampleTs - adjustedTime : null;
    // byTs 这一帧的实际 timestamp, 展示它与 target 的贴合度
    const byTsSampleTs = (byTs !== null && fbSamples.length > byTs)
      ? fbSamples[byTs].timestamp / 1_000_000
      : null;
    return { endFrame, framesBack, byFps, byTs, truncatedTime, endSampleTs, targetTs, byTsSampleTs };
  }, [solveTimeNum, videoFps, activeSolve, currentFrame, fbSamples, findStartFrameByTimestamp]);

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
  const isDraggingRef = useRef(false);
  const thumbMissLoggedRef = useRef(false);
  const dragPrefetchCenterRef = useRef<number | null>(null);

  // 拖动专用的"丝滑 scrub"路径 — PR/剪映式架构
  // 核心纪律:
  //   - canvas 在整个拖动过程中常亮,绝不切换 display (避免 layout thrashing)
  //   - 完全不碰 video.currentTime (避免 decoder 争抢)
  //   - canvas 尺寸锁死在 beginDragOverlay 里设定的 video 原生分辨率,
  //     所有 drawImage 拉伸填满 → 精确帧/缩略图混用也不会闪
  //   - 优先精确帧,缩略图只作 cache miss 垫底 (I 帧间隔 ~60 帧, 单靠它颗粒度太粗)
  //   - 节流 prefetch 把 ±60 帧解码进缓存,大部分 mousemove 都能命中
  // domOnly=true: 拖动 scrub 模式, 跳过 setCurrentFrame (调用方负责用 ref 更新 playhead/tooltip DOM)
  const seekToFrameRough = useCallback((frame: number, domOnly = false) => {
    if (videoFps <= 0) return;
    const maxFrame = totalFrames > 0 ? totalFrames - 1 : frame;
    const f = Math.max(0, Math.min(maxFrame, frame));
    currentFrameRef.current = f;
    if (!domOnly) setCurrentFrame(f);
    // 优先精确帧,未命中用 I 帧缩略图垫底 (保证 playhead 跟随时画面也持续推进)
    const bmp = getFrame(f) ?? getKeyFrameThumb(f);
    if (!bmp) {
      if (!thumbMissLoggedRef.current) {
        console.warn('[FCLog] seekToFrameRough MISS — scrub frozen on last frame', { f });
        thumbMissLoggedRef.current = true;
      }
    } else {
      thumbMissLoggedRef.current = false;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas && canvas.width !== 0) {
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      }
    }
    // 节流 prefetch: 偏离上次中心超过半个范围才重派,
    // 避免每次 mousemove rAF 都堆积 decode queue.
    // prefetch 内部命中 cache 会立即 return, 且不 bump seq, 多次调用安全.
    const lastCenter = dragPrefetchCenterRef.current;
    if (lastCenter === null || Math.abs(f - lastCenter) > 30) {
      prefetch(f, 60);
      dragPrefetchCenterRef.current = f;
    }
  }, [videoFps, totalFrames, getFrame, getKeyFrameThumb, prefetch]);

  // 拖动开始前的准备:把当前 video 元素上显示的帧抓拍到 canvas,并把 canvas 尺寸
  // 锁定在 video 原生分辨率,整个拖动过程中 canvas 尺寸/显示状态都不再变化
  const beginDragOverlay = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // 固定 canvas 为 video 原生分辨率 — 整个拖动过程不变
    const w = video.videoWidth || 1920;
    const h = video.videoHeight || 1080;
    canvas.width = w;
    canvas.height = h;
    // 初始绘制: 优先精确帧,次选缩略图,再次 video 元素快照
    const exact = getFrame(currentFrameRef.current);
    const thumb = getKeyFrameThumb(currentFrameRef.current);
    let painted = false;
    if (exact) {
      ctx.drawImage(exact, 0, 0, w, h);
      painted = true;
    } else if (thumb) {
      ctx.drawImage(thumb, 0, 0, w, h);
      painted = true;
    } else if (video.videoWidth > 0) {
      ctx.drawImage(video, 0, 0, w, h);
      painted = true;
    }
    // 没画成任何东西就不要切到 canvas 覆盖 <video> —— 否则黑屏
    if (painted) {
      setUseCanvasDisplay(true);
    } else {
      console.warn('[FCLog] beginDragOverlay FAILED to paint — keeping <video> visible');
    }
  }, [getFrame, getKeyFrameThumb]);

  const seekToFrame = useCallback((frame: number) => {
    const video = videoRef.current;
    if (!video || videoFps <= 0) return;
    // 上界必须夹到 totalFrames-1: 否则 mark 在旧 fps 下记录(如 1478 帧 @60fps)
    // 切到新 fps 后 currentTime 会超过 video.duration, 浏览器渲染黑屏
    const maxFrame = totalFrames > 0 ? totalFrames - 1 : frame;
    const f = Math.max(0, Math.min(maxFrame, frame));
    // 立即更新 UI
    currentFrameRef.current = f;
    setCurrentFrame(f);
    
    cancelAnimationFrame(seekRafRef.current);

    if (frameBufferReady) {
      // Tier 1: WebCodecs 绝对索引渲染（无视底层游标）
      // 先看缓存:命中直接渲染;未命中先用 video 元素粗略 seek 提供即时反馈
      const bmpNow = getFrame(f);
      if (bmpNow) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) {
          canvas.width = bmpNow.width;
          canvas.height = bmpNow.height;
          ctx.drawImage(bmpNow, 0, 0);
        }
        setUseCanvasDisplay(true);
        video.currentTime = (f + 0.5) / videoFps;
      } else {
        console.log('[FCLog] seekToFrame cache miss — entering tryRender loop (normal)', { f, totalFrames });
        // 缓存未命中: 让 video 元素开始粗略 seek (作为背景 fallback)
        // 但保持 useCanvasDisplay 现状 — 拖动时 canvas 上的旧帧比 "seek 中的黑屏 video" 观感更好
        video.currentTime = (f + 0.5) / videoFps;
        // 启动后台精确解码,完成后在 canvas 上画新帧 (小批量,避免拖动时反复 supersede)
        prefetch(f, 10);
        let tries = 0;
        const tryRenderStart = performance.now();
        const tryRender = () => {
          tries++;
          // 若用户已开始播放,canvas 必须让位给 video,绝不能在此再 setUseCanvasDisplay(true) 把 video 罩住
          if (!video.paused) { console.log('[FCLog] tryRender abort: video playing', { f, tries }); return; }
          if (currentFrameRef.current !== f) { console.log('[FCLog] tryRender abort: superseded', { f, newF: currentFrameRef.current, tries }); return; }
          const bmp = getFrame(f);
          if (bmp) {
            const elapsed = Math.round(performance.now() - tryRenderStart);
            console.log('[FCLog] tryRender SUCCESS', { f, tries, elapsedMs: elapsed });
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (ctx && canvas) {
              canvas.width = bmp.width;
              canvas.height = bmp.height;
              ctx.drawImage(bmp, 0, 0);
            }
            setUseCanvasDisplay(true);
          } else {
            // 超时 fallback: decoder 可能已死,永远不会拿到 bitmap
            // 放弃 canvas,交还给 <video> 元素 (至少不黑屏)
            // 120 tries ≈ 2s @ 60fps — 足够正常 prefetch 跑完,超时就说明 decoder 炸了
            if (tries > 120) {
              const elapsed = Math.round(performance.now() - tryRenderStart);
              console.warn('[FCLog] tryRender TIMEOUT — falling back to <video>', {
                f, tries, elapsedMs: elapsed,
                diag: (window as unknown as { __fcDiag?: () => unknown }).__fcDiag?.(),
              });
              setUseCanvasDisplay(false);
              return;
            }
            if (tries === 60) {
              console.log('[FCLog] tryRender taking a while — 60 tries (~1s)', {
                f, elapsedMs: Math.round(performance.now() - tryRenderStart),
              });
            }
            seekRafRef.current = requestAnimationFrame(tryRender);
          }
        };
        tryRender();
      }
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
  }, [videoFps, totalFrames, frameBufferReady, getFrame, prefetch]);

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
    // 上界: trim 激活时用 effEnd, 否则用 totalFrames-1 (防止越界黑屏)
    const effEnd = trimEnd || totalFrames;
    const hardMax = totalFrames > 0 ? totalFrames - 1 : Infinity;
    const upperBound = (trimStart > 0 || effEnd < totalFrames) ? effEnd : hardMax;
    const lowerBound = trimStart > 0 ? trimStart : 0;
    currentFrameRef.current = Math.max(lowerBound, Math.min(upperBound, currentFrameRef.current + n));
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
      // 取消任何拖动遗留的精确帧 rAF, 防止它在播放后又 setUseCanvasDisplay(true) 罩住 video
      cancelAnimationFrame(seekRafRef.current);
      video.muted = video.playbackRate !== 1;
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
    video.muted = rate !== 1;
    setPlaybackRate(rate);
  }, []);

  // 长按重复: pointerdown 立即触发一次, 400ms 后每 intervalMs 重复, 离开/抬起停止
  const longPressTimerRef = useRef<number | null>(null);
  const longPressIntervalRef = useRef<number | null>(null);
  const longPressClear = useCallback(() => {
    if (longPressTimerRef.current !== null) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    if (longPressIntervalRef.current !== null) { clearInterval(longPressIntervalRef.current); longPressIntervalRef.current = null; }
  }, []);
  useEffect(() => longPressClear, [longPressClear]);
  const longPressProps = useCallback((fn: () => void, intervalMs = 100) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      fn();
      longPressClear();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressIntervalRef.current = window.setInterval(fn, intervalMs);
      }, 400);
    },
    onPointerUp: longPressClear,
    onPointerLeave: longPressClear,
    onPointerCancel: longPressClear,
  }), [longPressClear]);

  // ── Solve 管理 ──

  const renumberSolves = (list: Solve[]) => list.map((s, i) => ({ ...s, name: `Solve ${i + 1}` }));

  const addSolve = useCallback(() => {
    setSolves(prev => {
      const next = renumberSolves([...prev, { name: '', marks: [], time: '' }]);
      setActiveSolveIdx(next.length - 1);
      return next;
    });
    setSelectedMarkIdx(null);
    showToast('Solve added');
  }, [showToast]);

  const removeSolve = useCallback(() => {
    if (solves.length <= 1) {
      setSolves(prev => [{ ...prev[0], name: 'Solve 1', marks: [], time: prev[0]?.time ?? '' }]);
      setSelectedMarkIdx(null);
      showToast('Marks cleared');
      return;
    }
    setSolves(prev => {
      const filtered = prev.filter((_, i) => i !== activeSolveIdx);
      const next = renumberSolves(filtered);
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
    // WCA 自动跳转：填写了 Time 且当前 solve 尚无 mark 时，标记 End Frame 后自动跳转到 Start Frame 并自动 Add
    if (solveTimeNum > 0 && videoFps > 0 && solves[activeSolveIdx]?.marks.length === 0) {
      let startFrame: number;
      if (startFrameMethod === 'timestamp') {
        // 和 WCA 公式 (⌊time⌋₂+.009) 对齐,两种方法查询同一个目标时间点
        const truncated = Math.floor(solveTimeNum * 100) / 100;
        const tsFrame = findStartFrameByTimestamp(currentFrame, truncated + 0.009);
        // samples 未就绪时 fallback 到 fps 公式, 不让用户等
        startFrame = tsFrame ?? Math.max(0, currentFrame - timeToFrames(solveTimeNum, videoFps));
      } else {
        startFrame = Math.max(0, currentFrame - timeToFrames(solveTimeNum, videoFps));
      }
      startFrame = Math.max(0, startFrame);
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
  }, [activeSolveIdx, currentFrame, solves, showToast, solveTimeNum, videoFps, seekToFrame, startFrameMethod, findStartFrameByTimestamp]);

  const removeMark = useCallback((idx: number) => {
    setSolves(prev => {
      const next = [...prev];
      const solve = { ...next[activeSolveIdx] };
      solve.marks = solve.marks.filter((_, i) => i !== idx);
      next[activeSolveIdx] = solve;
      const remaining = solve.marks.length;
      if (remaining > 0) {
        // 当前 solve 还有 mark，停在同位置（或往前一格）
        setSelectedMarkIdx(Math.min(idx, remaining - 1));
      } else {
        // 当前 solve 已空，跨 solve 找最近的 mark
        // 优先往前（帧号更小）的 solve，再往后
        let found = false;
        for (let si = activeSolveIdx - 1; si >= 0; si--) {
          if (next[si].marks.length > 0) {
            setActiveSolveIdx(si);
            setSelectedMarkIdx(next[si].marks.length - 1);
            found = true;
            break;
          }
        }
        if (!found) {
          for (let si = activeSolveIdx + 1; si < next.length; si++) {
            if (next[si].marks.length > 0) {
              setActiveSolveIdx(si);
              setSelectedMarkIdx(0);
              found = true;
              break;
            }
          }
        }
        if (!found) setSelectedMarkIdx(null);
      }
      return next;
    });
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

  // 上/下键跨 Solve 切换 mark
  const navigateMarkGlobal = useCallback((dir: 1 | -1) => {
    // 构建全局 mark 列表（按帧升序）
    const allMarks: { solveIdx: number; markIdx: number; frame: number }[] = [];
    for (let si = 0; si < solves.length; si++) {
      solves[si].marks.forEach((m, mi) => {
        allMarks.push({ solveIdx: si, markIdx: mi, frame: m.frame });
      });
    }
    allMarks.sort((a, b) => a.frame - b.frame);
    if (allMarks.length === 0) return;

    // 找当前选中 mark 在全局列表的位置
    let curGlobalIdx = -1;
    if (selectedMarkIdx !== null) {
      curGlobalIdx = allMarks.findIndex(
        (x) => x.solveIdx === activeSolveIdx && x.markIdx === selectedMarkIdx,
      );
    }

    const nextGlobalIdx = curGlobalIdx === -1
      ? (dir === 1 ? 0 : allMarks.length - 1)
      : Math.max(0, Math.min(allMarks.length - 1, curGlobalIdx + dir));

    const target = allMarks[nextGlobalIdx];
    setActiveSolveIdx(target.solveIdx);
    setSelectedMarkIdx(target.markIdx);
    seekToFrame(target.frame);
  }, [solves, activeSolveIdx, selectedMarkIdx, seekToFrame]);

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

  const loadFile = useCallback(async (file: File, initialSolves?: Solve[], initialFps?: number) => {
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoFile(file);

    setVideoName(file.name);
    setCurrentFrame(0);
    setIsPlaying(false);
    setUseCanvasDisplay(false);

    // 从文件名提取还原时间作为 Solve 1 的默认 time (仅 Solve 1, 其余 solve 留空)
    let defaultTime = '';
    const nameNoExt = file.name.replace(/\.[^.]+$/, '');
    const timeMatches = nameNoExt.match(/\d+\.\d+/g);
    if (timeMatches && timeMatches.length > 0) {
      const raw = parseFloat(timeMatches[timeMatches.length - 1]);
      if (!isNaN(raw)) {
        const truncated = Math.floor(raw * 100) / 100;
        defaultTime = truncated.toFixed(2).replace(/\.?0+$/, '') || String(truncated);
      }
    }

    const finalSolves = initialSolves && initialSolves.length > 0
      ? initialSolves.map((s, i) => i === 0 && !s.time ? { ...s, time: defaultTime } : s)
      : [{ name: 'Solve 1', marks: [], time: defaultTime }];
    setSolves(finalSolves);
    setActiveSolveIdx(0);
    setSelectedMarkIdx(null);
    if (initialFps && initialFps > 0) {
      setVideoFps(initialFps);
    } else {
      const detected = await detectFpsFromFile(file);
      if (detected && detected > 0) setVideoFps(detected);
    }
  }, [videoSrc]);

  // ── splits.txt 序列化 / 反序列化 ──
  // 格式:
  //   fps:59.94
  //   Solve 1:867:1164:1179:1300
  //   Solve 2:1580:1713:1845
  const serializeSplits = useCallback((solvesArr: Solve[], fps: number): string => {
    const lines: string[] = [];
    if (fps > 0) lines.push(`fps:${fps}`);
    for (const s of solvesArr) {
      const frames = s.marks.map(m => m.frame).join(':');
      lines.push(`${s.name}:${frames}`);
    }
    return lines.join('\n') + '\n';
  }, []);

  const parseSplits = useCallback((text: string): { solves: Solve[]; fps: number | null } => {
    const out: Solve[] = [];
    let fps: number | null = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const colonIdx = line.indexOf(':');
      if (colonIdx <= 0) continue;
      const key = line.slice(0, colonIdx);
      const rest = line.slice(colonIdx + 1);
      if (key === 'fps') {
        const v = parseFloat(rest);
        if (isFinite(v) && v > 0) fps = v;
      } else {
        // 兼容旧格式 `splits:...` → 名字降级为 Solve N;新格式直接用 key 作为 name
        const name = key === 'splits' ? `Solve ${out.length + 1}` : key;
        // 兼容旧的 `|` 分隔写法
        const frames = rest.split(/[:|]/).map(s => s.trim()).filter(s => s.length > 0).map(Number).filter(n => isFinite(n));
        out.push({ name, marks: frames.map(f => ({ frame: f })), time: '' });
      }
    }
    return { solves: out, fps };
  }, []);

  // 写 splits.txt 到当前目录(若有授权)
  const writeSplitsFile = useCallback(async (solvesArr: Solve[], fps: number) => {
    const dir = dirHandleRef.current;
    const name = videoNameInDirRef.current;
    if (!dir || !name) return;
    try {
      const fh = await dir.getFileHandle(name + '.splits.txt', { create: true });
      const writable = await fh.createWritable();
      await writable.write(serializeSplits(solvesArr, fps));
      await writable.close();
    } catch (e) {
      console.warn('[Splits] write failed:', e);
    }
  }, [serializeSplits]);

  // 选完目录中的某个视频后:加载视频 + 同目录 splits.txt
  const loadFromDirectoryEntry = useCallback(async (
    dir: FileSystemDirectoryHandle,
    videoEntry: { name: string; handle: FileSystemFileHandle },
  ) => {
    const file = await videoEntry.handle.getFile();
    dirHandleRef.current = dir;
    videoNameInDirRef.current = videoEntry.name;

    let loadedSolves: Solve[] | undefined;
    let loadedFps: number | undefined;
    try {
      const sh = await dir.getFileHandle(videoEntry.name + '.splits.txt');
      const sf = await sh.getFile();
      const parsed = parseSplits(await sf.text());
      if (parsed.solves.length > 0) loadedSolves = parsed.solves;
      if (parsed.fps && parsed.fps > 0) loadedFps = parsed.fps;
    } catch { /* splits 文件不存在,跳过 */ }

    await loadFile(file, loadedSolves, loadedFps);
    if (loadedSolves) showToast(`Loaded ${loadedSolves.length} solve(s) from .splits.txt`);
  }, [loadFile, parseSplits, showToast]);

  // Folder 按钮:选目录 → 列视频 → (单选自动加载 / 多选弹 modal) + 持久化记忆
  const openFromFolder = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) {
      showToast('Browser does not support folder access (Chrome/Edge only)');
      return;
    }
    try {
      const dir = await (window as unknown as { showDirectoryPicker: (o?: { mode?: string }) => Promise<FileSystemDirectoryHandle> })
        .showDirectoryPicker({ mode: 'readwrite' });
      const videos: { name: string; handle: FileSystemFileHandle }[] = [];
      for await (const [name, handle] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
        if (handle.kind === 'file' && /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(name)) {
          videos.push({ name, handle: handle as FileSystemFileHandle });
        }
      }
      if (videos.length === 0) {
        showToast('No video files in folder');
        return;
      }
      // 加入 MRU 列表(去重,提到头)
      const promoted = await fsPromoteDir(rememberedDirsRef.current, dir);
      rememberedDirsRef.current = promoted;
      fsSaveDirs(promoted).catch(e => console.warn('[FS] save dirs failed', e));
      videos.sort((a, b) => a.name.localeCompare(b.name));
      if (videos.length === 1) {
        await loadFromDirectoryEntry(dir, videos[0]);
      } else {
        folderPickerDirRef.current = dir;
        setFolderPickerVideos(videos);
      }
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') console.warn(e);
    }
  }, [loadFromDirectoryEntry, showToast]);

  // 拖放/选择文件时,遍历记忆目录列表(最近优先),找第一个含同名视频的目录
  // 策略:
  //  Pass 1 — 已 granted 的目录直接试匹配(无 prompt,瞬时)
  //  Pass 2 — 未 granted 的目录里,只对最近一个 prompt 一次,避免连弹多框
  const tryLoadViaRememberedDir = useCallback(async (file: File): Promise<boolean> => {
    const dirs = rememberedDirsRef.current;
    if (dirs.length === 0) return false;

    const tryMatch = async (dir: FileSystemDirectoryHandle): Promise<boolean> => {
      try {
        const fh = await dir.getFileHandle(file.name);
        // 命中:把该目录提到列表头持久化
        const promoted = await fsPromoteDir(dirs, dir);
        rememberedDirsRef.current = promoted;
        fsSaveDirs(promoted).catch(e => console.warn('[FS] save dirs failed', e));
        await loadFromDirectoryEntry(dir, { name: file.name, handle: fh });
        return true;
      } catch {
        return false;
      }
    };

    // Pass 1: 已 granted 的目录
    for (const dir of dirs) {
      if (await fsEnsurePermission(dir, false)) {
        if (await tryMatch(dir)) return true;
      }
    }

    // Pass 2: 对最近一个未授权目录 prompt 一次
    for (const dir of dirs) {
      const queryOnly = await fsEnsurePermission(dir, false);
      if (queryOnly) continue; // Pass 1 已试过
      const granted = await fsEnsurePermission(dir, true);
      if (!granted) return false; // 用户拒绝
      return await tryMatch(dir); // 不管是否命中都不再 prompt 其他目录
    }

    return false;
  }, [loadFromDirectoryEntry]);

  // 启动时恢复记忆的目录列表(不 prompt 权限,等用户操作时再请求)
  useEffect(() => {
    fsLoadDirs().then((arr) => {
      rememberedDirsRef.current = arr;
      if (arr.length > 0) console.log(`[FS] restored ${arr.length} remembered dir(s)`);
    });
  }, []);

  // 点击外部关闭 Export 下拉菜单
  useEffect(() => {
    if (!showExportMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showExportMenu]);

  // ── 拖放 / 文件选择 ──

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('video/')) return;
    // 优先用记忆的目录(如果同名文件存在,可自动读写 splits)
    if (await tryLoadViaRememberedDir(file)) return;
    // fallback: 普通加载,无目录权限
    dirHandleRef.current = null;
    videoNameInDirRef.current = null;
    loadFile(file);
  }, [loadFile, tryLoadViaRememberedDir]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (await tryLoadViaRememberedDir(file)) return;
    dirHandleRef.current = null;
    videoNameInDirRef.current = null;
    loadFile(file);
  }, [loadFile, tryLoadViaRememberedDir]);

  // solves / fps 变更时,自动写回 splits.txt(只有通过 Folder 入口加载时才生效)
  useEffect(() => {
    if (!dirHandleRef.current || !videoNameInDirRef.current) return;
    const t = setTimeout(() => writeSplitsFile(solves, videoFps), 200);
    return () => clearTimeout(t);
  }, [solves, videoFps, writeSplitsFile]);

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

            // prefetch 全偏后退方向。lowestPrefetched 跟踪已请求 prefetch 到的最低帧,
            // 避免每 10 帧无脑触发,导致正在跑的 decode 反复被新请求 supersede。
            console.log(`[StepBack] START frame=${currentFrameRef.current}, bufferReady=${frameBufferReady}`);
            // 按 fps 自适应预取,但封顶 120 帧/批,防止单次 decode 过大导致首次响应慢
            // triggerLead 设在 range 的 ~80%,较早触发下一批,给 decoder 充裕时间
            // 启动时并排派 2 批 —— useFrameBuffer 内部有 2 路并发 decoder 池,两批同时解
            const prefetchRange = Math.min(120, Math.max(60, Math.round(videoFps)));
            const triggerLead = Math.round(prefetchRange * 0.8);
            let lowestPrefetched = currentFrameRef.current;
            if (frameBufferReady) {
              prefetch(currentFrameRef.current, prefetchRange, 'backward');
              lowestPrefetched = currentFrameRef.current - prefetchRange;
              if (lowestPrefetched > 0) {
                prefetch(lowestPrefetched, prefetchRange, 'backward');
                lowestPrefetched -= prefetchRange;
              }
            }

            // 基于真实时间+累加器计算步进，保持 1x 速（高 FPS 视频在 60Hz 屏幕上会跳帧显示）
            let lastTime = performance.now();
            let frameBudget = 0; // 积累未消费的"帧数预算"，防止 floor 截断导致的长期速度偏差
            const stepBack = (now?: number) => {
              if (!holdPlayingRef.current) {
                console.log(`[StepBack] STOP — hits: ${hitCount}, misses: ${missCount}`);
                return;
              }
              const t = now ?? performance.now();
              const elapsed = (t - lastTime) / 1000;
              lastTime = t;
              // 用 video.playbackRate 实时读取,支持长按中切换倍速
              frameBudget += elapsed * videoFps * (video.playbackRate || 1);
              // 限制上限防止切到后台后积攒过多帧预算
              if (frameBudget > 4) frameBudget = 4;
              const step = Math.max(1, Math.floor(frameBudget));
              const f = Math.max(0, currentFrameRef.current - step);

              const bitmap = frameBufferReady ? getFrame(f) : null;
              // 精确帧命中 → 高清渲染; 未命中则尝试用最近 I 帧缩略图作为"低分辨率垫图"
              // 让 playhead + 画面持续推进, 高 fps 视频下宁可画面颗粒也不要完全冻住
              const thumb = !bitmap && frameBufferReady ? getKeyFrameThumb(f) : null;
              const drawable: ImageBitmap | null = bitmap ?? thumb;
              if (drawable) {
                frameBudget -= step;
                currentFrameRef.current = f;
                setCurrentFrame(f);
                if (bitmap) hitCount++; else missCount++;
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext('2d');
                if (ctx && canvas) {
                  canvas.width = drawable.width;
                  canvas.height = drawable.height;
                  ctx.drawImage(drawable, 0, 0);
                }
                setUseCanvasDisplay(true);

                // 接近 prefetch 边界(剩余 triggerLead 帧)时触发下一段,留时间给后台解码
                if (frameBufferReady && f - triggerLead <= lowestPrefetched && lowestPrefetched > 0) {
                  const newCenter = lowestPrefetched;
                  prefetch(newCenter, prefetchRange, 'backward');
                  lowestPrefetched = newCenter - prefetchRange;
                }
                requestAnimationFrame(stepBack);
              } else if (frameBufferReady) {
                // 连缩略图都没有 (极早期还没解出任何 I 帧) — 保持当前画面,rAF 重试
                missCount++;
                if (missCount <= 3) {
                  console.log(`[StepBack] WAIT frame=${f}, no thumb yet...`);
                }
                requestAnimationFrame(stepBack);
              } else {
                // WebCodecs 不可用 — 传统 seeked 链 fallback
                frameBudget -= step;
                currentFrameRef.current = f;
                setCurrentFrame(f);
                missCount++;
                setUseCanvasDisplay(false);
                video.addEventListener('seeked', () => stepBack(), { once: true });
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
        case 'arrowup': e.preventDefault(); navigateMarkGlobal(-1); break;
        case 'arrowdown': e.preventDefault(); navigateMarkGlobal(1); break;
        case 'arrowleft':
          e.preventDefault();
          setActiveSolveIdx(i => Math.max(0, i - 1));
          setSelectedMarkIdx(null);
          break;
        case 'arrowright':
          e.preventDefault();
          setActiveSolveIdx(i => Math.min(solves.length - 1, i + 1));
          setSelectedMarkIdx(null);
          break;
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
            // 从 canvas 回到 video：先 seek，等 seeked 后再切换，避免闪烁
            const f = currentFrameRef.current;
            video.addEventListener('seeked', () => setUseCanvasDisplay(false), { once: true });
            video.currentTime = f / videoFps;
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
  }, [togglePlay, stepFrames, stepSeconds, currentFrame, addMark, addSolve, copyToClipboard, videoFps, totalFrames, frameBufferReady, getFrame, prefetch, useCanvasDisplay, navigateMarkGlobal, solves.length]);

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

  // ── 生成缩略图 (WebCodecs 不可用 或 mp4box 解析 0 samples 时 fallback 到 <video>+seek) ──
  useEffect(() => {
    if (!videoSrc || totalFrames <= 0 || videoFps <= 0) return;
    // WebCodecs 路径正常时 (mp4box 拿到 samples) 走 useFrameBuffer.keyFrameThumbs, 跳过
    if (typeof VideoDecoder !== 'undefined' && !parseFailed) return;
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
      const times = Array.from({ length: timelineThumbCount }, (_, i) => (i / Math.max(1, timelineThumbCount - 1)) * dur);

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
  }, [videoSrc, totalFrames, videoFps, parseFailed, timelineThumbCount]);

  // ── Timeline trim 拖拽 ──
  useEffect(() => {
    // rAF 合并:mousemove 只记录最新位置,每个动画帧最多 seek 一次,避免 prefetch 频繁 supersede
    let pendingFrame: number | null = null;
    let pendingSide: 'left' | 'right' | 'seek' | null = null;
    let rafId = 0;
    let scrubModeActive = false; // 首次 mousemove 时才切到缩略图 scrub 模式(单击不触发)
    let wasPlayingBeforeDrag = false;
    const flush = () => {
      rafId = 0;
      if (pendingFrame === null) return;
      const f = pendingFrame;
      const side = pendingSide;
      pendingFrame = null;
      pendingSide = null;
      if (side === 'left') setTrimStart(f);
      else if (side === 'right') setTrimEnd(f);
      // playhead/tooltip 走 DOM 直改避免 React re-render (trim 拖动本身要 re-render, 这里也无害)
      const ph = playheadRef.current;
      const tip = playheadTooltipRef.current;
      if (ph && totalFrames > 0) {
        const effEnd = trimEnd || totalFrames;
        const clampedFrame = Math.max(trimStart, Math.min(f, effEnd));
        ph.style.left = `${(clampedFrame / totalFrames) * 100}%`;
      }
      if (tip && videoFps > 0) tip.textContent = `${formatTime(f / videoFps)} (${f})`;

      if (side === 'seek' && IS_MOBILE) {
        // 移动端 seek 拖动: <video> 硬件路径 (iOS Safari 硬件 H264 解码 + 合成, 丝滑)
        currentFrameRef.current = f;
        const v = videoRef.current;
        if (v && videoFps > 0) v.currentTime = (f + 0.5) / videoFps;
      } else {
        // 桌面 seek 拖动 / 任意 trim 拖动: 走原 WebCodecs+canvas 路径 (桌面端帧精确)
        // seek 拖动传 domOnly=true 跳过 setCurrentFrame, trim 拖动正常 setCurrentFrame
        seekToFrameRough(f, side === 'seek');
      }
    };
    const onMove = (e: PointerEvent) => {
      const d = trimDragRef.current;
      const track = trimTrackRef.current;
      if (!d || !track || totalFrames <= 0) return;
      e.preventDefault();
      // 首次 mousemove — 进入缩略图 scrub 模式
      if (!scrubModeActive) {
        scrubModeActive = true;
        // 拖动时必须暂停 video, 否则 RVFC 回调持续把 currentFrame 设为 video.currentTime,
        // 与拖动位置打架; 同时记住"拖动前在播放"状态以便 mouseup 后恢复
        const v = videoRef.current;
        if (v && !v.paused) {
          wasPlayingBeforeDrag = true;
          v.pause();
          setIsPlaying(false);
        }
        // 移动端 seek 拖动: 保持 <video> 可见, 浏览器硬件解码/合成接管(iOS Safari 丝滑, 类原生相册)
        // 桌面端 seek 拖动 / trim 拖动: 切 canvas 覆盖走 WebCodecs 缓存路径(桌面端 CPU/GPU 富余, 这条路更精确)
        if (d.side === 'seek' && IS_MOBILE) {
          setUseCanvasDisplay(false);
        } else {
          beginDragOverlay();
        }
      }
      const rect = track.getBoundingClientRect();
      const dx = e.clientX - d.startX;
      const frameDelta = Math.round((dx / rect.width) * totalFrames);
      if (d.side === 'left') {
        pendingFrame = Math.max(0, Math.min(d.startVal + frameDelta, (trimEnd || totalFrames) - 1));
        pendingSide = 'left';
      } else if (d.side === 'right') {
        pendingFrame = Math.max(trimStart + 1, Math.min(d.startVal + frameDelta, totalFrames));
        pendingSide = 'right';
      } else {
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const effEnd = trimEnd || totalFrames;
        pendingFrame = Math.max(trimStart, Math.min(Math.round(frac * totalFrames), effEnd));
        pendingSide = 'seek';
      }
      if (!rafId) rafId = requestAnimationFrame(flush);
      isDraggingRef.current = true;
    };
    const onUp = () => {
      if (!trimDragRef.current) return;
      trimDragRef.current = null;
      isDraggingRef.current = false;
      dragPrefetchCenterRef.current = null;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      // 只在真正 drag 过 (scrubModeActive) 才需要补一次精确 seek
      // 单击的情况 mousedown 已经精确 seek,不用再做
      if (scrubModeActive) {
        const finalFrame = pendingFrame ?? currentFrameRef.current;
        seekToFrame(finalFrame);
        // 拖动前在播放 → 恢复播放 (YouTube 风格)
        if (wasPlayingBeforeDrag) {
          const v = videoRef.current;
          if (v) {
            v.muted = v.playbackRate !== 1;
            cancelAnimationFrame(seekRafRef.current);
            // 关键: video.currentTime 是异步的, 若在 seek 未完成时切到 video 显示,
            // 浏览器会出现短暂黑屏. 等 seeked 触发后再切, canvas 期间继续显示已画的帧
            const startPlayback = () => {
              v.play().catch(() => {});
              setIsPlaying(true);
              setUseCanvasDisplay(false);
            };
            if (v.seeking) {
              v.addEventListener('seeked', startPlayback, { once: true });
            } else {
              startPlayback();
            }
          }
        }
      }
      wasPlayingBeforeDrag = false;
      pendingFrame = null;
      pendingSide = null;
      scrubModeActive = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [totalFrames, trimStart, trimEnd, videoFps, seekToFrame, seekToFrameRough, beginDragOverlay]);

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

  // 导出当前帧为 PNG。优先用 canvas(WebCodecs 解出的精确帧),fallback 到 video 元素截图。
  const exportCurrentFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!videoFile || !video) return;
    let blob: Blob | null = null;

    // Tier 1: 已经在 canvas 显示精确帧
    if (useCanvasDisplay && canvasRef.current && canvasRef.current.width > 0) {
      blob = await new Promise<Blob | null>((res) => canvasRef.current!.toBlob(res, 'image/png'));
    }

    // Tier 2: 从 video 元素截图
    if (!blob) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w === 0 || h === 0) {
        showToast('Video not ready');
        return;
      }
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const ctx = tmp.getContext('2d');
      if (!ctx) return;
      try {
        ctx.drawImage(video, 0, 0, w, h);
        blob = await new Promise<Blob | null>((res) => tmp.toBlob(res, 'image/png'));
      } catch (e) {
        showToast(`Frame capture failed: ${e instanceof Error ? e.message : e}`);
        return;
      }
    }

    if (!blob) {
      showToast('Failed to encode PNG');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const baseName = videoFile.name.replace(/\.[^.]+$/, '');
    a.href = url;
    a.download = `${baseName}.frame_${currentFrame}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [videoFile, useCanvasDisplay, currentFrame, showToast]);

  // 总帧数 + 首帧到达信号 (用于隐藏 loading overlay)
  const [videoFirstFrameReady, setVideoFirstFrameReady] = useState(false);
  useEffect(() => { setVideoFirstFrameReady(false); }, [videoSrc]);
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
    };
    const onFirstFrame = () => setVideoFirstFrameReady(true);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('loadeddata', onFirstFrame);
    if (video.readyState >= 2) setVideoFirstFrameReady(true);
    if (video.duration && isFinite(video.duration) && videoFps > 0) setTotalFrames(Math.round(video.duration * videoFps));
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('loadeddata', onFirstFrame);
    };
  }, [videoSrc, videoFps, frameBufferReady, prefetch]);

  // 后台热身预取:暂停状态下,debounce 500ms 后解码当前帧后方的帧,
  // 这样按 A 倒退时第一帧立即命中缓存,避免首次延迟
  useEffect(() => {
    if (!frameBufferReady || isPlaying || holdPlayingRef.current || isDraggingRef.current) return;
    if (currentFrame <= 0) return;
    const warmupRange = Math.min(120, Math.max(60, Math.round(videoFps)));
    const t = setTimeout(() => {
      if (holdPlayingRef.current || isDraggingRef.current) return;
      prefetch(currentFrame, warmupRange, 'backward');
    }, 500);
    return () => clearTimeout(t);
  }, [currentFrame, frameBufferReady, isPlaying, videoFps, prefetch]);

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
                  {/* Row 1 (桌面端 display:contents 不影响布局;手机端变为独立一行) */}
                  <div className="fc-toolbar-row1">
                    <span className="fc-video-label">{videoName}</span>
                    {videoFile && (
                      <VideoInfoButton
                        info={{
                          videoFile,
                          videoFps,
                          codec: fbDecoderConfig?.codec ?? null,
                          width: fbDecoderConfig?.codedWidth ?? videoRef.current?.videoWidth ?? 0,
                          height: fbDecoderConfig?.codedHeight ?? videoRef.current?.videoHeight ?? 0,
                          durationSec: videoFps > 0 && totalFrames > 0 ? totalFrames / videoFps : (videoRef.current?.duration ?? 0),
                          sampleCount: fbSamples.length > 0 ? fbSamples.length : null,
                          audio: audioInfo,
                          vfr: vfrInfo,
                        }}
                      />
                    )}
                    {/* Time 已移到右侧 Solve header (按 Solve 维度记录 time); FPS 见 ⓘ */}
                  </div>

                  {/* Row 2: 图像变换 + New/Folder/Export */}
                  <div className="fc-toolbar-row2">
                    <div className="fc-toolbar-controls">
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

                    <button className="fc-change-video fc-new-btn" onClick={() => fileInputRef.current?.click()} title="New video">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5"/>
                        <line x1="9" y1="5" x2="9" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="5" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <button className="fc-change-video fc-folder-btn fc-new-btn" onClick={openFromFolder} title="Open video from folder (auto-load/save .splits.txt)">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 5a1 1 0 0 1 1-1h4l1.5 2H15a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <div className="fc-export-wrap" ref={exportMenuRef}>
                    <button
                      className="fc-export-btn"
                      onClick={() => exporting ? undefined : setShowExportMenu(v => !v)}
                      disabled={exporting}
                      title="Export"
                    >
                      <IconExport />
                      {exporting ? `${exportProgress}%` : ''}
                      {!exporting && <span className="fc-export-caret">▾</span>}
                    </button>
                    {showExportMenu && !exporting && (
                      <div className="fc-export-menu">
                        <button
                          className="fc-export-menu-item"
                          onClick={() => { setShowExportMenu(false); handleExport(); }}
                        >
                          Export Video
                        </button>
                        <button
                          className="fc-export-menu-item"
                          onClick={() => { setShowExportMenu(false); exportCurrentFrame(); }}
                        >
                          Export Current Frame
                        </button>
                      </div>
                    )}
                  </div>
                    <button className="fc-shortcuts-btn" onClick={() => setShowShortcuts(true)} title="Keyboard Shortcuts">
                      <IconKeyboard />
                    </button>
                  </div>
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
                  onTouchStart={(e) => {
                    if (cropMode) return;
                    if (e.touches.length >= 2) {
                      handlePinchStart(e.touches[0], e.touches[1]);
                    } else {
                      handlePanStart(e.touches[0].clientX, e.touches[0].clientY);
                    }
                  }}
                  onTouchMove={(e) => {
                    if (e.touches.length >= 2 && pinchRef.current) {
                      handlePinchMove(e.touches[0], e.touches[1]);
                    } else if (e.touches.length === 1 && !pinchRef.current) {
                      handlePanMove(e.touches[0].clientX, e.touches[0].clientY);
                    }
                  }}
                  onTouchEnd={(e) => {
                    if (e.touches.length < 2) handlePinchEnd();
                    if (e.touches.length === 0) handlePanEnd();
                  }}
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

                  {/* 大视频文件读取进度 — 画面已出则隐藏, 避免遮挡 */}
                  {loadProgress && !decoderDead && !videoFirstFrameReady && (
                    <LoadingProgressOverlay bytes={loadProgress.bytes} total={loadProgress.total} />
                  )}

                  {/* Decoder 彻底失败时的友好提示 (HEVC 4:2:2 等浏览器不支持的 profile) */}
                  {decoderDead && videoFile && (
                    <DecodeErrorCard
                      videoFile={videoFile}
                      codec={fbDecoderConfig?.codec ?? null}
                      onCopy={copyToClipboard}
                    />
                  )}

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
              <div className={`fc-drop-hint ${dragging ? 'dragging' : ''}`}>
                <button type="button" className="fc-drop-upload-btn" onClick={() => fileInputRef.current?.click()} aria-label="Upload video">
                  <IconUpload />
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="video/*" className="fc-file-input" onChange={handleFileSelect} />
          </div>

          {/* ── 控制栏 ── */}
          {videoSrc && (
            <div className="fc-panel fc-controls-wrap">
              {/* Mark 三角标,贴在时间轴上方,单击跳到对应帧 */}
              {totalFrames > 0 && activeSolve.marks.length > 0 && (
                <div className="fc-mark-tri-row">
                  {activeSolve.marks.map((m, i) => {
                    const pct = (m.frame / totalFrames) * 100;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`fc-mark-tri ${selectedMarkIdx === i ? 'selected' : ''}`}
                        style={{ left: `${pct}%` }}
                        onClick={() => { setSelectedMarkIdx(i); seekToFrame(m.frame); }}
                        title={`Mark ${i}: frame ${m.frame}`}
                      >▼</button>
                    );
                  })}
                </div>
              )}

              {/* iOS-style timeline trimmer */}
              <div className="fc-timeline-trimmer" ref={trimTrackRef}>
                {/* Thumbnail filmstrip — 优先用 WebCodecs 增量缩略图 (视频加载后立即开始出现) */}
                <div className="fc-timeline-filmstrip">
                  {timelineThumbs.length > 0
                    ? timelineThumbs.map(({ bitmap }, i) => (
                        <ThumbnailCanvas key={i} bitmap={bitmap} />
                      ))
                    : thumbnails.map((src, i) => (
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
                  onPointerDown={(e) => {
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
                  onPointerDown={(e) => {
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
                    <div ref={playheadRef} className="fc-timeline-playhead" style={{ left: `${pct}%` }}>
                      <span ref={playheadTooltipRef} className="fc-playhead-tooltip">{formatTime(currentFrame / videoFps)} ({currentFrame})</span>
                    </div>
                  );
                })()}

                {/* Click/drag to seek overlay */}
                <div
                  className="fc-timeline-seek-area"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const track = trimTrackRef.current;
                    if (!track || totalFrames <= 0) return;
                    const rect = track.getBoundingClientRect();
                    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const effEnd = trimEnd || totalFrames;
                    const frame = Math.max(trimStart, Math.min(Math.round(frac * totalFrames), effEnd));
                    // 先做一次精确 seek —— 纯单击(无 drag)时画面即为最高画质
                    // 若用户继续拖动,onMove 首次触发时再切到 scrub 模式
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

                {/* Solve bands: 每个 solve 在其首尾 mark 之间画一条带,点击切换;
                    active solve 显示各 mark 的序号,其他 solve 显示名字 */}
                {totalFrames > 0 && solves.map((s, si) => {
                  if (s.marks.length < 1) return null;
                  const firstFrame = s.marks[0].frame;
                  const lastFrame = s.marks[s.marks.length - 1].frame;
                  const span = Math.max(1, lastFrame - firstFrame);
                  const leftPct = (firstFrame / totalFrames) * 100;
                  const widthPct = Math.max(0.4, (span / totalFrames) * 100);
                  const isActive = si === activeSolveIdx;
                  return (
                    <div
                      key={si}
                      className={`fc-solve-band ${isActive ? 'active' : ''}`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      onPointerDown={(e) => { e.stopPropagation(); if (!isActive) { setActiveSolveIdx(si); setSelectedMarkIdx(null); } }}
                      title={`${s.name} — ${s.marks.length} marks`}
                    >
                      {isActive ? (
                        s.marks.map((m, mi) => {
                          const rel = span > 0 ? ((m.frame - firstFrame) / span) * 100 : 0;
                          return (
                            <span key={mi} className="fc-solve-band-mark" style={{ left: `${rel}%` }}>{mi}</span>
                          );
                        })
                      ) : (
                        <span className="fc-solve-band-label">{s.name}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="fc-controls">
                <div className="fc-rate-group">
                  {PLAYBACK_RATES.map((r) => (
                    <button key={r} className={`fc-rate-btn ${playbackRate === r ? 'active' : ''}`} onClick={() => changeRate(r)}>{r === 1 ? '1x' : r}</button>
                  ))}
                </div>

                <div className="fc-ctrl-sep" />

                <button className="fc-ctrl-btn" title="Back 10 frames (Q)" {...longPressProps(() => stepFrames(-10), 150)}><IconSkipBack /></button>
                <button className="fc-ctrl-btn" title="Back 1 frame (A)" {...longPressProps(() => stepFrames(-1), 80)}><IconFrameBack /></button>
                <button className="fc-ctrl-btn play-btn" title="Play/Pause (K)" onClick={togglePlay}>
                  {isPlaying ? <IconPause /> : <IconPlay />}
                </button>
                <button className="fc-ctrl-btn" title="Forward 1 frame (D)" {...longPressProps(() => stepFrames(1), 80)}><IconFrameForward /></button>
                <button className="fc-ctrl-btn" title="Forward 10 frames (E)" {...longPressProps(() => stepFrames(10), 150)}><IconSkipForward /></button>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：Solve 面板 */}
        {videoSrc && (
          <div className="fc-solve-col">
            {/* Solve 选择器 */}
            <div className="fc-panel fc-solve-header">
              <button className="fc-solve-btn" title="Add Solve (+)" onClick={addSolve}>+</button>
              <button className="fc-solve-btn" title="Remove Solve" onClick={removeSolve}>−</button>
              <select
                className="fc-solve-select"
                value={activeSolveIdx}
                onChange={(e) => { setActiveSolveIdx(parseInt(e.target.value)); setSelectedMarkIdx(null); }}
              >
                {solves.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
              </select>
              <div className="fc-input-unit-wrap">
                <input
                  className="fc-tab-input fc-toolbar-time"
                  type="number" step="0.01" min={0} placeholder="Time (s)"
                  inputMode="decimal"
                  style={{ width: `${solveTime.length > 0 ? solveTime.length + 1 : 9}ch` }}
                  value={solveTime}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSolveTime(v);
                    if (/^\d+\.\d{2}$/.test(v)) {
                      e.target.blur();
                    }
                  }}
                />
                {solveTime && <span className="fc-input-suffix">s</span>}
              </div>
            </div>

            {/* Marks 列表 */}
            <div className="fc-panel fc-marks-panel">
              {/* Mark 操作按钮 */}
              <div className="fc-mark-actions">
                <button className="fc-action-btn" onClick={addMark} disabled={activeSolve.marks.some(m => m.frame === currentFrame)}>Add</button>
                <button className="fc-action-btn" onClick={() => selectedMarkIdx !== null && removeMark(selectedMarkIdx)} disabled={selectedMarkIdx === null}>Remove</button>
                <button className="fc-action-btn" title="将选中 mark 的帧号更新为当前播放位置" onClick={updateMark} disabled={selectedMarkIdx === null}>Update</button>
              </div>
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
                {startFramePreview && (
                  <div className="fc-start-suggest">
                    <div className="fc-method-toggle" role="radiogroup" aria-label="Start-frame method">
                      <span className="fc-method-toggle-label">Start:</span>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={startFrameMethod === 'fps'}
                        className={`fc-method-opt ${startFrameMethod === 'fps' ? 'active' : ''}`}
                        onClick={() => { setStartFrameMethod('fps'); if (startFramePreview) seekToFrame(startFramePreview.byFps); }}
                        title="Start frame = endFrame − ⌈(⌊time⌋₂+.009) × fps⌉"
                      >FPS <span className="fc-method-wca-badge">WCA</span></button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={startFrameMethod === 'timestamp'}
                        className={`fc-method-opt ${startFrameMethod === 'timestamp' ? 'active' : ''}`}
                        onClick={() => { setStartFrameMethod('timestamp'); if (startFramePreview?.byTs != null) seekToFrame(startFramePreview.byTs); }}
                        title="Start frame = 距离 (end sample timestamp − time × 1e6μs) 最近的 sample"
                      >Timestamp</button>
                    </div>
                    {startFrameMethod === 'fps' && (
                      <button
                        type="button"
                        className="fc-suggest-row active"
                        onClick={() => seekToFrame(startFramePreview.byFps)}
                        title={`Jump to frame ${startFramePreview.byFps} (FPS method)`}
                      >
                        <span className="fc-suggest-formula">
                          frames = ⌈(⌊{solveTimeNum.toFixed(2)}⌋₂+.009)×{videoFps.toFixed(2)}⌉ = <b>{startFramePreview.framesBack}f</b>
                        </span>
                        <span className="fc-suggest-formula-sub">
                          start = {startFramePreview.endFrame} − {startFramePreview.framesBack}f = <b>{startFramePreview.byFps}f</b>
                        </span>
                      </button>
                    )}
                    {startFrameMethod === 'timestamp' && (
                      <button
                        type="button"
                        className={`fc-suggest-row active ${startFramePreview.byTs === null ? 'disabled' : ''}`}
                        onClick={() => startFramePreview.byTs !== null && seekToFrame(startFramePreview.byTs)}
                        disabled={startFramePreview.byTs === null}
                        title={startFramePreview.byTs === null
                          ? 'Samples not ready yet'
                          : `Jump to frame ${startFramePreview.byTs} (timestamp method)`}
                      >
                        {startFramePreview.endSampleTs !== null && startFramePreview.targetTs !== null ? (
                          <>
                            <span className="fc-suggest-formula">
                              target = {startFramePreview.endSampleTs.toFixed(3)} − (⌊{solveTimeNum.toFixed(2)}⌋₂+.009) = <b>{startFramePreview.targetTs.toFixed(3)}s</b>
                            </span>
                            <span className="fc-suggest-formula-sub">
                              floor sample #<b>{startFramePreview.byTs ?? '—'}</b>
                              {startFramePreview.byTsSampleTs !== null && (
                                <> (ts={startFramePreview.byTsSampleTs.toFixed(3)}s ≤ target)</>
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="fc-suggest-formula-sub">samples not ready</span>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && <div className="fc-toast">{toast}</div>}

      {/* Folder 选视频弹窗(目录中有多个视频时) */}
      {folderPickerVideos && (
        <div className="fc-modal-overlay" onClick={() => setFolderPickerVideos(null)}>
          <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
            <button className="fc-modal-close" onClick={() => setFolderPickerVideos(null)}>✕</button>
            <h2>Select a video</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '60vh', overflowY: 'auto' }}>
              {folderPickerVideos.map((v) => (
                <button
                  key={v.name}
                  className="fc-tab-btn"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={async () => {
                    const dir = folderPickerDirRef.current;
                    setFolderPickerVideos(null);
                    if (dir) await loadFromDirectoryEntry(dir, v);
                  }}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
