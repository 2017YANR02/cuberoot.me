import {
  buildVaultBackup, VAULT_BACKUP_FILENAME, VAULT_BACKUP_FORMAT, VAULT_BACKUP_LAYOUT_REVISION, vaultBackupMarker,
  type VaultBackupLocale, type VaultBackupSource,
} from './vault-backup';

interface BackupFileHandle extends FileSystemFileHandle {
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
}

interface BackupDirectoryHandle extends FileSystemDirectoryHandle {
  getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<BackupFileHandle>;
}

interface BackupWindow extends Window {
  showDirectoryPicker?: (options: { mode: 'readwrite'; id: string; startIn: 'documents' }) => Promise<BackupDirectoryHandle>;
  showOpenFilePicker?: (options: { startIn: FileSystemFileHandle }) => Promise<FileSystemFileHandle[]>;
}

export interface VaultDeviceBackup {
  id: string;
  file: BackupFileHandle;
  last?: { savedAt: string; revision: string; modified: number; size: number; format?: number; layoutRevision?: number };
}

export type VaultBackupResult =
  | { status: 'off' | 'legacy' }
  | { status: 'ready' | 'permission' | 'failed'; config: VaultDeviceBackup };

const permissionOptions = { mode: 'readwrite' } as const;
const AUTHORIZATION_TIMEOUT_MS = 15_000;
const PICKER_TIMEOUT_MS = 120_000;
const withDeviceLock = <T>(action: () => Promise<T>) => navigator.locks.request('cuberoot-vault-backup', action);
export const canAutoBackupVault = () => typeof (window as BackupWindow).showDirectoryPicker === 'function'
  && Boolean(navigator.locks && window.indexedDB);
export const canLocateVaultBackup = () => typeof (window as BackupWindow).showOpenFilePicker === 'function';

function waitForBrowser<T>(response: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DOMException('Browser response timed out', 'TimeoutError')), timeoutMs);
  });
  return Promise.race([response, deadline]).finally(() => clearTimeout(timer));
}

export const requestVaultBackupPermission = (config: VaultDeviceBackup) =>
  waitForBrowser(config.file.requestPermission(permissionOptions), AUTHORIZATION_TIMEOUT_MS);

export const pickVaultBackupDirectory = () =>
  waitForBrowser((window as BackupWindow).showDirectoryPicker!({
    ...permissionOptions, id: 'cuberoot-vault-backup', startIn: 'documents',
  }), PICKER_TIMEOUT_MS);

export async function locateVaultBackup(file: FileSystemFileHandle): Promise<void> {
  await waitForBrowser((window as BackupWindow).showOpenFilePicker!({ startIn: file }), PICKER_TIMEOUT_MS);
}

async function deviceStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('cuberoot-vault-backup', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('devices'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('devices', mode);
      const request = action(transaction.objectStore('devices'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export const readVaultDeviceBackup = (userId: number): Promise<VaultDeviceBackup | undefined> =>
  deviceStore('readonly', (store) => store.get(userId));

export const disableVaultDeviceBackup = (userId: number) =>
  withDeviceLock(() => deviceStore('readwrite', (store) => store.delete(userId)));

const storeBackup = (userId: number, config: VaultDeviceBackup) =>
  deviceStore('readwrite', (store) => store.put(config, userId));

type LoadSource = (signal: AbortSignal) => Promise<VaultBackupSource>;
type CheckRevision = (signal: AbortSignal) => Promise<string | null>;

async function writeBackup(
  config: VaultDeviceBackup, load: LoadSource, locale: VaultBackupLocale, signal: AbortSignal, initial: boolean,
  checkRevision?: CheckRevision,
): Promise<VaultDeviceBackup> {
  const current = await config.file.getFile();
  const marker = vaultBackupMarker(config.id);
  // A picker can return an existing file. Never overwrite a different backup or document.
  if (initial ? current.size !== 0 : (await current.slice(0, marker.length).text()) !== marker) {
    throw new DOMException('Unexpected backup file', 'InvalidModificationError');
  }
  signal.throwIfAborted();
  const last = config.last;
  const sameFile = last?.format === VAULT_BACKUP_FORMAT && last.layoutRevision === VAULT_BACKUP_LAYOUT_REVISION
    && last.modified === current.lastModified && last.size === current.size;
  if (sameFile && checkRevision && await checkRevision(signal) === last.revision) return config;
  const source = await load(signal);
  if (sameFile && last.revision === source.revision) return config;
  const items = await source.readItems();
  const savedAt = new Date().toISOString();
  const backup = await buildVaultBackup(config.id, items, savedAt, locale);
  const latest = await config.file.getFile();
  if (latest.lastModified !== current.lastModified || latest.size !== current.size) {
    throw new DOMException('Backup file changed', 'InvalidModificationError');
  }
  signal.throwIfAborted();
  const writable = await config.file.createWritable();
  try {
    await writable.write(backup);
    signal.throwIfAborted();
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
  const written = await config.file.getFile();
  return {
    id: config.id, file: config.file,
    last: {
      savedAt, revision: source.revision, size: written.size, modified: written.lastModified,
      format: VAULT_BACKUP_FORMAT, layoutRevision: VAULT_BACKUP_LAYOUT_REVISION,
    },
  };
}

async function createBackupFile(directory: BackupDirectoryHandle, id: string): Promise<BackupFileHandle> {
  const names = [VAULT_BACKUP_FILENAME, VAULT_BACKUP_FILENAME.replace(/\.html$/, `-${id}.html`)];
  for (const name of names) {
    try {
      await directory.getFileHandle(name);
    } catch (error) {
      if (!(error instanceof DOMException)) throw error;
      if (error.name === 'NotFoundError') return directory.getFileHandle(name, { create: true });
      if (error.name !== 'TypeMismatchError') throw error;
    }
  }
  throw new DOMException('The backup filename is already in use', 'InvalidModificationError');
}

export function enableVaultDeviceBackup(
  userId: number, directory: BackupDirectoryHandle, load: LoadSource, locale: VaultBackupLocale, signal: AbortSignal,
) {
  return withDeviceLock(async () => {
    signal.throwIfAborted();
    const previous = await readVaultDeviceBackup(userId);
    if (previous?.last?.format === VAULT_BACKUP_FORMAT) throw new Error('Backup already enabled');
    const source = await load(signal);
    const items = await source.readItems();
    signal.throwIfAborted();
    const id = crypto.randomUUID();
    const file = await createBackupFile(directory, id);
    const written = await writeBackup({ id, file }, async () => ({
      revision: source.revision, readItems: async () => items,
    }), locale, signal, true);
    await storeBackup(userId, written);
    return written;
  });
}

export function reconnectVaultDeviceBackup(
  userId: number, backupId: string, directory: BackupDirectoryHandle,
  load: LoadSource, locale: VaultBackupLocale, signal: AbortSignal,
) {
  return withDeviceLock(async () => {
    signal.throwIfAborted();
    const current = await readVaultDeviceBackup(userId);
    if (current?.id !== backupId || current.last?.format !== VAULT_BACKUP_FORMAT) {
      throw new DOMException('Backup settings changed', 'InvalidStateError');
    }
    // Open the existing file through the directory so selecting it never truncates it.
    const file = await directory.getFileHandle(current.file.name);
    if (await file.queryPermission(permissionOptions) !== 'granted') {
      throw new DOMException('Backup write access was not granted', 'NotAllowedError');
    }
    const written = await writeBackup({ id: current.id, file }, load, locale, signal, false);
    await storeBackup(userId, written);
    return written;
  });
}

export function syncVaultDeviceBackup(
  userId: number, load: LoadSource, locale: VaultBackupLocale, signal: AbortSignal,
  checkRevision?: CheckRevision,
): Promise<VaultBackupResult> {
  return withDeviceLock(async () => {
    signal.throwIfAborted();
    const config = await readVaultDeviceBackup(userId);
    if (!config) return { status: 'off' };
    // An encrypted destination is never reused for a plaintext backup.
    if (config.last?.format !== VAULT_BACKUP_FORMAT) return { status: 'legacy' };
    try {
      if (await config.file.queryPermission(permissionOptions) !== 'granted') return { status: 'permission', config };
      const written = await writeBackup(config, load, locale, signal, false, checkRevision);
      if (written !== config) await storeBackup(userId, written);
      return { status: 'ready', config: written };
    } catch {
      return { status: 'failed', config };
    }
  });
}
