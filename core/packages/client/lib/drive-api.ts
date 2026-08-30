import type { DriveNode, DriveSnapshot, DriveUpload } from '@cuberoot/shared/drive';
import { apiUrl, directApiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export interface DriveMember {
  userId: number;
  name: string;
  wcaId: string | null;
  createdAt: string;
}

export interface DriveAccess {
  url: string;
  inline: boolean;
}

interface DriveChunkResponse {
  offset: number;
  complete: boolean;
  nodeId?: string;
  error?: string;
}

async function write<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method,
    headers: authHeaders(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleApi<T>(response);
}

export async function fetchDrive(parentId: string | null, trash = false): Promise<DriveSnapshot> {
  const query = trash ? '?trash=1' : parentId ? `?parent=${encodeURIComponent(parentId)}` : '';
  const response = await fetch(apiUrl(`/v1/drive${query}`), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  return handleApi<DriveSnapshot>(response);
}

export async function createDriveFolder(parentId: string | null, name: string): Promise<DriveNode> {
  const result = await write<{ node: DriveNode }>('/v1/drive/folders', 'POST', { parentId, name });
  return result.node;
}

export async function createDriveUpload(file: File, parentId: string | null): Promise<DriveUpload> {
  const result = await write<{ upload: DriveUpload }>('/v1/drive/uploads', 'POST', {
    parentId,
    name: file.name,
    sizeBytes: file.size,
    mimeType: file.type || 'application/octet-stream',
    lastModified: file.lastModified,
  });
  return result.upload;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function uploadDriveChunk(
  uploadId: string,
  offset: number,
  chunk: Blob,
  signal?: AbortSignal,
  onProgress?: (uploadedBytes: number) => void,
): Promise<DriveChunkResponse> {
  const bytes = await chunk.arrayBuffer();
  const checksum = bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    request.open('PATCH', directApiUrl(`/v1/drive/uploads/${encodeURIComponent(uploadId)}`));
    const headers = {
      ...authHeaders(false),
      'Content-Type': 'application/offset+octet-stream',
      'Upload-Offset': String(offset),
      'Upload-Checksum': `sha256 ${checksum}`,
    };
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.addEventListener('progress', (event) => {
      onProgress?.(Math.min(event.loaded, chunk.size));
    });
    request.addEventListener('load', () => {
      cleanup();
      let payload: DriveChunkResponse | null = null;
      try {
        payload = JSON.parse(request.responseText) as DriveChunkResponse;
      } catch {
        // The status text below is the useful fallback for an invalid upstream response.
      }
      if (request.status >= 200 && request.status < 300 && payload) {
        resolve(payload);
        return;
      }
      reject(new Error(payload?.error || request.statusText || `API error ${request.status}`));
    });
    request.addEventListener('error', () => {
      cleanup();
      reject(new TypeError('Network request failed'));
    });
    request.addEventListener('abort', () => {
      cleanup();
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    });
    signal?.addEventListener('abort', abort, { once: true });
    request.send(chunk);
  });
}

export const cancelDriveUpload = (uploadId: string) => (
  write<{ ok: boolean }>(`/v1/drive/uploads/${encodeURIComponent(uploadId)}`, 'DELETE')
);

export const updateDriveNode = (nodeId: string, changes: { name?: string; parentId?: string | null }) => (
  write<{ node: DriveNode }>(`/v1/drive/nodes/${encodeURIComponent(nodeId)}`, 'PATCH', changes)
);

export const trashDriveNode = (nodeId: string) => (
  write<{ ok: boolean }>(`/v1/drive/nodes/${encodeURIComponent(nodeId)}/trash`, 'POST')
);

export const restoreDriveNode = (nodeId: string) => (
  write<{ ok: boolean }>(`/v1/drive/nodes/${encodeURIComponent(nodeId)}/restore`, 'POST')
);

export const deleteDriveNode = (nodeId: string) => (
  write<{ ok: boolean }>(`/v1/drive/nodes/${encodeURIComponent(nodeId)}`, 'DELETE')
);

export const createDriveAccess = (nodeId: string, inline: boolean) => (
  write<DriveAccess>(`/v1/drive/files/${encodeURIComponent(nodeId)}/access`, 'POST', { inline })
);

export async function fetchDriveMembers(): Promise<DriveMember[]> {
  const response = await fetch(apiUrl('/v1/drive/members'), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  const result = await handleApi<{ members: DriveMember[] }>(response);
  return result.members;
}

export const addDriveMember = (userId: number) => (
  write<{ ok: boolean }>('/v1/drive/members', 'POST', { userId })
);

export const removeDriveMember = (userId: number) => (
  write<{ ok: boolean }>(`/v1/drive/members/${userId}`, 'DELETE')
);
