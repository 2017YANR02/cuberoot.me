import { paintCaption, type PreparedCaptions, type CaptionStyle } from './recon-captions';
import type { PixelCrop } from '../video-recon/engine/source-crop';
import type { CaptionCube } from './caption-cube';
import { downloadBlob } from '@/lib/scramble-dist/download';

export async function exportVideoFrame(fileName: string, frame: number, canvas?: HTMLCanvasElement | null, video?: HTMLVideoElement) {
  let png = canvas?.width ? await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png')) : null;
  if (!png && video?.videoWidth && video.videoHeight) {
    const capture = document.createElement('canvas');
    capture.width = video.videoWidth;
    capture.height = video.videoHeight;
    capture.getContext('2d')?.drawImage(video, 0, 0);
    png = await new Promise<Blob | null>(resolve => capture.toBlob(resolve, 'image/png'));
  }
  if (!png) return false;
  downloadBlob(`${fileName.replace(/\.[^.]+$/, '')}.frame_${frame}.png`, png);
  return true;
}

async function convertVideoClip(
  file: File,
  range: { start: number; end: number } | undefined,
  onProgress: (percent: number) => void,
  video?: import('mediabunny').ConversionVideoOptions,
  signal?: AbortSignal,
) {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import('mediabunny');
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat(), target });
    const conversion = await Conversion.init({ input, output, trim: range, video });
    if ((video && conversion.discardedTracks.some(item => item.track.type === 'audio')) || !conversion.isValid || !conversion.utilizedTracks.some(track => track.type === 'video')) {
      throw new Error('The browser cannot export this source as MP4.');
    }
    conversion.onProgress = progress => onProgress(Math.round(progress * 100));
    signal?.throwIfAborted();
    const cancel = () => { void conversion.cancel().catch(() => {}); };
    signal?.addEventListener('abort', cancel, { once: true });
    try { await conversion.execute(); } finally { signal?.removeEventListener('abort', cancel); }
    signal?.throwIfAborted();
    if (!target.buffer) throw new Error('No video was exported.');
    return new Blob([target.buffer], { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}

export async function exportVideoClip(file: File, range: { start: number; end: number } | undefined, onProgress: (percent: number) => void) {
  const blob = await convertVideoClip(file, range, onProgress);
  downloadBlob(`${file.name.replace(/\.[^.]+$/, '')}_export.mp4`, blob);
}

export async function renderReconVideo(file: File, cues: PreparedCaptions, style: CaptionStyle, onProgress: (n: number) => void, signal: AbortSignal, cube?: CaptionCube, crop?: PixelCrop) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Canvas unavailable');
  const blob = await convertVideoClip(file, undefined, onProgress, {
    codec: 'avc', forceTranscode: true, allowTransformationMetadata: false,
    crop: crop && { left: crop.x, top: crop.y, width: crop.width, height: crop.height },
    process(sample) {
      if (canvas.width !== sample.displayWidth || canvas.height !== sample.displayHeight) {
        canvas.width = sample.displayWidth;
        canvas.height = sample.displayHeight;
      }
      sample.draw(ctx, 0, 0);
      cube?.draw(ctx, sample.timestamp, canvas.width, canvas.height, style.cubePosition, style.cubeScale);
      paintCaption(ctx, cues, sample.timestamp, canvas.width, canvas.height, style);
      return canvas;
    },
  }, signal);
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-sub.mp4', { type: 'video/mp4' });
}
