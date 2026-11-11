import { prepareImageUpload, type PreparedImageUpload } from '@/lib/image-upload';
import { resizePhotoPixels } from '@cuberoot/shared/cube-photo/pixels';
import type { PhotoPixels } from '@cuberoot/shared/cube-photo/detect';

export interface PhotoImage { src: string; width: number; height: number; pixels: PhotoPixels }

/** Decode locally; the smaller pixel buffer is shared by both photo workflows. */
export async function readPhoto(file?: File, saved?: PreparedImageUpload): Promise<PhotoImage> {
  const prepared = saved ?? await prepareImageUpload(file!, 1920);
  const image = new Image();
  image.src = prepared.previewUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('canvas');
  context.drawImage(image, 0, 0);
  return { src: prepared.previewUrl, width: canvas.width, height: canvas.height,
    pixels: resizePhotoPixels(context.getImageData(0, 0, canvas.width, canvas.height)) };
}
