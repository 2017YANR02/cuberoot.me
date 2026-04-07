/**
 * useReversedVideo — 懒生成倒放视频
 *
 * 接收原始视频 File，后台用 ffmpeg.wasm 生成倒放副本。
 * 生成完成前返回 null，完成后返回倒放视频的 blob URL。
 * 不阻塞首次加载。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface ReversedVideoState {
  /** 倒放视频的 blob URL，处理完成前为 null */
  reversedSrc: string | null;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 处理进度 0-100 */
  progress: number;
  /** 错误信息 */
  error: string | null;
}

const CORE_VERSION = '0.12.6';
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

export function useReversedVideo(file: File | null): ReversedVideoState {
  const [state, setState] = useState<ReversedVideoState>({
    reversedSrc: null,
    isProcessing: false,
    progress: 0,
    error: null,
  });

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const abortRef = useRef(false);
  const prevFileRef = useRef<File | null>(null);
  const prevBlobUrl = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (prevBlobUrl.current) {
      URL.revokeObjectURL(prevBlobUrl.current);
      prevBlobUrl.current = null;
    }
  }, []);

  useEffect(() => {
    if (!file || file === prevFileRef.current) return;
    prevFileRef.current = file;
    abortRef.current = false;

    // 清理上一次的 blob URL
    cleanup();
    setState({ reversedSrc: null, isProcessing: true, progress: 0, error: null });

    const process = async () => {
      try {
        // 懒初始化 FFmpeg 实例
        if (!ffmpegRef.current) {
          const ffmpeg = new FFmpeg();

          // 进度回调
          ffmpeg.on('progress', ({ progress }) => {
            if (!abortRef.current) {
              setState(s => ({ ...s, progress: Math.round(progress * 100) }));
            }
          });

          // 加载 WASM 核心（首次约 25MB，之后浏览器缓存）
          await ffmpeg.load({
            coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
          });

          if (abortRef.current) return;
          ffmpegRef.current = ffmpeg;
        }

        const ffmpeg = ffmpegRef.current;

        // 写入输入文件
        const inputData = await fetchFile(file);
        if (abortRef.current) return;
        await ffmpeg.writeFile('input.mp4', inputData);

        // 生成倒放视频（仅反转视频轨道，不反转音频）
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-vf', 'reverse',
          '-an',              // 去掉音频（倒放不需要）
          '-c:v', 'libx264',  // 重新编码
          '-preset', 'ultrafast', // 最快速度
          '-crf', '18',       // 高质量
          'reversed.mp4',
        ]);

        if (abortRef.current) return;

        // 读取输出
        const data = await ffmpeg.readFile('reversed.mp4');
        if (abortRef.current) return;

        const blob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        prevBlobUrl.current = url;

        // 清理 ffmpeg 虚拟文件系统
        await ffmpeg.deleteFile('input.mp4').catch(() => {});
        await ffmpeg.deleteFile('reversed.mp4').catch(() => {});

        setState({
          reversedSrc: url,
          isProcessing: false,
          progress: 100,
          error: null,
        });
      } catch (err) {
        if (!abortRef.current) {
          console.error('[useReversedVideo] FFmpeg error:', err);
          setState({
            reversedSrc: null,
            isProcessing: false,
            progress: 0,
            error: err instanceof Error ? err.message : 'FFmpeg processing failed',
          });
        }
      }
    };

    process();

    return () => {
      abortRef.current = true;
    };
  }, [file, cleanup]);

  // 组件卸载时清理
  useEffect(() => cleanup, [cleanup]);

  return state;
}
