import {
  deserializeSia123Pdbs,
  parseSia123Scramble,
  solveSia123WithPdbs,
  type Sia123Pdbs,
  type Sia123Solution,
} from '@cuberoot/puzzle-solvers/sia123';
import { statsUrl } from './stats-base';

export * from '@cuberoot/puzzle-solvers/sia123';

export const SIA123_TABLE_PATH = '/stats/scramble/opt_sia123.bin.gz';

let PDBS: Sia123Pdbs | null = null;
let PDBS_PROMISE: Promise<Sia123Pdbs> | null = null;
const GZIP0 = 0x1f, GZIP1 = 0x8b;
const MAGIC0 = 'SI13'.charCodeAt(0);

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DS = (globalThis as any).DecompressionStream;
  if (typeof DS !== 'function') throw new Error('DecompressionStream unavailable (gzip table cannot be inflated)');
  const stream = new Response(new Blob([bytes as BlobPart])).body!.pipeThrough(new DS('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Lazily fetch + inflate + decode the PDBs (cached). Throws a clear error on failure (no in-browser BFS fallback). */
export async function loadSia123Pdbs(): Promise<Sia123Pdbs> {
  if (PDBS) return PDBS;
  if (PDBS_PROMISE) return PDBS_PROMISE;
  PDBS_PROMISE = (async () => {
    const url = statsUrl(SIA123_TABLE_PATH);
    let res: Response;
    try { res = await fetch(url); }
    catch (e) { throw new Error(`无法加载联体 1×2×3 距离表 / failed to fetch the Siamese 1×2×3 table: ${String((e as Error)?.message ?? e)}`); }
    if (!res.ok) throw new Error(`无法加载联体 1×2×3 距离表 (HTTP ${res.status}) / failed to fetch the Siamese 1×2×3 table (HTTP ${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let raw: Uint8Array;
    if (bytes[0] === GZIP0 && bytes[1] === GZIP1) raw = await gunzip(bytes);
    else if (bytes[0] === MAGIC0) raw = bytes;
    else raw = await gunzip(bytes);
    const p = deserializeSia123Pdbs(raw);
    PDBS = p;
    return p;
  })();
  try { return await PDBS_PROMISE; }
  catch (e) { PDBS_PROMISE = null; throw e; }
}

/** Test/diagnostic only: inject already-built PDBs (skips fetch). */
export function _setSia123PdbsForTest(p: Sia123Pdbs | null): void { PDBS = p; PDBS_PROMISE = null; }

/** Solve a sia123 scramble optimally (async: lazily fetch+inflate the PDB table on first call). */
export async function solveSia123(scramble: string): Promise<Sia123Solution> {
  parseSia123Scramble(scramble); // eager validation (reject bad tokens without fetching)
  const pdbs = await loadSia123Pdbs();
  return solveSia123WithPdbs(pdbs, scramble);
}
