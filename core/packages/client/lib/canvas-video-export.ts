/** Shared fixed-frame H.264 / MP4 encoder for canvas-based video exports. */
export interface ExportProgress {
  phase: string;
  pct: number;
  framesDone: number;
  framesTotal: number;
}

interface CanvasVideoOptions {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  abortRef: { aborted: boolean };
  /** Frames between keyframes; defaults to two seconds. */
  keyFrameInterval?: number;
}

export interface CanvasVideoEncoder {
  /** Supply consecutive frame indices, starting at zero. */
  encode(source: CanvasImageSource, frameIndex: number): Promise<void>;
  finish(): Promise<Blob>;
  close(): void;
}

export function isCanvasVideoExportSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

export async function createCanvasVideoEncoder(options: CanvasVideoOptions): Promise<CanvasVideoEncoder> {
  const { width, height, fps, bitrate, abortRef } = options;
  const keyFrameInterval = options.keyFrameInterval ?? Math.max(1, Math.round(fps * 2));
  if (![width, height].every(value => Number.isInteger(value) && value >= 2 && value % 2 === 0)) {
    throw new Error('Video dimensions must be positive even integers');
  }
  if (!Number.isFinite(fps) || fps <= 0 || fps > 240
    || !Number.isSafeInteger(bitrate) || bitrate <= 0
    || !Number.isSafeInteger(keyFrameInterval) || keyFrameInterval <= 0) {
    throw new Error('Invalid video frame rate, bitrate or keyframe interval');
  }
  if (abortRef.aborted) throw new Error('aborted');
  if (!isCanvasVideoExportSupported()) throw new Error('WebCodecs unsupported');

  const config: VideoEncoderConfig = {
    codec: 'avc1.640033', width, height, bitrate, framerate: fps,
  };
  const support = await VideoEncoder.isConfigSupported(config);
  if (abortRef.aborted) throw new Error('aborted');
  if (!support.supported) throw new Error('H.264 video encoding unsupported');
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  if (abortRef.aborted) throw new Error('aborted');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height, frameRate: fps },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let encoderError: Error | null = null;
  let closed = false;
  let nextFrame = 0;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      try { muxer.addVideoChunk(chunk, metadata); }
      catch (error) { encoderError = error instanceof Error ? error : new Error(String(error)); }
    },
    error: error => { encoderError = error; },
  });
  const close = () => {
    if (closed) return;
    closed = true;
    try { encoder.close(); } catch { /* WebCodecs may already have closed after an error. */ }
  };
  const check = () => {
    if (abortRef.aborted) throw new Error('aborted');
    if (encoderError) throw encoderError;
    if (closed) throw new Error('Video encoder closed');
  };
  try { encoder.configure(config); }
  catch (error) { close(); throw error; }

  return {
    close,
    async encode(source, frameIndex) {
      try {
        check();
        if (!Number.isSafeInteger(frameIndex) || frameIndex !== nextFrame) {
          throw new Error('Video frame indices must be consecutive, starting at zero');
        }
        const timestamp = Math.round(frameIndex * 1e6 / fps);
        const duration = Math.round((frameIndex + 1) * 1e6 / fps) - timestamp;
        const frame = new VideoFrame(source, { timestamp, duration });
        try { encoder.encode(frame, { keyFrame: frameIndex % keyFrameInterval === 0 }); }
        finally { frame.close(); }
        nextFrame++;
        while (encoder.encodeQueueSize > 4) {
          check();
          await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
        check();
      } catch (error) { close(); throw error; }
    },
    async finish() {
      try {
        check();
        if (!nextFrame) throw new Error('Cannot export an empty video');
        await encoder.flush();
        check();
        muxer.finalize();
        return new Blob([target.buffer], { type: 'video/mp4' });
      } finally { close(); }
    },
  };
}
