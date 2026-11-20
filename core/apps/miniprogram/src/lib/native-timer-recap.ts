import type { Solve } from '@cuberoot/shared/timer/types';
import { encodeReplayPayload } from '@cuberoot/shared/timer/replay-encode';
import {
  playbackEndMs, playbackFrame, playbackMoveDurationTicks, playbackSeek, playbackTrack, rawPlaybackTarget,
  rawRecapMoveRows, reconstructionSummary, shouldAutoRecap,
} from '@cuberoot/shared/timer/reconstruct/recap';
import { sliceReconstruction } from '@cuberoot/shared/timer/reconstruct/slice';
import { detectSolveMethod, walkMethod } from '@cuberoot/shared/timer/reconstruct/method-walk';
import { methodById, type MethodId } from '@cuberoot/shared/timer/reconstruct/methods';
import { computeStepMetrics } from '@cuberoot/shared/timer/reconstruct/step-metrics';
import { STAGE_SEGMENT_EVENTS } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { detectWastedWork } from '@cuberoot/shared/timer/reconstruct/error-detect';
import { computeF2lSlots } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import { getMiniProgramLocale, type MiniProgramLocale } from './i18n';
import { nativeTimerPreview } from './native-timer-preview';
import { nativeTimerGyroPlayback } from './native-timer-gyro';
import { miniProgramApi } from './platform';

export { shouldAutoRecap };

/** Native projection of the same raw encoder track shown in the timer report. */
export function createNativeTimerRecap(
  solve: Solve,
  language: MiniProgramLocale = getMiniProgramLocale(),
  preferredMethod?: MethodId,
) {
  const raw = solve.moves;
  if (!raw?.length) return null;

  const { moves } = playbackTrack(raw, undefined, false);
  const gyro = nativeTimerGyroPlayback(solve.gyro, solve.device?.model);
  const endMs = playbackEndMs(moves, raw);
  const metrics = STAGE_SEGMENT_EVENTS.has(solve.event) ? computeStepMetrics(solve.scramble, raw, solve.timeMs) : null;
  const method = metrics ? preferredMethod ?? detectSolveMethod(solve.scramble, raw, solve.timeMs) : null;
  const walk = method && method !== 'cfop' ? walkMethod(method, solve.scramble, raw, solve.timeMs) : null;
  const definition = method ? methodById(method) : null;
  const segments = metrics?.segments;
  const cfopEnds = [segments?.crossEndIdx, segments?.f2lEndIdx, segments?.ollEndIdx, segments?.solvedEndIdx];
  const stages = (walk?.stages ?? metrics?.steps ?? []).map((step, index) => {
    const stage = definition?.stages[index];
    const endIndex = 'endIdx' in step ? step.endIdx : cfopEnds[index] ?? null;
    return { ...step, key: stage?.key ?? String(index), label: stage?.[language] ?? '', endIndex };
  });
  const slots = method === 'cfop' && segments ? computeF2lSlots(solve.scramble, raw, solve.timeMs, segments) : null;
  const slices = sliceReconstruction(raw, solve.timeMs, solve.bld?.memoMs);
  const summary = reconstructionSummary(raw, solve.timeMs, null, walk?.totalExecutionMs ?? metrics?.totalExecutionMs ?? null, solve.bld?.memoMs);
  const waste = metrics ? detectWastedWork(solve.scramble, raw) : null;
  const wasted = new Set<number>();
  for (const span of waste?.spans ?? []) {
    for (let i = span.fromIdx; i <= span.toIdx; i++) wasted.add(i);
  }
  const rows = rawRecapMoveRows(raw, wasted).map(row => ({
    ...row, time: (row.ts / 1000).toFixed(2), gapTime: row.gap === null ? '—' : (row.gap / 1000).toFixed(2),
  }));
  const algorithm = raw.map(move => move.m).join(' ');
  const copyText = [solve.scramble, algorithm].filter(Boolean).join('\n\n');
  let renderedIndex = -1;
  let image = '';
  let setup = solve.scramble;
  function render(position: { index: number; timeMs: number }, playing = false) {
    const { index, timeMs } = position;
    if (index !== renderedIndex) {
      renderedIndex = index;
      setup = [solve.scramble, ...moves.slice(0, index).map(move => move.m)].join(' ');
      image = nativeTimerPreview(solve.event, setup);
    }
    return { index, total: moves.length, timeMs, endMs, playing, image, move: moves[index - 1]?.m ?? '', setup };
  }
  return {
    id: solve.id, scramble: solve.scramble, timeMs: solve.timeMs, inspectionMs: solve.inspectionMs ?? null,
    device: solve.device ?? null, method, rows, stages, slots, slices, summary, ...gyro,
    pickupMs: walk?.pickupMs ?? metrics?.pickupMs ?? null,
    putDownMs: walk ? walk.putDownMs : metrics?.putDownMs ?? null,
    endMs, total: moves.length, algorithm, copyText, verifiedText: solve.reconstruction?.join('\n') ?? '',
    moveAt(index: number, speed = 1) {
      const move = moves[index - 1];
      if (!move) return null;
      return { token: move.m, durationTicks: playbackMoveDurationTicks(moves, index, solve.timeMs, speed)! };
    },
    seek(index: number) { return render(playbackSeek(moves, endMs, Math.trunc(index) || 0)); },
    seekRaw(index: number, timeMs?: number) { return render(rawPlaybackTarget(moves, raw, index, timeMs)); },
    advance(timeMs: number) {
      const frame = playbackFrame(moves, endMs, Math.max(0, timeMs));
      return render(frame, frame.playing);
    },
    shareUrl() {
      const encodeBinary = typeof btoa === 'function'
        ? btoa
        : (value: string) => miniProgramApi().arrayBufferToBase64(Uint8Array.from(value, character => character.charCodeAt(0)).buffer);
      return `https://cuberoot.me${language === 'zh' ? '/zh' : ''}/timer?replay=${encodeReplayPayload(solve, encodeBinary)}`;
    },
  };
}

export type NativeTimerRecap = NonNullable<ReturnType<typeof createNativeTimerRecap>>;
