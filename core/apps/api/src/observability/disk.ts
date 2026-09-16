import { lstat, opendir, realpath, statfs, readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { posix } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

const COOLDOWN_MS = 60_000;
const BLOCKED = ['/proc', '/sys', '/dev', '/run'];

export interface DirectorySnapshot {
  path: string;
  bytes: number;
  children: { path: string; bytes: number }[];
  ownBytes: number;
  omittedBytes: number;
  omittedCount: number;
  partial: boolean;
  scannedAt: string;
}

export interface DiskProgress {
  entries: number;
  bytes: number;
  currentPath: string;
  startedAt: string;
  updatedAt: string;
}

export function validateDiskPath(path: string): string {
  if (!path.startsWith('/') || path.length > 1024 || /[\x00-\x1f\x7f\\]/.test(path)
    || posix.normalize(path) !== path || (path !== '/' && path.endsWith('/'))
    || BLOCKED.some(root => path === root || path.startsWith(`${root}/`))) {
    throw new Error('Invalid directory');
  }
  return path;
}

export async function resolveDiskPath(path: string): Promise<string> {
  validateDiskPath(path);
  const [canonical, info, root] = await Promise.all([realpath(path), lstat(path), lstat('/')]);
  if (canonical !== path || !info.isDirectory() || info.dev !== root.dev) throw new Error('Invalid directory');
  return path;
}

// Serial metadata reads only: never open file contents or dereference symlinks.
// Bound work, open directory handles, hard-link bookkeeping and response size.
export async function scanDiskDirectory(path: string, onProgress: (progress: DiskProgress) => void = () => {}): Promise<DirectorySnapshot> {
  if (process.platform !== 'linux') throw new Error('Disk scanning requires Linux');
  await resolveDiskPath(path);
  const root = await lstat(path);
  const deadline = Date.now() + 120_000;
  const seen = new Set<number>();
  let count = 0;
  let allocated = 0;
  const startedAt = new Date().toISOString();
  let lastProgress = 0;
  let partial = false;
  let exhausted = false;
  const children: DirectorySnapshot['children'] = [];

  async function visit(directory: string, depth: number): Promise<number> {
    if (Date.now() >= deadline || count >= 1_000_000 || depth > 64) {
      partial = true;
      if (depth <= 64) exhausted = true;
      return 0;
    }
    try {
      const info = await lstat(directory);
      if (info.dev !== root.dev) return 0;
      if (info.nlink > 1 && !info.isDirectory()) {
        if (seen.has(info.ino)) return 0;
        seen.add(info.ino);
      }
      let bytes = info.blocks * 512;
      count++;
      allocated += bytes;
      if (Date.now() - lastProgress >= 250) {
        lastProgress = Date.now();
        onProgress({ entries: count, bytes: allocated, currentPath: info.isDirectory() ? directory : posix.dirname(directory), startedAt, updatedAt: new Date().toISOString() });
      }
      if (count % 256 === 0) await pause(8);
      if (!info.isDirectory() || info.isSymbolicLink()) return bytes;
      const entries = await opendir(directory);
      for await (const entry of entries) {
        if (exhausted) break;
        const childPath = posix.join(directory, entry.name);
        if (BLOCKED.includes(childPath)) continue;
        const childBytes = await visit(childPath, depth + 1);
        bytes += childBytes;
        if (depth === 0 && entry.isDirectory()) {
          // Non-root mounts have zero attributed bytes and cannot be explored.
          if (childBytes > 0) children.push({ path: childPath, bytes: childBytes });
        }
      }
      return bytes;
    } catch {
      partial = true;
      return 0;
    }
  }
  const bytes = await visit(path, 0);
  children.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
  return {
    path, bytes, children: children.slice(0, 200),
    ownBytes: Math.max(0, bytes - children.reduce((sum, row) => sum + row.bytes, 0)),
    omittedBytes: children.slice(200).reduce((sum, row) => sum + row.bytes, 0),
    omittedCount: Math.max(0, children.length - 200), partial,
    scannedAt: new Date().toISOString(),
  };
}

export async function diskCapacity() {
  const disk = await statfs('/');
  return {
    totalBytes: disk.blocks * disk.bsize,
    usedBytes: (disk.blocks - disk.bfree) * disk.bsize,
    availableBytes: disk.bavail * disk.bsize,
    reservedBytes: Math.max(0, disk.bfree - disk.bavail) * disk.bsize,
    measuredAt: new Date().toISOString(),
  };
}

type ScanEntry = { snapshot: DirectorySnapshot | null; error: boolean; startedAt: number; progress: DiskProgress | null; saveError: boolean };

export class DiskScanner {
  private entries = new Map<string, ScanEntry>();
  private active: string | null = null;
  private loaded: Promise<void> | undefined;
  constructor(private scan = scanDiskDirectory, private now = Date.now, private cacheFile?: string) {}

  load(): Promise<void> {
    return this.loaded ??= this.loadSaved();
  }

  private async loadSaved() {
    if (!this.cacheFile) return;
    try {
      const snapshots: DirectorySnapshot[] = JSON.parse(await readFile(this.cacheFile, 'utf8'));
      if (!Array.isArray(snapshots) || snapshots.length > 64) return;
      for (const snapshot of snapshots) {
        validateDiskPath(snapshot.path);
        if (!Number.isFinite(snapshot.bytes) || snapshot.bytes < 0 || !Array.isArray(snapshot.children)
          || snapshot.children.length > 200 || !Number.isFinite(Date.parse(snapshot.scannedAt))) continue;
        this.entries.set(snapshot.path, { snapshot, error: false, startedAt: 0, progress: null, saveError: false });
      }
    } catch { /* Missing or damaged saved results never trigger a scan. */ }
  }

  private async save() {
    if (!this.cacheFile) return;
    await mkdir(posix.dirname(this.cacheFile), { recursive: true, mode: 0o700 });
    const snapshots = [...this.entries.values()].flatMap(entry => entry.snapshot ? [entry.snapshot] : []);
    const temporary = `${this.cacheFile}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(snapshots), { mode: 0o600 });
    await rename(temporary, this.cacheFile);
  }

  read(path: string, refresh = false) {
    const now = this.now();
    let entry = this.entries.get(path);
    const due = refresh;
    if (due && this.active === null && (!entry || now - entry.startedAt >= COOLDOWN_MS)) {
      if (!entry && this.entries.size >= 64) this.entries.delete(this.entries.keys().next().value!);
      entry = { snapshot: entry?.snapshot ?? null, error: false, startedAt: now, saveError: false,
        progress: { entries: 0, bytes: 0, currentPath: path, startedAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() } };
      this.entries.set(path, entry);
      this.active = path;
      const target = entry;
      void this.scan(path, progress => { target.progress = progress; }).then(async snapshot => {
        target.snapshot = snapshot;
        try { await this.save(); } catch { target.saveError = true; }
      })
        .catch(() => { target.error = true; })
        .finally(() => { this.active = null; });
    }
    return {
      snapshot: entry?.snapshot ?? null,
      scanning: this.active === path,
      busy: due && this.active !== null && this.active !== path,
      error: entry?.error ?? false,
      saveError: entry?.saveError ?? false,
      progress: this.active === path ? entry?.progress ?? null : null,
      refreshAfter: entry ? new Date(entry.startedAt + COOLDOWN_MS).toISOString() : null,
    };
  }
}

// Stable runtime state lives outside immutable releases and the nginx response cache.
export const diskScanner = new DiskScanner(scanDiskDirectory, Date.now, '/root/core-api/state/admin-disk.json');
