import type { AlgPuzzle } from '@cuberoot/shared';
import { normalizeAlgForTwisty } from '@/lib/alg_normalize';
import { invertFtoEifAlgorithm } from '@/lib/fto-eif-image';
import { invertSq1Alg, parseSq1Tokens } from '@cuberoot/shared/sq1-notation';

/** 公式动画和记号教学共用 1 STM/s 的默认节奏。 */
export const DEFAULT_ALG_MOVE_DURATION_MS = 1000;
export const DEFAULT_PREVIEW_TIMING = { frames: 60, stepMs: DEFAULT_ALG_MOVE_DURATION_MS } as const;
const SIM_FRAMES_PER_SECOND = 60;

/** `/sim` 播放器的一步一项。SQ1 的 `(t, b)` 内含空格，不能按空白切。 */
export function resolveSimPreviewMoves(puzzle: AlgPuzzle, alg: string): string[] {
  const normalized = normalizeAlgForTwisty(puzzle, alg);
  if (puzzle === 'sq1') {
    return parseSq1Tokens(normalized).map(token =>
      token.kind === 'slice' ? '/' : `(${token.top}, ${token.bot})`,
    );
  }
  return normalized.split(/\s+/).filter(Boolean);
}

export function resolveSimMoveDurationScale(puzzle: AlgPuzzle, move: string): number {
  const token = move.trim();
  if (!token || /\s/.test(token)) return 1;

  let magnitude = 1;
  if (puzzle === 'pyraminx' || (puzzle === 'skewb' && !/^[xyz]/i.test(token))) {
    magnitude = 4 / 3;
  } else {
    const amount = Number(token.match(/(\d+)'?$/)?.[1]);
    if (Number.isFinite(amount) && amount > 0) magnitude = amount;
  }
  return 2 - 2 / (magnitude + 1);
}

export function resolvePreviewTiming(moveDurationMs?: number, durationScale = 1): { frames: number; stepMs: number } {
  if (moveDurationMs === undefined || !Number.isFinite(moveDurationMs) || moveDurationMs <= 0) {
    return DEFAULT_PREVIEW_TIMING;
  }
  const frames = moveDurationMs * SIM_FRAMES_PER_SECOND / 1000 / durationScale;
  return {
    frames: Math.max(1, Number(frames.toFixed(6))),
    stepMs: moveDurationMs,
  };
}

/** cubing.js 的普通转动原生为 1000ms、半转为 1500ms;tempoScale 越大,播放越快。 */
export function resolveTwistyTempoScale(moveDurationMs?: number, move = ''): number | undefined {
  if (moveDurationMs === undefined || !Number.isFinite(moveDurationMs) || moveDurationMs <= 0) {
    return undefined;
  }
  const token = move.trim();
  const isSingleMove = token.length > 0 && !/\s/.test(token);
  const amount = isSingleMove ? token.match(/(\d+)'?$/)?.[1] : undefined;
  const nativeDurationMs = isSingleMove && (/(?:\+\+|--)$/.test(token) || amount === '2')
    ? 1500
    : amount && amount !== '1'
      ? 2000
      : 1000;
  return nativeDurationMs / moveDurationMs;
}

/** Resolve the preview's initial state without duplicating the rule across renderers. */
export function resolvePlayerSetup(
  puzzle: AlgPuzzle,
  alg: string,
  setup: string | undefined,
  startSolved: boolean,
): string {
  if (startSolved) return '';
  if (setup?.trim()) return normalizeAlgForTwisty(puzzle, setup);
  if (puzzle === 'fto') return invertFtoEifAlgorithm(alg);
  if (puzzle === 'sq1') return invertSq1Alg(alg);
  return `(${normalizeAlgForTwisty(puzzle, alg)})'`;
}
