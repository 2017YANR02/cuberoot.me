import type {CameraCaptureMetrics} from './camera-metrics';
/** Source-time sampling is independent of inference speed. */
export class FrameSelector {
  private origin: number | undefined;
  private lastBucket = -1;
  constructor(
    readonly sourceFps: number,
    readonly targetFps = 30,
    readonly minimumTimestamp = -Infinity,
  ) {}

  accept(timestamp: number): boolean {
    if (!Number.isFinite(timestamp) || timestamp < this.minimumTimestamp - 0.0000001) return false;
    if (this.sourceFps > 0 && this.sourceFps <= this.targetFps + 0.001)
      return true;
    this.origin ??= timestamp;
    // Tolerance covers timestamp quantization, e.g. WebCodecs' integer microseconds.
    const bucket = Math.floor(
      (timestamp - this.origin) * this.targetFps + 0.0001,
    );
    if (bucket <= this.lastBucket) return false;
    this.lastBucket = bucket;
    return true;
  }
}

export interface SourceFrame {
  bitmap: ImageBitmap;
  timestamp: number;
  captureMetrics?:CameraCaptureMetrics;
}

/** One-frame lookahead overlaps decoding with inference without evicting frames. */
export class FramePrefetcher<T extends { close(): void }> {
  private pending:
    | {
        discarded: boolean;
        value?: T | null;
        promise: Promise<{ value: T | null; error?: unknown }>;
      }
    | undefined;
  private closed = false;
  constructor(private readonly read: () => Promise<T | null>) {}
  private start() {
    const entry = {
      discarded: false,
      value: undefined as T | null | undefined,
      promise: undefined as unknown as Promise<{
        value: T | null;
        error?: unknown;
      }>,
    };
    // Convert failures into values until next() consumes them, avoiding an
    // unhandled rejection if decoding fails while inference is still running.
    entry.promise = this.read().then(
      (value) => {
        if (entry.discarded) value?.close();
        else entry.value = value;
        return { value };
      },
      (error) => ({ value: null, error }),
    );
    this.pending = entry;
    return entry;
  }
  async next(): Promise<T | null> {
    if (this.closed) return null;
    const entry = this.pending ?? this.start();
    const outcome = await entry.promise;
    if (entry.discarded || this.closed || entry !== this.pending) return null;
    this.pending = undefined;
    entry.value = undefined;
    if ("error" in outcome) throw outcome.error;
    if (outcome.value) this.start();
    return outcome.value;
  }
  reset() {
    if (this.pending) {
      this.pending.discarded = true;
      this.pending.value?.close();
      this.pending.value = undefined;
      this.pending = undefined;
    }
  }
  close() {
    this.closed = true;
    this.reset();
  }
}

/** Sequential decoding with one selected frame prepared ahead of inference. */
export async function openVideoFile(file: File) {
  // Keep demux/decoder code out of the camera/image startup bundle.
  const { Input, BlobSource, ALL_FORMATS, CanvasSink } =
    await import("mediabunny");
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode()))
      throw new Error(
        "This browser cannot decode this video. Try an H.264 MP4.",
      );
    const duration = await track.computeDuration();
    const metrics = await track.computeFrameRateMetrics();
    const sink = new CanvasSink(track, { poolSize: 2 });
    const previewSink = new CanvasSink(track, { poolSize: 1 });
    const thumbnailSink = new CanvasSink(track, { width: 144, height: 80, fit: "cover", poolSize: 1 });
    let iterator = sink.canvases();
    const samplingFps =
      metrics.maxFrameRate <= 30.001
        ? metrics.maxFrameRate
        : metrics.frameRateIsConstant
          ? metrics.averageFrameRate
          : 0;
    let selector = new FrameSelector(samplingFps);
    let closed = false;
    const prefetch = new FramePrefetcher(async () => {
      const activeIterator = iterator,
        activeSelector = selector;
      while (!closed) {
        const { value, done } = await activeIterator.next();
        if (done || closed) return null;
        if (value.timestamp < 0 || !activeSelector.accept(value.timestamp))
          continue;
        const bitmap = await createImageBitmap(value.canvas);
        return {
          bitmap,
          timestamp: value.timestamp,
          close: () => bitmap.close(),
        };
      }
      return null;
    });
    return {
      duration,
      sourceFps: metrics.averageFrameRate,
      next: () => prefetch.next(),
      async preview(timestamp: number, thumbnail = false) {
        const selectedSink = thumbnail ? thumbnailSink : previewSink;
        const value = await selectedSink.getCanvas(Math.max(timestamp, 0.001)) ??
          (timestamp < 1 / metrics.averageFrameRate ? await selectedSink.getCanvas(1 / metrics.averageFrameRate) : null);
        if (!value || closed) return null;
        return { bitmap: await createImageBitmap(value.canvas), timestamp: value.timestamp };
      },
      seek(timestamp: number) {
        prefetch.reset();
        void iterator.return().catch(() => {});
        iterator = sink.canvases(timestamp);
        selector = new FrameSelector(samplingFps, 30, timestamp);
      },
      close() {
        closed = true;
        prefetch.close();
        void iterator.return().catch(() => {});
        input.dispose();
      },
    };
  } catch (error) {
    input.dispose();
    throw error;
  }
}
export type VideoFileSource = Awaited<ReturnType<typeof openVideoFile>>;

/** FIFO never replaces an older admitted frame with a newer one. */
export class FrameQueue<T extends { close(): void }> {
  private frames: T[] = [];
  get length() {
    return this.frames.length;
  }
  push(frame: T) {
    this.frames.push(frame);
  }
  shift() {
    return this.frames.shift();
  }
  clear() {
    for (const frame of this.frames) frame.close();
    this.frames = [];
  }
}
