import {
  deserializeSia222Pdbs,
  parseSia222Scramble,
  solveSia222WithPdbs,
  type Sia222Pdbs,
  type Sia222Solution,
} from '@cuberoot/puzzle-solvers/sia222';
import { statsUrl } from './stats-base';

export * from '@cuberoot/puzzle-solvers/sia222';

export const SIA222_TABLE_PATH = '/stats/scramble/opt_sia222.bin.gz';

let PDBS: Sia222Pdbs | null = null;
let PDBS_PROMISE: Promise<Sia222Pdbs> | null = null;
const GZIP0 = 0x1f, GZIP1 = 0x8b;
const MAGIC0 = 'SI22'.charCodeAt(0);

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DS = (globalThis as any).DecompressionStream;
  if (typeof DS !== 'function') throw new Error('DecompressionStream unavailable (gzip table cannot be inflated)');
  const stream = new Response(new Blob([bytes as BlobPart])).body!.pipeThrough(new DS('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Lazily fetch + inflate + decode the PDBs (cached). Throws a clear error on failure (no in-browser BFS fallback). */
export async function loadSia222Pdbs(): Promise<Sia222Pdbs> {
  if (PDBS) return PDBS;
  if (PDBS_PROMISE) return PDBS_PROMISE;
  PDBS_PROMISE = (async () => {
    const url = statsUrl(SIA222_TABLE_PATH);
    let res: Response;
    try { res = await fetch(url); }
    catch (e) { throw new Error(`无法加载联体 2×2×2 距离表 / failed to fetch the Siamese 2×2×2 table: ${String((e as Error)?.message ?? e)}`); }
    if (!res.ok) throw new Error(`无法加载联体 2×2×2 距离表 (HTTP ${res.status}) / failed to fetch the Siamese 2×2×2 table (HTTP ${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let raw: Uint8Array;
    if (bytes[0] === GZIP0 && bytes[1] === GZIP1) raw = await gunzip(bytes);
    else if (bytes[0] === MAGIC0) raw = bytes;
    else raw = await gunzip(bytes);
    const p = deserializeSia222Pdbs(raw);
    PDBS = p;
    return p;
  })();
  try { return await PDBS_PROMISE; }
  catch (e) { PDBS_PROMISE = null; throw e; }
}

/** Test/diagnostic only: inject already-built PDBs (skips fetch). */
export function _setSia222PdbsForTest(p: Sia222Pdbs | null): void { PDBS = p; PDBS_PROMISE = null; }

/** Solve a sia222 scramble optimally (async: lazily fetch+inflate the PDB table on first call). */
export async function solveSia222(scramble: string): Promise<Sia222Solution> {
  parseSia222Scramble(scramble); // eager validation (reject bad tokens without fetching)
  const pdbs = await loadSia222Pdbs();
  return solveSia222WithPdbs(pdbs, scramble);
}
