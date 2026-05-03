/**
 * Type stubs for the global symbols exposed by the legacy data files
 * (boohoo.js + hs.js + zbh.js) which are loaded into the worker via
 * importScripts. The cube model + hash tables + alg dictionaries are
 * intentionally kept verbatim so analyzer numbers stay byte-identical
 * to speedcubedb's reference implementation.
 */

export interface NxNState {
  /** mat[face][row][col] sticker matrix; faces keyed by 'U'/'D'/'F'/'B'/'L'/'R'. */
  mat: Record<'U' | 'D' | 'F' | 'B' | 'L' | 'R', string[][]>;
  // The legacy data structure has more internal fields; treat as opaque.
  [k: string]: unknown;
}

export interface F2LOption {
  /** [name, alg] tuple — speedcubedb dictionary entry. */
  0: string;
  1: string;
  length: 2;
  [n: number]: string;
}

export interface NxNApi {
  new_NxN_Data(arg: number | NxNState): NxNState;
  ProcessMoves(state: NxNState, alg: string): void;
  isCrossSolved(state: NxNState): boolean;
  getAmountOfSolvedPairs(state: NxNState): number;
  getF2LOptions(state: NxNState): F2LOption[];
  getOLLHash(state: NxNState): string;
  getNewPLLHash(state: NxNState): string;
  getNormalizedPuzzle(state: NxNState): NxNState;
  getNormalizedHash(state: NxNState): string;
  OLLHashTable: Record<string, { name: string; orientation: number }>;
  PLLnewHashTable: Record<string, { name: string; orientation: number }>;
}

export interface NxNAlgHandlerApi {
  calculateETM(alg: string): number;
  OLLDictionary: Record<string, string[]>;
  PLLDictionary: Record<string, string[]>;
  PLLRot: Record<string, number>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const NxN: NxNApi;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const NxN_AlgHandler: NxNAlgHandlerApi;
}

export {};
