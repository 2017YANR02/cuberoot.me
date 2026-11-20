import {
  TIMER_BACKUP_KEEP,
  advanceTimerAutoBackupCadence,
  type TimerLocalBackupEntry,
} from '@cuberoot/shared/timer/backup-client';
import { MAX_TIMER_BACKUP_BYTES } from '@cuberoot/shared/timer/persistence';
import { timerSettingFieldContract } from '@cuberoot/shared/timer/settings-contract';
import { getMiniProgramLocale, tr } from './i18n';
import { nativeUserDataPath, type NativeFileEnvironment } from './native-file-path';
import type { NativeTimerStorage } from './native-timer';
import { nativeTimerTextBytes } from './native-timer-text';
import { miniProgramApi } from './platform';

const COUNTER_KEY = 'cuberoot:timer:backup-counter';
const BACKUP_FILE = /^(\d+)-(\d+)\.json$/;
const BACKUP_STORAGE_PREFIX = 'cuberoot:timer:local-backup:';
const BACKUP_STORAGE_KEY = /^cuberoot:timer:local-backup:(\d+)-(\d+)-(\d+)$/;
type BackupFileSystem = Pick<WechatMiniprogram.FileSystemManager,
  'mkdirSync' | 'readdirSync' | 'readFileSync' | 'writeFile' | 'statSync' | 'renameSync' | 'unlinkSync'>;
type BackupApi = Pick<NativeTimerStorage, 'getStorageSync' | 'setStorageSync' | 'getStorageInfoSync'> &
  Partial<Pick<NativeTimerStorage, 'removeStorageSync'>> & NativeFileEnvironment & { getFileSystemManager?(): BackupFileSystem };

function backupFiles(api: BackupApi) {
  const root = nativeUserDataPath(api);
  if (!root || typeof api.getFileSystemManager !== 'function') return;
  try {
    const fs = api.getFileSystemManager();
    const methods = ['mkdirSync', 'readdirSync', 'readFileSync', 'writeFile', 'statSync', 'renameSync', 'unlinkSync'] as const;
    if (methods.every(method => typeof fs?.[method] === 'function')) return { fs, path: `${root}/timer-backups` };
  } catch { /* Some native SDK hosts omit the file-system bridge. */ }
}

function hasBackupStorage(api: BackupApi) {
  return typeof api.getStorageInfoSync === 'function' && typeof api.getStorageSync === 'function'
    && typeof api.setStorageSync === 'function' && typeof api.removeStorageSync === 'function';
}

export function nativeTimerLocalBackupsAvailable(api?: BackupApi): boolean {
  try {
    const native = api ?? miniProgramApi();
    return !!backupFiles(native) || hasBackupStorage(native);
  } catch { return false; }
}

export function nativeTimerLocalBackupControls(disabled: boolean, expanded: boolean, language = getMiniProgramLocale()) {
  const create = timerSettingFieldContract('settings.data.local-backup-create');
  const list = timerSettingFieldContract('settings.data.local-backup-list');
  const restore = timerSettingFieldContract('settings.data.local-backup-restore');
  return {
    heading: tr({ en: 'Local backup', zh: '本机备份' }, language),
    create: { id: create.id, label: tr(create.copy, language), disabled },
    list: { id: list.id, label: tr(expanded ? { en: 'Hide backups', zh: '收起备份' } : list.copy, language), disabled },
    restore: { id: restore.id, label: tr(restore.copy, language), disabled },
    empty: tr({ en: 'No local backups yet', zh: '还没有本机备份' }, language),
    restoreConfirmation: tr({ en: 'Restore this backup and replace all current solves?', zh: '确认用此备份覆盖当前全部成绩？' }, language),
  };
}

/** Store immutable snapshots in the private file directory, or in individually retained native keys. */
export function createNativeTimerLocalBackups(api: BackupApi = miniProgramApi(), now = Date.now) {
  let sequence = 0;
  let writes: Promise<unknown> = Promise.resolve();
  type HistoryEntry = TimerLocalBackupEntry & { sequence: number; storage: boolean };

  function ensureDirectory({ fs, path }: NonNullable<ReturnType<typeof backupFiles>>) {
    try { fs.mkdirSync(path); }
    catch { /* Reads and writes will report a directory that still cannot be accessed. */ }
  }

  function entries(files: ReturnType<typeof backupFiles>): HistoryEntry[] {
    const saved: HistoryEntry[] = [];
    if (files) {
      const { fs, path } = files;
      ensureDirectory(files);
      for (const key of fs.readdirSync(path)) {
        const match = BACKUP_FILE.exec(key);
        if (!match) continue;
        try {
          const stat = fs.statSync(`${path}/${key}`);
          if (!Array.isArray(stat) && stat.isFile()) saved.push({ key, ts: Number(match[1]), sequence: Number(match[2]), size: stat.size, storage: false });
        } catch { /* An entry may have been cleared since the directory read. */ }
      }
    }
    if (hasBackupStorage(api)) {
      for (const key of api.getStorageInfoSync!().keys) {
        const match = BACKUP_STORAGE_KEY.exec(key);
        if (match) saved.push({ key, ts: Number(match[1]), sequence: Number(match[2]), size: Number(match[3]), storage: true });
      }
    }
    return saved.sort((a, b) => b.ts - a.ts || b.sequence - a.sequence);
  }

  async function writeFile({ fs, path }: NonNullable<ReturnType<typeof backupFiles>>, key: string, text: string) {
    const pendingPath = `${path}/${key}.pending`;
    try {
      await new Promise<void>((resolve, reject) => fs.writeFile({
        filePath: pendingPath, data: text, encoding: 'utf8', success: () => resolve(), fail: reject,
      }));
      const stat = fs.statSync(pendingPath);
      if (Array.isArray(stat) || stat.size > MAX_TIMER_BACKUP_BYTES) throw new Error('Timer backup is too large');
      fs.renameSync(pendingPath, `${path}/${key}`);
    } catch (error) {
      try { fs.unlinkSync(pendingPath); } catch { /* There may be no partial file. */ }
      throw error;
    }
  }

  function create(text: string) {
    const task = writes.then(async () => {
      const files = backupFiles(api);
      if (!files && !hasBackupStorage(api)) throw new Error('Timer backup storage unavailable');
      const previous = entries(files);
      const ts = now();
      const used = new Set(previous.filter(entry => entry.ts === ts).map(entry => entry.sequence));
      do { sequence++; } while (used.has(sequence));
      if (files) await writeFile(files, `${ts}-${sequence}.json`, text);
      else {
        const size = nativeTimerTextBytes(text);
        if (size > MAX_TIMER_BACKUP_BYTES) throw new Error('Timer backup is too large');
        const key = `${BACKUP_STORAGE_PREFIX}${ts}-${sequence}-${size}`;
        try { api.setStorageSync(key, text); }
        catch (error) {
          try { api.removeStorageSync?.(key); } catch { /* A failed write may leave no key to remove. */ }
          throw error;
        }
      }
      for (const entry of previous.slice(TIMER_BACKUP_KEEP - 1)) {
        try {
          if (entry.storage) api.removeStorageSync?.(entry.key);
          else files?.fs.unlinkSync(`${files.path}/${entry.key}`);
        }
        catch { /* A retained older snapshot does not invalidate this backup. */ }
      }
    });
    writes = task.catch(() => undefined);
    return task;
  }

  return {
    create,
    async list() {
      await writes;
      const files = backupFiles(api);
      if (!files && !hasBackupStorage(api)) throw new Error('Timer backup storage unavailable');
      return entries(files).slice(0, TIMER_BACKUP_KEEP).map(({ key, ts, size }) => ({ key, ts, size }));
    },
    async read(key: string) {
      const inStorage = BACKUP_STORAGE_KEY.test(key);
      if (!inStorage && !BACKUP_FILE.test(key)) return;
      await writes;
      try {
        if (inStorage) {
          const text = api.getStorageSync(key);
          return typeof text === 'string' && nativeTimerTextBytes(text) <= MAX_TIMER_BACKUP_BYTES ? text : undefined;
        }
        const files = backupFiles(api);
        if (!files) return;
        const { fs, path } = files;
        const file = `${path}/${key}`;
        const stat = fs.statSync(file);
        if (Array.isArray(stat) || stat.size > MAX_TIMER_BACKUP_BYTES) return;
        const text = fs.readFileSync(file, 'utf8');
        return typeof text === 'string' ? text : undefined;
      } catch { return; }
    },
    onPersistedSolves(addedSolves: number, every: number, snapshot: () => string) {
      if (addedSolves <= 0) return;
      try {
        const keys = api.getStorageInfoSync?.().keys;
        const previous = keys && !keys.includes(COUNTER_KEY) ? undefined : api.getStorageSync(COUNTER_KEY);
        const cadence = advanceTimerAutoBackupCadence(previous, addedSolves, every);
        api.setStorageSync(COUNTER_KEY, cadence.next);
        if (cadence.due) void create(snapshot()).catch(() => undefined);
      } catch { /* An automatic backup failure must not undo the saved solve. */ }
    },
  };
}
