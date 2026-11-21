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

export async function exportVideoClip(
  file: File,
  range: { start: number; end: number } | undefined,
  onProgress: (percent: number) => void,
) {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import('mediabunny');
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat(), target });
    const conversion = await Conversion.init({ input, output, trim: range });
    if (!conversion.isValid || !conversion.utilizedTracks.some(track => track.type === 'video')) {
      throw new Error('The browser cannot export this source as MP4.');
    }
    conversion.onProgress = progress => onProgress(Math.round(progress * 100));
    await conversion.execute();
    if (!target.buffer) throw new Error('No video was exported.');
    downloadBlob(`${file.name.replace(/\.[^.]+$/, '')}_export.mp4`, new Blob([target.buffer], { type: 'video/mp4' }));
  } finally {
    input.dispose();
  }
}
