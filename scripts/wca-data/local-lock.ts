import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { hostname } from 'node:os';

/** Fail closed after an interrupted publisher; never steal or expire its lock. */
export async function withLocalLock<T>(path: string, work: () => T | Promise<T>): Promise<T> {
  mkdirSync(dirname(path), { recursive: true });
  let fd: number;
  try { fd = openSync(path, 'wx', 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Another data operation owns ${path}; if it was interrupted, verify the recorded owner has stopped before removing this lock.`);
    throw error;
  }
  const owner = JSON.stringify({ pid: process.pid, host: hostname(), token: randomUUID() });
  try { writeFileSync(fd, owner); } finally { closeSync(fd); }
  try { return await work(); }
  finally {
    // An external recovery must not allow this operation to release a new owner.
    try { if (readFileSync(path, 'utf8') === owner) unlinkSync(path); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
}
