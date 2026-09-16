import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';

vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdminOrApiKey: vi.fn() }));
vi.mock('node:fs/promises', () => ({ lstat: vi.fn(), realpath: vi.fn(), opendir: vi.fn(), statfs: vi.fn(), readFile: vi.fn(), mkdir: vi.fn(), writeFile: vi.fn(), rename: vi.fn() }));
import { lstat, realpath, opendir, statfs, readFile, writeFile, rename } from 'node:fs/promises';
import { requireAdminOrApiKey } from '../src/utils/recon_helpers.js';
import { DiskScanner, scanDiskDirectory, validateDiskPath, resolveDiskPath, diskScanner } from '../src/observability/disk.js';
import { adminDiskRoutes } from '../src/routes/admin_disk.js';

function meta(ino: number, blocks: number, kind = 'file', dev = 1, nlink = 1) {
  return { ino, blocks, dev, nlink, isDirectory: () => kind === 'dir', isSymbolicLink: () => kind === 'link' };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
  vi.mocked(realpath).mockImplementation(async path => String(path));
  vi.mocked(lstat).mockResolvedValue(meta(1, 8, 'dir') as never);
  vi.mocked(statfs).mockResolvedValue({ blocks: 100, bfree: 30, bavail: 25, bsize: 4096 } as never);
});
afterEach(() => vi.restoreAllMocks());

describe('disk directory boundaries and allocation', () => {
  it.each(['', '.', 'root', '//root', '/root/../etc', '/root/', '/proc', '/proc/1', '/sys', '/dev', '/run/a', '/a\n', '/a\\b'])('rejects %j', path => {
    expect(() => validateDiskPath(path)).toThrow();
  });
  it('accepts literal shell punctuation as a path, without executing it', () => {
    expect(validateDiskPath('/root/a;$(test)')).toBe('/root/a;$(test)');
  });
  it('rejects symlink aliases and other filesystems', async () => {
    vi.mocked(realpath).mockResolvedValue('/elsewhere');
    await expect(resolveDiskPath('/root/alias')).rejects.toThrow();
    vi.mocked(realpath).mockResolvedValue('/mnt');
    vi.mocked(lstat).mockImplementation(async path => meta(1, 8, 'dir', path === '/' ? 1 : 2) as never);
    await expect(resolveDiskPath('/mnt')).rejects.toThrow();
  });
  it('counts allocated blocks once per hard link and skips symlink traversal and mount contents', async () => {
    const tree: Record<string, ReturnType<typeof meta>> = {
      '/': meta(1, 8, 'dir'), '/data': meta(2, 8, 'dir'), '/data/a': meta(3, 16, 'dir'),
      '/data/a/file': meta(4, 24, 'file', 1, 2), '/data/a/hardlink': meta(4, 24, 'file', 1, 2),
      '/data/link': meta(5, 0, 'link'), '/data/mount': meta(6, 8, 'dir', 2), '/data/file': meta(7, 32),
    };
    vi.mocked(lstat).mockImplementation(async path => tree[String(path)] as never);
    vi.mocked(opendir).mockImplementation(async path => ({
      async *[Symbol.asyncIterator]() {
        for (const [key, value] of Object.entries(tree)) {
          if (key.slice(0, key.lastIndexOf('/')) === path) yield { name: key.slice(key.lastIndexOf('/') + 1), isDirectory: value.isDirectory };
        }
      },
    }) as never);
    const progress = vi.fn();
    const result = await scanDiskDirectory('/data', progress);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ entries: 1, bytes: 4096, currentPath: '/data' }));
    expect(result.bytes).toBe(40960);
    expect(result.children).toEqual([{ path: '/data/a', bytes: 20480 }]);
    expect(result.ownBytes).toBe(20480);
    expect(result.partial).toBe(false);
    expect(vi.mocked(opendir).mock.calls.map(call => call[0])).toEqual(['/data', '/data/a']);
  });
  it('reports unreadable directories as incomplete', async () => {
    vi.mocked(opendir).mockRejectedValue(new Error('permission denied'));
    expect((await scanDiskDirectory('/data')).partial).toBe(true);
  });
});

describe('disk scan scheduling', () => {
  it('shares one scan globally, serves cache and enforces refresh cooldown', async () => {
    let time = 1000;
    let complete!: (value: Awaited<ReturnType<typeof scanDiskDirectory>>) => void;
    const scan = vi.fn(() => new Promise<Awaited<ReturnType<typeof scanDiskDirectory>>>(resolve => { complete = resolve; }));
    const scanner = new DiskScanner(scan, () => time);
    expect(scanner.read('/').scanning).toBe(false);
    expect(scan).not.toHaveBeenCalled();
    expect(scanner.read('/', true).scanning).toBe(true);
    expect(scanner.read('/').scanning).toBe(true);
    expect(scanner.read('/var', true).busy).toBe(true);
    expect(scan).toHaveBeenCalledTimes(1);
    const snapshot = { path: '/', bytes: 4096, children: [], ownBytes: 4096, omittedBytes: 0, omittedCount: 0, partial: false, scannedAt: new Date().toISOString() };
    complete(snapshot);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(scanner.read('/', true).snapshot).toEqual(snapshot);
    expect(scan).toHaveBeenCalledTimes(1);
    time += 24 * 60 * 60_000;
    expect(scanner.read('/').snapshot).toEqual(snapshot);
    expect(scan).toHaveBeenCalledTimes(1);
    expect(scanner.read('/', true).scanning).toBe(true);
    expect(scan).toHaveBeenCalledTimes(2);
  });
  it('preserves failure without a retry loop and releases the scan slot', async () => {
    const scanner = new DiskScanner(vi.fn().mockRejectedValue(new Error('failed')));
    scanner.read('/', true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(scanner.read('/')).toMatchObject({ scanning: false, error: true });
    expect(scanner.read('/var').scanning).toBe(false);
    expect(scanner.read('/var', true).scanning).toBe(true);
  });

  it('saves completed results atomically and loads them after restart without scanning', async () => {
    const snapshot = { path: '/', bytes: 4096, children: [], ownBytes: 4096, omittedBytes: 0, omittedCount: 0, partial: false, scannedAt: new Date().toISOString() };
    const scanner = new DiskScanner(vi.fn().mockResolvedValue(snapshot), Date.now, '/state/disk.json');
    scanner.read('/', true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('/state/disk.json.'), JSON.stringify([snapshot]), { mode: 0o600 });
    expect(rename).toHaveBeenCalledWith(expect.any(String), '/state/disk.json');
    vi.mocked(readFile).mockResolvedValue(JSON.stringify([snapshot]));
    const scan = vi.fn();
    const restarted = new DiskScanner(scan, Date.now, '/state/disk.json');
    await restarted.load();
    expect(restarted.read('/')).toMatchObject({ snapshot, scanning: false });
    expect(scan).not.toHaveBeenCalled();
  });

  it('keeps completed results available when saving fails', async () => {
    vi.mocked(writeFile).mockRejectedValue(new Error('disk full'));
    const snapshot = { path: '/', bytes: 4096, children: [], ownBytes: 4096, omittedBytes: 0, omittedCount: 0, partial: false, scannedAt: new Date().toISOString() };
    const scanner = new DiskScanner(vi.fn().mockResolvedValue(snapshot), Date.now, '/state/disk.json');
    scanner.read('/', true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(scanner.read('/')).toMatchObject({ snapshot, scanning: false, error: false, saveError: true });
  });

  it('exposes live progress while preserving an older result', async () => {
    const snapshot = { path: '/', bytes: 4096, children: [], ownBytes: 4096, omittedBytes: 0, omittedCount: 0, partial: false, scannedAt: new Date().toISOString() };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify([snapshot]));
    const progress = { entries: 100, bytes: 10240, currentPath: '/var', startedAt: snapshot.scannedAt, updatedAt: snapshot.scannedAt };
    const scanner = new DiskScanner((_path, report) => { report!(progress); return new Promise(() => {}); }, Date.now, '/state/disk.json');
    await scanner.load();
    expect(scanner.read('/', true)).toMatchObject({ snapshot, scanning: true, progress });
  });
});

describe('admin disk endpoint', () => {
  it.each([401, 403] as const)('denies access before reading the filesystem (%s)', async status => {
    vi.mocked(requireAdminOrApiKey).mockRejectedValue(new HTTPException(status));
    const response = await adminDiskRoutes.request('/admin/disk');
    expect(response.status).toBe(status);
    expect(lstat).not.toHaveBeenCalled();
    expect(statfs).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('returns capacity accounting and cached status without HTTP caching', async () => {
    vi.spyOn(diskScanner, 'read').mockReturnValue({ snapshot: null, scanning: true, busy: false, error: false, saveError: false, progress: null, refreshAfter: null });
    const response = await adminDiskRoutes.request('/admin/disk?path=/var&refresh=1');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ capacity: { totalBytes: 409600, usedBytes: 286720, availableBytes: 102400, reservedBytes: 20480 }, scanning: true });
    expect(diskScanner.read).toHaveBeenCalledWith('/var', true);
  });
  it('rejects invalid directories and refresh arguments', async () => {
    expect((await adminDiskRoutes.request('/admin/disk?path=/proc')).status).toBe(400);
    expect((await adminDiskRoutes.request('/admin/disk?refresh=yes')).status).toBe(400);
    expect(statfs).not.toHaveBeenCalled();
  });
});
