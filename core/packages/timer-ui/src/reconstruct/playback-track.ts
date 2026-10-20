import type { ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { SolveMove } from '@cuberoot/shared/timer/reconstruct/stage-segments';

export interface PlaybackMove extends SolveMove {
  endTs: number;
  /** Number of encoder events consumed by this complete gesture. */
  rawAfter: number;
}

export function playbackTrack(raw: SolveMove[], lines: ReconTextLine[] | undefined, posed: boolean) {
  const rebuilt = posed ? null : reconstructedTrack(lines, raw);
  return { rebuilt: rebuilt !== null, moves: rebuilt ?? raw.map((move, i) => ({ ...move, endTs: move.ts, rawAfter: i + 1 })) };
}

export function playbackEndMs(moves: PlaybackMove[], raw: SolveMove[]) {
  return moves.length ? Math.max(moves.at(-1)!.endTs, raw.at(-1)?.ts ?? 0) : 0;
}

export function playbackSeek(moves: PlaybackMove[], lastTs: number, index: number, atMs?: number) {
  const next = Math.max(0, Math.min(moves.length, index));
  return { index: next, timeMs: atMs === undefined ? (next ? moves[next - 1].ts : 0) : Math.max(0, Math.min(lastTs, atMs)) };
}

export function rawPlaybackTarget(moves: PlaybackMove[], raw: SolveMove[], index: number, atMs?: number, play = false) {
  const at = atMs ?? (index > 0 ? raw[index - 1]?.ts ?? 0 : 0);
  const next = atMs === undefined || play ? playbackIndexForRaw(moves, index, at) : playbackIndexAt(moves, at);
  return playbackSeek(moves, playbackEndMs(moves, raw), next, play ? at : atMs);
}

export function playbackFrame(moves: PlaybackMove[], lastTs: number, timeMs: number) {
  const at = Math.min(timeMs, lastTs);
  return { timeMs: at, index: playbackIndexAt(moves, at), playing: timeMs < lastTs };
}

/** The notation ranges are authoritative; display-only manual overrides have no timing map. */
export function reconstructedTrack(lines: ReconTextLine[] | undefined, raw: SolveMove[]): PlaybackMove[] | null {
  if (!lines?.length) return null;
  const out: PlaybackMove[] = [];
  const covered = new Set<number>();
  let consumed = 0;
  for (const line of lines) {
    // Reconstructed steps carry verified encoder spans. Replay those steps;
    // the original recording remains the fallback and gyro-mode track.
    if (!line.moveRanges) return null;
    const timedRanges = line.moveRanges.map(range => ({ ...range }));
    // A library replacement shares one verified source interval. Allocate it
    // across the replacement steps instead of enqueueing every step at once.
    for (let from = 0; from < timedRanges.length;) {
      const first = timedRanges[from];
      let to = from + 1;
      while (to < timedRanges.length && timedRanges[to].startIdx === first.startIdx
        && timedRanges[to].ts === first.ts && timedRanges[to].endTs === first.endTs) to++;
      if (to - from > 1 && first.endTs > first.ts) {
        const start = first.ts, duration = first.endTs - start;
        for (let i = from; i < to; i++) {
          timedRanges[i].ts = start + duration * (i - from) / (to - from);
          timedRanges[i].endTs = start + duration * (i - from + 1) / (to - from);
        }
      }
      from = to;
    }
    for (const range of timedRanges) {
      const rotation = range.endIdx < range.startIdx;
      if (!rotation) {
        if (range.startIdx < 0 || range.endIdx >= raw.length) return null;
        // Opposite faces commute and notation may reorder their encoder ranges.
        // Require complete, unique coverage, not strictly increasing indices.
        for (let i = range.startIdx; i <= range.endIdx; i++) {
          if (covered.has(i)) return null;
          covered.add(i);
        }
        consumed = Math.max(consumed, range.endIdx + 1);
      }
      const ts = Math.max(out.at(-1)?.ts ?? 0, range.ts);
      out.push({ m: range.token, ts, endTs: Math.max(ts, range.endTs), rawAfter: consumed });
    }
  }
  return covered.size === raw.length && out.length > 0 ? out : null;
}

export function playbackIndexAt(moves: PlaybackMove[], ms: number): number {
  let index = 0;
  while (index < moves.length && moves[index].ts <= ms) index++;
  return index;
}

/** Raw clicks cannot stop halfway through a reconstructed slice/wide gesture. */
export function playbackIndexForRaw(moves: PlaybackMove[], rawIndex: number, atMs: number): number {
  if (rawIndex === 0 && atMs <= 0) return 0;
  let index = 0;
  while (index < moves.length && moves[index].rawAfter <= rawIndex && moves[index].ts <= atMs) index++;
  return index;
}
