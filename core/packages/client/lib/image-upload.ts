import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export interface UploadedImage {
  id: number;
  url: string;
}

export interface PreparedImageUpload {
  dataB64: string;
  mime: string;
  previewUrl: string;
}

export async function prepareImageUpload(file: File, maxDimension = 1920): Promise<PreparedImageUpload> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('unsupported_image_type');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('image_processing_failed');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let mime = 'image/webp';
    let previewUrl = canvas.toDataURL(mime, 0.86);
    if (!previewUrl.startsWith('data:image/webp')) {
      mime = 'image/jpeg';
      previewUrl = canvas.toDataURL(mime, 0.86);
    }
    const dataB64 = previewUrl.split(',')[1] ?? '';
    if (!dataB64) throw new Error('image_processing_failed');
    return { dataB64, mime, previewUrl };
  } finally {
    bitmap.close?.();
  }
}

export async function uploadImageBlob(dataB64: string, mime: string): Promise<UploadedImage> {
  return handleApi<UploadedImage>(await fetch(apiUrl('/v1/article/img'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ dataB64, mime }),
  }));
}
