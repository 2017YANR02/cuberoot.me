import { encodeGyroTrack, GyroRecorder, type GyroSample } from '../smart_cube/gyro_track';
import { TimerSmartCubeMoveRecorder } from './smart-cube-move-recorder';
import type { Solve, SolveMove } from './types';
import { stageSegmentsFor } from './stage-segments-producer';
import type { Quat } from '../smart_cube/orientation';

export interface SmartCubeAttemptDevice {
  model: string;
  name: string;
}

export interface SmartCubeAttemptResult {
  device?: SmartCubeAttemptDevice;
  gyro: string | null;
  moves: SolveMove[];
}

/**
 * Owns the per-attempt smart-cube producer shared by Web and installed App.
 * Hosts still decide when a timer attempt starts and where the result is
 * persisted; this class only snapshots the device at start and drains the
 * move/gyro streams at finish.
 */
export class SmartCubeAttemptProducer {
  private readonly moves = new TimerSmartCubeMoveRecorder();
  private readonly gyro = new GyroRecorder();
  private device: SmartCubeAttemptDevice | undefined;
  private active = false;

  begin(startedAtMs: number, device?: SmartCubeAttemptDevice): void {
    this.moves.begin(startedAtMs);
    this.gyro.reset();
    this.device = device ? { model: device.model, name: device.name } : undefined;
    this.active = true;
  }

  recordMove(move: string, timestamp: number): boolean {
    return this.moves.record(move, timestamp);
  }

  /** Gyro time is relative to the host's start clock, not the device move clock. */
  recordGyro(quaternion: Quat, timestamp: number): boolean {
    return this.active && this.gyro.push(quaternion, timestamp);
  }

  snapshotMoves(): SolveMove[] {
    return this.moves.snapshot();
  }

  /** Live reconstruction reads exactly the fields finish will persist. */
  snapshot(): SmartCubeAttemptResult {
    const moves = this.snapshotMoves();
    return {
      moves,
      device: moves.length > 0 && this.device ? { ...this.device } : undefined,
      gyro: moves.length > 0 ? encodeGyroTrack(this.gyro.snapshot()) : null,
    };
  }

  finish(): SmartCubeAttemptResult {
    const moves = this.moves.take();
    const samples = this.gyro.take();
    const gyro = moves.length > 0 ? encodeGyroTrack(samples) : null;
    const device = moves.length > 0 ? this.device : undefined;
    this.device = undefined;
    this.active = false;
    return { device, gyro, moves };
  }

  /** Attach the same persisted recording fields on Web and installed App. */
  finishSolveFields(context: Pick<Solve, 'event' | 'scramble' | 'timeMs'>):
    Pick<Solve, 'moves' | 'device' | 'gyro' | 'stageSegments'> {
    const { moves, device, gyro } = this.finish();
    if (moves.length === 0) return {};
    const stageSegments = stageSegmentsFor({ ...context, moves });
    return {
      moves,
      ...(device ? { device } : {}),
      ...(gyro ? { gyro } : {}),
      ...(stageSegments ? { stageSegments } : {}),
    };
  }

  reset(): void {
    this.moves.reset();
    this.gyro.reset();
    this.device = undefined;
    this.active = false;
  }
}

export type { GyroSample };
