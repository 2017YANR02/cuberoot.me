import { SITE_ASSISTANT_IMAGE_BYTES, type AssistantImage } from '@cuberoot/shared/site-assistant';
import { prepareImageUpload } from './image-upload';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from './session-fetch';

export async function saveAssistantImages(images: AssistantImage[], conversationId: string, signal?: AbortSignal): Promise<AssistantImage[]> {
  return Promise.all(images.map(image => image.attachmentId ? image : sessionFetch(apiUrl('/v1/site-assistant/attachments'), {
    method: 'POST', headers: authHeaders(), signal, body: JSON.stringify({ conversationId, image }),
  }).then(response => handleApi<AssistantImage>(response))));
}

export async function readAssistantImage(image: AssistantImage, signal?: AbortSignal): Promise<AssistantImage> {
  if (image.data) return image;
  if (!image.attachmentId) throw new Error('missing_image');
  return loadAssistantAttachment(image.attachmentId, signal);
}

export async function loadAssistantAttachment(id: string, signal?: AbortSignal): Promise<AssistantImage> {
  return handleApi<AssistantImage>(await sessionFetch(apiUrl(`/v1/site-assistant/attachments/${encodeURIComponent(id)}`), { headers: authHeaders(), signal }));
}

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
