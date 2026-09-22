import {
  SOLVED_SMART_CUBE_FACELETS,
  SmartCubeStateTracker,
} from './cubie';
import { MoveClock } from './move_clock';

export interface SmartCubeSessionSnapshot<Metadata = unknown> {
  active: boolean;
  facelets: string | null;
  generation: number;
  lastMove: string | null;
  lastMoveMetadata: Metadata | undefined;
  rawFacelets: string | null;
  solved: boolean;
}

export interface SmartCubeSessionMove<Metadata = unknown> {
  facelets: string;
  metadata: Metadata | undefined;
  move: string;
  rawFacelets: string;
  timestamp: number;
}

export interface SmartCubeSessionLease<Metadata = unknown> {
  readonly generation: number;
  adoptFacelets(facelets: string, solvedTimestamp?: number): boolean;
  isCurrent(): boolean;
  move(move: string, deviceTimestamp?: number, metadata?: Metadata): SmartCubeSessionMove<Metadata> | null;
}

export interface SmartCubeSessionControllerOptions<Metadata = unknown> {
  isSolved?(facelets: string): boolean;
  now?(): number;
  onChange?(snapshot: SmartCubeSessionSnapshot<Metadata>): void;
  onMove?(event: SmartCubeSessionMove<Metadata>): void;
  onSolved?(timestamp?: number): void;
  projectFacelets?(rawFacelets: string): string;
}

export interface OpenSmartCubeSessionOptions {
  publishInitialState?: boolean;
}

/**
 * Runtime-neutral owner of one smart-cube move/state stream.
 *
 * Platform adapters still own discovery, permissions, GATT and protocol
 * handshakes. Once a driver starts producing normalized moves and facelets,
 * this controller owns their generation, state model, device clock and solved
 * edge. A lease from an older connection becomes inert as soon as another
 * session opens or the current session closes.
 */
export class SmartCubeSessionController<Metadata = unknown> {
  private readonly tracker = new SmartCubeStateTracker();
  private readonly moveClock = new MoveClock();
  private generation = 0;
  private wasSolved = true;
  private snapshot: SmartCubeSessionSnapshot<Metadata> = {
    active: false,
    facelets: null,
    generation: 0,
    lastMove: null,
    lastMoveMetadata: undefined,
    rawFacelets: null,
    solved: true,
  };

  constructor(private readonly options: SmartCubeSessionControllerOptions<Metadata> = {}) {}

  getSnapshot(): SmartCubeSessionSnapshot<Metadata> {
    return { ...this.snapshot };
  }

  getFacelets(): string | null {
    return this.snapshot.facelets;
  }

  getRawFacelets(): string | null {
    return this.snapshot.rawFacelets;
  }

  open(options: OpenSmartCubeSessionOptions = {}): SmartCubeSessionLease<Metadata> {
    const generation = ++this.generation;
    this.tracker.reset();
    this.moveClock.reset();
    this.wasSolved = true;
    const rawFacelets = this.tracker.getFacelets();
    const facelets = options.publishInitialState === false
      ? null
      : this.project(rawFacelets);
    this.snapshot = {
      active: true,
      facelets,
      generation,
      lastMove: null,
      lastMoveMetadata: undefined,
      rawFacelets: facelets === null ? null : rawFacelets,
      solved: facelets === null ? true : this.isSolved(facelets),
    };
    this.wasSolved = this.snapshot.solved;
    this.emit();

    return {
      generation,
      adoptFacelets: (nextFacelets, solvedTimestamp) => (
        this.adoptFacelets(generation, nextFacelets, solvedTimestamp)
      ),
      isCurrent: () => this.isCurrent(generation),
      move: (move, deviceTimestamp, metadata) => (
        this.applyMove(generation, move, deviceTimestamp, metadata)
      ),
    };
  }

  close(): void {
    this.clear(true);
  }

  /** Invalidate late driver callbacks without notifying an unmounted host. */
  dispose(): void {
    this.clear(false);
  }

  private clear(notify: boolean): void {
    ++this.generation;
    this.tracker.reset();
    this.moveClock.reset();
    this.wasSolved = true;
    this.snapshot = {
      active: false,
      facelets: null,
      generation: this.generation,
      lastMove: null,
      lastMoveMetadata: undefined,
      rawFacelets: null,
      solved: true,
    };
    if (notify) this.emit();
  }

  /** Reset the software model without manufacturing a solved completion edge. */
  resetState(): boolean {
    if (!this.snapshot.active) return false;
    this.tracker.reset();
    const rawFacelets = this.tracker.getFacelets();
    const facelets = this.project(rawFacelets);
    const solved = this.isSolved(facelets);
    this.wasSolved = solved;
    this.snapshot = {
      ...this.snapshot,
      facelets,
      lastMoveMetadata: undefined,
      rawFacelets,
      solved,
    };
    this.emit();
    return true;
  }

  /** Re-evaluate the current raw state after a host changes its projection. */
  republish(solvedTimestamp?: number): boolean {
    if (!this.snapshot.active) return false;
    const rawFacelets = this.tracker.getFacelets();
    this.publishFacelets(rawFacelets, solvedTimestamp);
    return true;
  }

  resetClock(): void {
    this.moveClock.reset();
  }

  private isCurrent(generation: number): boolean {
    return this.snapshot.active && this.generation === generation;
  }

  private applyMove(
    generation: number,
    move: string,
    deviceTimestamp?: number,
    metadata?: Metadata,
  ): SmartCubeSessionMove<Metadata> | null {
    if (!this.isCurrent(generation)) return null;
    const timestamp = this.moveClock.stamp(
      deviceTimestamp,
      this.options.now?.() ?? Date.now(),
    );
    this.tracker.applyMove(move);
    const rawFacelets = this.tracker.getFacelets();
    const facelets = this.project(rawFacelets);
    const solved = this.isSolved(facelets);
    const becameSolved = solved && !this.wasSolved;
    this.wasSolved = solved;
    this.snapshot = {
      ...this.snapshot,
      facelets,
      lastMove: move,
      lastMoveMetadata: metadata,
      rawFacelets,
      solved,
    };
    const event = { facelets, metadata, move, rawFacelets, timestamp };
    this.options.onMove?.(event);
    this.emit();
    if (becameSolved) this.options.onSolved?.(timestamp);
    return event;
  }

  private adoptFacelets(
    generation: number,
    facelets: string,
    solvedTimestamp?: number,
  ): boolean {
    if (!this.isCurrent(generation) || !this.tracker.adoptFacelets(facelets)) return false;
    this.publishFacelets(facelets, solvedTimestamp);
    return true;
  }

  private publishFacelets(rawFacelets: string, solvedTimestamp?: number): void {
    const facelets = this.project(rawFacelets);
    const solved = this.isSolved(facelets);
    const becameSolved = solved && !this.wasSolved;
    this.wasSolved = solved;
    this.snapshot = {
      ...this.snapshot,
      facelets,
      lastMoveMetadata: undefined,
      rawFacelets,
      solved,
    };
    this.emit();
    if (becameSolved) this.options.onSolved?.(solvedTimestamp);
  }

  private project(rawFacelets: string): string {
    return this.options.projectFacelets?.(rawFacelets) ?? rawFacelets;
  }

  private isSolved(facelets: string): boolean {
    return this.options.isSolved?.(facelets) ?? facelets === SOLVED_SMART_CUBE_FACELETS;
  }

  private emit(): void {
    this.options.onChange?.(this.getSnapshot());
  }
}
