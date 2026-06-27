/**
 * sim_export — 把当前 setup+alg 离线渲染成 1080p mp4。
 *
 * 思路: 暂停 tweener 的 rAF 自动推进, 把 renderer 切到 1920×1080, twister.setup(setup)
 * 立即应用 setup, push(alg) 进 queue, 然后 manual loop:
 *   tweener.update() 推一帧 → renderer.render() → new VideoFrame(canvas) → encoder.encode
 * 直到 queue + 活跃 tween 都空, 末尾再 hold 30 帧便于观看, 收尾走 mp4-muxer。
 *
 * 复用 wr_metric (top10_export.ts) 的 VideoEncoder/mp4-muxer 编码套路: avc1.640033 / 12 Mbps / 30 fps。
 */
import * as THREE from 'three';
import { Alg } from 'cubing/alg';
import World from './engine/world';
import { timing } from './engine/tweenTiming';
import tweener from './engine/tweener';
import { cleanForPlayer } from '@/lib/recon-alg-utils';

const W = 1920;
const H = 1080;
const FPS = 30;
const BITRATE = 12_000_000;
const HOLD_END_FRAMES = FPS;          // 末尾停 1 秒
const HOLD_START_FRAMES = Math.round(FPS * 0.5); // 起始停 0.5 秒
const MAX_FRAMES = 30 * 60 * FPS;     // 30 分钟硬上限, 防失控

export interface ExportProgress {
  phase: string;
  pct: number;
  framesDone: number;
  framesTotal: number;
}

export interface SimExportOptions {
  world: World;
  renderer: THREE.WebGLRenderer;
  setup: string;
  alg: string;
  isZh: boolean;
  abortRef: { aborted: boolean };
  onProgress?: (p: ExportProgress) => void;
  previewCanvas?: HTMLCanvasElement | null;
}

/** 把 alg 用 cubing.js Alg 展平为单一 leaf moves 序列, 跟 PlayerControls 走同一 parser。 */
function expandAlg(alg: string): string {
  const cleaned = cleanForPlayer(alg);
  if (!cleaned.trim()) return '';
  try {
    const leafs = [...new Alg(cleaned).experimentalLeafMoves()].map(m => m.toString());
    return leafs.join(' ');
  } catch {
    return cleaned;
  }
}

/** 估算总帧数 — 仅用于进度条 (实际帧数取决于 group lock 并发, 最终以循环结束为准)。 */
function estimateTotalFrames(alg: string): number {
  const leafs = expandAlg(alg).split(/\s+/).filter(Boolean);
  // 单 move = CubeGroup.frames 帧; 同轴串行假设占满。给个保守估算: 移动数 × frames × 0.9
  const perMove = timing.frames;
  return HOLD_START_FRAMES + Math.max(perMove, Math.round(leafs.length * perMove * 0.9)) + HOLD_END_FRAMES;
}

export async function exportSimVideo(opts: SimExportOptions): Promise<void> {
  const { world, renderer, setup, alg, isZh, abortRef, onProgress, previewCanvas } = opts;
  if (typeof VideoEncoder === 'undefined') {
    throw new Error((isZh
              ? '浏览器不支持 WebCodecs (需 Chrome / Edge / Safari 16.4+)'
              : 'Browser does not support WebCodecs'));
  }

  const expanded = expandAlg(alg);
  if (!expanded) {
    throw new Error((isZh ? '解法为空, 没有可导出的动画' : 'Alg is empty — nothing to record'));
  }

  // 1. snapshot 原始 renderer / world 状态, finally 里恢复
  const origCanvas = renderer.domElement;
  const origDrawW = origCanvas.width;
  const origDrawH = origCanvas.height;
  const origStyleW = origCanvas.style.width;
  const origStyleH = origCanvas.style.height;
  const origPixelRatio = renderer.getPixelRatio();
  const origWorldW = world.width;
  const origWorldH = world.height;
  const origFrames = timing.frames;

  let previewCtx: CanvasRenderingContext2D | null = null;
  if (previewCanvas) {
    previewCanvas.width = W;
    previewCanvas.height = H;
    previewCtx = previewCanvas.getContext('2d');
  }

  // 2. 切到 1080p; manual stepping
  tweener.paused = true;
  // setPixelRatio(1) 让 setSize 真的拿到 1920×1080 像素 buffer, 不被 devicePixelRatio 放大
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  world.width = W;
  world.height = H;
  world.resize();

  onProgress?.({
    phase: (isZh ? '准备...' : 'Preparing...'),
    pct: 0, framesDone: 0, framesTotal: estimateTotalFrames(alg),
  });

  // 3. mp4-muxer + VideoEncoder
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encoderError = e instanceof Error ? e : new Error(String(e)); },
  });
  encoder.configure({
    codec: 'avc1.640033',
    width: W,
    height: H,
    bitrate: BITRATE,
    framerate: FPS,
  });

  const encodeFrame = (frameIndex: number): void => {
    const ts = Math.round(frameIndex * 1e6 / FPS);
    const vf = new VideoFrame(origCanvas, { timestamp: ts, duration: Math.round(1e6 / FPS) });
    const isKey = frameIndex % FPS === 0;
    encoder.encode(vf, { keyFrame: isKey });
    vf.close();
    if (previewCtx && (frameIndex % 5 === 0)) {
      // WebGL 源 canvas 透明背景,2D 预览必须先 clear,否则历代帧 alpha=0 区叠加成残影
      previewCtx.fillStyle = '#000';
      previewCtx.fillRect(0, 0, W, H);
      previewCtx.drawImage(origCanvas, 0, 0, W, H);
    }
  };

  const renderOnce = (): void => {
    renderer.clear();
    renderer.render(world.scene, world.camera);
  };

  const yieldForBackpressure = async (): Promise<void> => {
    while (encoder.encodeQueueSize > 4 && !abortRef.aborted) {
      await new Promise<void>(r => setTimeout(r, 0));
    }
  };

  // 4. 离线渲染 + 编码
  let frameIndex = 0;
  const encodeStartTs = performance.now();
  let lastProgressTs = encodeStartTs;
  const totalEstimate = estimateTotalFrames(alg);

  const tickProgress = async (phaseZh: string, phaseEn: string): Promise<void> => {
    const now = performance.now();
    if (now - lastProgressTs <= 200 && frameIndex !== 0) return;
    lastProgressTs = now;
    const elapsed = (now - encodeStartTs) / 1000;
    const fps = (frameIndex + 1) / Math.max(0.1, elapsed);
    const pct = Math.min(0.99, frameIndex / Math.max(1, totalEstimate));
    onProgress?.({
      phase: isZh
        ? `${phaseZh} · ${fps.toFixed(0)} fps`
        : `${phaseEn} · ${fps.toFixed(0)} fps`,
      pct,
      framesDone: frameIndex,
      framesTotal: totalEstimate,
    });
    await new Promise<void>(r => setTimeout(r, 0));
  };

  try {
    // a) 应用 setup (立即同步, 内部 tweener.finish 跳过动画)
    world.cube.twister.setup(setup);
    world.cube.dirty = true;
    renderOnce();

    // b) 起始 hold
    for (let i = 0; i < HOLD_START_FRAMES; i++) {
      if (abortRef.aborted) throw new Error('aborted');
      if (encoderError) throw encoderError;
      encodeFrame(frameIndex++);
      await yieldForBackpressure();
      if (frameIndex % 6 === 0) await tickProgress('录制开头', 'Recording intro');
    }

    // c) push alg 进 twister queue, 之后 manual tick
    world.cube.twister.push(expanded);

    while (frameIndex < MAX_FRAMES) {
      if (abortRef.aborted) throw new Error('aborted');
      if (encoderError) throw encoderError;

      const hasWork = tweener.length > 0 || world.cube.twister.length > 0;
      if (!hasWork) break;

      // 推一帧 tween;若 tweener 空但 queue 还有 (理论上不该发生, 但 force 等场景下可能),
      // 主动 pump 一次 twister.update 让下一个 action 入 tween
      if (tweener.length === 0) {
        (world.cube.twister as unknown as { update: () => void }).update();
        if (tweener.length === 0) break; // 真卡死, 退出
      }
      tweener.update();
      world.cube.dirty = true;
      renderOnce();
      encodeFrame(frameIndex++);
      await yieldForBackpressure();
      if (frameIndex % 6 === 0) await tickProgress('编码中', 'Encoding');
    }

    // d) 末尾 hold
    for (let i = 0; i < HOLD_END_FRAMES; i++) {
      if (abortRef.aborted) throw new Error('aborted');
      if (encoderError) throw encoderError;
      encodeFrame(frameIndex++);
      await yieldForBackpressure();
      if (frameIndex % 6 === 0) await tickProgress('录制末尾', 'Recording outro');
    }

    onProgress?.({
      phase: (isZh ? '正在封装 mp4...' : 'Finalizing mp4...'),
      pct: 1, framesDone: frameIndex, framesTotal: frameIndex,
    });
    await encoder.flush();
    if (encoderError) throw encoderError;
    encoder.close();
    muxer.finalize();
  } catch (e) {
    try { encoder.close(); } catch { /* ignore */ }
    throw e;
  } finally {
    // 5. 恢复 — 不管成功失败都要复位, 否则 UI canvas 卡在 1080p
    tweener.paused = false;
    timing.frames = origFrames;
    renderer.setPixelRatio(origPixelRatio);
    renderer.setSize(origWorldW, origWorldH, false);
    // setSize 第二参数 false 不动 style, 但 setPixelRatio 可能已改 drawingBuffer; 强制还原
    origCanvas.width = origDrawW;
    origCanvas.height = origDrawH;
    origCanvas.style.width = origStyleW;
    origCanvas.style.height = origStyleH;
    world.width = origWorldW;
    world.height = origWorldH;
    world.resize();
    world.dirty = true;
  }

  if (abortRef.aborted) throw new Error('aborted');

  // 6. 下载
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tsTag = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `sim-${tsTag}.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
