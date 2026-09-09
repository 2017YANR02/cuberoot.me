/**
 * sim_export — 把当前 setup+alg 离线渲染成 1080p mp4。
 *
 * 思路: 暂停 tweener 的 rAF 自动推进, 把 renderer 切到 1920×1080, twister.setup(setup)
 * 立即应用 setup, push(alg) 进 queue, 然后 manual loop:
 *   tweener.update() 推一帧 → renderer.render() → new VideoFrame(canvas) → encoder.encode
 * 直到 queue + 活跃 tween 都空, 末尾再 hold 30 帧便于观看, 收尾走 mp4-muxer。
 *
 * 与成绩页、历史画卷复用 canvas-video-export 编码器: avc1.640033 / 12 Mbps / 30 fps。
 */
import * as THREE from 'three';
import { Alg } from 'cubing/alg';
import World from './engine/world';
import { timing } from './engine/tweenTiming';
import tweener from './engine/tweener';
import { cleanForPlayer } from '@/lib/recon-alg-utils';
import { createCanvasVideoEncoder, type ExportProgress } from '@/lib/canvas-video-export';
import { saveBlob } from '@/lib/document-export';

export type { ExportProgress } from '@/lib/canvas-video-export';

const W = 1920;
const H = 1080;
const FPS = 30;
const BITRATE = 12_000_000;
const HOLD_END_FRAMES = FPS;          // 末尾停 1 秒
const HOLD_START_FRAMES = Math.round(FPS * 0.5); // 起始停 0.5 秒
const MAX_FRAMES = 30 * 60 * FPS;     // 30 分钟硬上限, 防失控

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
  const origPaused = tweener.paused;

  let previewCtx: CanvasRenderingContext2D | null = null;
  if (previewCanvas) {
    previewCanvas.width = W;
    previewCanvas.height = H;
    previewCtx = previewCanvas.getContext('2d');
  }

  onProgress?.({
    phase: (isZh ? '准备...' : 'Preparing...'),
    pct: 0, framesDone: 0, framesTotal: estimateTotalFrames(alg),
  });

  // 2. 能力预检和编码器创建在改变场景前完成。
  const encoder = await createCanvasVideoEncoder({
    width: W, height: H, fps: FPS, bitrate: BITRATE, abortRef, keyFrameInterval: FPS,
  });

  const encodeFrame = async (frameIndex: number): Promise<void> => {
    if (previewCtx && (frameIndex % 5 === 0)) {
      // WebGL 源 canvas 透明背景,2D 预览必须先 clear,否则历代帧 alpha=0 区叠加成残影
      previewCtx.fillStyle = '#000';
      previewCtx.fillRect(0, 0, W, H);
      previewCtx.drawImage(origCanvas, 0, 0, W, H);
    }
    await encoder.encode(origCanvas, frameIndex);
  };

  const renderOnce = (): void => {
    // 离线导出也让 U 面 logo 跟住中心块(转层动画里同步旋转)。
    (world.cube as { updateLogoTransform?: () => void }).updateLogoTransform?.();
    renderer.clear();
    renderer.render(world.scene, world.camera);
  };

  // 4. 离线渲染 + 编码
  let frameIndex = 0;
  const encodeStartTs = performance.now();
  let lastProgressTs = encodeStartTs;
  const totalEstimate = estimateTotalFrames(alg);
  let blob: Blob;

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
    // 3. 切到 1080p; manual stepping，出错同样通过 finally 恢复。
    tweener.paused = true;
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    world.width = W;
    world.height = H;
    world.resize();

    // a) 应用 setup (立即同步, 内部 tweener.finish 跳过动画)
    world.cube.twister.setup(setup);
    world.cube.dirty = true;
    renderOnce();

    // b) 起始 hold
    for (let i = 0; i < HOLD_START_FRAMES; i++) {
      if (abortRef.aborted) throw new Error('aborted');
      await encodeFrame(frameIndex++);
      if (frameIndex % 6 === 0) await tickProgress('录制开头', 'Recording intro');
    }

    // c) push alg 进 twister queue, 之后 manual tick
    world.cube.twister.push(expanded);

    while (frameIndex < MAX_FRAMES) {
      if (abortRef.aborted) throw new Error('aborted');

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
      await encodeFrame(frameIndex++);
      if (frameIndex % 6 === 0) await tickProgress('编码中', 'Encoding');
    }

    // d) 末尾 hold
    for (let i = 0; i < HOLD_END_FRAMES; i++) {
      if (abortRef.aborted) throw new Error('aborted');
      await encodeFrame(frameIndex++);
      if (frameIndex % 6 === 0) await tickProgress('录制末尾', 'Recording outro');
    }

    onProgress?.({
      phase: (isZh ? '正在封装 mp4...' : 'Finalizing mp4...'),
      pct: 1, framesDone: frameIndex, framesTotal: frameIndex,
    });
    blob = await encoder.finish();
  } finally {
    encoder.close();
    // 5. 恢复 — 不管成功失败都要复位, 否则 UI canvas 卡在 1080p
    tweener.paused = origPaused;
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
  const tsTag = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  saveBlob(blob, `sim-${tsTag}.mp4`);
}
