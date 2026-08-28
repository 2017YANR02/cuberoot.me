import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi } from './admin-api';

const BASE = `${API_ORIGIN}/v1/creator-gallery/captions`;

export interface CreatorGalleryCaption {
  imageKey: string;
  captionZh: string;
  captionEn: string;
}

interface CreatorGalleryCaptionResponse {
  captions: CreatorGalleryCaption[];
}

export async function getCreatorGalleryCaptions(): Promise<CreatorGalleryCaption[]> {
  const response = await handleApi<CreatorGalleryCaptionResponse>(await fetch(BASE));
  return response.captions;
}

export async function saveCreatorGalleryCaptions(
  captions: CreatorGalleryCaption[],
): Promise<CreatorGalleryCaption[]> {
  const response = await handleApi<CreatorGalleryCaptionResponse>(
    await fetch(BASE, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ captions }),
    }),
  );
  return response.captions;
}
