import {
  SmartCubeSoloTimerController,
  type SmartCubeSoloMove,
  type SmartCubeSoloMoveMetadata,
  type SmartCubeSoloTimerContext,
  type SmartCubeSoloTimerControllerOptions,
} from '@cuberoot/shared/smart-cube/solo-timer';
import type { SmartCubeGuidanceState } from '@cuberoot/shared/smart-cube/scramble-guidance';

export type TrainingCubeStage = 'idle' | 'preparing' | 'queued' | 'active' | 'running';
export interface TrainingCubeSnapshot<Context> {
  id: string;
  connected: boolean;
  stage: TrainingCubeStage;
  context: Context | null;
  guidance: SmartCubeGuidanceState;
}
export interface MultiCubeTrainingSnapshot<Context> {
  activeId: string | null;
  scrambleId: string | null;
  cubes: TrainingCubeSnapshot<Context>[];
}

interface Cube<Context, Metadata extends SmartCubeSoloMoveMetadata> extends TrainingCubeSnapshot<Context> {
  controller: SmartCubeSoloTimerController<Metadata>;
  facelets: string | null;
}

/** One athlete, independent per-device guidance, and a FIFO of verified cubes.
 * The host retains scramble generation and persistence; tickets never migrate
 * between cubes, and only the active cube can reach the shared timer/recorder.
 */
export class MultiCubeTrainingController<
  Context extends SmartCubeSoloTimerContext,
  Metadata extends SmartCubeSoloMoveMetadata = SmartCubeSoloMoveMetadata,
> {
  private cubes = new Map<string, Cube<Context, Metadata>>();
  private queue: string[] = [];
  private activeId: string | null = null;
  private scrambleId: string | null = null;
  private finishedId: string | null = null;
  private lastAssigned = -1;
  private usedTickets = new Set<Context['id']>();
  private scheduling = false;

  constructor(private readonly options: {
    timer: SmartCubeSoloTimerControllerOptions<Metadata>;
    onChange(snapshot: MultiCubeTrainingSnapshot<Context>): void;
    onActive(id: string, context: Context): void;
    onNeedScramble(): void;
    onDisplay(context: Context): void;
    onCancelArm(): void;
  }) {}

  snapshot(): MultiCubeTrainingSnapshot<Context> {
    return {
      activeId: this.activeId,
      scrambleId: this.scrambleId,
      cubes: [...this.cubes.values()].map(({ controller: _controller, facelets: _facelets, ...cube }) => ({ ...cube })),
    };
  }

  active(): TrainingCubeSnapshot<Context> | null {
    return this.activeId ? this.cubes.get(this.activeId) ?? null : null;
  }

  reset(notify = true): void {
    for (const cube of this.cubes.values()) cube.controller.dispose();
    this.cubes.clear();
    this.queue = [];
    this.usedTickets.clear();
    this.activeId = this.scrambleId = this.finishedId = null;
    this.lastAssigned = -1;
    if (notify) this.emit();
  }

  connect(id: string, connected: boolean): void {
    let cube = this.cubes.get(id);
    if (!cube) {
      if (!connected) return;
      const timer = this.options.timer;
      const controller = new SmartCubeSoloTimerController<Metadata>({
        ...timer,
        // Completion is queued below, never allowed to arm the global timer directly.
        autoReadyOnScramble: () => false,
        canStartAttempt: () => this.activeId === id && timer.canStartAttempt(),
        getPhase: () => this.activeId === id ? timer.getPhase() : 'idle',
        onGuidanceChange: guidance => {
          const current = this.cubes.get(id);
          if (current) { current.guidance = guidance; this.emit(); }
        },
        onMove: event => { if (this.activeId === id) timer.onMove?.(event); },
        startFromCube: timestamp => {
          if (this.activeId !== id || !timer.startFromCube(timestamp)) return false;
          this.cubes.get(id)!.stage = 'running';
          this.emit();
          return true;
        },
        stopFromCube: timestamp => {
          if (this.activeId !== id || !timer.stopFromCube(timestamp)) return false;
          // Drain only after the finishing move has left the old controller.
          this.finishedId = id;
          return true;
        },
      });
      cube = { id, connected, controller, stage: 'idle', context: null, facelets: null,
        guidance: { correctionActive: false, hint: null, match: null } };
      this.cubes.set(id, cube);
    } else if (cube.connected === connected) return;
    cube.connected = connected;
    cube.controller.setConnected(connected);
    // A running disconnected cube retains exclusive ownership until reconnect/cancel.
    // Unstarted tickets require a new state verification on reconnect.
    if (!connected && cube.stage !== 'running') {
      this.queue = this.queue.filter(key => key !== id);
      if (this.activeId === id) { this.activeId = null; this.options.onCancelArm(); }
      cube.stage = cube.context ? 'preparing' : 'idle';
      if (this.scrambleId === id) this.scrambleId = null;
    }
    this.schedule(false);
    this.emit();
  }

  setContext(context: Context): void {
    const cube = this.scrambleId ? this.cubes.get(this.scrambleId) : null;
    if (!cube || (this.usedTickets.has(context.id) && cube.context?.id !== context.id)) return;
    if (cube.context === context) return;
    if (cube.context?.id !== context.id) this.usedTickets.add(context.id);
    cube.context = context;
    cube.controller.setContext(context);
    if (cube.facelets) cube.controller.syncFacelets(cube.facelets);
    this.emit();
  }

  syncFacelets(id: string, facelets: string): void {
    const cube = this.cubes.get(id);
    if (!cube?.connected || cube.facelets === facelets) return;
    cube.facelets = facelets;
    // State packets may invalidate a waiting ticket, but must never start a solve.
    if ((cube.stage === 'queued' || cube.stage === 'active')
      && facelets !== cube.context?.targetFacelets) this.invalidate(cube);
    cube.controller.syncFacelets(facelets);
    this.schedule(false);
    this.emit();
  }

  /** Preserve an already armed, verified first cube when adding another device. */
  restoreReady(id: string): void {
    const cube = this.cubes.get(id);
    if (cube?.context?.targetFacelets && cube.facelets === cube.context.targetFacelets) this.enqueue(cube);
  }

  move(id: string, event: SmartCubeSoloMove<Metadata>) {
    const cube = this.cubes.get(id);
    if (!cube?.connected) return;
    if (!event.metadata?.futureHistory && (cube.stage === 'queued'
      || (cube.stage === 'active' && ['idle', 'stopped'].includes(this.options.timer.getPhase())))
      && event.facelets !== cube.context?.targetFacelets) this.invalidate(cube);
    cube.facelets = event.facelets;
    const outcome = cube.controller.move(event);
    if (outcome.guidanceCompleted && cube.stage === 'preparing') this.enqueue(cube, event.timestamp);
    this.drainFinished();
    this.schedule(false);
    this.emit();
    return outcome;
  }

  solved(id: string, timestamp?: number): void {
    this.cubes.get(id)?.controller.solved(timestamp);
    this.drainFinished();
  }

  /** Called after an explicit host abort/reset; other cubes keep their tickets. */
  finishActive(): void {
    if (this.activeId) { this.finishedId = this.activeId; this.drainFinished(); }
  }

  resume(): void {
    const active = this.active();
    const beforeActive = this.activeId;
    const beforeScramble = this.scrambleId;
    const phase = this.options.timer.getPhase();
    if (active?.connected && active.stage === 'active' && this.options.timer.autoReadyOnScramble()
      && (phase === 'idle' || phase === 'stopped')
      && this.options.timer.canStartAttempt() && this.options.timer.isTimingEnabled()) {
      this.options.timer.armFromCube();
    }
    this.schedule(false);
    if (beforeActive !== this.activeId || beforeScramble !== this.scrambleId) this.emit();
  }

  private invalidate(cube: Cube<Context, Metadata>): void {
    if (this.activeId === cube.id) { this.activeId = null; this.options.onCancelArm(); }
    this.queue = this.queue.filter(id => id !== cube.id);
    cube.stage = 'preparing';
    // Reset the completion latch while retaining this cube's exact ticket.
    cube.controller.setContext(null);
    cube.controller.setContext(cube.context);
  }

  private enqueue(cube: Cube<Context, Metadata>, timestamp?: number): void {
    if (cube.stage !== 'preparing') return;
    cube.stage = 'queued';
    if (!this.queue.includes(cube.id)) this.queue.push(cube.id);
    if (this.scrambleId === cube.id) this.scrambleId = null;
    this.schedule(true, timestamp);
    this.emit();
  }

  private drainFinished(): void {
    if (!this.finishedId) return;
    const cube = this.cubes.get(this.finishedId);
    this.finishedId = null;
    if (cube) {
      cube.controller.setRunning(false);
      cube.controller.setContext(null);
      cube.context = null;
      cube.stage = 'idle';
    }
    this.activeId = null;
    this.schedule(true);
    this.emit();
  }

  private schedule(advance: boolean, timestamp?: number): void {
    if (this.scheduling) return;
    this.scheduling = true;
    try {
      if (!this.activeId && this.options.timer.getPhase() !== 'running') {
        const id = this.queue.find(key => this.cubes.get(key)?.connected);
        const cube = id ? this.cubes.get(id) : null;
        if (cube?.context) {
          this.queue = this.queue.filter(key => key !== cube.id);
          this.activeId = cube.id;
          cube.stage = 'active';
          this.options.onActive(cube.id, cube.context);
          if (this.options.timer.autoReadyOnScramble() && this.options.timer.canStartAttempt()
            && this.options.timer.isTimingEnabled()) this.options.timer.armFromCube(timestamp);
        }
      }
      if (this.scrambleId) return;
      const cubes = [...this.cubes.values()];
      // Resume an interrupted ticket before consuming another one.
      let cube = cubes.find(candidate => candidate.connected && candidate.stage === 'preparing');
      if (!cube) {
        for (let offset = 1; offset <= cubes.length; offset++) {
          const index = (this.lastAssigned + offset) % cubes.length;
          const candidate = cubes[index];
          if (candidate.connected && candidate.stage === 'idle') { cube = candidate; this.lastAssigned = index; break; }
        }
      }
      if (cube) {
        this.scrambleId = cube.id;
        cube.stage = 'preparing';
        if (cube.context) this.options.onDisplay(cube.context);
        else if (advance || this.usedTickets.size > 0) this.options.onNeedScramble();
      }
    } finally { this.scheduling = false; }
  }

  private emit(): void { this.options.onChange(this.snapshot()); }
}
