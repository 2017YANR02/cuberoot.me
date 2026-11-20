import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { CUBE_COLOR_LETTER_FOR_FACE, CUBE_FILL, CUBE_ON_FILL } from '@cuberoot/puzzle-render-core/support/cube-colors';
import { TIMER_COLOR_NAMES } from '@cuberoot/shared/timer/color-subsets';
import { orientedFaceColors } from '@cuberoot/shared/timer/cube-orientation';
import {
  STAGE_SOLVER_FACES, bestStageSolverFace, stageSolverCountStatus, stageSolverSplitLeadingRotations,
  STAGE_SOLVER_TABLES_BASE, STAGE_SOLVER_TABLE_QUERY, STAGE_SOLVER_VARIANT_IDS, STAGE_SOLVER_VARIANT_TABLES,
  STAGE_SOLVER_DEFAULT_SLACK, STAGE_SOLVER_DEFAULT_LIMIT, STAGE_SOLVER_NO_LIMIT_CAP, sortStageSolverCandidates,
  bestStageSolverY, rotateSolutionY, stageSolverMoveLength,
  VARIANT_STAGES, stageSolverKind, stageSolverNeed, stageSolverStageIndex, type StageSolverMethod, type StageSolverTableSize,
} from '@cuberoot/shared/timer/scramble-variants';
import { createTimerWorkerRpc } from '@cuberoot/shared/timer/worker-rpc';
import { openNativeTimerWorkerPort } from './native-timer-worker';
import { nativeTimerPreview } from './native-timer-preview';
import { tr } from './i18n';
import { miniProgramApi } from './platform';

export interface NativeStageSolverOptions {
  scramble: string;
  method: StageSolverMethod;
  stage: number;
  /** Bitset for U/D/L/R/F/B quarter, half and inverse turns. */
  mask?: number;
  restriction?: { lo: number; hi: number; maxRot: number };
  limit?: number;
  slack?: number;
  combo?: string;
  base?: number;
}

export interface NativeStageSolverMoves {
  len: number;
  sols: Array<{ m: string; c: string }>;
  ms: number;
  tables: StageSolverTableSize[];
}

export class NativeStageSolverRuntimeError extends Error {
  constructor(cause: unknown) {
    super('The native stage solver engine could not start', { cause });
  }
}

export function nativeStageSolverCandidateRow(
  candidate: NativeStageSolverMoves['sols'][number],
  index: number,
  restricted = false,
  rotation = restricted ? 0 : bestStageSolverY(candidate.m),
) {
  rotation = ((rotation % 4) + 4) % 4;
  const m = rotateSolutionY(candidate.m, rotation);
  const { lead, body } = stageSolverSplitLeadingRotations(m);
  const colors = orientedFaceColors(lead);
  return {
    m, c: candidate.c, index, rotation, lead, body, count: stageSolverMoveLength(m),
    top: CUBE_FILL[colors.U], front: CUBE_FILL[colors.F],
  };
}

export function nativeStageSolverCandidateRows(solutions: NativeStageSolverMoves['sols'], restricted = false) {
  return solutions.map((candidate, index) => nativeStageSolverCandidateRow(candidate, index, restricted));
}

export function nativeStageSolverFaceCells(
  counts: readonly (number | null)[] = [],
  selectedFace: number | null = null,
  visibleColors?: string,
) {
  const visible = (i: number) => !visibleColors || visibleColors.includes(CUBE_COLOR_LETTER_FOR_FACE[STAGE_SOLVER_FACES[i]]);
  const bestFace = bestStageSolverFace(counts, visible);
  const done = STAGE_SOLVER_FACES.every((_, i) => !visible(i) || stageSolverCountStatus(counts[i]) !== 'pending');
  return {
    bestFace,
    faces: STAGE_SOLVER_FACES.flatMap((face, index) => {
      if (!visible(index)) return [];
      const status = stageSolverCountStatus(counts[index]);
      return [{
        face, index, status,
        label: tr(TIMER_COLOR_NAMES[CUBE_COLOR_LETTER_FOR_FACE[face]]),
        text: status === 'pending' ? '·' : status === 'no-solution' ? '-' : status === 'too-broad' ? '⋯' : String(counts[index]),
        background: CUBE_FILL[face],
        foreground: CUBE_ON_FILL[face],
        selected: selectedFace === index,
        best: done && bestFace != null && counts[index] === counts[bestFace],
      }];
    }),
  };
}

export function nativeStageSolverAvailability(): { available: boolean; reason?: 'worker-unavailable' | 'base-library-too-old' } {
  try {
    const api = miniProgramApi();
    if (typeof api.createWorker !== 'function') return { available: false, reason: 'worker-unavailable' };
    let version: string | undefined;
    try { version = api.getSystemInfoSync().SDKVersion; } catch { /* Worker can report missing WebAssembly on init. */ }
    const components = version?.split('.').map(Number);
    const [major, minor] = components ?? [];
    if (Number.isFinite(major) && (major! < 3 || (major === 3 && Number.isFinite(minor) && minor! < 5))) {
      return { available: false, reason: 'base-library-too-old' };
    }
    return { available: true };
  } catch {
    return { available: false, reason: 'worker-unavailable' };
  }
}

export function nativeStageSolverPlayback(scramble: string, candidate: string) {
  const { lead, body } = stageSolverSplitLeadingRotations(candidate);
  return { setup: [scramble.trim(), lead].filter(Boolean).join(' '), moves: body.split(/\s+/).filter(Boolean) };
}

export type NativeStageSolverPlayback = ReturnType<typeof nativeStageSolverPlayback>;

export function nativeStageSolverPosition(playback: NativeStageSolverPlayback, frame: number) {
  return [playback.setup, ...playback.moves.slice(0, frame)].join(' ');
}

export function nativeStageSolverFrame(playback: NativeStageSolverPlayback, index: number, showImage = true) {
  const total = playback.moves.length;
  const frame = Math.min(total, Math.max(0, Math.trunc(index) || 0));
  const image = showImage ? nativeTimerPreview('333', nativeStageSolverPosition(playback, frame)) : '';
  return { frame, total, image, move: playback.moves[frame - 1] ?? '' };
}

type EngineNeed = ReturnType<typeof stageSolverNeed> | 'xcross_restrict';
type SolverCommand = { type: string; [field: string]: unknown };
type SolverPayload = { need?: EngineNeed; command: SolverCommand; tables?: Record<string, ArrayBuffer> };
type SolverReply = {
  readyNeed?: EngineNeed | null;
  hasXCross?: boolean;
  values?: number[];
  data?: { len: number; sols: NativeStageSolverMoves['sols'] };
  ms?: number;
  elapsedMs?: number;
  tables?: StageSolverTableSize[];
} | null;

function tableDownload(name: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (signal?.aborted) return Promise.reject(new Error('Stage solver download cancelled'));
  return new Promise((resolve, reject) => {
    const task = miniProgramApi().request<ArrayBuffer>({
      url: `${STAGE_SOLVER_TABLES_BASE}/${name}.bin.gz?${STAGE_SOLVER_TABLE_QUERY}`,
      responseType: 'arraybuffer',
      success(response) {
        signal?.removeEventListener('abort', abort);
        if (response.statusCode === 200 && response.data instanceof ArrayBuffer) resolve(response.data);
        else reject(new Error(`Stage solver table ${name} download failed (${response.statusCode})`));
      },
      fail(error) {
        signal?.removeEventListener('abort', abort);
        reject(new Error(error.errMsg));
      },
    });
    function abort() {
      task.abort();
      reject(new Error('Stage solver download cancelled'));
    }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function tableNames(need: EngineNeed, command: SolverCommand, status: SolverReply): readonly string[] {
  if (need === 'cross' && Number(command.variant) > 0 && !status?.hasXCross) return ['pt_cross_C4E0'];
  if (status?.readyNeed === need) return [];
  if (need === 'variant') return STAGE_SOLVER_VARIANT_TABLES.filter(name => name !== 'pt_cross');
  return need === 'first_layer' ? ['opt_first_layer'] : [];
}

function commandFor(options: NativeStageSolverOptions, face?: number): { need: EngineNeed; command: SolverCommand } {
  const { method, stage, mask, restriction } = options;
  const stageKey = VARIANT_STAGES[method]?.[stage];
  if (!stageKey) throw new Error('Invalid stage solver method or stage');
  const need = stageSolverNeed(method);
  const kind = stageSolverKind(method, stageKey);
  const scramble = normalizeWcaScramble(options.scramble) ?? options.scramble.trim();
  if (!scramble) throw new Error('Stage solver needs a scramble');
  const extra = options.slack ?? STAGE_SOLVER_DEFAULT_SLACK;
  const cap = options.limit === 0 ? STAGE_SOLVER_NO_LIMIT_CAP : options.limit ?? STAGE_SOLVER_DEFAULT_LIMIT;
  if (kind === 'std' && restriction) {
    const command = { scramble, ...restriction, k: stage };
    return { need: 'xcross_restrict', command: face === undefined
      ? { type: 'xcr_grid', ...command } : { type: 'xcr_moves', ...command, face, extra, cap, combo: options.combo } };
  }
  const fields = {
    scramble, stage: stageSolverStageIndex(method, stage),
    ...(mask === undefined ? {} : { mask }),
    ...(face === undefined ? {} : { face, extra, cap, combo: options.combo, base: options.base }),
  };
  if (kind === 'std') return { need, command: {
    type: face === undefined ? mask === undefined ? 'solve' : 'stage_masked_grid' : 'moves', variant: stage, ...fields,
  } };
  return {
    need,
    command: {
      type: `${kind}_${face === undefined ? 'stage' : 'moves'}`, ...fields,
      ...(kind === 'variant' ? { variant: STAGE_SOLVER_VARIANT_IDS[method as keyof typeof STAGE_SOLVER_VARIANT_IDS] } : {}),
      ...(kind === 'f2leo' ? { pseudo: method === 'pseudo_f2leo' } : {}),
    },
  };
}

/** Native host for the exact same WASM and engine dispatch as the Web panel. */
export function createNativeStageSolver() {
  const rpc = createTimerWorkerRpc<SolverPayload, SolverReply>({
    createWorker: () => openNativeTimerWorkerPort('stage-solver'),
    makeRequest: (id, request) => ({ id, request }),
    label: 'Native stage solver',
  });
  let started = false;
  let closed = false;
  const solve = async (options: NativeStageSolverOptions, face: number | undefined, signal?: AbortSignal) => {
    if (closed) throw new Error('Native stage solver is closed');
    const { need, command } = commandFor(options, face);
    started = true;
    let status: SolverReply;
    try {
      status = await rpc.request({ command: { type: 'stage_prepare' } }, signal, 12000);
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new NativeStageSolverRuntimeError(error);
    }
    const request = async (previous: SolverReply): Promise<SolverReply> => {
      const names = tableNames(need, command, previous);
      const tables = await Promise.all(names.map(async name => [name, await tableDownload(name, signal)] as const));
      return rpc.request({ need, command, tables: Object.fromEntries(tables) }, signal);
    };
    try {
      return await request(status);
    } catch (error) {
      // A concurrent timer-worker client can replace the process while the
      // transport is fetching tables. A clean worker needs its own tables.
      if (!closed && !signal?.aborted && status?.readyNeed && String(error).includes('Missing stage solver table:')) {
        return request(null);
      }
      throw error;
    }
  };
  return {
    async counts(options: NativeStageSolverOptions, signal?: AbortSignal) {
      const result = await solve(options, undefined, signal);
      if (!result?.values || result.values.length !== 6) throw new Error('Native stage solver returned invalid counts');
      return { counts: result.values, elapsedMs: result.elapsedMs, tables: result.tables ?? [] };
    },
    async moves(options: NativeStageSolverOptions, face: number, signal?: AbortSignal): Promise<NativeStageSolverMoves> {
      if (!Number.isInteger(face) || face < 0 || face >= 6) throw new Error('Invalid stage solver face');
      const result = await solve(options, face, signal);
      if (!result?.data || !Array.isArray(result.data.sols)) throw new Error('Native stage solver returned invalid moves');
      return { ...result.data, sols: sortStageSolverCandidates(result.data.sols), ms: result.ms ?? 0, tables: result.tables ?? [] };
    },
    dispose() {
      if (closed) return;
      closed = true;
      if (!started) { rpc.dispose(); return; }
      void rpc.request({ command: { type: 'stage_release' } }, undefined, 2000)
        .catch(() => null).finally(() => rpc.dispose());
    },
  };
}
