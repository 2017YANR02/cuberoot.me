export const DRIVE_TOTAL_BYTES = 20 * 1024 * 1024 * 1024;
export const DRIVE_CHUNK_BYTES = 8 * 1024 * 1024;
export const DRIVE_UPLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const DRIVE_NAME_MAX_LENGTH = 255;

export type DriveNodeKind = 'file' | 'folder';

export interface DriveNode {
  id: string;
  parentId: string | null;
  name: string;
  kind: DriveNodeKind;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface DriveUpload {
  id: string;
  nodeId: string;
  parentId: string | null;
  name: string;
  mimeType: string;
  expectedBytes: number;
  receivedBytes: number;
  chunkBytes: number;
  lastModified: number | null;
  expiresAt: string;
}

export interface DriveQuota {
  limitBytes: number;
  usedBytes: number;
  reservedBytes: number;
}

export interface DriveSnapshot {
  allowed: boolean;
  isAdmin: boolean;
  nodes: DriveNode[];
  uploads: DriveUpload[];
  breadcrumbs: Array<{ id: string; name: string }>;
  quota: DriveQuota;
}

export function normalizeDriveName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name === '.' || name === '..' || name.length > DRIVE_NAME_MAX_LENGTH) return null;
  if (/[\\/\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

export function isDrivePreviewableMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith('image/')
    || mimeType.startsWith('video/')
    || mimeType.startsWith('audio/')
    || mimeType === 'application/pdf'
    || mimeType.startsWith('text/');
}
