// NOTE: /wca/globe「轨迹」模式导出视频(WebCodecs 确定性逐帧编码,固定 60fps)。
//   globe 是 MapLibre WebGL 画布,无法纯 Canvas2D 重画;改为:每帧由调用方 setupFrame()
//   布置地图(arc source + 相机)→ settle() 等渲染稳定 → drawImage(GL 画布) + 烧入字幕/logo
//   → VideoFrame(按 fps 时间戳)→ VideoEncoder(H.264)→ mp4-muxer。
//   与实时无关,帧率恒定 = fps(实时 MediaRecorder 会被渲染速度拖到 ~18fps,故弃用)。
//   依赖建图 preserveDrawingBuffer:true,否则 drawImage(GL 画布) 读到空白。

const FONT_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';
const ACCENT = '#e9b341';
const MAX_SIDE = 1920;

export interface TrailFrameState {
  index: number;          // 当前比赛 0-based
  total: number;
  cuberName: string;      // 已 displayCuberName 本地化
  compName: string;       // 已本地化
  compMeta: string;       // "城市, 国家 · 日期"
}

export interface TrailExportOptions {
  mapCanvas: HTMLCanvasElement;
  totalFrames: number;
  fps: number;
  /** 为第 f 帧布置地图(设 source + 相机),返回该帧字幕状态 */
  setupFrame: (f: number) => TrailFrameState;
  /** 等地图把当前帧渲染稳定 */
  settle: () => Promise<void>;
  logo?: HTMLImageElement | null;
  abortRef: { aborted: boolean };
  onProgress?: (done: number, total: number) => void;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (maxW <= 0) return '';
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

export function isVideoExportSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

export async function exportTrailVideo(opts: TrailExportOptions): Promise<Blob> {
  const { mapCanvas, totalFrames, fps, setupFrame, settle, logo, abortRef, onProgress } = opts;
  if (!isVideoExportSupported()) {
    throw new Error('WebCodecs unsupported');
  }

  // 合成画布:按 map 画布等比缩到最长边 <= MAX_SIDE,偶数(H.264 要求)
  const sw = mapCanvas.width || 1280;
  const sh = mapCanvas.height || 720;
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const W = Math.max(2, Math.round((sw * scale) / 2) * 2);
  const H = Math.max(2, Math.round((sh * scale) / 2) * 2);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2d context unavailable');

  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: W, height: H, frameRate: fps },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encoderError = e instanceof Error ? e : new Error(String(e)); },
  });
  const bitrate = Math.max(4_000_000, Math.min(24_000_000, Math.round(W * H * fps * 0.1)));
  encoder.configure({ codec: 'avc1.640033', width: W, height: H, bitrate, framerate: fps });

  const frameDur = Math.round(1e6 / fps);

  try {
    for (let f = 0; f < totalFrames; f++) {
      if (abortRef.aborted) throw new Error('aborted');
      if (encoderError) throw encoderError;

      const st = setupFrame(f);
      await settle();
      if (abortRef.aborted) throw new Error('aborted');

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      try { ctx.drawImage(mapCanvas, 0, 0, W, H); } catch { /* 读不到时黑底 */ }
      drawOverlay(ctx, W, H, st, logo ?? null);

      const vf = new VideoFrame(canvas, { timestamp: f * frameDur, duration: frameDur });
      encoder.encode(vf, { keyFrame: f % (fps * 2) === 0 });
      vf.close();

      while (encoder.encodeQueueSize > 4 && !abortRef.aborted && !encoderError) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
      if (f % 4 === 0 || f === totalFrames - 1) {
        onProgress?.(f + 1, totalFrames);
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    await encoder.flush();
    if (encoderError) throw encoderError;
    encoder.close();
    muxer.finalize();
  } catch (e) {
    try { encoder.close(); } catch { /* ignore */ }
    throw e;
  }

  return new Blob([target.buffer], { type: 'video/mp4' });
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  st: TrailFrameState,
  logo: HTMLImageElement | null,
): void {
  const s = H / 1080;

  // 底部渐变压暗
  const gradH = 300 * s;
  let g = ctx.createLinearGradient(0, H - gradH, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.74)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H - gradH, W, gradH);

  // 顶部轻压暗
  const topH = 150 * s;
  g = ctx.createLinearGradient(0, 0, 0, topH);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, topH);

  const padX = 56 * s;
  ctx.textBaseline = 'alphabetic';

  // 顶部左:选手名
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(40 * s)}px ${FONT_SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText(truncate(ctx, st.cuberName, W - padX * 2), padX, 70 * s);

  // 底部左:N / total → 比赛名 → 城市,国家·日期(自下而上)
  let by = H - 56 * s;
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.font = `400 ${Math.round(26 * s)}px ${FONT_SANS}`;
  ctx.fillText(truncate(ctx, st.compMeta, W - padX * 2), padX, by);

  by -= 44 * s;
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(46 * s)}px ${FONT_SANS}`;
  ctx.fillText(truncate(ctx, st.compName, W - padX * 2), padX, by);

  by -= 56 * s;
  ctx.fillStyle = ACCENT;
  ctx.font = `700 ${Math.round(24 * s)}px ${FONT_MONO}`;
  ctx.fillText(`${st.index + 1} / ${st.total}`, padX, by);

  // 底部右:logo(按高度保比例;CubeRoot-dark 是方形标)
  if (logo && logo.naturalWidth > 0 && logo.naturalHeight > 0) {
    const lh = 76 * s;
    const lw = lh * (logo.naturalWidth / logo.naturalHeight);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logo, W - padX - lw, H - 46 * s - lh, lw, lh);
    ctx.globalAlpha = 1;
  }
}
