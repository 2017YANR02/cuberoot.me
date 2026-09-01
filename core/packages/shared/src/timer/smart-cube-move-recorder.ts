import type { SolveMove } from './stage-segments';

/** One move clock/buffer shared by every timer surface that records BLE solves. */
export class TimerSmartCubeMoveRecorder {
  private moves: SolveMove[] = [];
  private startedAtMs: number | null = null;

  begin(startedAtMs: number): void {
    this.moves = [];
    this.startedAtMs = Number.isFinite(startedAtMs) ? startedAtMs : 0;
  }

  record(move: string, atMs: number): boolean {
    if (this.startedAtMs === null) return false;
    const previous = this.moves.at(-1)?.ts ?? 0;
    const relative = Number.isFinite(atMs) ? atMs - this.startedAtMs : previous;
    this.moves.push({ m: move, ts: Math.max(0, previous, relative) });
    return true;
  }

  reset(): void {
    this.moves = [];
    this.startedAtMs = null;
  }

  snapshot(): SolveMove[] {
    return this.moves.map((move) => ({ ...move }));
  }

  take(): SolveMove[] {
    const moves = this.snapshot();
    this.reset();
    return moves;
  }
}
