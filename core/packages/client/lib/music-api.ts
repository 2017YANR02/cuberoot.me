import { apiUrl, directApiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export type MusicTrackStatus = 'pending' | 'published' | 'rejected';

export interface MusicApiTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  lyricsLrc: string | null;
  audioMime: string;
  audioSizeBytes: number;
  audioFilename: string;
  status: MusicTrackStatus;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  coverUrl: string | null;
  audioUrl: string | null;
  ownerUserId?: number | null;
}

export interface MusicMetadataDraft {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  lyricsLrc?: string;
}

export interface MusicAdminDraft extends MusicMetadataDraft {
  status: MusicTrackStatus;
  reviewNote?: string;
}

const BASE = '/v1/music';

function list(path: string, authenticated = false): Promise<{ tracks: MusicApiTrack[] }> {
  return fetch(apiUrl(path), {
    headers: authenticated ? authHeaders(false) : undefined,
    cache: 'no-store',
  }).then(handleApi<{ tracks: MusicApiTrack[] }>);
}

export async function listPublicMusicTracks(): Promise<MusicApiTrack[]> {
  return (await list(`${BASE}/tracks`)).tracks;
}

export async function listMyMusicTracks(): Promise<MusicApiTrack[]> {
  return (await list(`${BASE}/me/tracks`, true)).tracks;
}

export async function listAdminMusicTracks(): Promise<MusicApiTrack[]> {
  return (await list(`${BASE}/admin/tracks`, true)).tracks;
}

function metadataQuery(draft: MusicMetadataDraft, filename: string): string {
  const query = new URLSearchParams({
    title: draft.title,
    artist: draft.artist,
    filename,
  });
  if (draft.album) query.set('album', draft.album);
  if (draft.genre) query.set('genre', draft.genre);
  if (draft.lyricsLrc) query.set('lyricsLrc', draft.lyricsLrc);
  return query.toString();
}

export async function createMusicTrack(file: File, draft: MusicMetadataDraft): Promise<MusicApiTrack> {
  const response = await fetch(directApiUrl(`${BASE}/tracks?${metadataQuery(draft, file.name)}`), {
    method: 'POST',
    headers: {
      ...authHeaders(false),
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  return (await handleApi<{ track: MusicApiTrack }>(response)).track;
}

export async function putMusicTrackCover(id: string, file: File): Promise<MusicApiTrack> {
  const response = await fetch(directApiUrl(`${BASE}/tracks/${encodeURIComponent(id)}/cover`), {
    method: 'PUT',
    headers: {
      ...authHeaders(false),
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  return (await handleApi<{ track: MusicApiTrack }>(response)).track;
}

export async function updateMyMusicTrack(id: string, draft: MusicMetadataDraft): Promise<MusicApiTrack> {
  const response = await fetch(apiUrl(`${BASE}/tracks/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(draft),
  });
  return (await handleApi<{ track: MusicApiTrack }>(response)).track;
}

export async function updateAdminMusicTrack(id: string, draft: MusicAdminDraft): Promise<MusicApiTrack> {
  const response = await fetch(apiUrl(`${BASE}/admin/tracks/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(draft),
  });
  return (await handleApi<{ track: MusicApiTrack }>(response)).track;
}

export async function deleteAdminMusicTrack(id: string): Promise<void> {
  await handleApi<{ ok: true }>(await fetch(apiUrl(`${BASE}/admin/tracks/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  }));
}

export async function fetchMusicTrackDownload(id: string): Promise<Blob> {
  const response = await fetch(directApiUrl(`${BASE}/tracks/${encodeURIComponent(id)}/download`), {
    headers: authHeaders(false),
  });
  if (!response.ok) {
    await handleApi<never>(response);
    throw new Error(`Music download HTTP ${response.status}`);
  }
  return response.blob();
}

export function musicApiAssetUrl(path: string): string {
  if (/^https?:/i.test(path)) return path;
  return directApiUrl(path.startsWith('/') ? path : `/${path}`);
}
