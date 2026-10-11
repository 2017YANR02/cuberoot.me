import { SITE_ASSISTANT_IMAGE_BYTES, type AssistantImage } from '@cuberoot/shared/site-assistant';
import { prepareImageUpload } from './image-upload';

/** Re-encode to strip metadata and keep the entire request below proxy limits. */
export async function prepareAssistantImage(file: File): Promise<AssistantImage> {
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('invalid_image');
  for (const dimension of [1920, 1280, 960]) {
    const image = await prepareImageUpload(file, dimension);
    if (image.dataB64.length <= 4 * Math.ceil(SITE_ASSISTANT_IMAGE_BYTES / 3)) {
      return { mediaType: image.mime as AssistantImage['mediaType'], data: image.dataB64 };
    }
  }
  throw new Error('invalid_image');
}
