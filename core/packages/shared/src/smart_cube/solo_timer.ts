import {
  timerSmartCubeStartsAttemptOnTurn,
  timerSupportsSmartCubeAutoTiming,
} from '../timer/event-catalog';
import type { TimerPhase } from '../timer/machine';
import type { EventId } from '../timer/types';
import {
  createSmartCubeGuidanceController,
  type SmartCubeGuidanceState,
} from './scramble_guidance';

export interface SmartCubeSoloTimerContext {
  event: EventId;
  id: string | number;
  scramble: string;
  targetFacelets: string | null;
}

export interface SmartCubeSoloMoveMetadata {
  futureHistory?: boolean;
}

export interface SmartCubeSoloMove<Metadata extends SmartCubeSoloMoveMetadata = SmartCubeSoloMoveMetadata> {
  facelets: string | null;
  metadata?: Metadata;
  move: string;
  timestamp: number;
}

export interface SmartCubeSoloMoveOutcome {
  delivered: boolean;
  futureHistory: boolean;
  guidanceCompleted: boolean;
  recorded: boolean;
  started: boolean;
}

export interface SmartCubeSoloTimerControllerOptions<
  Metadata extends SmartCubeSoloMoveMetadata = SmartCubeSoloMoveMetadata,
> {
  armFromCube(): boolean | void;
  autoReadyOnScramble(): boolean;
  canStartAttempt(): boolean;
  getPhase(): TimerPhase;
  isTimingEnabled(): boolean;
  onGuidanceChange?(state: SmartCubeGuidanceState): void;
  onMove?(event: SmartCubeSoloMove<Metadata>): void;
  recordMove(event: SmartCubeSoloMove<Metadata>): void;
  solve(fromFacelets: string, targetFacelets: string): Promise<string | null>;
  startFromCube(timestamp: number): boolean;
  stopFromCube(timestamp?: number): boolean;
}

const EMPTY_OUTCOME: SmartCubeSoloMoveOutcome = {
  delivered: false,
  futureHistory: false,
  guidanceCompleted: false,
  recorded: false,
  started: false,
};

/**
 * Runtime-neutral orchestration for one Solo smart-cube timer surface.
 *
 * The host owns transport, React state and persistence. This controller owns
 * the order-sensitive path between a normalized move and the timer: an armed
 * first turn starts before it is recorded, running history recovery is still
 * recorded, scramble completion can arm exactly once, and solved edges stop
 * only the event that entered the running phase.
 */
export class SmartCubeSoloTimerController<
  Metadata extends SmartCubeSoloMoveMetadata = SmartCubeSoloMoveMetadata,
> {
  private connected = false;
  private context: SmartCubeSoloTimerContext | null = null;
  private contextRevision = 0;
  private disposed = false;
  private running = false;
  private runningEvent: EventId | null = null;
  private readonly guidance: ReturnType<typeof createSmartCubeGuidanceController>;

  constructor(private readonly options: SmartCubeSoloTimerControllerOptions<Metadata>) {
    this.guidance = createSmartCubeGuidanceController({
      onChange: options.onGuidanceChange,
      solve: options.solve,
    });
  }

  getGuidanceSnapshot(): SmartCubeGuidanceState {
    return this.guidance.snapshot();
  }

  setConnected(connected: boolean): void {
    if (this.disposed || this.connected === connected) return;
    this.connected = connected;
    this.guidance.setConnected(connected);
  }

  setContext(context: SmartCubeSoloTimerContext | null): void {
    if (this.disposed || (
      this.context?.event === context?.event
      && this.context?.id === context?.id
      && this.context?.scramble === context?.scramble
      && this.context?.targetFacelets === context?.targetFacelets
    )) return;
    this.context = context;
    this.contextRevision++;
    this.guidance.setContext(context?.targetFacelets ? {
      id: context.id,
      scramble: context.scramble,
      targetFacelets: context.targetFacelets,
    } : null);
  }

  setRunning(running: boolean): void {
    if (this.disposed || this.running === running) return;
    this.running = running;
    if (running) this.runningEvent = this.context?.event ?? this.runningEvent;
    else this.runningEvent = null;
    this.guidance.setRunning(running);
  }

  /** Refresh visible guidance from authoritative state without creating a completion edge. */
  syncFacelets(facelets: string): SmartCubeGuidanceState {
    return this.guidance.syncFacelets(facelets);
  }

  move(event: SmartCubeSoloMove<Metadata>): SmartCubeSoloMoveOutcome {
    const outcome = { ...EMPTY_OUTCOME };
    outcome.futureHistory = event.metadata?.futureHistory === true;
    if (this.disposed || !this.connected) return outcome;

    const context = this.context;
    const contextRevision = this.contextRevision;
    try {
      if (this.running || this.options.getPhase() === 'running') {
        this.enterRunning(context?.event ?? null);
        this.options.recordMove(event);
        outcome.recorded = true;
        return outcome;
      }
      if (outcome.futureHistory) return outcome;

      const phase = this.options.getPhase();
      if (context
        && (phase === 'inspecting' || phase === 'holding' || phase === 'ready')
        && timerSmartCubeStartsAttemptOnTurn(context.event)
        && this.options.isTimingEnabled()
        && this.options.canStartAttempt()
        && this.options.startFromCube(event.timestamp)) {
        this.enterRunning(context.event);
        this.options.recordMove(event);
        outcome.recorded = true;
        outcome.started = true;
        return outcome;
      }

      if (!event.facelets
        || !context?.targetFacelets
        || !timerSupportsSmartCubeAutoTiming(context.event)
        || contextRevision !== this.contextRevision) return outcome;
      const observation = this.guidance.observe(event.facelets);
      outcome.guidanceCompleted = observation.completedNow;
      if (observation.completedNow
        && contextRevision === this.contextRevision
        && timerSmartCubeStartsAttemptOnTurn(context.event)
        && this.options.isTimingEnabled()
        && this.options.canStartAttempt()
        && this.options.autoReadyOnScramble()) {
        const currentPhase = this.options.getPhase();
        if (currentPhase === 'idle' || currentPhase === 'stopped') this.options.armFromCube();
      }
      return outcome;
    } finally {
      if (!outcome.futureHistory && this.connected && !this.disposed) {
        this.options.onMove?.(event);
        outcome.delivered = true;
      }
    }
  }

  solved(timestamp?: number): boolean {
    if (this.disposed || !this.connected) return false;
    const running = this.running || this.options.getPhase() === 'running';
    const event = this.runningEvent ?? this.context?.event ?? null;
    if (!running || !event || !timerSupportsSmartCubeAutoTiming(event)) return false;
    const stopped = this.options.stopFromCube(timestamp);
    if (stopped) this.setRunning(false);
    return stopped;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.connected = false;
    this.context = null;
    this.running = false;
    this.runningEvent = null;
    this.contextRevision++;
    this.guidance.dispose();
  }

  private enterRunning(event: EventId | null): void {
    if (!this.running) {
      this.running = true;
      this.runningEvent = event ?? this.runningEvent;
    }
    this.guidance.setRunning(true);
  }
}
