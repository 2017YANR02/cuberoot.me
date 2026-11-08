import type { SolveMove } from './stage-segments';
import { moveClockElapsed, type MoveClockSample } from '../smart_cube/move_clock';
import { cubeTimerElapsed, type CubeTimerStart } from './machine';

/** One move clock/buffer shared by every timer surface that records BLE solves. */
export class TimerSmartCubeMoveRecorder {
  private moves: SolveMove[] = [];
  private startedAtMs: number | null = null;
  private cubeStart: CubeTimerStart | undefined;
  private samples: Array<MoveClockSample | undefined> = [];

  begin(startedAtMs: number, cubeStart?: CubeTimerStart): void {
    this.moves = [];
    this.samples = [];
    this.cubeStart = cubeStart;
    this.startedAtMs = Number.isFinite(startedAtMs) ? startedAtMs : 0;
  }

  record(move: string, atMs: number, clock?: MoveClockSample): boolean {
    if (this.startedAtMs === null) return false;
    const previous = this.moves.at(-1)?.ts ?? 0;
    const relative = Number.isFinite(atMs) ? atMs - this.startedAtMs : previous;
    this.moves.push({ m: move, ts: Math.max(0, previous, relative) });
    this.samples.push(clock?.timestamp === atMs ? clock : undefined);
    return true;
  }

  reset(): void {
    this.moves = [];
    this.startedAtMs = null;
    this.cubeStart = undefined;
    this.samples = [];
  }

  snapshot(): SolveMove[] {
    const end = this.samples.at(-1);
    const span = moveClockElapsed(this.cubeStart?.sample, end);
    const duration = cubeTimerElapsed(this.cubeStart, end);
    if (span === null || duration === null) return this.moves.map(move => ({ ...move }));
    const leadInMs = duration - span;
    let previous = 0;
    return this.moves.map((move, i) => {
      const sample = this.samples[i];
      const elapsed = sample ? moveClockElapsed(this.cubeStart!.sample, { ...sample, rate: end!.rate }) : null;
      // Untimed recovered history shares the preceding estimated instant. Its
      // old online timestamp must not leak into this newly calibrated domain.
      const ts = elapsed === null ? previous : leadInMs + elapsed;
      previous = Math.max(previous, ts);
      return { m: move.m, ts: previous };
    });
  }

  /** Host-timed gyro must follow a corrected first-turn origin, without rate scaling. */
  get hostCorrectionMs(): number {
    const end = this.samples.at(-1);
    const elapsed = cubeTimerElapsed(this.cubeStart, end);
    if (elapsed === null || this.startedAtMs === null || !Number.isFinite(end!.hostTime)) return 0;
    return this.startedAtMs - end!.hostTime + elapsed;
  }

  take(): SolveMove[] {
    const moves = this.snapshot();
    this.reset();
    return moves;
  }
}
