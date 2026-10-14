import type { ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { SolveMove } from '@cuberoot/shared/timer/reconstruct/stage-segments';

export interface PlaybackMove extends SolveMove {
  endTs: number;
  /** Number of encoder events consumed by this complete gesture. */
  rawAfter: number;
}

/** The notation ranges are authoritative; display-only manual overrides have no timing map. */
export function reconstructedTrack(lines: ReconTextLine[] | undefined, raw: SolveMove[]): PlaybackMove[] | null {
  if (!lines?.length) return null;
  const out: PlaybackMove[] = [];
  const covered = new Set<number>();
  let consumed = 0;
  for (const displayLine of lines) {
    // Library notation is a display projection, never a synthetic timed execution.
    const correction = displayLine.libraryCorrection;
    const line = correction?.originalLine ?? (correction
      ? { ...displayLine, moveRanges: correction.originalRanges } : displayLine);
    if (!line.moveRanges) return null;
    for (const range of line.moveRanges) {
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
