import { SOLVED_SMART_CUBE_FACELETS } from '../smart_cube/cubie';
import type { MoveClockSample } from '../smart_cube/move_clock';
import type { Quat } from '../smart_cube/orientation';
import { SmartCubeAttemptProducer, type SmartCubeAttemptDevice, type SmartCubeStartingGrip } from './smart-cube-attempt';

export const COMPETITION_STAGE_LIMIT_MS = 120_000;
export const COMPETITION_INSPECTION_MS = 16_000;
export const COMPETITION_INTERMISSION_MS = 3_000;

export type CompetitionDnfReason = 'scramble_timeout' | 'solve_timeout' | 'disconnected';

export function competitionSolveStart(inspectAt: number, firstTurnAt?: number | null) {
  return Math.max(inspectAt, Math.min(firstTurnAt ?? Infinity, inspectAt + COMPETITION_INSPECTION_MS));
}

export function competitionDeadline(issuedAt: number, inspectAt?: number | null, solveAt?: number | null) {
  return (inspectAt == null ? issuedAt : competitionSolveStart(inspectAt, solveAt)) + COMPETITION_STAGE_LIMIT_MS;
}

export type CompetitionCubePhase =
  | { kind: 'scrambling'; at: number }
  | { kind: 'inspecting'; at: number }
  | { kind: 'running'; at: number; inspectionMs: number }
  | { kind: 'finished'; at: number; durationMs: number; reason?: CompetitionDnfReason };

type Move = { move: string; at: number; facelets: string; clock?: MoveClockSample };

/** The host supplies a monotonic clock and feeds verified device state and move edges. */
export class CompetitionCubeAttempt {
  readonly recording = new SmartCubeAttemptProducer();
  phase: CompetitionCubePhase;
  private inspectAt: number | null = null;

  constructor(
    private readonly issuedAt: number,
    private readonly targetFacelets: string,
    private readonly callbacks: {
      change(phase: CompetitionCubePhase): void;
      finish(phase: Extract<CompetitionCubePhase, { kind: 'finished' }>, inspectionMs: number, recording: ReturnType<SmartCubeAttemptProducer['finish']>): void;
      device(): { device?: SmartCubeAttemptDevice; grip?: SmartCubeStartingGrip };
    },
  ) {
    this.phase = { kind: 'scrambling', at: issuedAt };
  }

  aligned(facelets: string, completedNow: boolean, at: number) {
    if (this.phase.kind !== 'scrambling' || at < this.issuedAt) return;
    this.tick(at);
    if (this.phase.kind !== 'scrambling' || !completedNow || facelets !== this.targetFacelets) return;
    this.inspectAt = at;
    this.setPhase({ kind: 'inspecting', at });
  }

  move({ move, at, facelets, clock }: Move) {
    if (this.phase.kind === 'inspecting') {
      this.start(competitionSolveStart(this.phase.at, at));
    }
    this.tick(at);
    if (this.phase.kind !== 'running') return;
    this.recording.recordMove(move, at, clock);
    if (facelets === SOLVED_SMART_CUBE_FACELETS) this.finish(at);
  }

  tick(at: number) {
    if (this.phase.kind === 'inspecting' && at >= this.phase.at + COMPETITION_INSPECTION_MS) {
      this.start(this.phase.at + COMPETITION_INSPECTION_MS);
    }
    if (this.phase.kind === 'scrambling' && at >= this.issuedAt + COMPETITION_STAGE_LIMIT_MS) {
      this.finish(this.issuedAt + COMPETITION_STAGE_LIMIT_MS, 'scramble_timeout');
    } else if (this.phase.kind === 'running' && at >= this.phase.at + COMPETITION_STAGE_LIMIT_MS) {
      this.finish(this.phase.at + COMPETITION_STAGE_LIMIT_MS, 'solve_timeout');
    }
  }

  disconnected(at: number) {
    this.tick(at);
    if (at >= this.issuedAt && this.phase.kind !== 'finished') this.finish(at, 'disconnected');
  }

  gyro(pose: Quat, at: number) {
    if (this.phase.kind === 'running') this.recording.recordGyro(pose, at - this.phase.at);
  }

  private start(at: number) {
    const { device, grip } = this.callbacks.device();
    this.recording.begin(at, device, grip);
    this.setPhase({ kind: 'running', at, inspectionMs: at - this.inspectAt! });
  }

  private finish(at: number, reason?: CompetitionDnfReason) {
    const running = this.phase.kind === 'running' ? this.phase : null;
    const recording = this.recording.finish();
    const durationMs = Math.max(running ? Math.floor(at - running.at) : 0, Math.floor(recording.moves.at(-1)?.ts ?? 0), reason ? 0 : 1);
    const phase = { kind: 'finished', at, durationMs, reason } as const;
    this.setPhase(phase);
    this.callbacks.finish(phase, running?.inspectionMs ?? (this.inspectAt == null ? 0 : Math.max(0, at - this.inspectAt)), recording);
  }

  private setPhase(phase: CompetitionCubePhase) {
    this.phase = phase;
    this.callbacks.change(phase);
  }
}
