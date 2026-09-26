import { encodeGyroTrack, GyroRecorder, type GyroSample } from '../smart_cube/gyro_track';
import { TimerSmartCubeMoveRecorder } from './smart-cube-move-recorder';
import type { SolveMove } from './types';
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

  begin(startedAtMs: number, device?: SmartCubeAttemptDevice): void {
    this.moves.begin(startedAtMs);
    this.gyro.reset();
    this.device = device;
  }

  recordMove(move: string, timestamp: number): boolean {
    return this.moves.record(move, timestamp);
  }

  recordGyro(quaternion: Quat, timestamp: number): boolean {
    return this.gyro.push(quaternion, timestamp);
  }

  snapshotMoves(): SolveMove[] {
    return this.moves.snapshot();
  }

  finish(): SmartCubeAttemptResult {
    const moves = this.moves.take();
    const gyro = encodeGyroTrack(this.gyro.take());
    const device = moves.length > 0 ? this.device : undefined;
    this.device = undefined;
    return { device, gyro, moves };
  }

  reset(): void {
    this.moves.reset();
    this.gyro.reset();
    this.device = undefined;
  }
}

export type { GyroSample };
