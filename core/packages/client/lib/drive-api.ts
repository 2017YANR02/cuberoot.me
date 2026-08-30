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
): Promise<{ offset: number; complete: boolean; nodeId?: string }> {
  const bytes = await chunk.arrayBuffer();
  const checksum = bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  const response = await fetch(directApiUrl(`/v1/drive/uploads/${encodeURIComponent(uploadId)}`), {
    method: 'PATCH',
    headers: {
      ...authHeaders(false),
      'Content-Type': 'application/offset+octet-stream',
      'Upload-Offset': String(offset),
      'Upload-Checksum': `sha256 ${checksum}`,
    },
    body: chunk,
    signal,
  });
  return handleApi<{ offset: number; complete: boolean; nodeId?: string }>(response);
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
