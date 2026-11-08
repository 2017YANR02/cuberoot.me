import { encodeGyroTrack, GyroRecorder, type GyroSample } from '../smart_cube/gyro_track';
import { TimerSmartCubeMoveRecorder } from './smart-cube-move-recorder';
import type { Solve, SolveMove } from './types';
import { stageSegmentsFor } from './stage-segments-producer';
import type { Quat } from '../smart_cube/orientation';
import { applyOrientation, mirrorForBrand, quatMul, sensorBasisForBrand } from '../smart_cube/orientation';
import { notationQuaternion } from './reconstruct/gyro_orient';
import type { CubeTimerStart } from './machine';
import type { MoveClockSample } from '../smart_cube/move_clock';

export interface SmartCubeStartingGrip {
  reference: Quat;
  initial: Quat;
  orientation?: string;
}

export interface SmartCubeAttemptDevice {
  model: string;
  name: string;
}

export interface SmartCubeAttemptResult {
  device?: SmartCubeAttemptDevice;
  gyro: string | null;
  moves: SolveMove[];
}

export interface LiveSmartCubeAttemptResult {
  device?: SmartCubeAttemptDevice;
  gyroSamples: readonly GyroSample[];
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
  private grip: SmartCubeStartingGrip | undefined;
  private liveGyro: readonly GyroSample[] = [];

  begin(startedAtMs: number, device?: SmartCubeAttemptDevice, grip?: SmartCubeStartingGrip, cubeStart?: CubeTimerStart): void {
    this.moves.begin(startedAtMs, cubeStart);
    this.gyro.reset();
    this.liveGyro = [];
    this.device = device ? { model: device.model, name: device.name } : undefined;
    this.active = true;
    this.grip = grip ? { ...grip, reference: { ...grip.reference }, initial: { ...grip.initial } } : undefined;
    if (grip) this.recordGyro(grip.initial, 0);
  }

  recordMove(move: string, timestamp: number, clock?: MoveClockSample): boolean {
    return this.moves.record(move, timestamp, clock);
  }

  /** Gyro time is relative to the host's start clock, not the device move clock. */
  recordGyro(quaternion: Quat, timestamp: number): boolean {
    if (!this.active) return false;
    const pose = this.grip ? quatMul(notationQuaternion(this.grip.orientation ?? ''),
      applyOrientation(quaternion, this.grip.reference, {
        basis: sensorBasisForBrand(this.device?.model), mirror: mirrorForBrand(this.device?.model),
      })) : quaternion;
    return this.gyro.push(pose, timestamp);
  }

  snapshotMoves(): SolveMove[] {
    return this.moves.snapshot();
  }

  /** Live reconstruction consumes samples directly, without a storage round trip. */
  snapshotLive(): LiveSmartCubeAttemptResult {
    const moves = this.snapshotMoves();
    if (this.liveGyro.length !== this.gyro.length) {
      const added = this.gyro.snapshot(this.liveGyro.length).map(sample => Object.freeze({
        ...sample, q: Object.freeze(sample.q), ...(this.grip ? { frame: 'scramble' as const } : {}),
      }));
      this.liveGyro = Object.freeze([...this.liveGyro, ...added]);
    }
    return { moves, gyroSamples: moves.length ? this.alignGyro(this.liveGyro) : [],
      device: moves.length > 0 && this.device ? { ...this.device } : undefined };
  }

  /** Explicit persisted-format snapshot; do not call this on the live move path. */
  snapshot(): SmartCubeAttemptResult {
    const moves = this.snapshotMoves();
    return {
      moves,
      device: moves.length > 0 && this.device ? { ...this.device } : undefined,
      gyro: moves.length > 0 ? encodeGyroTrack(this.alignGyro(this.gyro.snapshot()), this.grip ? 'scramble' : undefined) : null,
    };
  }

  finish(): SmartCubeAttemptResult {
    const samples = this.alignGyro(this.gyro.take());
    const moves = this.moves.take();
    const gyro = moves.length > 0 ? encodeGyroTrack(samples, this.grip ? 'scramble' : undefined) : null;
    const device = moves.length > 0 ? this.device : undefined;
    this.device = undefined;
    this.active = false;
    this.grip = undefined;
    this.liveGyro = [];
    return { device, gyro, moves };
  }

  private alignGyro(samples: readonly GyroSample[]): readonly GyroSample[] {
    const shift = this.moves.hostCorrectionMs;
    if (shift === 0) return samples;
    return samples.map((sample, i) => ({ ...sample,
      tMs: this.grip && i === 0 ? 0 : Math.max(0, sample.tMs + shift) }));
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
    this.liveGyro = [];
    this.grip = undefined;
    this.moves.reset();
    this.gyro.reset();
    this.device = undefined;
    this.active = false;
  }
}

export type { GyroSample };
