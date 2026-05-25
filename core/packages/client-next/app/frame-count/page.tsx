'use client';

// POC 验证目的:
//   1. mp4box.js 在 Next 16 Turbopack 下能 import + 跑
//   2. WebCodecs VideoDecoder 在 'use client' 组件里能解码全部帧
//   3. Canvas 渲染 / drawImage 正常
// 不验证:i18n / split mark / FFmpeg 导出 / useDocumentTitle — 这些在 main repo 已成熟,SSR-only 包装即可。

import { useState, useRef, useCallback } from 'react';
import {
  createFile,
  DataStream,
  Endianness,
  type Movie,
  type Sample,
  type MP4BoxBuffer,
} from 'mp4box';

interface DecodeResult {
  width: number;
  height: number;
  codec: string;
  duration: number;
  totalSamples: number;
  decodedFrames: number;
  elapsedMs: number;
}

// mp4box 的 codec description (SPS/PPS extradata) 提取 — 用 mp4box 自带 DataStream,
// 不要手写 fake stream(box.write 调用的 method 太多,漏一个就静默失败,H.265 第一帧 decode 必报
// "key frame required" 因为 description=undefined)。
function extractDescription(entry: unknown): Uint8Array | undefined {
  const e = entry as Record<string, { write: (s: DataStream) => void } | undefined>;
  const box = e.avcC ?? e.hvcC ?? e.vpcC;
  if (!box) return undefined;
  const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
  box.write(stream);
  // mp4box write 含 8-byte box header,WebCodecs description 要纯 box 内容
  return new Uint8Array(stream.buffer, 8);
}

export default function FrameCountPocPage() {
  const [status, setStatus] = useState<string>('Pick an mp4 to begin');
  const [result, setResult] = useState<DecodeResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setResult(null);
    setStatus(`Reading ${file.name} (${(file.size / 1048576).toFixed(1)} MB)…`);
    const t0 = performance.now();

    const mp4 = createFile();
    const samples: Sample[] = [];
    let info: Movie | null = null;
    let videoTrackId = -1;
    let decoderConfig: VideoDecoderConfig | null = null;

    await new Promise<void>((resolve, reject) => {
      mp4.onError = (e: string) => reject(new Error(String(e)));
      mp4.onReady = (i: Movie) => {
        info = i;
        const track = i.videoTracks[0];
        if (!track || !track.video) {
          reject(new Error('No video track'));
          return;
        }
        videoTrackId = track.id;
        const trak = (mp4 as unknown as {
          getTrackById(id: number): { mdia: { minf: { stbl: { stsd: { entries: unknown[] } } } } };
        }).getTrackById(track.id);
        const description = extractDescription(trak.mdia.minf.stbl.stsd.entries[0]);
        decoderConfig = {
          codec: track.codec,
          codedWidth: track.video.width,
          codedHeight: track.video.height,
          description,
        };
        mp4.setExtractionOptions(track.id, null, { nbSamples: 1000 });
        mp4.start();
      };
      mp4.onSamples = (id: number, _ref: unknown, ss: Sample[]) => {
        if (id === videoTrackId) samples.push(...ss);
      };
      file.arrayBuffer().then((buf) => {
        const b = buf as MP4BoxBuffer;
        b.fileStart = 0;
        mp4.appendBuffer(b);
        mp4.flush();
        resolve();
      }, reject);
    });

    const finalInfo = info as Movie | null;
    if (!finalInfo || !decoderConfig) {
      throw new Error('parse failed');
    }

    setStatus(`Demuxed ${samples.length} samples, decoding…`);

    let decodedFrames = 0;
    const lastFrameRef = { current: null as VideoFrame | null };
    const decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        decodedFrames++;
        if (lastFrameRef.current) lastFrameRef.current.close();
        lastFrameRef.current = frame;
      },
      error: (e: DOMException) => {
        setStatus(`Decoder error: ${e.message}`);
      },
    });
    try {
      decoder.configure(decoderConfig);
    } catch (e) {
      setStatus(`configure() threw: ${(e as Error).message}`);
      return;
    }

    for (const sample of samples) {
      if (!sample.data) continue;
      const chunk = new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: (sample.cts * 1_000_000) / sample.timescale,
        duration: (sample.duration * 1_000_000) / sample.timescale,
        data: sample.data,
      });
      decoder.decode(chunk);
    }
    await decoder.flush();

    const lf = lastFrameRef.current;
    if (lf && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = lf.displayWidth;
        canvasRef.current.height = lf.displayHeight;
        ctx.drawImage(lf, 0, 0);
      }
      lf.close();
    }

    const track = finalInfo.videoTracks[0];
    setResult({
      width: track.video?.width ?? 0,
      height: track.video?.height ?? 0,
      codec: track.codec,
      duration: finalInfo.duration / finalInfo.timescale,
      totalSamples: samples.length,
      decodedFrames,
      elapsedMs: Math.round(performance.now() - t0),
    });
    setStatus(`Done.`);
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1>frame-count POC (Next.js 16)</h1>
      <p style={{ color: '#666' }}>
        Verifies mp4box.js + WebCodecs VideoDecoder + Canvas inside a Next.js App Router client component.
      </p>

      <input
        type="file"
        accept="video/mp4,video/quicktime"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f).catch((err: Error) => setStatus(`Caught: ${err.message}`));
        }}
        style={{ marginTop: 16 }}
      />

      <div style={{ marginTop: 16, padding: 12, background: '#f4f4f5', borderRadius: 6, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
        <strong>Status:</strong> {status}
      </div>

      {result && (
        <table style={{ marginTop: 16, borderCollapse: 'collapse', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
          <tbody>
            {(Object.entries(result) as [keyof DecodeResult, number | string][]).map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: '4px 12px 4px 0', color: '#666' }}>{k}</td>
                <td style={{ padding: 4 }}>{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <canvas
        ref={canvasRef}
        style={{ marginTop: 16, maxWidth: '100%', display: result ? 'block' : 'none', border: '1px solid #ddd' }}
      />
    </main>
  );
}
