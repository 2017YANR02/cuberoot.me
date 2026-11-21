import type {PixelCrop} from './source-crop';

export type OverlayPainter = (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

/** Keeps the visible canvas on a completed frame until its successor is ready. */
export class FramePresenter {
  private pending?: OffscreenCanvas;
  private displayed?: OffscreenCanvas;
  private composite?: OffscreenCanvas;
  private reusable: OffscreenCanvas[] = [];

  get snapshot() {
    return this.displayed;
  }

  capture(source: HTMLImageElement | ImageBitmap | OffscreenCanvas) {
    if (this.pending) this.releaseFrame(this.pending);
    this.pending = this.captureFrame(source);
  }

  /** Detached raw frame: its pixels cannot be overwritten by later admissions. */
  captureFrame(source: HTMLImageElement | ImageBitmap | OffscreenCanvas, crop?: PixelCrop) {
    const width = crop?.width ?? (source instanceof HTMLImageElement ? source.naturalWidth : source.width);
    const height = crop?.height ?? (source instanceof HTMLImageElement ? source.naturalHeight : source.height);
    const frame = this.reusable.pop() ?? new OffscreenCanvas(width, height);
    if (frame.width !== width) frame.width = width;
    if (frame.height !== height) frame.height = height;
    const context = frame.getContext("2d")!;
    context.clearRect(0, 0, width, height);
    if (crop) context.drawImage(source, crop.x, crop.y, width, height, 0, 0, width, height);
    else context.drawImage(source, 0, 0);
    return frame;
  }

  releaseFrame(frame: OffscreenCanvas) {
    if (frame !== this.displayed && this.reusable.length < 4) this.reusable.push(frame);
  }

  presentFrame(target: HTMLCanvasElement, frame: OffscreenCanvas, overlay?: OverlayPainter) {
    const old = this.displayed;
    this.displayed = frame;
    if (old && old !== frame) this.releaseFrame(old);
    this.redraw(target, overlay);
  }

  present(target: HTMLCanvasElement, overlay?: OverlayPainter) {
    if (!this.pending) return;
    const frame = this.pending;
    this.pending = undefined;
    this.presentFrame(target, frame, overlay);
  }

  redraw(target: HTMLCanvasElement, overlay?: OverlayPainter) {
    if (!this.displayed) return;
    const source = this.displayed;
    const scale = Math.min(1, 1920 / Math.max(source.width, source.height));
    const width = Math.round(source.width * scale),
      height = Math.round(source.height * scale);
    let image = source;
    if (overlay) {
      if (
        !this.composite ||
        this.composite.width !== width ||
        this.composite.height !== height
      )
        this.composite = new OffscreenCanvas(width, height);
      const context = this.composite.getContext("2d")!;
      context.clearRect(0, 0, width, height);
      context.drawImage(source, 0, 0, width, height);
      overlay(context, width, height);
      image = this.composite;
    }
    // Only this final blit touches the visible frame. Resizing happens after
    // composition too, so a new source size cannot clear the old view early.
    if (target.width !== width) target.width = width;
    if (target.height !== height) target.height = height;
    const visible = target.getContext("2d")!;
    visible.globalCompositeOperation = "copy";
    visible.drawImage(image, 0, 0, width, height);
    visible.globalCompositeOperation = "source-over";
  }

  clear(target?: HTMLCanvasElement) {
    this.pending = undefined;
    this.displayed = undefined;
    this.composite = undefined;
    this.reusable = [];
    target?.getContext("2d")?.clearRect(0, 0, target.width, target.height);
  }
}
