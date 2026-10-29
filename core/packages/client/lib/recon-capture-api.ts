import type { ReconCapture, ReconCaptureInput, ReconCaptureAnchor } from '@cuberoot/shared/recon-capture';
import { RECON_CAPTURE_MAX_VIDEO_BYTES, RECON_CAPTURE_CHUNK_BYTES, RECON_CAPTURE_VIDEO_MIMES } from '@cuberoot/shared/recon-capture';
import { reconCaptureApiUrl } from './recon-capture-transport';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from './session-fetch';
import { tr } from '@/i18n/tr';

async function request<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  return handleApi<T>(await sessionFetch(reconCaptureApiUrl(`/v1/recon-captures${path}`), {
    method: body === undefined ? 'GET' : 'POST',
    headers: authHeaders(body !== undefined),
    cache: 'no-store', signal,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

export const listReconCaptures = (sourceSolveId: string, signal?: AbortSignal) =>
  request<{ items: ReconCapture[]; hasMore: boolean }>(`?${new URLSearchParams({ sourceSolveId })}`, signal);
export const reconCaptureStatus = (signal?: AbortSignal) =>
  request<{ available: boolean; storage: string; maxVideoBytes: number; chunkBytes: number }>('/status', signal);
export const getReconCapture = (id: string, signal?: AbortSignal) =>
  request<ReconCapture>(`/${encodeURIComponent(id)}`, signal);
export const createReconCapture = (id: string, input: ReconCaptureInput, signal?: AbortSignal) =>
  request<ReconCapture>('', signal, { id, input });
export const completeReconCapture = (id: string, signal?: AbortSignal) =>
  request<ReconCapture>(`/${encodeURIComponent(id)}/complete`, signal, {});
export const saveReconCaptureSync = (id: string, revision: number, anchors: ReconCaptureAnchor[], signal?: AbortSignal) =>
  request<ReconCapture>(`/${encodeURIComponent(id)}/sync`, signal, { revision, anchors });

function aborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
}

/** Metadata is descriptive only. It never establishes video/log synchronization. */
async function videoDuration(file: File, signal: AbortSignal): Promise<number | null> {
  aborted(signal);
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (duration: number | null, cancelled = false) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      video.onloadedmetadata = null; video.onerror = null;
      video.removeAttribute('src'); video.load();
      URL.revokeObjectURL(url);
      if (cancelled) reject(new DOMException('Aborted', 'AbortError'));
      else resolve(duration);
    };
    const cancel = () => finish(null, true);
    const timeout = setTimeout(() => finish(null), 8000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : null);
    video.onerror = () => finish(null);
    signal.addEventListener('abort', cancel, { once: true });
    video.src = url;
  });
}

/** Read one bounded block at a time; never materialize the whole original video. */
export async function inspectCaptureVideo(file: File, signal: AbortSignal, onProgress: (bytes: number) => void): Promise<ReconCaptureInput['video']> {
  if (!file.size || file.size > RECON_CAPTURE_MAX_VIDEO_BYTES) {
    throw new Error(tr({ zh: '请选择不超过 1 GiB 的原视频。', en: 'Choose an original video up to 1 GiB.' }));
  }
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  const fallback: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
  const mimeType = file.type || fallback[extension ?? ''] || '';
  if (!RECON_CAPTURE_VIDEO_MIMES.some(mime => mime === mimeType)) {
    throw new Error(tr({ zh: '请选择 MP4、MOV 或 WebM 视频。', en: 'Choose an MP4, MOV or WebM video.' }));
  }
  const durationMs = await videoDuration(file, signal);
  const chunkSha256: string[] = [];
  for (let offset = 0; offset < file.size; offset += RECON_CAPTURE_CHUNK_BYTES) {
    aborted(signal);
    const end = Math.min(offset + RECON_CAPTURE_CHUNK_BYTES, file.size);
    const bytes = await file.slice(offset, end).arrayBuffer();
    aborted(signal);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    aborted(signal);
    chunkSha256.push(Array.from(digest, value => value.toString(16).padStart(2, '0')).join(''));
    onProgress(end);
  }
  return { filename: file.name, sizeBytes: file.size, mimeType, lastModified: file.lastModified,
    durationMs, chunkBytes: RECON_CAPTURE_CHUNK_BYTES, chunkSha256 };
}

/** Re-selecting a copied/renamed original is fine, but every byte must match. */
export function sameCaptureVideo(a: ReconCaptureInput['video'], b: ReconCaptureInput['video']): boolean {
  return a.sizeBytes === b.sizeBytes && a.chunkBytes === b.chunkBytes
    && a.chunkSha256.length === b.chunkSha256.length
    && a.chunkSha256.every((hash, index) => hash === b.chunkSha256[index]);
}
