/**
 * @module useFrameBuffer
 * WebCodecs 帧缓冲 — mp4box.js 解复用 + VideoDecoder + LRU ImageBitmap 缓存。
 * 长按 A 后退时，直接从缓存取帧渲染到 Canvas，无需 seek。
 *
 * 浏览器兼容：WebCodecs 仅 Chrome 94+/Edge 94+，其余浏览器 isReady=false，
 * 调用方 fallback 到 seeked 链。
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  createFile,
  DataStream,
  Endianness,
  type ISOFile,
  type MP4BoxBuffer,
  type Movie,
  type Track,
  type Sample,
} from 'mp4box';

// ── 常量 ─────────────────────────────────────────────────────────────────────

/** 移动端检测: iOS Safari 单页内存限制紧 (~1GB), 需要更保守的预算 */
const IS_MOBILE = typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
   (typeof window !== 'undefined' && window.innerWidth <= 768));

/** 缓冲区最大帧数。stepBack 按 fps 自适应 prefetch (高 fps 视频需要更大缓冲),
 *  需容纳"旧的未消费帧 + 新的整段",否则 LRU 会把未消费帧淘汰
 *  (get 把已消费帧标记为最近,反而保留,不消费的反而被淘汰)。
 *  360 帧:可支持到 240fps 视频 (2 批 × 240 帧) 的顺滑回放。
 *  1080p ImageBitmap 通常用 GPU texture,实际占用远小于 RGBA 估算。
 *  移动端 (iOS Safari 单页 GPU 内存极紧, 解码峰值瞬间能撑爆) 降到 60。 */
const MAX_CACHE = IS_MOBILE ? 60 : 360;

/** WebCodecs 是否可用 */
const HAS_WEBCODECS = typeof VideoDecoder !== 'undefined';

// ── 类型 ─────────────────────────────────────────────────────────────────────

export interface SampleInfo {
  /** 帧在视频中的序号（0-based） */
  index: number;
  /** 是否关键帧（I帧） */
  isSync: boolean;
  /** 对应的编码数据 */
  data: Uint8Array;
  /** 时间戳 μs */
  timestamp: number;
  /** 持续时间 μs */
  duration: number;
}

export interface FrameBufferHook {
  /** 取已解码的帧，无则返回 null */
  getFrame(frameIndex: number): ImageBitmap | null;
  /** 预解码 center ± range, direction 可偏向 'backward' 或 'forward' */
  prefetch(center: number, range: number, direction?: 'backward' | 'forward'): void;
  /** 取最接近的 I 帧缩略图 (专为拖动时丝滑 scrub 设计,全局持久缓存,不走 LRU) */
  getKeyFrameThumb(frameIndex: number): ImageBitmap | null;
  /** 按 presentation index 升序排列的全部已解码缩略图条目 (用于 timeline 展示) */
  keyFrameThumbs: Array<{ frameIdx: number; bitmap: ImageBitmap }>;
  /** WebCodecs 是否可用且初始化完成 */
  isReady: boolean;
  /** 释放所有资源 */
  dispose(): void;
  /** 所有帧的编码数据（供导出使用） */
  samples: SampleInfo[];
  /** VideoDecoder 配置（供导出使用） */
  decoderConfig: VideoDecoderConfig | null;
  /**
   * 基于 sample 时间戳的起表帧定位 — 用于魔方裁判场景下校准 WCA 公式。
   * 给定 end user-frame 和向前回溯秒数, 返回距离 target timestamp 最近的 sample 对应的 user-frame。
   * 不可用时 (samples 未就绪 / secondsBack<=0) 返回 null。
   */
  findStartFrameByTimestamp(endUserFrame: number, secondsBack: number): number | null;
}

// ── LRU 帧缓存 ──────────────────────────────────────────────────────────────

class FrameCache {
  private cache = new Map<number, ImageBitmap>();
  private accessOrder: number[] = [];

  get(index: number): ImageBitmap | null {
    const bmp = this.cache.get(index);
    if (!bmp) return null;
    // 移到末尾（最近访问）
    this.accessOrder = this.accessOrder.filter(i => i !== index);
    this.accessOrder.push(index);
    return bmp;
  }

  set(index: number, bmp: ImageBitmap): void {
    if (this.cache.has(index)) {
      // 已有则替换
      this.cache.get(index)!.close();
      this.cache.set(index, bmp);
      this.accessOrder = this.accessOrder.filter(i => i !== index);
      this.accessOrder.push(index);
      return;
    }
    // 超容量：淘汰最久未访问的
    while (this.cache.size >= MAX_CACHE && this.accessOrder.length > 0) {
      const evict = this.accessOrder.shift()!;
      const old = this.cache.get(evict);
      if (old) { old.close(); this.cache.delete(evict); }
    }
    this.cache.set(index, bmp);
    this.accessOrder.push(index);
  }

  has(index: number): boolean {
    return this.cache.has(index);
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    for (const bmp of this.cache.values()) bmp.close();
    this.cache.clear();
    this.accessOrder = [];
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useFrameBuffer(
  videoFile: File | null,
  fps: number,
): FrameBufferHook {
  const [isReady, setIsReady] = useState(false);
  // 缩略图版本号 — 新 thumb 加入时递增,供 consumer 重渲染 timeline 用
  const [thumbVersion, setThumbVersion] = useState(0);

  const cacheRef = useRef<FrameCache>(new FrameCache());
  const samplesRef = useRef<SampleInfo[]>([]);
  const decodeToPresentationRef = useRef<Int32Array>(new Int32Array(0));
  const presentationToDecodeRef = useRef<Int32Array>(new Int32Array(0));
  const configRef = useRef<VideoDecoderConfig | null>(null);
  // fps 用 ref 跟踪: 避免用户编辑 FPS 输入框触发整个缩略图解码流水线重跑 (OOM 风险)
  const fpsRef = useRef(fps);
  fpsRef.current = fps;

  // 防止重叠的 prefetch
  const prefetchSeqRef = useRef(0);
  // 桌面允许 2 路并发 decode,iOS/Android 强制串行避免硬件压垮
  // 并发主要用途: A 倒退连续播放时,stepBack 到达 batch 底部时,下一 batch 正好解完 → 无边界停顿
  const MAX_CONCURRENT_DECODES = IS_MOBILE ? 1 : 2;
  const activeDecodesRef = useRef(0);
  const decodeQueueRef = useRef<Array<() => Promise<void>>>([]);
  const pumpQueue = useCallback(() => {
    while (activeDecodesRef.current < MAX_CONCURRENT_DECODES && decodeQueueRef.current.length > 0) {
      const job = decodeQueueRef.current.shift()!;
      activeDecodesRef.current++;
      job().finally(() => {
        activeDecodesRef.current--;
        pumpQueue();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // I 帧缩略图池 (专为拖动 scrub 设计,全局持久,不受 LRU 淘汰)
  // 键:Presentation index, 值:下采样的 ImageBitmap 缩略图
  const keyThumbsRef = useRef<Map<number, ImageBitmap>>(new Map());
  const keyThumbIndicesRef = useRef<number[]>([]); // 排序的 I 帧 presentation index,便于二分查找

  // 视频实际时长 (秒), 用于 user-fps ↔ real pIdx 转换
  // 用户输入的 fps 可能与视频真实 fps 不一致 (e.g. 视频 59.94fps 但用户填 5fps 测试),
  // 此时 public API 收到的 frameIndex 是 user-fps 语义, 内部 pIdx 是 real-fps 语义, 必须转换
  const realDurationRef = useRef(0);

  // 诊断计数器 — 挂到 window.__fcDiag 便于控制台查看
  const diagRef = useRef({
    getFrameHit: 0,
    getFrameMiss: 0,
    thumbHit: 0,
    thumbMiss: 0,
    iFrameDecoderDead: false,
    strideDecoderDead: false,
    decodeRangeDeadCount: 0,
    lastDecodeRangeError: null as { msg: string; at: number } | null,
  });

  // ── 初始化：mp4box 解析文件 → 提取 samples → 配置 decoder ──

  useEffect(() => {
    if (!HAS_WEBCODECS || !videoFile || fps <= 0) {
      setIsReady(false);
      return;
    }

    let cancelled = false;
    const cache = cacheRef.current;
    cache.clear();
    samplesRef.current = [];
    configRef.current = null;
    setIsReady(false);

    const mp4File = createFile() as ISOFile;
    let videoTrackId: number | null = null;
    let sampleIndex = 0;

    // mp4box onReady：提取 codec 配置
    mp4File.onReady = (info: Movie) => {
      if (cancelled) return;

      const vTrack = info.videoTracks?.[0] as Track | undefined;
      if (!vTrack) {
        console.warn('[FrameBuffer] No video track found');
        return;
      }

      videoTrackId = vTrack.id;
      const codecStr = vTrack.codec;

      // 提取 description（SPS/PPS extradata）从 trakBox
      const trak = mp4File.getTrackById(videoTrackId);
      let description: Uint8Array | undefined;
      if (trak) {
        // mp4box v2: trak.mdia.minf.stbl.stsd.entries[0].avcC/hvcC/vpcC
        const entries = (trak as any).mdia?.minf?.stbl?.stsd?.entries;
        if (entries && entries.length > 0) {
          const entry = entries[0];
          const box = entry.avcC || entry.hvcC || entry.vpcC;
          if (box) {
            const stream = new DataStream(
              undefined,
              0,
              Endianness.BIG_ENDIAN,
            );
            box.write(stream);
            description = new Uint8Array(stream.buffer, 8); // 跳过 box header
          }
        }
      }

      const config: VideoDecoderConfig = {
        codec: codecStr,
        codedWidth: vTrack.video?.width ?? 1920,
        codedHeight: vTrack.video?.height ?? 1080,
        ...(description ? { description } : {}),
      };

      configRef.current = config;

      // 请求所有 samples
      mp4File.setExtractionOptions(videoTrackId);
      mp4File.start();
    };

    // mp4box onSamples：收集所有帧信息
    mp4File.onSamples = (_trackId: number, _user: unknown, samples: Sample[]) => {
      if (cancelled) return;
      for (const s of samples) {
        if (!s.data) continue;
        samplesRef.current.push({
          index: sampleIndex++,
          isSync: s.is_sync,
          data: new Uint8Array(s.data),
          timestamp: (s.cts * 1_000_000) / s.timescale,
          duration: (s.duration * 1_000_000) / s.timescale,
        });
      }
    };

    // 读取文件 → 送入 mp4box
    const reader = new FileReader();
    reader.onload = () => {
      if (cancelled || !reader.result) return;
      const buf = reader.result as ArrayBuffer;
      const mp4Buf = buf as MP4BoxBuffer;
      mp4Buf.fileStart = 0;
      mp4File.appendBuffer(mp4Buf);
      mp4File.flush();

      // samples 收集完毕后标记 ready
      if (configRef.current && samplesRef.current.length > 0) {
        // mp4box delivers samples in absolute Decode Order.
        // We MUST retain this order for VideoDecoder.decode() to resolve B-frame dependencies properly. 
        // We establish a two-way mapping between presentation (CTS timeline) and decode (physical).
        const len = samplesRef.current.length;
        const decodeToPres = new Int32Array(len);
        const presToDecode = new Int32Array(len);

        const sortedRefs = [...samplesRef.current].map((s, idx) => ({ dtsIdx: idx, cts: s.timestamp }))
                                                  .sort((a,b) => a.cts - b.cts);
        
        for (let i = 0; i < len; i++) {
          const dtsIdx = sortedRefs[i].dtsIdx;
          presToDecode[i] = dtsIdx;      // presentation index -> decode index
          decodeToPres[dtsIdx] = i;      // decode index -> presentation index
        }

        decodeToPresentationRef.current = decodeToPres;
        presentationToDecodeRef.current = presToDecode;

        // 记录视频实际时长 (presentation 最后一帧的 end time)
        let maxEnd = 0;
        for (const s of samplesRef.current) {
          const end = s.timestamp + s.duration;
          if (end > maxEnd) maxEnd = end;
        }
        realDurationRef.current = maxEnd / 1_000_000;

        console.log(`[FrameBuffer] READY — ${len} samples, codec=${configRef.current.codec}, ${configRef.current.codedWidth}x${configRef.current.codedHeight}, realDur=${realDurationRef.current.toFixed(3)}s, realFps=${(len / realDurationRef.current).toFixed(3)}`);
        setIsReady(true);
      } else {
        console.warn('[FrameBuffer] NOT READY — config:', !!configRef.current, 'samples:', samplesRef.current.length);
      }
    };
    reader.readAsArrayBuffer(videoFile);

    return () => {
      cancelled = true;
      mp4File.stop();
      cache.clear();
      // 清空 decode 队列,避免残留任务在下一视频里跑
      decodeQueueRef.current = [];
      prefetchSeqRef.current++; // bump seq 让正在跑的 decoder 立即 break
      // 清理 I 帧缩略图
      for (const bmp of keyThumbsRef.current.values()) bmp.close();
      keyThumbsRef.current.clear();
      keyThumbIndicesRef.current = [];
      setThumbVersion(0);
    };
  }, [videoFile]);

  // ── 缩略图两阶段预解码 ──
  // 阶段 1 (快): 只解码所有 I 帧 — 自包含、解码极快,几百 ms 内全部落盘,
  //              足够 timeline 立即显示 5/7/10 张缩略图
  // 阶段 2 (慢): 完整 decode 全部帧,按步长抽样加到缓存,供拖动 scrub 使用
  useEffect(() => {
    if (!isReady) return;
    const samples = samplesRef.current;
    const config = configRef.current;
    const decodeToPres = decodeToPresentationRef.current;
    if (!config || samples.length === 0) return;

    let cancelled = false;
    const thumbs = keyThumbsRef.current;

    // ── 自适应缩略图分辨率 ──
    // 目标: 总内存 ~300MB 预算, 全部缩略图同分辨率(避免拖动闪烁),
    // 按"短视频缩略图数少→可以更高清"的原则动态计算尺寸.
    const srcW = config.codedWidth ?? 1920;
    const srcH = config.codedHeight ?? 1080;
    const NATIVE_DIM = Math.max(srcW, srcH);
    const MIN_DIM = IS_MOBILE ? 360 : 640;
    // 移动端 (iOS Safari) 内存极紧, 50MB 预算避免页面 reload
    const TARGET_MEM_BYTES = (IS_MOBILE ? 50 : 300) * 1024 * 1024;

    // I 帧统计
    let iFrameCount = 0;
    for (let i = 0; i < samples.length; i++) {
      if (samples[i].isSync) iFrameCount++;
    }

    // Phase 1 I 帧采样上限: 避免 MJPEG / 全 I 帧视频爆内存
    // timeline 只需 5-10 张缩略图, 30 张已绰绰有余, 其余 I 帧被 Phase 2 stride 采样覆盖
    // 移动端只要 10 张 timeline 缩略图, 进一步省内存
    const MAX_PHASE1_THUMBS = IS_MOBILE ? 10 : 30;
    const phase1Count = Math.min(iFrameCount, MAX_PHASE1_THUMBS);
    const iFrameSubsampleStep = iFrameCount > 0 ? Math.max(1, Math.ceil(iFrameCount / phase1Count)) : 1;

    // 读 fpsRef: 用户改 FPS 后不重跑本 effect, 仍按首次加载时的 fps 规划
    const effectiveFps = Math.max(1, fpsRef.current);
    // 步长: 每秒 ~10 张; 若按目标分辨率仍超预算, 自动增大 stride
    let stride = Math.max(1, Math.round(effectiveFps / 10));

    // 短视频 (≤10s) 强制高清; 其余按 MIN_DIM 底线
    // 移动端封顶 540p, 因为 ImageBitmap 太大会被 iOS 强制 reload
    const durationSec = samples.length / effectiveFps;
    const SHORT_VIDEO_DIM = IS_MOBILE ? 960 : 1920;
    const desiredDim = durationSec <= 10
      ? Math.min(NATIVE_DIM, SHORT_VIDEO_DIM)
      : MIN_DIM;

    const minSideRatio = Math.min(srcW, srcH) / NATIVE_DIM;
    const desiredBytesPerThumb = desiredDim * desiredDim * minSideRatio * 4;
    const maxThumbsAtDesired = Math.max(1, Math.floor(TARGET_MEM_BYTES / desiredBytesPerThumb));
    // 预算里算的是 phase1 采样后的 I 帧数, 不是原始 iFrameCount
    const estThumbs = (s: number) => Math.ceil(samples.length / s) + phase1Count;
    if (estThumbs(stride) > maxThumbsAtDesired) {
      const denom = Math.max(1, maxThumbsAtDesired - phase1Count);
      stride = Math.max(stride, Math.ceil(samples.length / denom));
    }

    // 按预期张数均分预算, 反推 maxDim
    const expectedThumbs = estThumbs(stride);
    const bytesPerThumb = TARGET_MEM_BYTES / expectedThumbs;
    const pixelsPerThumb = bytesPerThumb / 4;
    const longSideRatio = NATIVE_DIM / Math.min(srcW, srcH);
    const computedMaxDim = Math.sqrt(pixelsPerThumb * longSideRatio);
    const maxDim = Math.min(NATIVE_DIM, Math.max(desiredDim, Math.round(computedMaxDim)));

    const scale = Math.min(1, maxDim / NATIVE_DIM);
    const thumbW = Math.round(srcW * scale);
    const thumbH = Math.round(srcH * scale);

    console.log(`[FrameBuffer] thumb plan: stride=${stride}, phase1=${phase1Count}/${iFrameCount} I-frames, est=${expectedThumbs} @ ${thumbW}x${thumbH} (~${Math.round(expectedThumbs * bytesPerThumb / 1024 / 1024)}MB)`);

    // timestamp → presentation index 映射 (所有 samples)
    const tsMap = new Map<number, number>();
    for (let i = 0; i < samples.length; i++) {
      tsMap.set(Math.trunc(samples[i].timestamp), decodeToPres[i]);
    }

    // 增量插入 pIdx 到有序索引数组
    const insertIdx = (pIdx: number) => {
      const arr = keyThumbIndicesRef.current;
      let lo = 0, hi = arr.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < pIdx) lo = mid + 1; else hi = mid;
      }
      arr.splice(lo, 0, pIdx);
    };

    // 显式 canvas resize: iOS Safari 对 createImageBitmap(VideoFrame, {resizeWidth}) 支持不可靠,
    // 可能创建全尺寸 bitmap 导致内存爆炸. 用 OffscreenCanvas 强制下采样.
    const resizeCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(thumbW, thumbH)
      : null;
    const resizeCtx = resizeCanvas?.getContext('2d', { alpha: false }) ?? null;

    // 通用 output handler 工厂,按是否跳过已缓存索引来控制阶段 2
    const makeOutputHandler = (filter: (pIdx: number) => boolean) =>
      async (frame: VideoFrame) => {
        if (cancelled) { frame.close(); return; }
        const pIdx = tsMap.get(Math.trunc(frame.timestamp));
        if (pIdx === undefined || !filter(pIdx)) {
          frame.close();
          return;
        }
        try {
          let bmp: ImageBitmap;
          if (resizeCanvas && resizeCtx) {
            // canvas 路径: 保证真实尺寸下采样, 用 transferToImageBitmap 同步快照避免并发竞态
            resizeCtx.drawImage(frame, 0, 0, thumbW, thumbH);
            bmp = resizeCanvas.transferToImageBitmap();
          } else {
            bmp = await createImageBitmap(frame, {
              resizeWidth: thumbW,
              resizeHeight: thumbH,
              resizeQuality: 'medium',
            });
          }
          if (cancelled) { bmp.close(); frame.close(); return; }
          thumbs.set(pIdx, bmp);
          insertIdx(pIdx);
        } catch {
          // ignore
        } finally {
          frame.close();
        }
      };

    (async () => {
      // ─ 阶段 1: I 帧独立解码 (均匀采样, 最多 MAX_PHASE1_THUMBS 张) ─
      const keyIndices: number[] = [];
      let iSeen = 0;
      for (let i = 0; i < samples.length; i++) {
        if (samples[i].isSync) {
          if (iSeen % iFrameSubsampleStep === 0) keyIndices.push(i);
          iSeen++;
        }
      }

      const iFrameDecoder = new VideoDecoder({
        output: makeOutputHandler(() => true), // 所有 I 帧都保留
        error: (e) => {
          diagRef.current.iFrameDecoderDead = true;
          console.warn('[FCLog] ⚠️ iFrame decoder DEAD — phase1 thumbs lost', {
            msg: (e as DOMException).message,
            name: (e as DOMException).name,
            state: iFrameDecoder.state,
            thumbsSoFar: thumbs.size,
            keyIndicesPlanned: keyIndices.length,
          });
        },
      });

      try {
        iFrameDecoder.configure(config);
        for (const di of keyIndices) {
          if (cancelled) break;
          if (iFrameDecoder.state !== 'configured') break;
          // 背压：防止硬件解码器队列溢出（4K HEVC + iOS 尤其敏感）
          while (iFrameDecoder.decodeQueueSize > (IS_MOBILE ? 2 : 8) && !cancelled && iFrameDecoder.state === 'configured') {
            await new Promise(r => setTimeout(r, IS_MOBILE ? 16 : 4));
          }
          if (iFrameDecoder.state !== 'configured') break;
          const s = samples[di];
          iFrameDecoder.decode(new EncodedVideoChunk({
            type: 'key',
            timestamp: s.timestamp,
            duration: s.duration,
            data: s.data,
          }));
        }
        if (iFrameDecoder.state === 'configured') await iFrameDecoder.flush();
      } catch (e) {
        console.warn('[FrameBuffer] iFrame decode failed:', e);
      } finally {
        if (iFrameDecoder.state !== 'closed') iFrameDecoder.close();
      }

      if (cancelled) return;
      console.log(`[FrameBuffer] Phase 1 done — ${thumbs.size} I-frame thumbs @ ${thumbW}x${thumbH}`);
      setThumbVersion(v => v + 1); // timeline 立即渲染

      // ─ 阶段 2: 完整 decode, 按 (上方算好的) stride 采样填补 scrub 缓存 ─
      const strideDecoder = new VideoDecoder({
        // 跳过已缓存的索引和非步长位置
        output: makeOutputHandler((pIdx) => pIdx % stride === 0 && !thumbs.has(pIdx)),
        error: (e) => {
          diagRef.current.strideDecoderDead = true;
          console.warn('[FCLog] ⚠️ Stride decoder DEAD — phase2 scrub thumbs lost', {
            msg: (e as DOMException).message,
            name: (e as DOMException).name,
            state: strideDecoder.state,
            thumbsSoFar: thumbs.size,
          });
        },
      });

      try {
        strideDecoder.configure(config);
        for (let i = 0; i < samples.length; i++) {
          if (cancelled) break;
          // decoder error 会把 state 切到 'closed', 继续 decode 必抛 InvalidStateError
          // 级联噪音 → 直接退出循环
          if (strideDecoder.state !== 'configured') break;
          // 背压：防止硬件解码器队列溢出 (iOS 收紧)
          while (strideDecoder.decodeQueueSize > (IS_MOBILE ? 4 : 16) && !cancelled && strideDecoder.state === 'configured') {
            await new Promise(r => setTimeout(r, IS_MOBILE ? 16 : 4));
          }
          if (strideDecoder.state !== 'configured') break;
          const s = samples[i];
          strideDecoder.decode(new EncodedVideoChunk({
            type: s.isSync ? 'key' : 'delta',
            timestamp: s.timestamp,
            duration: s.duration,
            data: s.data,
          }));
        }
        if (strideDecoder.state === 'configured') await strideDecoder.flush();
      } catch (e) {
        console.warn('[FrameBuffer] Stride decode failed:', e);
      } finally {
        if (strideDecoder.state !== 'closed') strideDecoder.close();
      }

      if (!cancelled) {
        console.log(`[FrameBuffer] Phase 2 done — ${thumbs.size} total thumbs, stride=${stride}`);
        // 阶段 2 结束不再 bump thumbVersion: 避免 timeline 重新抽样抖动
        // scrub 靠 getKeyFrameThumb 直读 ref, 无需 React 重渲染
      }
    })();

    return () => { cancelled = true; };
  }, [isReady]);

  // ── 解码一段帧范围 [from, to] ──

  const decodeRange = useCallback(async (from: number, to: number, seq: number) => {
    const config = configRef.current;
    const samples = samplesRef.current;
    if (!config || samples.length === 0) return;

    // 边界裁剪 (针对用户感知的 Presentation Index)
    const pStart = Math.max(0, from);
    const pEnd = Math.min(samples.length - 1, to);
    if (pStart > pEnd) return;

    const presToDecode = presentationToDecodeRef.current;
    const decodeToPres = decodeToPresentationRef.current;

    // 寻找这批显示帧所跨越的最宽泛的底层 Decode 指针范围
    let minD = Infinity;
    let maxD = -Infinity;
    for (let p = pStart; p <= pEnd; p++) {
      const d = presToDecode[p];
      if (d < minD) minD = d;
      if (d > maxD) maxD = d;
    }

    // 为了解压 minD 这个数据包，需要往前寻找离它最近的一阶 I-frame 参照物
    let iFrameIdx = minD;
    while (iFrameIdx > 0 && !samples[iFrameIdx].isSync) {
      iFrameIdx--;
    }

    const cache = cacheRef.current;

    // 构建时钟映射：用于在输出回调里，把底层的 Timestamp 精准反推回用户的 Presentation Index
    const tsToPresIdx = new Map<number, number>();
    for (let d = iFrameIdx; d <= maxD; d++) {
      tsToPresIdx.set(Math.trunc(samples[d].timestamp), decodeToPres[d]);
    }

    // 移动端: LRU 缓存的精确帧也降到 720p 长边, 避免单帧 8MB × 60 = 480MB
    const cfgW = config.codedWidth ?? 1920;
    const cfgH = config.codedHeight ?? 1080;
    const cacheMaxDim = IS_MOBILE ? 720 : Math.max(cfgW, cfgH);
    const cacheScale = Math.min(1, cacheMaxDim / Math.max(cfgW, cfgH));
    const cacheW = Math.round(cfgW * cacheScale);
    const cacheH = Math.round(cfgH * cacheScale);
    const cacheCanvas = IS_MOBILE && typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(cacheW, cacheH)
      : null;
    const cacheCtx = cacheCanvas?.getContext('2d', { alpha: false }) ?? null;

    // 流式入缓存: 帧一解出来就进 cache, 不等整批 flush
    // 这对 A 倒退播放至关重要 — stepBack 消费速度 >= decode 速度时,
    // 若等 flush 才填 cache, stepBack 就会在 WAIT 分支卡住直到整批完成
    const decoder = new VideoDecoder({
      output: async (frame: VideoFrame) => {
        if (seq !== prefetchSeqRef.current) {
          frame.close();
          return;
        }
        try {
          const matchPIdx = tsToPresIdx.get(Math.trunc(frame.timestamp));
          // 超出请求范围的帧(decoder 为了还原 P/B 依赖链必须多解一些) 直接丢弃
          if (matchPIdx === undefined || matchPIdx < pStart || matchPIdx > pEnd || cache.has(matchPIdx)) {
            return;
          }
          let bitmap: ImageBitmap;
          if (cacheCanvas && cacheCtx) {
            cacheCtx.drawImage(frame, 0, 0, cacheW, cacheH);
            bitmap = cacheCanvas.transferToImageBitmap();
          } else {
            bitmap = await createImageBitmap(frame);
          }
          // 入缓存前再 check 一次 seq —— createImageBitmap 是 await, 期间可能已被 supersede
          if (seq !== prefetchSeqRef.current || cache.has(matchPIdx)) {
            bitmap.close();
            return;
          }
          cache.set(matchPIdx, bitmap);
        } catch {
          // createImageBitmap 失败（极罕见）
        } finally {
          frame.close();
        }
      },
      error: (e: DOMException) => {
        diagRef.current.decodeRangeDeadCount++;
        diagRef.current.lastDecodeRangeError = { msg: e.message, at: Date.now() };
        console.warn('[FCLog] ⚠️ decodeRange decoder DEAD — exact frames gone', {
          msg: e.message,
          name: e.name,
          state: decoder.state,
          seq,
          pStart,
          pEnd,
          cacheSize: cache.size,
          queueWas: decoder.decodeQueueSize,
          deadCount: diagRef.current.decodeRangeDeadCount,
        });
      },
    });

    try {
      decoder.configure(config);

      // 从 I 帧顺序送入到 maxD (严格的底层物理顺序，保证所有 P/B 时域依赖完整)
      for (let i = iFrameIdx; i <= maxD; i++) {
        if (seq !== prefetchSeqRef.current) break;
        // decoder error 会把 state 切到 'closed', 跳出避免 "closed codec" 级联噪音
        if (decoder.state !== 'configured') break;
        // 背压：4K HEVC / iOS 解码器队列溢出会导致 EncodingError 或页面崩溃
        while (decoder.decodeQueueSize > (IS_MOBILE ? 4 : 16) && seq === prefetchSeqRef.current && decoder.state === 'configured') {
          await new Promise(r => setTimeout(r, IS_MOBILE ? 16 : 4));
        }
        if (decoder.state !== 'configured') break;
        const s = samples[i];

        const chunk = new EncodedVideoChunk({
          type: s.isSync ? 'key' : 'delta',
          timestamp: s.timestamp,
          duration: s.duration,
          data: s.data,
        });
        decoder.decode(chunk);
      }

      if (decoder.state === 'configured') await decoder.flush();
      // 流式入 cache, 无需在此做批量转移
    } catch (e) {
      const err = e as DOMException;
      diagRef.current.decodeRangeDeadCount++;
      diagRef.current.lastDecodeRangeError = { msg: err.message ?? String(e), at: Date.now() };
      console.warn('[FCLog] ⚠️ decodeRange sync throw — likely configure() failure', {
        msg: err.message, name: err.name, seq, pStart, pEnd,
      });
    } finally {
      if (decoder.state !== 'closed') {
        decoder.close();
      }
    }
  }, []);

  // ── user-fps ↔ real pIdx 转换 ──
  // user 输入的 frameIndex 语义: frame N 对应时间 N / userFps 秒
  // 内部 samples / cache / keyThumbs 用的 pIdx 语义: frame N 对应时间 samples[p2d[N]].timestamp 秒
  // 当用户填的 fps 与视频真实 fps 不一致时, 必须在 public API 边界做转换
  const userToPIdx = useCallback((userFrame: number): number => {
    const samples = samplesRef.current;
    if (samples.length === 0) return 0;
    const dur = realDurationRef.current;
    if (dur <= 0) return Math.max(0, Math.min(samples.length - 1, userFrame));
    const userFps = Math.max(1e-6, fpsRef.current);
    const realFps = samples.length / dur;
    const pIdx = Math.round(userFrame * realFps / userFps);
    return Math.max(0, Math.min(samples.length - 1, pIdx));
  }, []);

  const pIdxToUser = useCallback((pIdx: number): number => {
    const samples = samplesRef.current;
    if (samples.length === 0) return 0;
    const dur = realDurationRef.current;
    if (dur <= 0) return pIdx;
    const userFps = Math.max(1e-6, fpsRef.current);
    const realFps = samples.length / dur;
    return Math.round(pIdx * userFps / realFps);
  }, []);

  // ── prefetch ──

  const prefetch = useCallback((center: number, range: number, direction?: 'backward' | 'forward') => {
    if (!isReady) return;

    // user-fps frame → real pIdx
    const pCenter = userToPIdx(center);
    // range 也要按 realFps/userFps 比例缩放 (保证预取同样的"时间窗口"),
    // 但封顶防止 userFps << realFps 时一次预取整个视频 (OOM)
    const samples = samplesRef.current;
    const dur = realDurationRef.current;
    const userFps = Math.max(1e-6, fpsRef.current);
    const realFps = dur > 0 ? samples.length / dur : userFps;
    const scaledRange = Math.ceil(range * realFps / userFps);
    const pRange = Math.min(300, Math.max(1, scaledRange));

    // 方向偏移：backward 全部向左，forward 全部向右
    let from: number, to: number;
    if (direction === 'backward') {
      from = pCenter - pRange;
      to = pCenter;
    } else if (direction === 'forward') {
      from = pCenter;
      to = pCenter + pRange;
    } else {
      from = pCenter - pRange;
      to = pCenter + pRange;
    }

    // 检查是否已经全部缓存
    const cache = cacheRef.current;
    const actualFrom = Math.max(0, from);
    const actualTo = Math.min(samples.length - 1, to);

    let allCached = true;
    for (let i = actualFrom; i <= actualTo; i++) {
      if (!cache.has(i)) { allCached = false; break; }
    }
    if (allCached) return;

    // 注意: 只有"会互相 supersede 的请求"才 bump seq (drag 场景). 播放期的 prefetch
    // 是并排排队、互不替代的, 不能 bump 否则队列里前面的批次全被当过期跳过.
    // 这里用 cache 命中率已经过滤了重复请求,直接沿用当前 seq 即可.
    const seq = prefetchSeqRef.current;

    decodeQueueRef.current.push(() => decodeRange(from, to, seq));
    pumpQueue();
  }, [isReady, decodeRange, userToPIdx, pumpQueue]);

  // ── getFrame ──
  // 入参 frameIndex 为 user-fps 语义, 内部转换为 real pIdx 查缓存
  const getFrame = useCallback((frameIndex: number): ImageBitmap | null => {
    if (!isReady) return null;
    const bmp = cacheRef.current.get(userToPIdx(frameIndex));
    if (bmp) diagRef.current.getFrameHit++; else diagRef.current.getFrameMiss++;
    return bmp;
  }, [isReady, userToPIdx]);

  // 二分查找 <= frameIndex 的最大 I 帧索引,返回对应的缩略图
  // 入参 frameIndex 为 user-fps 语义, 内部转换后再二分查找 (indices 是 real pIdx)
  const getKeyFrameThumb = useCallback((frameIndex: number): ImageBitmap | null => {
    const indices = keyThumbIndicesRef.current;
    if (indices.length === 0) { diagRef.current.thumbMiss++; return null; }
    const pIdx = userToPIdx(frameIndex);
    let lo = 0, hi = indices.length - 1, best = indices[0];
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (indices[mid] <= pIdx) { best = indices[mid]; lo = mid + 1; }
      else hi = mid - 1;
    }
    const bmp = keyThumbsRef.current.get(best) ?? null;
    if (bmp) diagRef.current.thumbHit++; else diagRef.current.thumbMiss++;
    return bmp;
  }, [userToPIdx]);

  // 把诊断快照挂到 window.__fcDiag(),控制台任意时刻调用可查看
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as { __fcDiag?: () => unknown }).__fcDiag = () => ({
      isReady,
      samples: samplesRef.current.length,
      realDuration: realDurationRef.current,
      userFps: fpsRef.current,
      realFps: realDurationRef.current > 0 ? samplesRef.current.length / realDurationRef.current : null,
      keyThumbCount: keyThumbIndicesRef.current.length,
      cacheSize: cacheRef.current.size,
      prefetchSeq: prefetchSeqRef.current,
      ...diagRef.current,
    });
    return () => { delete (window as unknown as { __fcDiag?: () => unknown }).__fcDiag; };
  }, [isReady]);

  // ── 基于 sample timestamp 的起表帧定位 ──
  // WCA 公式 frames = ⌈(⌊time⌋₂+.009)×fps⌉ 依赖单一 fps 值, 容器读数漂移时 ±1 帧。
  // 这里直接用 mp4box 解析出的每个 sample 的 timestamp 做 ground truth:
  // 从 end-frame 的 timestamp 往前减 secondsBack 秒, 二分查找最近的 sample。
  const findStartFrameByTimestamp = useCallback(
    (endUserFrame: number, secondsBack: number): number | null => {
      const samples = samplesRef.current;
      if (samples.length === 0 || secondsBack <= 0) return null;
      const endPIdx = userToPIdx(endUserFrame);
      if (endPIdx < 0 || endPIdx >= samples.length) return null;
      const endTs = samples[endPIdx].timestamp; // μs
      const targetTs = endTs - secondsBack * 1_000_000;
      if (targetTs <= samples[0].timestamp) return pIdxToUser(0);
      // 二分: 找第一个 timestamp >= targetTs 的 sample
      let lo = 0, hi = samples.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid].timestamp < targetTs) lo = mid + 1;
        else hi = mid;
      }
      // 比较 lo 和 lo-1, 选时间戳更接近 targetTs 的那个
      const cand = lo > 0 &&
        Math.abs(samples[lo - 1].timestamp - targetTs) < Math.abs(samples[lo].timestamp - targetTs)
        ? lo - 1 : lo;
      return pIdxToUser(cand);
    },
    [userToPIdx, pIdxToUser],
  );

  // ── dispose ──

  const dispose = useCallback(() => {
    prefetchSeqRef.current++;
    cacheRef.current.clear();
    setIsReady(false);
  }, []);

  // 按 pIdx 升序排列的 thumbs 数组,thumbVersion 变化时重新计算
  // frameIdx 对外暴露 user-fps 语义 (供 FrameCountPage 与 totalFrames 坐标对齐)
  const keyFrameThumbs = useMemo(() => {
    const indices = keyThumbIndicesRef.current;
    const thumbs = keyThumbsRef.current;
    const out: Array<{ frameIdx: number; bitmap: ImageBitmap }> = [];
    for (const idx of indices) {
      const bmp = thumbs.get(idx);
      if (bmp) out.push({ frameIdx: pIdxToUser(idx), bitmap: bmp });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbVersion, fps, pIdxToUser]);

  return {
    getFrame, prefetch, getKeyFrameThumb, keyFrameThumbs, isReady, dispose,
    samples: samplesRef.current,
    decoderConfig: configRef.current,
    findStartFrameByTimestamp,
  };
}
