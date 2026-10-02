import { readFileSync } from 'node:fs';

const MiB = 1024 * 1024;
// Leave room for the WASM wrapper, streaming buffer and other live services.
export const CUBEOPT_LOAD_RESERVE_BYTES = 1024 * MiB;
export const CUBEOPT_LOAD_FLOOR_BYTES = 256 * MiB;

export function requiredCubeoptLoadBytes(tableBytes: number): number {
  if (!Number.isSafeInteger(tableBytes) || tableBytes <= 0) throw new Error('Invalid CubeOpt table size');
  return tableBytes + CUBEOPT_LOAD_RESERVE_BYTES;
}

export function assertCubeoptLoadMemory(availableBytes: number, requiredBytes: number): void {
  if (!Number.isFinite(availableBytes) || availableBytes < requiredBytes) {
    throw new Error(`CubeOpt load deferred: available memory ${Math.floor(availableBytes / MiB)} MiB; requires ${Math.ceil(requiredBytes / MiB)} MiB`);
  }
}

/** Linux MemAvailable includes reclaimable cache; free RAM alone is too strict. */
export function checkCubeoptLoadMemory(requiredBytes: number): void {
  if (process.platform !== 'linux') return;
  const available = readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+)\s+kB/m);
  if (!available) throw new Error('CubeOpt load deferred: memory availability is unknown');
  assertCubeoptLoadMemory(Number(available[1]) * 1024, requiredBytes);
}
