'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import BoolToggle from '@/components/BoolToggle';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import { CompactSelect } from '@/components/CompactSelect';
import { usePopoverPosition } from '@cuberoot/timer-ui/popover-position';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import '@/components/training-settings.css';
import { createPortal } from 'react-dom';
import type { VideoReviewSurface } from '../../video-recon/VideoReconClient';
import { cropPixels, type PixelCrop } from '@/lib/video-recon/engine/source-crop';
import { VideoSourceFilmstrip } from '@/components/video/VideoSourceFilmstrip';
import { VideoFrameProgressRing } from '../../video-recon/VideoReconProgress';
import { VideoStatsStage } from '../../video-recon/VideoStatsStage';
import type { PlaybackSpeed } from '@/lib/video-recon/engine/playback-timing';
import type { CaptionCube } from '@/lib/video-tools/caption-cube';
import type { VerifiedVideoDraft } from '../../video-recon/VideoSolveAnalysis';
import { useT } from '@/hooks/useT';
import { downloadBlob } from '@/lib/scramble-dist/download';
import { bindTrackpadZoom } from '@/lib/cube-trackpad';
import { captionAss, captionCubeRect, initialCaptionStyle, paintCaption, prepareCaptions, solutionCues } from '@/lib/video-tools/recon-captions';

const rounded = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const MIN_CAPTION_SIZE = 8;
const MAX_CAPTION_SIZE = 240;

function bindOverlayZoom(handle: HTMLButtonElement | null, resize: (step: number, factor: number) => void) {
  if (!handle) return;
  return bindTrackpadZoom(handle, factor => resize(0, factor), event => {
    if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    event.stopPropagation();
    resize(-Math.sign(event.deltaY), 1);
  });
}

export default function ReconCaptionEditor({ file, review, solution, recognition, scramble, event, onApply, onUse }: {
  review?: VideoReviewSurface;
  file: File; solution: string; recognition?: VerifiedVideoDraft; scramble: string; event?: string; onApply?: () => void; onUse?: (file: File) => void;
}) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cubeCanvas = useRef<HTMLCanvasElement>(null);
  const fontInput = useRef<HTMLInputElement>(null);
  const presentedTime = useRef<number | undefined>(undefined);
  const frameReader = useRef<ReturnType<typeof import('@/lib/video-recon/engine/frame-stream').openVideoFile> | undefined>(undefined);
  const [stepping, setStepping] = useState(false);
  const task = useRef<AbortController | null>(null);
  const customFaces = useRef(new Set<FontFace>());
  const [customFont, setCustomFont] = useState<{ family: string; name: string; installedFamily: string }>();
  const [fontReady, setFontReady] = useState('');
  const [loadingFont, setLoadingFont] = useState(false);
  const [videoSource, setSource] = useState({ width: 0, height: 0, duration: 0 });
  const workspace = review?.workspace;
  const cubeEngine = review?.cubeEngine ?? 'three';
  const solidFoundation = cubeEngine === 'cubing' && !!review?.solidFoundation;
  const source = review ? { width: review.view.videoSize?.width ?? 0, height: review.view.videoSize?.height ?? 0, duration: review.view.duration } : videoSource;
  const { duration } = source;
  const [framing, setFraming] = useState<{ file: File; crop?: PixelCrop }>();
  const [trimBars, setTrimBars] = useState(true);
  const detectedCrop = framing?.file === file ? framing.crop : undefined;
  const manualCrop = review?.view.sourceCrop;
  const crop = useMemo(() => manualCrop && source.width && source.height
    ? cropPixels(manualCrop, source.width, source.height) : trimBars ? detectedCrop : undefined,
  [manualCrop, source.width, source.height, trimBars, detectedCrop]);
  useEffect(() => {
    if (!workspace || framing?.file !== file || !source.width || !source.height) return;
    // A manually cropped source has already been cropped by the frame presenter.
    workspace.setPreviewFraming(crop && !manualCrop ? {
      x: crop.x / source.width, y: crop.y / source.height, width: crop.width / source.width, height: crop.height / source.height,
    } : null);
    return () => workspace.setPreviewFraming(undefined);
  }, [workspace, framing, file, source.width, source.height, crop, manualCrop]);
  const media = crop ?? source;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const bothAxes = !!crop && crop.width < source.width && crop.height < source.height;
  const paintVideo = !workspace && bothAxes && !CSS.supports('object-view-box', 'inset(1%)');
  const inset = crop && `inset(${100 * crop.y / source.height}% ${100 * (1 - (crop.x + crop.width) / source.width)}% ${100 * (1 - (crop.y + crop.height) / source.height)}% ${100 * crop.x / source.width}%)`;
  useEffect(() => {
    if (!(source.width && source.height && duration > 0 && Number.isFinite(duration))) return;
    const controller = new AbortController();
    void import('@/lib/video-tools/caption-crop').then(({ detectCaptionCrop }) =>
      detectCaptionCrop(file, source.width, source.height, duration, controller.signal)
    ).catch(() => undefined).then(result => {
      if (!controller.signal.aborted) setFraming({ file, crop: result });
    });
    return () => controller.abort();
  }, [file, duration, source.width, source.height]);
  const cubeGrip = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const cubeDragged = useRef(false);
  const cubeHandle = useRef<HTMLButtonElement>(null);
  const cubePanel = useRef<HTMLDivElement>(null);
  const cubePanelId = useId();
  const [cubeEditorOpen, setCubeEditorOpen] = useState(false);
  const [offset, setOffset] = useState(NaN);
  const [useCube, setUseCube] = useState(true);
  const [cubeRenderer, setCube] = useState<{ engine: typeof cubeEngine; renderer: CaptionCube }>();
  const cube = cubeRenderer?.engine === cubeEngine ? cubeRenderer.renderer : undefined;
  const [editedText, setText] = useState<string>();
  const sourceText = recognition?.cues?.length ? recognition.solution : solution;
  const text = review ? sourceText : editedText ?? sourceText;
  const [videoPosition, setPosition] = useState(0);
  const position = review ? (review.view.trimming ? review.view.position : review.view.presentedTimestamp) : videoPosition;
  const [style, setStyle] = useState(initialCaptionStyle);
  const [sizeInput, setSizeInput] = useState<string>();
  const captionHandle = useRef<HTMLButtonElement>(null);
  const stylePanel = useRef<HTMLDivElement>(null);
  const stylePanelId = useId();
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const bindCaptionHandle = useCallback((handle: HTMLButtonElement | null) => {
    captionHandle.current = handle;
    if (!handle) return;
    const unbind = bindOverlayZoom(handle, (step, factor) => {
      setSizeInput(undefined);
      setStyle(previous => {
        const size = Math.max(MIN_CAPTION_SIZE, Math.min(MAX_CAPTION_SIZE, rounded(previous.size * factor + step)));
        return size === previous.size ? previous : { ...previous, size };
      });
    });
    return () => { unbind?.(); captionHandle.current = null; };
  }, []);
  const bindCubeHandle = useCallback((handle: HTMLButtonElement | null) => {
    cubeHandle.current = handle;
    if (!handle) return;
    const unbind = bindOverlayZoom(handle, (step, factor) => {
      const { width, height } = media;
      setStyle(previous => {
        const scale = previous.cubeScale ?? 1;
        const cubeScale = Math.max(.4, Math.min(2.2, rounded(scale * factor + step * .05)));
        if (cubeScale === scale) return previous;
        const { left, top, edge } = captionCubeRect(width, height, previous.cubePosition, scale);
        const newEdge = captionCubeRect(width, height, undefined, cubeScale).edge;
        if (newEdge === edge) return { ...previous, cubeScale };
        const shift = (edge - newEdge) / 2;
        const position = { x: (left + shift) / width, y: (top + shift) / height };
        const next = captionCubeRect(width, height, position, cubeScale);
        return { ...previous, cubeScale, cubePosition: { x: next.left / width, y: next.top / height } };
      });
    });
    return () => { unbind?.(); cubeHandle.current = null; };
  }, [media.width, media.height]);
  const captionGrip = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const captionDragged = useRef(false);
  const [captionRect, setCaptionRect] = useState<ReturnType<typeof paintCaption>>();
  const cubeRect = captionCubeRect(media.width, media.height, style.cubePosition, style.cubeScale);
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState('');
  const [output, setOutput] = useState<File>();
  const recognized = useMemo(() => {
    const timed = recognition?.cues;
    if (!timed?.length || !recognition) return;
    if (text === recognition.solution) return timed;
    // Stage annotations can change without changing any observed move or timestamp.
    const rows = solutionCues(text, 0);
    const moves = (line: string) => line.split('//')[0].trim().replace(/\s+/g, ' ');
    const inspection = (solution: string) => solution.split('\n')
      .filter(line => /\/\/\s*(?:insp(?:ection)?|观察)\s*$/i.test(line)).map(moves).join(' ');
    if (rows.length !== timed.length || inspection(text) !== inspection(recognition.solution)) return;
    if (rows.some((row, i) => moves(row.text) !== moves(timed[i].text))) return;
    return timed.map((cue, i) => ({ ...cue, text: rows[i].text }));
  }, [recognition, text]);
  const cues = useMemo(() => recognized ?? solutionCues(text, offset), [recognized, text, offset]);
  const prepared = useMemo(() => prepareCaptions(cues), [cues]);
  const valid = duration > 0 && cues.length > 0 && cues.every((cue, i) => cue.start >= 0 && cue.end > cue.start
    && cue.end <= duration + .001 && (!i || cue.start >= cues[i - 1].end - .000001)
    && cue.marks?.some(mark => mark && (mark.start < cue.start || mark.start >= cue.end)) !== true);
  const timedTurns = prepared.flatMap(c => c.turns);
  const allTimed = timedTurns.length > 0 && timedTurns.every(m => Number.isFinite(m.from) && Number.isFinite(m.to));
  const enableCube = event === '3x3' && useCube && !!scramble.trim() && allTimed && valid;
  useEffect(() => {
    const abort = new AbortController();
    let renderer: CaptionCube | undefined;
    setCube(undefined);
    if (enableCube) void import('@/lib/video-tools/caption-cube').then(async ({ createCaptionCube }) => {
      if (abort.signal.aborted) return;
      const next = await createCaptionCube(scramble, text, prepared, cubeEngine, abort.signal);
      if (abort.signal.aborted) { next.dispose(); return; }
      renderer = next;
      setCube({ engine: cubeEngine, renderer });
    }).catch(() => {
      if (!abort.signal.aborted) {
        setUseCube(false);
        setError(t('无法绘制小魔方，请检查浏览器的 WebGL 支持。', 'The cube could not render. Check WebGL support.'));
      }
    });
    return () => { abort.abort(); renderer?.dispose(); };
  }, [enableCube, scramble, text, prepared, cubeEngine, t]);
  const busy = progress !== undefined && progress < 100;
  useEffect(() => {
    if (progress !== 100) return;
    const timer = window.setTimeout(() => setProgress(undefined), 500);
    return () => window.clearTimeout(timer);
  }, [progress]);
  const canEditCaption = !!captionRect && !busy && media.width > 0 && media.height > 0 && (!review || !!review.overlay);
  const styleEditorVisible = styleEditorOpen && canEditCaption;
  const showCubeHandle = !!cube && !busy && media.width > 0 && media.height > 0;
  const canEditCube = showCubeHandle && !!review?.overlay && cubeEngine === 'cubing';
  const cubeEditorVisible = cubeEditorOpen && canEditCube;
  const cubePanelStyle = usePopoverPosition({
    open: cubeEditorVisible, triggerRef: cubeHandle, panelRef: cubePanel,
    contentKey: `${media.width}:${media.height}:${cubeRect.left}:${cubeRect.top}:${cubeRect.edge}`,
  });
  const closeCubeEditor = useCallback(() => setCubeEditorOpen(false), []);
  usePopoverDismiss(cubeEditorVisible, closeCubeEditor, cubePanel, cubeHandle);
  useEffect(() => { if (!canEditCube) closeCubeEditor(); }, [canEditCube, closeCubeEditor]);
  useEffect(() => { if (cubeEditorVisible) cubePanel.current?.focus({ preventScroll: true }); }, [cubeEditorVisible]);
  useEffect(closeCubeEditor, [file, closeCubeEditor]);
  const stylePanelStyle = usePopoverPosition({
    open: styleEditorVisible, triggerRef: captionHandle, panelRef: stylePanel,
    contentKey: `${media.width}:${media.height}:${captionRect?.x}:${captionRect?.y}:${captionRect?.height}:${captionRect?.width}`,
  });
  const closeStyleEditor = useCallback(() => {
    setStyleEditorOpen(false);
    setFontMenuOpen(false);
    setSizeInput(undefined);
  }, []);
  usePopoverDismiss(styleEditorVisible && !fontMenuOpen, closeStyleEditor, stylePanel, captionHandle);
  useEffect(() => { if (!canEditCaption) closeStyleEditor(); }, [canEditCaption, closeStyleEditor]);
  useEffect(() => { if (styleEditorVisible) stylePanel.current?.focus({ preventScroll: true }); }, [styleEditorVisible]);
  useEffect(closeStyleEditor, [file, closeStyleEditor]);
  const ready = (!review || !!review.overlay) && framing?.file === file && fontReady === style.font && !loadingFont && (!enableCube || !!cube);
  useEffect(() => {
    const url = workspace ? undefined : URL.createObjectURL(file);
    const faces = customFaces.current;
    if (video.current && url) video.current.src = url;
    return () => {
      task.current?.abort();
      if (url) URL.revokeObjectURL(url);
      void frameReader.current?.then(reader => reader.close()).catch(() => {});
      frameReader.current = undefined;
      faces.forEach(face => document.fonts.delete(face));
    };
  }, [file, workspace]);
  useEffect(() => {
    let active = true;
    document.fonts.load('700 64px ' + style.font, 'R U D').then(() => {
      if (active) setFontReady(style.font);
    }).catch(() => { if (active) setError(t('字体加载失败，请选择其他字体。', 'Font could not load. Choose another font.')); });
    return () => { active = false; };
  }, [style.font, t]);
  useEffect(() => {
    setOutput(undefined);
    setProgress(undefined);
    return () => { task.current?.abort(); };
  }, [file, style, prepared, cube, useCube, crop, solidFoundation]);
  const paint = useCallback((time: number) => {
    const layer = canvas.current, player = video.current;
    const ctx = layer?.getContext('2d');
    if (!layer || !ctx || !media.width || !media.height) return;
    if (layer.width !== media.width) layer.width = media.width;
    if (layer.height !== media.height) layer.height = media.height;
    ctx.clearRect(0, 0, layer.width, layer.height);
    if (paintVideo && crop && player && player.readyState >= 2) {
      ctx.drawImage(player, crop.x, crop.y, crop.width, crop.height, 0, 0, layer.width, layer.height);
    }
    if (!workspace) {
      cube?.setSolidFoundation?.(solidFoundation);
      cube?.draw(ctx, time, layer.width, layer.height, style.cubePosition, style.cubeScale);
    }
    const rect = paintCaption(ctx, prepared, time, layer.width, layer.height, style);
    setCaptionRect(previous => previous && rect && previous.x === rect.x && previous.y === rect.y
      && previous.width === rect.width && previous.height === rect.height ? previous : rect);
  }, [media.width, media.height, paintVideo, crop, prepared, cube, style, solidFoundation, workspace]);
  const paintReviewCube = useCallback((time: number) => {
    const layer = cubeCanvas.current;
    const ctx = layer?.getContext('2d');
    if (!ctx || !cube) return;
    const edge = cubeRect.edge;
    cube.setSolidFoundation?.(solidFoundation);
    const image = cube.capture(time, edge);
    ctx.clearRect(0, 0, edge, edge);
    ctx.drawImage(image, 0, 0, edge, edge);
  }, [cube, cubeRect.edge, solidFoundation]);
  const overlay = review?.overlay;
  const readPlaybackTime = review?.view.running && !review.view.trimming ? workspace?.readReviewPlaybackTime : undefined;
  useLayoutEffect(() => {
    if (overlay && !readPlaybackTime) paintReviewCube(position);
  }, [overlay, readPlaybackTime, position, paintReviewCube]);
  useEffect(() => {
    if (!overlay || !cube || !readPlaybackTime) return;
    let lastTime: number | undefined;
    let frame = requestAnimationFrame(function tick(now) {
      const time = readPlaybackTime!(now);
      if (time !== lastTime) {
        lastTime = time;
        paintReviewCube(time);
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [overlay, cube, readPlaybackTime, paintReviewCube]);
  useLayoutEffect(() => {
    if (overlay) paint(position);
  }, [overlay, position, paint, fontReady]);
  useEffect(() => {
    const player = video.current;
    if (!player || !duration || workspace) return;
    const seek = () => paint(presentedTime.current ?? player.currentTime);
    let frame: number;
    function next(_: number, meta: VideoFrameCallbackMetadata) {
      presentedTime.current = meta.mediaTime; paint(meta.mediaTime); frame = player!.requestVideoFrameCallback(next);
    }
    seek();
    if (player.requestVideoFrameCallback) frame = player.requestVideoFrameCallback(next);
    else player.addEventListener('timeupdate', seek);
    player.addEventListener('seeked', seek);
    return () => {
      if (frame !== undefined) player.cancelVideoFrameCallback(frame);
      player.removeEventListener('timeupdate', seek); player.removeEventListener('seeked', seek);
    };
  }, [paint, duration, workspace, fontReady]);
  function locate(seconds: number) {
    if (!Number.isFinite(seconds)) return;
    if (review) {
      if (review.view.trimming) review.workspace.previewSelection(seconds);
      else void review.workspace.requestReview(seconds);
      return;
    }
    if (!video.current) return;
    video.current.pause();
    video.current.currentTime = Math.min(duration, Math.max(0, seconds));
  }
  async function stepFrame(delta: number) {
    const player = video.current;
    if (!player || stepping) return;
    player.pause(); setStepping(true);
    try {
      frameReader.current ??= import('@/lib/video-recon/engine/frame-stream').then(({ openVideoFile }) => openVideoFile(file));
      const reader = await frameReader.current;
      if (!video.current) return;
      // Get the displayed sample first, even if the playhead is between two timestamps.
      const current = await reader.preview(player.currentTime);
      if (!current) return;
      current.bitmap.close();
      const direction = delta < 0 ? -1 : 1;
      let timestamp = current.timestamp;
      for (let i = 0; i < Math.abs(delta); i++) {
        const next = await reader.previewAdjacent(timestamp, direction);
        if (!next) break;
        next.bitmap.close();
        timestamp = next.timestamp;
      }
      if (timestamp !== current.timestamp) {
        presentedTime.current = timestamp;
        locate(timestamp + .000001);
      }
    } catch { setError(t('无法读取相邻帧，可用画面时间定位。', 'Adjacent frames are unavailable. Use the time field to seek.')); }
    finally { setStepping(false); }
  }
  async function loadFont(picked: File) {
    setLoadingFont(true);
    try {
      const family = 'ReconFont' + crypto.randomUUID().replaceAll('-', '');
      const face = await new FontFace(family, await picked.arrayBuffer(), { weight: '700' }).load();
      if (!fontInput.current) return;
      document.fonts.add(face); customFaces.current.add(face);
      setCustomFont({ family, name: picked.name, installedFamily: picked.name.replace(/\.[^.]+$/, '') });
      setStyle(s => ({ ...s, font: family })); setError('');
    } catch { setError(t('无法读取字体，请选择 TTF、OTF 或 WOFF 字体。', 'Choose a valid TTF, OTF or WOFF font.')); }
    finally { setLoadingFont(false); }
  }
  function moveCaption(x: number, y: number) {
    setStyle(s => ({ ...s, x: clamp(x), y: clamp(y) }));
  }
  function captionPointer(e: PointerEvent<HTMLElement>) {
    const frame = canvas.current?.getBoundingClientRect();
    if (!frame?.width || !frame.height) return;
    return { x: (e.clientX - frame.left) / frame.width, y: (e.clientY - frame.top) / frame.height };
  }
  function moveCube(x: number, y: number) {
    const { left, top } = captionCubeRect(media.width, media.height, { x, y }, style.cubeScale);
    setStyle(s => ({ ...s, cubePosition: { x: left / media.width, y: top / media.height } }));
  }
  function dragCube(e: PointerEvent<HTMLButtonElement>) {
    const grip = cubeGrip.current, frame = canvas.current?.getBoundingClientRect();
    if (!grip || !frame?.width || !frame.height || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    if (!cubeDragged.current) {
      if (Math.hypot(e.clientX - grip.startX, e.clientY - grip.startY) < 4) return;
      cubeDragged.current = true;
      closeCubeEditor();
    }
    moveCube((e.clientX - frame.left) / frame.width - grip.x, (e.clientY - frame.top) / frame.height - grip.y);
  }
  function downloadAss() {
    const families: Record<string, string> = {
      CaptionSilkscreen: 'Silkscreen', 'system-ui': 'Arial', monospace: 'Courier New', serif: 'Georgia',
    };
    const family = customFont && style.font === customFont.family ? customFont.installedFamily : families[style.font] ?? 'Arial';
    const content = captionAss(prepared, style, family, media.width, media.height);
    downloadBlob(file.name.replace(/\.[^.]+$/, '') + '.ass', new Blob(['\uFEFF', content], { type: 'text/plain;charset=utf-8' }));
  }
  async function render(useOutput = false) {
    if (task.current || !valid || !ready) return;
    if (output) {
      if (useOutput) onUse?.(output);
      else downloadBlob(output.name, output);
      return;
    }
    const controller = new AbortController();
    task.current = controller; setProgress(0); setError('');
    try {
      const { renderReconVideo } = await import('@/lib/video-tools/export');
      cube?.setSolidFoundation?.(solidFoundation);
      const result = await renderReconVideo(file, prepared, style, percent => {
        if (!controller.signal.aborted) setProgress(Math.min(percent, 99));
      }, controller.signal, cube, crop);
      if (controller.signal.aborted) return;
      setOutput(result);
      setProgress(100);
      if (useOutput) onUse?.(result);
      else downloadBlob(result.name, result);
    } catch {
      setProgress(undefined);
      if (!controller.signal.aborted) setError(t('此浏览器无法将这个视频编码为 MP4，请尝试桌面浏览器或更换视频。', 'This browser could not encode this video as MP4. Try a desktop browser or a different video.'));
    } finally {
      if (task.current === controller) {
        task.current = null;
        if (controller.signal.aborted) setProgress(undefined);
      }
    }
  }
  const fontItems = [
    { value: 'CaptionSilkscreen', label: 'Silkscreen' },
    { value: 'system-ui', label: t('系统字体', 'System sans') },
    { value: 'monospace', label: t('等宽', 'Monospace') },
    { value: 'serif', label: t('衬线', 'Serif') },
    ...(customFont ? [{ value: customFont.family, label: customFont.name }] : []),
  ];
  const styleLabel = t('字幕样式', 'Caption style');
  const cubeStyleLabel = t('魔方外观', 'Cube appearance');
  const cubeLayout = media.width > 0 && media.height > 0 ? {
    left: `${100 * cubeRect.left / media.width}%`, top: `${100 * cubeRect.top / media.height}%`,
    width: `${100 * cubeRect.edge / media.width}%`, height: `${100 * cubeRect.edge / media.height}%`,
  } : undefined;
  const overlayControls = <>
    {review && cube && cubeLayout && <canvas className="recon-caption-cube-layer" ref={cubeCanvas}
      width={cubeRect.edge} height={cubeRect.edge} style={cubeLayout} aria-hidden />}
    <canvas className="recon-caption-layer" ref={canvas} aria-hidden />
    {showCubeHandle && <button type="button" ref={bindCubeHandle}
      className="recon-caption-cube-handle"
      aria-label={canEditCube ? t('设置魔方外观，方向键可微调位置', 'Set cube appearance, or use arrow keys to move the cube')
        : t('移动魔方，方向键可微调', 'Move cube, or use arrow keys to adjust')}
      aria-haspopup={canEditCube ? 'dialog' : undefined} aria-expanded={canEditCube ? cubeEditorVisible : undefined}
      aria-controls={cubeEditorVisible ? cubePanelId : undefined}
      style={cubeLayout}
      onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
      onPointerDown={e => {
        if (!e.isPrimary || e.button !== 0) return;
        const frame = canvas.current!.getBoundingClientRect();
        const box = e.currentTarget.getBoundingClientRect();
        if (!frame.width || !frame.height) return;
        cubeDragged.current = false;
        cubeGrip.current = { x: (e.clientX - box.left) / frame.width, y: (e.clientY - box.top) / frame.height,
          startX: e.clientX, startY: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={dragCube} onPointerUp={dragCube} onLostPointerCapture={() => { cubeGrip.current = null; }}
      onClick={e => {
        e.stopPropagation();
        if (!canEditCube || (e.detail && cubeDragged.current)) return;
        closeStyleEditor();
        setCubeEditorOpen(open => !open);
      }}
      onKeyDown={e => {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (!dx && !dy) return;
        e.preventDefault(); e.stopPropagation();
        moveCube((cubeRect.left + dx) / media.width, (cubeRect.top + dy) / media.height);
      }} />}
    {cubeEditorVisible && review && <div id={cubePanelId} ref={cubePanel} role="dialog" aria-label={cubeStyleLabel}
      tabIndex={-1} popover="manual" className="settings-popover-layer recon-caption-editor" style={cubePanelStyle}>
      <div className="settings-popover-panel" data-site-surface="popover">
        <strong>{cubeStyleLabel}</strong>
        <LiquidGlassChips items={['transparent', 'black']} value={solidFoundation ? 'black' : 'transparent'}
          role="listbox" ariaLabel={cubeStyleLabel} onChange={value => review.setSolidFoundation(value === 'black')}
          getLabel={value => value === 'black' ? t('黑色', 'Black') : t('透明', 'Transparent')} />
      </div>
    </div>}
    {captionRect && canEditCaption && <button type="button" ref={bindCaptionHandle}
      className="recon-caption-text-handle" aria-label={t('编辑字幕样式，方向键可微调位置', 'Edit caption style, or use arrow keys to move captions')}
      aria-haspopup="dialog" aria-expanded={styleEditorVisible} aria-controls={styleEditorVisible ? stylePanelId : undefined}
      style={{ left: `${100 * captionRect.x / media.width}%`, top: `${100 * captionRect.y / media.height}%`,
        width: `${100 * captionRect.width / media.width}%`, height: `${100 * captionRect.height / media.height}%` }}
      onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
      onPointerDown={e => {
        if (!e.isPrimary || e.button !== 0) return;
        captionDragged.current = false;
        const point = captionPointer(e);
        if (!point) return;
        captionGrip.current = { x: point.x - captionRect.x / media.width, y: point.y - captionRect.y / media.height,
          startX: e.clientX, startY: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        const grip = captionGrip.current;
        if (!grip || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        if (!captionDragged.current) {
          if (Math.hypot(e.clientX - grip.startX, e.clientY - grip.startY) < 4) return;
          captionDragged.current = true;
          if (styleEditorVisible) closeStyleEditor();
        }
        const point = captionPointer(e);
        if (point) moveCaption(point.x - grip.x, point.y - grip.y);
      }}
      onLostPointerCapture={() => { captionGrip.current = null; }}
      onClick={e => {
        e.stopPropagation();
        if (e.detail && captionDragged.current) return;
        closeCubeEditor();
        if (styleEditorVisible) closeStyleEditor();
        else setStyleEditorOpen(true);
      }}
      onKeyDown={e => {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (!dx && !dy) return;
        e.preventDefault(); e.stopPropagation();
        moveCaption((captionRect.x + dx) / media.width, (captionRect.y + dy) / media.height);
      }} />}
    {styleEditorVisible && <div id={stylePanelId} ref={stylePanel} role="dialog" aria-label={styleLabel} tabIndex={-1}
      popover="manual" className="settings-popover-layer recon-caption-editor" style={stylePanelStyle}>
      <div className="settings-popover-panel" data-site-surface="popover">
        <strong>{styleLabel}</strong>
        <div className="recon-caption-actions"><span>{t('字体', 'Font')}</span>
          <CompactSelect ariaLabel={t('字体', 'Font')} value={style.font} disabled={loadingFont} onOpenChange={setFontMenuOpen}
            items={[...fontItems, { value: 'import-font', label: t('导入字体', 'Import font') }]}
            label={fontItems.find(item => item.value === style.font)?.label} keyboardListNavigation showArrow
            onChange={font => {
              if (font === 'import-font') fontInput.current?.click();
              else setStyle(previous => ({ ...previous, font }));
            }} />
        </div>
        {customFont && style.font === customFont.family && <label>
          {t('ASS 使用的字体名称', 'Installed font name for ASS')}
          <input value={customFont.installedFamily} onChange={e => setCustomFont({ ...customFont, installedFamily: e.currentTarget.value })} />
        </label>}
        <div className="recon-caption-actions">
          <label>{t('字号', 'Size')} <input type="number" min={MIN_CAPTION_SIZE} max={MAX_CAPTION_SIZE}
            value={sizeInput ?? Math.round(style.size)} onChange={e => {
              const input = e.currentTarget;
              setSizeInput(input.value);
              const size = input.valueAsNumber;
              if (input.validity.valid && Number.isFinite(size)) setStyle(previous => ({ ...previous, size }));
            }} onBlur={() => setSizeInput(undefined)} /> px</label>
          <label>{t('描边', 'Outline')} <input type="number" min={1} max={25} defaultValue={style.stroke} onChange={e => {
            const stroke = e.currentTarget.valueAsNumber;
            if (e.currentTarget.validity.valid && Number.isFinite(stroke)) setStyle(previous => ({ ...previous, stroke }));
          }} onBlur={e => { e.currentTarget.value = String(style.stroke); }} /> px</label>
        </div>
        <BoolToggle value={style.comments} onChange={comments => setStyle(prev => ({ ...prev, comments }))} disabled={busy}
          label={t('阶段注释', 'Stage comments')} />
      </div>
    </div>}
    <input ref={fontInput} type="file" hidden accept=".ttf,.otf,.woff,.woff2" onChange={e => {
      const f = e.target.files?.[0]; e.target.value = ''; if (f) void loadFont(f);
    }} />
  </>;
  const useLabel = t('使用视频复盘', 'Use video reconstruction');
  const useOptions = [
    ...(onApply ? [{ value: 'solution', label: t('仅复盘', 'Reconstruction only') }] : []),
    ...(onUse ? [{ value: 'both', label: t('复盘和视频', 'Reconstruction and video'), disabled: !valid || !ready }] : []),
  ];
  const actions = <>
    {!review && <div className="recon-caption-actions">
      {([-1, 1] as const).map(d => <button type="button" className="submit-reuse-btn" key={d} disabled={!duration || stepping} onClick={() => void stepFrame(d)}>
        {d < 0 ? t('上一帧', 'Previous frame') : t('下一帧', 'Next frame')}</button>)}
    </div>}
    <div className="recon-caption-actions">
      {!review && recognition?.cues?.length && !recognized ? <button type="button" className="submit-reuse-btn" disabled={busy} onClick={() => {
        setText(undefined); setError('');
      }}>{t('使用识别出的解法', 'Use recognized solution')}</button> : null}
      {(onApply || output && onUse) && <CompactSelect label={t('使用', 'Use')} ariaLabel={useLabel}
        items={useOptions} disabled={busy} triggerClassName="btn-primary" unstyledTrigger showArrow keyboardListNavigation
        onChange={value => {
          if (value === 'solution') onApply?.();
          else void render(true);
        }} />}
      <button type="button" className="btn-primary" disabled={!valid || !ready || busy} onClick={() => void render()}>{t('导出', 'Export')}</button>
      <button type="button" className="submit-reuse-btn" onClick={downloadAss}
        disabled={!valid || framing?.file !== file || !media.width || !media.height || busy}>{t('下载 ASS 字幕', 'Download ASS subtitles')}</button>
    </div>
    {!review && !recognized && duration > 0 && <button type="button" className="submit-reuse-btn" disabled={busy}
      onClick={() => setOffset(video.current?.currentTime ?? 0)}>{t('以当前画面作为还原起点', 'Use current frame as solve start')}</button>}
    {!review && !valid && duration > 0 && <p className="submit-hint">
      {t('请在复盘文本中注明各阶段用时，并定位到还原起点。', 'Include each stage duration in the reconstruction and select the frame where the solve starts.')}
    </p>}
    {error && <p className="submit-hint submit-hint-warn" role="alert">{error}</p>}
  </>;
  const playerSettings = <>
    {event === '3x3' && <BoolToggle value={useCube} onChange={setUseCube} disabled={busy}
      label={t('动画', 'Animation')} />}
    {detectedCrop && !manualCrop && <BoolToggle value={trimBars} onChange={setTrimBars} disabled={busy}
      label={t('裁去原片黑边', 'Crop source black bars')} />}
  </>;
  const exportRing = progress !== undefined && <VideoFrameProgressRing progress={progress} label={t('导出', 'Export')} />;
  const playerFrame = overlay?.closest('.video-recon-player-frame');
  if (review) return <>
    {overlay && createPortal(overlayControls, overlay)}
    {playerFrame && exportRing && createPortal(exportRing, playerFrame)}
    {review.playerMenu && createPortal(playerSettings, review.playerMenu)}
    {review.settings && createPortal(<div className="recon-caption-editor">
      {actions}
    </div>, review.settings)}
  </>;
  const frame = media.width && media.height ? media : { width: 300, height: 150 };
  return <div className="video-recon-columns recon-caption-editor">
    <div className="recon-caption-monitor">
      <div className="video-recon-source-panel">
        <VideoStatsStage frameDecoration={exportRing} settingsItems={playerSettings} fileName={file.name} className="video-recon-stage recon-caption-preview" playback={paintVideo ? {
          filmstrip: <VideoSourceFilmstrip source={file} />,
          playing, speed, end: duration, position, index: Math.round(position * 1000), length: Math.round(duration * 1000) + 1,
          onPlay: () => { const v = video.current; if (v?.paused) void v.play(); else v?.pause(); },
          onSpeed: rate => { setSpeed(rate); if (video.current) video.current.playbackRate = rate; },
          onSeekIndex: ms => locate(ms / 1000), onStep: direction => void stepFrame(direction),
        } : undefined}>
          <div className="recon-caption-viewport" style={{
            width: `min(100%, ${frame.width}px, calc(var(--video-recon-preview-height) * ${frame.width / frame.height}))`,
            aspectRatio: `${frame.width} / ${frame.height}`,
          }}>
            <div className="recon-caption-picture" style={media.width && media.height ? {
              width: `min(100cqw, calc(100cqh * ${media.width / media.height}))`,
              aspectRatio: `${media.width} / ${media.height}`,
            } : undefined}>
              <video ref={video} controls={!paintVideo} playsInline preload="auto"
                style={source.width ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: crop ? 'cover' : 'contain',
                  ...(bothAxes && inset ? { objectViewBox: inset } : {}),
                  objectPosition: crop ? `${100 * crop.x / (source.width - crop.width || 1)}% ${100 * crop.y / (source.height - crop.height || 1)}%` : undefined,
                } : undefined}
                onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
                onLoadedMetadata={({ currentTarget: v }) => setSource({ width: v.videoWidth, height: v.videoHeight, duration: v.duration })}
                onSeeking={() => { presentedTime.current = undefined; }}
                onTimeUpdate={e => setPosition(e.currentTarget.currentTime)} onSeeked={e => setPosition(e.currentTarget.currentTime)}
                onError={() => setError(t('无法预览这个视频。', 'This video cannot be previewed.'))} />
              {overlayControls}
            </div>
          </div>
        </VideoStatsStage>
      </div>
      {actions}
    </div>
    <fieldset className="recon-caption-fields" disabled={busy}>
      <section><label><strong>{t('复盘文本', 'Reconstruction text')}</strong>
        <textarea className="recon-caption-text" rows={4} value={text} onChange={e => setText(e.target.value)} /></label></section>
    </fieldset>
  </div>;
}
