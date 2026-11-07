import type { CubePhotoDetection, PhotoPixels } from '@cuberoot/shared/cube-photo/detect';
import type { PhotoAnalysisInput, PhotoAnalysisMessage } from '@cuberoot/shared/cube-photo/analyze';

export type PhotoWorkerRequest<T> = { id: number; input: T; fresh?: boolean } | { id: number; cancel: true };
export interface PhotoWorkerReply<T> { id: number; message: T }
export type PhotoDetectionInput = PhotoPixels & { puzzleSize?: 2 | 3 };
export type PhotoDetectionMessage = { detection: CubePhotoDetection; puzzleSize: 2 | 3; elapsedMs: number } | { error: 'detection_failed' };

/** One active request per worker; successful requests keep the worker and its cache. */
class PhotoWorkerChannel<Output> {
  private worker?: Worker;
  private sequence = 0;
  private active?: { id: number; receive: (message: Output) => void; timer: ReturnType<typeof setTimeout> };

  constructor(private create: () => Worker, private timeout: number, private error: Output,
    private finished: (message: Output) => boolean) {}

  warmup() {
    if (this.worker) return;
    const worker = this.create();
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<PhotoWorkerReply<Output>>) => {
      const active = this.active;
      if (this.worker !== worker || !active || event.data.id !== active.id) return;
      if (this.finished(event.data.message)) { clearTimeout(active.timer); this.active = undefined; }
      active.receive(event.data.message);
    };
    worker.onerror = () => { if (this.worker === worker) this.fail(); };
    worker.onmessageerror = () => { if (this.worker === worker) this.fail(); };
  }

  start(input: PhotoDetectionInput | PhotoAnalysisInput, receive: (message: Output) => void, fresh = false): () => void {
    this.cancel();
    const id = ++this.sequence;
    this.active = { id, receive, timer: setTimeout(() => this.fail(), this.timeout) };
    try {
      this.warmup();
      const pixels = 'pixels' in input ? input.pixels : input;
      const data = new Uint8ClampedArray(pixels.data);
      // ImageData dimensions are prototype accessors, so do not spread it.
      const copy = { width: pixels.width, height: pixels.height, data };
      const payload = 'pixels' in input ? { ...input, pixels: copy } : { ...copy, puzzleSize: input.puzzleSize };
      this.worker!.postMessage({ id, input: payload, fresh }, [data.buffer]);
    } catch { this.fail(); }
    return () => { if (this.active?.id === id) this.cancel(); };
  }

  cancel() {
    const active = this.active;
    if (!active) return;
    clearTimeout(active.timer); this.active = undefined;
    // Stop obsolete async lookups, while retaining in-flight catalog fetches.
    try { this.worker?.postMessage({ id: active.id, cancel: true }); } catch { this.dispose(); }
  }

  dispose() {
    if (this.active) clearTimeout(this.active.timer);
    this.active = undefined;
    this.worker?.terminate(); this.worker = undefined;
  }

  private fail() {
    const receive = this.active?.receive;
    this.dispose();
    receive?.(this.error);
  }
}

/** Owned by the page, not a module singleton: photos/caches are released on exit. */
export class PhotoWorkers {
  private detector = new PhotoWorkerChannel<PhotoDetectionMessage>(
    () => new Worker(new URL('./detect.worker.ts', import.meta.url), { type: 'module' }), 20000,
    { error: 'detection_failed' }, () => true);
  private analyzer = new PhotoWorkerChannel<PhotoAnalysisMessage>(
    () => new Worker(new URL('./analyze.worker.ts', import.meta.url), { type: 'module' }), 30000,
    { type: 'error' }, message => message.type === 'done' || message.type === 'error');

  warmup() {
    // Decode the selected image and load both worker modules concurrently.
    for (const channel of [this.detector, this.analyzer]) {
      try { channel.warmup(); } catch { /* start() reports/retries an unavailable worker */ }
    }
  }
  detect(input: PhotoDetectionInput, receive: (message: PhotoDetectionMessage) => void) { return this.detector.start(input, receive); }
  analyze(input: PhotoAnalysisInput, receive: (message: PhotoAnalysisMessage) => void, fresh = false) { return this.analyzer.start(input, receive, fresh); }
  cancel() { this.detector.cancel(); this.analyzer.cancel(); }
  dispose() { this.detector.dispose(); this.analyzer.dispose(); }
}
