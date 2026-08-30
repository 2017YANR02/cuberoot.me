import { promises as fs } from 'node:fs';
import path from 'node:path';

export const DRIVE_STORAGE_ROOT = process.env.DRIVE_STORAGE_DIR || path.join(process.cwd(), '.drive-storage');
export const DRIVE_UPLOAD_DIR = path.join(DRIVE_STORAGE_ROOT, 'uploads');

const DRIVE_FILE_DIR = path.join(DRIVE_STORAGE_ROOT, 'files');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function drivePartPath(uploadId: string): string {
  return path.join(DRIVE_UPLOAD_DIR, `${uploadId}.part`);
}

export function driveStorageKey(nodeId: string): string {
  return `${nodeId.slice(0, 2)}/${nodeId}`;
}

export function driveStoredPath(storageKey: string): string {
  const [prefix, nodeId, extra] = storageKey.replace(/\\/g, '/').split('/');
  if (extra !== undefined || !nodeId || !UUID_PATTERN.test(nodeId) || prefix !== nodeId.slice(0, 2)) {
    throw new Error('invalid Drive storage key');
  }
  return path.join(DRIVE_FILE_DIR, prefix, nodeId);
}

export async function safeRemoveDriveFile(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') console.error(`[drive] failed to remove ${filePath}: ${error.message}`);
  });
}

export async function removeDriveAccountFiles(
  storageKeys: readonly string[],
  uploads: readonly { id: string; nodeId: string }[],
): Promise<void> {
  await Promise.all([
    ...storageKeys.map((key) => safeRemoveDriveFile(driveStoredPath(key))),
    ...uploads.flatMap((upload) => [
      safeRemoveDriveFile(drivePartPath(upload.id)),
      safeRemoveDriveFile(driveStoredPath(driveStorageKey(upload.nodeId))),
    ]),
  ]);
}
