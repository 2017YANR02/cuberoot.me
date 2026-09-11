import { cubeMove, faceTurnToken, SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { faceletToCubie, validateFacelet, type CubieCube } from '../cube_facelet';

/** Existing two-phase workers return a GENERATOR for the state, not its inverse. */
export type Solve333 = (state: CubieCube) => Promise<string>;

function replay(from: string, moves: readonly string[]): string | null {
  let state = from;
  for (const move of moves) {
    const token = faceTurnToken(move);
    if (!token) return null;
    state = cubeMove(state, token);
  }
  return state;
}

/** Derive the 3D opening from authoritative facelets; never display an unverified answer. */
export async function anchorAlgFor(facelets: string, solve: Solve333): Promise<string[] | null> {
  const target = facelets.toUpperCase();
  if (validateFacelet(target) !== null) return null;
  if (target === SOLVED_3X3) return [];
  try {
    const tokens = (await solve(faceletToCubie(target))).trim().split(/\s+/).filter(Boolean);
    return tokens.length > 0 && replay(SOLVED_3X3, tokens) === target ? tokens : null;
  } catch { return null; }
}

export interface LiveSmartCubeAnchorSnapshot {
  moves: readonly string[];
  algAnchored: boolean;
}

/**
 * One session-owned anchor for Web and installed clients. React renders do not
 * cancel the pending solve: subsequent turns queue behind its captured opening.
 * A different authoritative state or connection invalidates the old generation.
 */
export class LiveSmartCubeAnchor {
  private connection: string | null = null;
  private revision = 0;
  private facelets: string | null = null;
  private pendingMoves: string[] = [];
  private snapshot: LiveSmartCubeAnchorSnapshot = { moves: [], algAnchored: false };

  constructor(private readonly options: {
    solve: Solve333;
    onChange(snapshot: LiveSmartCubeAnchorSnapshot): void;
  }) {}

  getSnapshot(): LiveSmartCubeAnchorSnapshot { return this.snapshot; }

  private publish(moves: readonly string[], algAnchored: boolean): void {
    this.snapshot = { moves, algAnchored };
    this.options.onChange(this.snapshot);
  }

  setConnection(key: string | null): void {
    if (this.connection === key) return;
    this.connection = key;
    this.revision++;
    this.facelets = null;
    this.pendingMoves = [];
    this.publish([], false);
  }

  move(move: string): void {
    if (!this.connection || !this.facelets) return;
    const next = replay(this.facelets, [move]);
    if (!next) {
      this.revision++;
      this.facelets = null;
      this.pendingMoves = [];
      this.publish([], false);
      return;
    }
    this.facelets = next;
    if (next === SOLVED_3X3) {
      this.revision++;
      this.pendingMoves = [];
      this.publish([], true);
    } else if (this.snapshot.algAnchored) {
      this.publish([...this.snapshot.moves, move], true);
    } else {
      this.pendingMoves.push(move);
    }
  }

  observeFacelets(facelets: string | null | undefined): void {
    if (!this.connection) return;
    const target = facelets?.toUpperCase() ?? null;
    if (target === this.facelets) return;
    // If this differs from the move-derived state it is a real state resync,
    // not another render. Never layer the target opening over the old log.
    const revision = ++this.revision;
    this.facelets = target;
    this.pendingMoves = [];
    this.publish([], false);
    if (!target || validateFacelet(target) !== null) { this.facelets = null; return; }
    if (target === SOLVED_3X3) { this.publish([], true); return; }
    void anchorAlgFor(target, this.options.solve).then((opening) => {
      if (revision !== this.revision || !this.connection || opening === null) return;
      const moves = [...opening, ...this.pendingMoves];
      if (replay(SOLVED_3X3, moves) !== this.facelets) return;
      this.pendingMoves = [];
      this.publish(moves, true);
    });
  }
}
