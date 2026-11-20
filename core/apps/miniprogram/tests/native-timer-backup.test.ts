import { expect, it, vi } from 'vitest';
import { TIMER_BACKUP_KEEP } from '@cuberoot/shared/timer/backup-client';
import { createTimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import { createNativeTimerLocalBackups, nativeTimerLocalBackupControls, nativeTimerLocalBackupsAvailable } from '../src/lib/native-timer-backup';
import { nativeTimerSettingPatch, nativeTimerSettingsModel } from '../src/lib/native-timer-settings';

function fixture() {
  const data = new Map<string, unknown>();
  const files = new Map<string, string>();
  let failWrites = false;
  const fs = {
    mkdirSync: vi.fn(),
    readdirSync: (directory: string) => [...files.keys()].map(path => path.slice(directory.length + 1)),
    statSync(file: string) {
      if (!files.has(file)) throw new Error('Missing file');
      return { isFile: () => true, size: new TextEncoder().encode(files.get(file)).length } as WechatMiniprogram.Stats;
    },
    readFileSync: (file: string) => files.get(file) ?? '',
    writeFile({ filePath, data: text, fail, success }: WechatMiniprogram.WriteFileOption) {
      files.set(filePath, text as string);
      if (failWrites) fail?.({ errCode: 107003, errMsg: 'quota exceeded' });
      else success?.({ errCode: 0, errMsg: 'writeFile:ok' });
    },
    renameSync(oldFile: string, newFile: string) {
      if (!files.has(oldFile)) throw new Error('Missing source file');
      files.set(newFile, files.get(oldFile)!);
      files.delete(oldFile);
    },
    unlinkSync: (file: string) => { files.delete(file); },
  };
  return {
    api: {
      env: { USER_DATA_PATH: 'ttfile://user' },
      getEnvInfoSync() { throw new Error('Legacy API bridge'); },
      getFileSystemManager: () => fs,
      getStorageSync: (key: string) => data.get(key),
      setStorageSync: (key: string, value: unknown) => { data.set(key, value); },
    },
    files,
    failWrites: () => { failWrites = true; },
  };
}

it('keeps the newest snapshots, measures native UTF-8, and never opens an unrelated path', async () => {
  const { api, files } = fixture();
  const backups = createNativeTimerLocalBackups(api, () => 100);
  for (let index = 0; index <= TIMER_BACKUP_KEEP; index++) await backups.create(`成绩 ${index}`);
  const entries = await backups.list();
  expect(files.size).toBe(TIMER_BACKUP_KEEP);
  expect(entries).toHaveLength(TIMER_BACKUP_KEEP);
  expect(entries[0]).toMatchObject({ ts: 100, size: 9 });
  await expect(backups.read(entries[0]!.key)).resolves.toBe('成绩 10');
  await expect(backups.read('../other.json')).resolves.toBeUndefined();
});

it('uses the shared cadence across cold starts and does not produce a snapshot at frequency zero', async () => {
  const { api } = fixture();
  const snapshot = vi.fn(() => 'data');
  const beforeRestart = createNativeTimerLocalBackups(api, () => 100);
  beforeRestart.onPersistedSolves(1, 2, snapshot);
  expect(snapshot).not.toHaveBeenCalled();
  const afterRestart = createNativeTimerLocalBackups(api, () => 200);
  afterRestart.onPersistedSolves(1, 2, snapshot);
  afterRestart.onPersistedSolves(3, 0, snapshot);
  afterRestart.onPersistedSolves(0, 2, snapshot);
  expect(snapshot).toHaveBeenCalledOnce();
  await expect(afterRestart.list()).resolves.toEqual([{ key: '200-1.json', ts: 200, size: 4 }]);
  afterRestart.onPersistedSolves(1, 2, () => 'next');
  const entries = await afterRestart.list();
  expect(entries).toHaveLength(2);
  await expect(afterRestart.read(entries[0]!.key)).resolves.toBe('next');
});

it('preserves older backups when writing a new snapshot fails mid-file', async () => {
  const { api, files, failWrites } = fixture();
  const backups = createNativeTimerLocalBackups(api, () => 100);
  await backups.create('older');
  const entries = await backups.list();
  failWrites();
  await expect(backups.create('partial')).rejects.toMatchObject({ errCode: 107003 });
  await expect(backups.list()).resolves.toEqual(entries);
  expect([...files.values()]).toEqual(['older']);
});

it('uses a guarded key-value fallback and retains those snapshots when file storage becomes available', async () => {
  const { api: nativeFiles } = fixture();
  const data = new Map<string, unknown>([['cuberoot:timer', 'main database']]);
  let shouldFail = false;
  const api = {
    getStorageSync: (key: string) => data.get(key),
    getStorageInfoSync: () => ({ keys: [...data.keys()] }),
    setStorageSync(key: string, value: unknown) {
      data.set(key, value);
      if (shouldFail) throw new Error('Storage quota');
    },
    removeStorageSync: (key: string) => { data.delete(key); },
  };
  expect(nativeTimerLocalBackupsAvailable(api)).toBe(true);
  expect(nativeTimerLocalBackupsAvailable({ ...api, removeStorageSync: undefined })).toBe(false);
  const local = createNativeTimerLocalBackups(api, () => 100);
  await local.create('成绩');
  const [entry] = await local.list();
  expect(entry?.size).toBe(6);
  shouldFail = true;
  await expect(local.create('partial')).rejects.toThrow('Storage quota');
  expect(data.get('cuberoot:timer')).toBe('main database');
  expect(data.size).toBe(2);
  const next = createNativeTimerLocalBackups({ ...nativeFiles, ...api }, () => 200);
  await next.create('file');
  expect((await next.list()).map(item => item.ts)).toEqual([200, 100]);
  await expect(next.read(entry!.key)).resolves.toBe('成绩');
});

it('only exposes the frequency preference when the platform can actually back up solves', () => {
  const timer = { event: '333' as const, currentSource: 'wca' as const, busy: false, solves: [], settings: createTimerStoreSettings() };
  expect(nativeTimerSettingsModel(timer).rows.find(row => row.key === 'autoBackupEvery')).toBeUndefined();
  expect(nativeTimerSettingsModel(timer, { backupAvailable: true }, 'en').rows.find(row => row.key === 'autoBackupEvery'))
    .toMatchObject({ label: 'Back up every N solves', min: 0, max: 30, value: 10 });
  expect(nativeTimerSettingPatch(timer, 'data', 'autoBackupEvery', '99', { backupAvailable: true })).toEqual({ autoBackupEvery: 30 });
  expect(nativeTimerSettingPatch(timer, 'data', 'autoBackupEvery', '0')).toBeUndefined();
  expect(nativeTimerLocalBackupControls(false, true, 'zh').list.label).toBe('收起备份');
});
