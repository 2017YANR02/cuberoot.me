import { cropPixels, detectVideoBars, type PixelCrop } from '../video-recon/engine/source-crop';

/** Compare separated frames so a dark opening, transition or stage background
 * does not decide the framing for the entire solve. */
export async function detectCaptionCrop(file: File, width: number, height: number, duration: number, signal: AbortSignal) {
  const { ALL_FORMATS, BlobSource, CanvasSink, Input } = await import('mediabunny');
  signal.throwIfAborted();
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const dispose = () => input.dispose();
  signal.addEventListener('abort', dispose, { once: true });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return;
    const scale = Math.min(1, 640 / Math.max(width, height));
    const sink = new CanvasSink(track, { width: Math.max(1, Math.round(width * scale)), poolSize: 1 });
    const frames: PixelCrop[] = [];
    for (const fraction of [.15, .5, .85]) {
      signal.throwIfAborted();
      const sample = await sink.getCanvas(duration * fraction);
      if (!sample) return;
      const bitmap = await createImageBitmap(sample.canvas);
      try {
        const rect = cropPixels(detectVideoBars(bitmap, .45), width, height);
        if (!rect) return;
        frames.push(rect);
      } finally { bitmap.close(); }
    }
    const first = frames[0];
    const tolerance = Math.ceil(2 / scale);
    if (frames.some(r => Math.abs(r.x - first.x) > tolerance || Math.abs(r.y - first.y) > tolerance ||
      Math.abs(r.width - first.width) > tolerance || Math.abs(r.height - first.height) > tolerance)) return;
    const left = Math.min(...frames.map(r => r.x)), top = Math.min(...frames.map(r => r.y));
    const right = Math.max(...frames.map(r => r.x + r.width)), bottom = Math.max(...frames.map(r => r.y + r.height));
    // H.264 encoders can require even dimensions.
    const cropWidth = 2 * Math.floor((right - left) / 2), cropHeight = 2 * Math.floor((bottom - top) / 2);
    if (cropWidth >= 2 && cropHeight >= 2) return { x: left, y: top, width: cropWidth, height: cropHeight };
  } finally {
    signal.removeEventListener('abort', dispose);
    input.dispose();
  }
}
