/*
 * Bicube browser adapter. The runtime-neutral state model, table builder/codec,
 * synchronous solver and enumeration helpers live in @cuberoot/puzzle-solvers/bicube.
 * This module owns only client-specific table fetching, gzip inflation and caching.
 */

import { statsUrl } from './stats-base';
import {
  BIC_TABLE_PATH,
  bicExamplesByLengthFromTable,
  deserializeBicTable,
  parseBicScramble,
  solveBicWithTable,
  type BicSolution,
  type BicTable,
} from '@cuberoot/puzzle-solvers/bicube';

export * from '@cuberoot/puzzle-solvers/bicube';

let TABLE: BicTable | null = null;
let TABLE_PROMISE: Promise<BicTable> | null = null;

const GZIP_MAGIC0 = 0x1f;
const GZIP_MAGIC1 = 0x8b;
const BIC_MAGIC0 = 'B'.charCodeAt(0);

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DS = (globalThis as any).DecompressionStream;
  if (typeof DS !== 'function') throw new Error('DecompressionStream unavailable (gzip table cannot be inflated)');
  const stream = new Response(new Blob([bytes as BlobPart])).body!.pipeThrough(new DS('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function loadBicTable(): Promise<BicTable> {
  if (TABLE) return TABLE;
  if (TABLE_PROMISE) return TABLE_PROMISE;
  TABLE_PROMISE = (async () => {
    const url = statsUrl(BIC_TABLE_PATH);
    let res: Response;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error(`无法加载 Bicube 距离表 / failed to fetch the Bicube table: ${String((e as Error)?.message ?? e)}`);
    }
    if (!res.ok) throw new Error(`无法加载 Bicube 距离表 (HTTP ${res.status}) / failed to fetch the Bicube table (HTTP ${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let raw: Uint8Array;
    if (bytes[0] === GZIP_MAGIC0 && bytes[1] === GZIP_MAGIC1) raw = await gunzip(bytes);
    else if (bytes[0] === BIC_MAGIC0) raw = bytes;
    else raw = await gunzip(bytes);
    const table = deserializeBicTable(raw);
    TABLE = table;
    return table;
  })();
  try {
    return await TABLE_PROMISE;
  } catch (e) {
    TABLE_PROMISE = null;
    throw e;
  }
}

export function _setBicTableForTest(table: BicTable | null): void {
  TABLE = table;
  TABLE_PROMISE = null;
}

export async function solveBic(scramble: string): Promise<BicSolution> {
  parseBicScramble(scramble);
  const table = await loadBicTable();
  return solveBicWithTable(table, scramble);
}

export async function bicExamplesByLength(perBin = 12): Promise<Record<number, string[]>> {
  const table = await loadBicTable();
  return bicExamplesByLengthFromTable(table, perBin);
}
