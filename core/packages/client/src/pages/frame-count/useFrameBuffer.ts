/**
 * @module useFrameBuffer
 * WebCodecs 帧缓冲 — mp4box.js 解复用 + VideoDecoder + LRU ImageBitmap 缓存。
 * 长按 A 后退时，直接从缓存取帧渲染到 Canvas，无需 seek。
 *
 * 浏览器兼容：WebCodecs 仅 Chrome 94+/Edge 94+，其余浏览器 isReady=false，
 * 调用方 fallback 到 seeked 链。
 */

import { useEffect, useRef, useCallback, useState } from 'react';
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

/** 缓冲区最大帧数。stepBack 每轮 prefetch 60 帧,需要至少容纳"旧的未消费帧 + 新的整段",
 *  否则 LRU 会把未消费帧淘汰(get 把已消费帧标记为最近,反而保留,不消费的反而被淘汰)。
 *  150 帧:容纳 2 轮 prefetch + 30 帧余量。1080p ImageBitmap 通常用 GPU texture,实际占用远小于 RGBA 估算。 */
const MAX_CACHE = 150;

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
  /** WebCodecs 是否可用且初始化完成 */
  isReady: boolean;
  /** 释放所有资源 */
  dispose(): void;
  /** 所有帧的编码数据（供导出使用） */
  samples: SampleInfo[];
  /** VideoDecoder 配置（供导出使用） */
  decoderConfig: VideoDecoderConfig | null;
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

  const cacheRef = useRef<FrameCache>(new FrameCache());
  const samplesRef = useRef<SampleInfo[]>([]);
  const decodeToPresentationRef = useRef<Int32Array>(new Int32Array(0));
  const presentationToDecodeRef = useRef<Int32Array>(new Int32Array(0));
  const configRef = useRef<VideoDecoderConfig | null>(null);

  // 防止重叠的 prefetch
  const prefetchSeqRef = useRef(0);
  // 链式串行执行 decode：新请求 supersede 旧请求(通过 seq),等旧 decoder close 后再启动新的
  const prefetchChainRef = useRef<Promise<void>>(Promise.resolve());

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

        console.log(`[FrameBuffer] READY — ${len} samples, codec=${configRef.current.codec}, ${configRef.current.codedWidth}x${configRef.current.codedHeight}`);
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
    };
  }, [videoFile, fps]);

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

    // 创建临时 decoder，收集解码结果
    const pendingFrames: { index: number; bitmap: ImageBitmap }[] = [];

    const decoder = new VideoDecoder({
      output: async (frame: VideoFrame) => {
        // seq 检查，避免过期解码浪费
        if (seq !== prefetchSeqRef.current) {
          frame.close();
          return;
        }
        try {
          const bitmap = await createImageBitmap(frame);
          // Use timestamp to map back exactly to Presentation Index
          const matchPIdx = tsToPresIdx.get(Math.trunc(frame.timestamp));
          if (matchPIdx !== undefined) {
            pendingFrames.push({ index: matchPIdx, bitmap });
          } else {
            bitmap.close();
          }
        } catch {
          // createImageBitmap 失败（极罕见）
        } finally {
          frame.close();
        }
      },
      error: (e: DOMException) => {
        console.warn('[FrameBuffer] Decoder error:', e);
      },
    });

    try {
      decoder.configure(config);

      // 从 I 帧顺序送入到 maxD (严格的底层物理顺序，保证所有 P/B 时域依赖完整)
      for (let i = iFrameIdx; i <= maxD; i++) {
        if (seq !== prefetchSeqRef.current) break;
        const s = samples[i];

        const chunk = new EncodedVideoChunk({
          type: s.isSync ? 'key' : 'delta',
          timestamp: s.timestamp,
          duration: s.duration,
          data: s.data,
        });
        decoder.decode(chunk);
      }

      await decoder.flush();

      // 只缓存用户请求的 Presentation 范围 [pStart, pEnd]
      if (seq === prefetchSeqRef.current) {
        for (const pf of pendingFrames) {
          if (pf.index >= pStart && pf.index <= pEnd && !cache.has(pf.index)) {
            cache.set(pf.index, pf.bitmap);
          } else {
            pf.bitmap.close();
          }
        }
      } else {
        // 已过期，全部释放
        for (const pf of pendingFrames) pf.bitmap.close();
      }
    } catch (e) {
      console.warn('[FrameBuffer] Decode range failed:', e);
      for (const pf of pendingFrames) pf.bitmap.close();
    } finally {
      if (decoder.state !== 'closed') {
        decoder.close();
      }
    }
  }, []);

  // ── prefetch ──

  const prefetch = useCallback((center: number, range: number, direction?: 'backward' | 'forward') => {
    if (!isReady) return;

    // 方向偏移：backward 全部向左，forward 全部向右
    let from: number, to: number;
    if (direction === 'backward') {
      from = center - range;
      to = center;
    } else if (direction === 'forward') {
      from = center;
      to = center + range;
    } else {
      from = center - range;
      to = center + range;
    }

    // 检查是否已经全部缓存
    const cache = cacheRef.current;
    const samples = samplesRef.current;
    const actualFrom = Math.max(0, from);
    const actualTo = Math.min(samples.length - 1, to);

    let allCached = true;
    for (let i = actualFrom; i <= actualTo; i++) {
      if (!cache.has(i)) { allCached = false; break; }
    }
    if (allCached) return;

    // 总是 bump seq —— 旧的 decodeRange 在循环里检查 seq 会立即 break,加快旧 decoder 释放
    const seq = ++prefetchSeqRef.current;

    // 串行链:等上一个 decode close 后再启动,避免多个 VideoDecoder 资源争抢
    prefetchChainRef.current = prefetchChainRef.current.then(() => {
      // 排队期间又来了更新的请求 → 跳过这次
      if (seq !== prefetchSeqRef.current) return;
      return decodeRange(from, to, seq);
    }).catch(() => {});
  }, [isReady, decodeRange]);

  // ── getFrame ──

  const getFrame = useCallback((frameIndex: number): ImageBitmap | null => {
    if (!isReady) return null;
    return cacheRef.current.get(frameIndex);
  }, [isReady]);

  // ── dispose ──

  const dispose = useCallback(() => {
    prefetchSeqRef.current++;
    cacheRef.current.clear();
    setIsReady(false);
  }, []);

  return {
    getFrame, prefetch, isReady, dispose,
    samples: samplesRef.current,
    decoderConfig: configRef.current,
  };
}
