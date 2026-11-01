import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from './session-fetch';

export type GalleryStatus = 'private' | 'pending' | 'public' | 'rejected';
export interface GalleryPhoto { id: number; memberName: string; wcaId: string | null }
export interface MyGalleryPhoto { id: number; status: GalleryStatus }
const path = '/v1/membership/gallery';

export async function listGalleryPhotos(signal?: AbortSignal): Promise<GalleryPhoto[]> {
  const result = await handleApi<{ photos: GalleryPhoto[] }>(await sessionFetch(apiUrl(`${path}?v=2`), { cache: 'no-store', signal }));
  return result.photos;
}
export async function listMyGalleryPhotos(signal?: AbortSignal): Promise<MyGalleryPhoto[]> {
  const result = await handleApi<{ photos: MyGalleryPhoto[] }>(await sessionFetch(apiUrl(`${path}/mine`), { headers: authHeaders(false), cache: 'no-store', signal }));
  return result.photos;
}
export async function setGalleryVisibility(id: number, status: 'private' | 'pending'): Promise<MyGalleryPhoto> {
  return handleApi(await sessionFetch(apiUrl(`${path}/${id}/visibility`), {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status }), cache: 'no-store',
  }));
}
export async function listGalleryRequests(signal?: AbortSignal): Promise<GalleryPhoto[]> {
  const result = await handleApi<{ photos: GalleryPhoto[] }>(await sessionFetch(apiUrl(`${path}/review`), { headers: authHeaders(false), cache: 'no-store', signal }));
  return result.photos;
}
export async function reviewGalleryPhoto(id: number, decision: 'public' | 'rejected'): Promise<MyGalleryPhoto> {
  return handleApi(await sessionFetch(apiUrl(`${path}/${id}/review`), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ decision }), cache: 'no-store',
  }));
}
