import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';
import {
  buildVaultBackup, VAULT_BACKUP_FILENAME, VAULT_BACKUP_FORMAT, vaultBackupLabels, vaultBackupMarker,
  type VaultBackupItem, type VaultBackupLocale,
} from '@/lib/vault-backup';
import {
  disableVaultDeviceBackup, enableVaultDeviceBackup, locateVaultBackup, readVaultDeviceBackup, reconnectVaultDeviceBackup,
  requestVaultBackupPermission, syncVaultDeviceBackup,
  type VaultDeviceBackup,
} from '@/lib/vault-backup-device';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, options: { url: string; runScripts: 'outside-only' }) => { window: Window & typeof globalThis };
};

const savedAt = '2026-11-20T20:00:00.000Z';
const locale: VaultBackupLocale = {
  lang: 'en',
  labels: Object.fromEntries(Object.entries(vaultBackupLabels).map(([key, label]) => [key, label.en])) as VaultBackupLocale['labels'],
};
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCXUAAAAASUVORK5CYII=';
const item: VaultBackupItem = {
  entry: {
    id: 'fixture',
    title: 'Offline test account',
    fields: [
      { id: 'email', label: 'Email', value: 'offline-test@example.invalid', secret: false },
      { id: 'primary-password', label: 'Password', value: 'primary-password-fixture', secret: true },
    ],
    notes: '<img src=x onerror=alert(1)>',
    privateNotes: 'Private test note',
    accounts: [{
      id: 'other', name: 'Second account', notes: 'Second account note',
      fields: [{ id: 'password', label: 'Password', value: 'secret-password-fixture', secret: true }],
    }],
    images: [{ id: 'photo', name: 'test.png', dataUrl: image }],
  },
  trashedAt: savedAt,
};

afterEach(() => vi.unstubAllGlobals());

it('opens as searchable plaintext offline and renders saved values as text', async () => {
  const info: VaultBackupItem = {
    entry: { id: 'info', category: 'personal', title: 'Personal info', fields: [], notes: 'A separate note' },
  };
  const backup = await buildVaultBackup('fixture', [item, info], savedAt, locale);
  const html = await backup.text();
  expect(html.startsWith(vaultBackupMarker('fixture'))).toBe(true);
  expect(html).toContain('secret-password-fixture');
  const dom = new JSDOM(html, { url: 'file:///vault-test.html', runScripts: 'outside-only' });
  const { window } = dom;
  const { document } = window;
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const script = document.querySelector('script:not([type])')!.textContent!;
  const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content');
  expect(policy).toContain("default-src 'none'");
  expect(policy).toContain(`script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'`);
  try {
    expect(document.querySelector('form, input[type="password"]')).toBe(null);
    expect(get('items').textContent).toContain('secret-password-fixture');
    expect(get('items').textContent).toContain(item.entry.notes);
    expect(get('items').textContent).toContain(item.entry.privateNotes);
    const accounts = document.querySelectorAll('.backup-account');
    expect(accounts).toHaveLength(2);
    expect(accounts[0].textContent).toContain('offline-test@example.invalid');
    expect(accounts[0].textContent).toContain('primary-password-fixture');
    expect(accounts[0].textContent).toContain('Private test note');
    expect(accounts[1].textContent).toContain('secret-password-fixture');
    expect(accounts[1].textContent).toContain('Second account note');
    expect(document.querySelector('[data-entry-id="info"] .backup-account')).toBe(null);
    expect(document.querySelector('[data-entry-id="info"]')?.textContent).toContain('A separate note');
    expect(document.querySelectorAll('img')).toHaveLength(1);
    expect(document.querySelector('img')?.getAttribute('src')).toBe(image);
    expect(document.querySelector('summary')?.textContent).toContain('Trash');
    window.eval(script);
    const search = get<HTMLInputElement>('search');
    search.value = 'offline-test@example.invalid';
    search.dispatchEvent(new window.Event('input'));
    expect(get('empty').hidden).toBe(true);
    search.value = 'no matches';
    search.dispatchEvent(new window.Event('input'));
    expect(get('empty').hidden).toBe(false);
  } finally { window.close(); }
});

class MemoryBackupFile {
  readonly name: string;
  permission: PermissionState = 'granted';
  content: File;
  failWrite = false;
  aborts = 0;
  constructor(name = 'backup.html') {
    this.name = name;
    this.content = new File([], name);
  }
  async getFile() { return this.content; }
  async queryPermission() { return this.permission; }
  async requestPermission() { return this.permission; }
  async createWritable() {
    let staged: Blob | undefined;
    return {
      write: async (value: Blob) => {
        staged = value;
        if (this.failWrite) throw new Error('Disk full');
      },
      close: async () => { this.content = new File([staged!], this.name); },
      abort: async () => { this.aborts += 1; },
    };
  }
}

it('opens the file picker beside the saved backup without using the selection', async () => {
  const file = new MemoryBackupFile() as unknown as VaultDeviceBackup['file'];
  const showOpenFilePicker = vi.fn(async () => [file]);
  vi.stubGlobal('window', { showOpenFilePicker });
  await expect(locateVaultBackup(file)).resolves.toBeUndefined();
  expect(showOpenFilePicker).toHaveBeenCalledWith({ startIn: file });
});

it('times out an unanswered browser permission prompt and allows a later request to succeed', async () => {
  vi.useFakeTimers();
  try {
    const file = new MemoryBackupFile();
    const config = { id: 'device', file: file as unknown as VaultDeviceBackup['file'] };
    const request = vi.spyOn(file, 'requestPermission').mockImplementationOnce(() => new Promise(() => {}));
    const timedOut = expect(requestVaultBackupPermission(config)).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(15_000);
    await timedOut;
    await expect(requestVaultBackupPermission(config)).resolves.toBe('granted');
    expect(request).toHaveBeenCalledTimes(2);
  } finally { vi.useRealTimers(); }
});

it('requires a new folder choice for plaintext and preserves the old and unrelated files', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => run() } });
  const originalClone = structuredClone;
  vi.stubGlobal('structuredClone', (value: unknown) => {
    const config = value as { file?: MemoryBackupFile } | null;
    if (!(config?.file instanceof MemoryBackupFile)) return originalClone(value);
    // Fake IndexedDB cannot serialize a native file handle. Keep our mock handle by reference.
    const { file, ...fields } = config;
    return { ...originalClone(fields), file };
  });
  const signal = new AbortController().signal;
  const source = (revision: string) => async () => ({ revision, readItems: async () => [item] });
  const load = source('first');

  const oldHandle = new MemoryBackupFile('cuberoot-vault-backup.html');
  oldHandle.content = new File(['<!doctype html><!-- CubeRoot Vault backup v1 device -->', '<title>Encrypted backup</title>'], oldHandle.name);
  const oldFile = oldHandle.content;
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('cuberoot-vault-backup', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('devices'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('devices', 'readwrite');
      transaction.objectStore('devices').put({
        id: 'device', file: oldHandle,
        last: { savedAt, revision: 'first', modified: oldFile.lastModified, size: oldFile.size, format: 2 },
      }, 1);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
  const loadSnapshot = vi.fn(load);
  expect((await syncVaultDeviceBackup(1, loadSnapshot, locale, signal)).status).toBe('legacy');
  expect(loadSnapshot).not.toHaveBeenCalled();
  expect(oldHandle.content).toBe(oldFile);

  const unrelated = new MemoryBackupFile(VAULT_BACKUP_FILENAME);
  unrelated.content = new File(['unrelated document'], unrelated.name);
  const folderFiles = new Map([[unrelated.name, unrelated], [oldHandle.name, oldHandle]]);
  const chooseFolder = {
    async getFileHandle(name: string, options?: { create?: boolean }) {
      const existing = folderFiles.get(name);
      if (existing) return existing;
      if (!options?.create) throw new DOMException('Missing file', 'NotFoundError');
      const file = new MemoryBackupFile(name);
      folderFiles.set(name, file);
      return file;
    },
  } as unknown as Parameters<typeof enableVaultDeviceBackup>[1];
  const config = await enableVaultDeviceBackup(1, chooseFolder, load, locale, signal);
  const file = folderFiles.get(config.file.name)!;
  expect(file.name).not.toBe(unrelated.name);
  expect(config.last?.format).toBe(VAULT_BACKUP_FORMAT);
  expect(await file.content.text()).toContain('secret-password-fixture');
  expect(await unrelated.content.text()).toBe('unrelated document');
  expect(oldHandle.content).toBe(oldFile);
  expect(await readVaultDeviceBackup(2)).toBeUndefined();
  expect((await syncVaultDeviceBackup(1, loadSnapshot, locale, signal, async () => 'first')).status).toBe('ready');
  expect(loadSnapshot).not.toHaveBeenCalled();
  expect((await syncVaultDeviceBackup(1, loadSnapshot, locale, signal, async () => null)).status).toBe('ready');
  expect(loadSnapshot).toHaveBeenCalledOnce();

  const original = file.content;
  expect((await syncVaultDeviceBackup(1, async () => ({
    revision: 'second', readItems: async () => { throw new Error('Undecryptable cloud entry'); },
  }), locale, signal)).status).toBe('failed');
  file.permission = 'prompt';
  expect((await syncVaultDeviceBackup(1, source('second'), locale, signal)).status).toBe('permission');
  file.permission = 'granted';
  file.failWrite = true;
  expect((await syncVaultDeviceBackup(1, source('second'), locale, signal)).status).toBe('failed');
  expect(file.aborts).toBe(1);
  expect(file.content).toBe(original);
  file.failWrite = false;
  expect((await syncVaultDeviceBackup(1, source('second'), locale, signal, async () => 'second')).status).toBe('ready');
  expect(file.content).not.toBe(original);
  const updated = file.content;
  file.permission = 'prompt';
  const selectedFile = new MemoryBackupFile(file.name);
  const getFileHandle = vi.fn(async () => selectedFile);
  const directory = { getFileHandle } as unknown as Parameters<typeof reconnectVaultDeviceBackup>[2];
  selectedFile.content = new File(['unrelated document'], file.name);
  await expect(reconnectVaultDeviceBackup(1, config.id, directory, source('third'), locale, signal))
    .rejects.toMatchObject({ name: 'InvalidModificationError' });
  expect(await selectedFile.content.text()).toBe('unrelated document');
  expect((await readVaultDeviceBackup(1))?.file).toBe(file);
  selectedFile.content = updated;
  await reconnectVaultDeviceBackup(1, config.id, directory, source('third'), locale, signal);
  expect(getFileHandle).toHaveBeenLastCalledWith(file.name);
  expect((await readVaultDeviceBackup(1))?.file).toBe(selectedFile);
  expect(selectedFile.content).not.toBe(updated);
  expect(file.content).toBe(updated);
  await disableVaultDeviceBackup(1);
  expect((await syncVaultDeviceBackup(1, source('third'), locale, signal)).status).toBe('off');
  expect(file.content).toBe(updated);
});
