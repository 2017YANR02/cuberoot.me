/**
 * GAN move-stream synchroniser — the FIFO that makes a lossy BLE link safe.
 *
 * Every GAN move event carries a serial number. Notifications get dropped
 * (they are unacknowledged BLE notifies), so "apply whatever arrives" builds a
 * cube model that is silently, permanently wrong: the tracked state ends up
 * being the true state times the inverse of whatever was lost, and every
 * downstream feature — the scramble check, auto-stop-on-solved, the live cube
 * view — is then lying.
 *
 * csTimer solved this years ago and the logic here is a faithful port of
 * `gancube.js`'s `evictMoveBuffer` / `injectLostMoveToBuffer` /
 * `requestMoveHistory` / `isMoveNumberInRange` (D:\cube\cstimer). The rules:
 *
 *   - A move is only applied when its serial is EXACTLY one past the last
 *     applied one. Anything ahead of that waits in the buffer.
 *   - On a hole, ask the cube for its move history and keep waiting. The cube
 *     remembers the last ~50 turns, so the gap gets filled from the source
 *     rather than guessed.
 *   - History replies are injected at the buffer head, oldest-first, and only
 *     if they actually fall in the missing window.
 *   - If the buffer grows past 16 the link is beyond repair; the caller is
 *     told to drop the connection rather than keep a wrong model alive.
 *
 * Serial numbers are compared modulo 256 throughout, exactly as csTimer does:
 * move events carry a 16-bit counter but history replies carry 8 bits, and the
 * `& 0xFF` comparison is what lets the two be mixed.
 *
 * Shared by `gan_v3.ts` and `gan_v4.ts`, whose move/history frames differ only
 * in bit offsets. GAN v2 does not need this — it sends a 7-move sliding window
 * in every frame, so a single drop is self-healing there.
 */

/** How far the buffer may run ahead before we call the link unrecoverable. */
const MAX_PENDING = 16;

export interface BufferedMove {
  /** The cube's serial number for this move. */
  cnt: number;
  /** WCA face notation, single quarter turn (`R`, `R'`). */
  mv: string;
}

export interface GanMoveSyncHooks {
  /**
   * Ask the cube to replay `numberOfMoves` moves ending at `startMoveCnt`.
   * The driver owns the actual GATT write (the opcode differs per version).
   * Called with csTimer's already-adjusted window — see `requestHistory`.
   */
  requestHistory?: (startMoveCnt: number, numberOfMoves: number) => void;
  /** The buffer wedged: the caller should tear the connection down. */
  onWedged?: () => void;
}

export class GanMoveSync {
  /**
   * Serial of the last move handed to the host. -1 means "not seeded yet" —
   * in that state move events are ignored, because we do not know how far the
   * cube has already turned. The facelets snapshot is what seeds it.
   */
  private prevMoveCnt = -1;
  /** Serial from the most recent move / facelets event, seeded or not. */
  private lastSeenCnt = -1;
  private readonly buffer: BufferedMove[] = [];
  private readonly hooks: GanMoveSyncHooks;

  constructor(hooks: GanMoveSyncHooks = {}) {
    this.hooks = hooks;
  }

  /** True once a facelets snapshot (or a first move event) has set the base. */
  get seeded(): boolean {
    return this.prevMoveCnt !== -1;
  }

  /** Serial the host is currently caught up to. Exposed for diagnostics. */
  get counter(): number {
    return this.prevMoveCnt;
  }

  /** Moves waiting on a hole ahead of them. */
  get pending(): number {
    return this.buffer.length;
  }

  /**
   * Adopt the cube's own counter as the baseline — csTimer's `initCubeState`.
   * Everything the cube did before this point is water under the bridge; the
   * accompanying facelet state is the truth.
   */
  seed(moveCnt: number): void {
    this.prevMoveCnt = moveCnt;
    this.lastSeenCnt = moveCnt;
    this.buffer.length = 0;
  }

  /** Note a serial seen on the wire without applying anything. */
  observe(moveCnt: number): void {
    this.lastSeenCnt = moveCnt;
  }

  /** Forget everything (disconnect / re-handshake). */
  reset(): void {
    this.prevMoveCnt = -1;
    this.lastSeenCnt = -1;
    this.buffer.length = 0;
  }

  /**
   * A move event arrived. Returns the moves that are now safe to apply, in
   * chronological order — empty while a hole is being filled.
   */
  push(moveCnt: number, mv: string): string[] {
    this.lastSeenCnt = moveCnt;
    if (this.prevMoveCnt === -1) return [];
    if (moveCnt === this.prevMoveCnt) return [];
    this.buffer.push({ cnt: moveCnt, mv });
    return this.evict(true);
  }

  /**
   * A history reply arrived. `moves` must be in the order the cube sends them
   * (NEWEST first); each is injected only if it fits the missing window.
   * Returns whatever that unblocks.
   */
  injectHistory(moves: BufferedMove[]): string[] {
    if (this.prevMoveCnt === -1) return [];
    for (const m of moves) this.injectLost(m);
    return this.evict(false);
  }

  /**
   * The cube's counter is ahead of ours and the stream has gone quiet —
   * ask for the difference. csTimer only does this on a debounced facelets
   * event, so the caller owns that decision; this just issues the request.
   */
  requestResync(cubeMoveCnt: number): void {
    const diff = (cubeMoveCnt - this.prevMoveCnt) & 0xff;
    if (diff <= 0) return;
    // Firmware bug guard, verbatim from csTimer: a facelets event reporting
    // counter 0 cannot be trusted to mean "move 0 completed", and asking would
    // restore a stale move from the previous counter cycle.
    if (cubeMoveCnt === 0) return;
    const start = this.buffer.length > 0 ? this.buffer[0].cnt : (cubeMoveCnt + 1) & 0xff;
    this.requestHistory(start, diff + 1);
  }

  /* ---------------------------------------------------------------- */

  /**
   * Drain everything that is contiguous with what we have already applied.
   * `reqLostMoves` gates the history request so a history REPLY can't trigger
   * another request from inside itself.
   */
  private evict(reqLostMoves: boolean): string[] {
    const out: string[] = [];
    while (this.buffer.length > 0) {
      const diff = (this.buffer[0].cnt - this.prevMoveCnt) & 0xff;
      if (diff > 1) {
        if (reqLostMoves) this.requestHistory(this.buffer[0].cnt, diff);
        break;
      }
      const move = this.buffer.shift()!;
      out.push(move.mv);
      this.prevMoveCnt = move.cnt;
    }
    if (this.buffer.length > MAX_PENDING) {
      this.hooks.onWedged?.();
    }
    return out;
  }

  /**
   * Is `moveCnt` inside the circular window `(start, end)`? Both ends can be
   * made inclusive. csTimer's `isMoveNumberInRange`, unchanged.
   */
  private static inRange(
    start: number, end: number, moveCnt: number,
    closedStart = false, closedEnd = false,
  ): boolean {
    return ((end - start) & 0xff) >= ((moveCnt - start) & 0xff)
      && (closedStart || ((start - moveCnt) & 0xff) > 0)
      && (closedEnd || ((end - moveCnt) & 0xff) > 0);
  }

  /** csTimer's `injectLostMoveToBuffer` — head-insert, newest reply first. */
  private injectLost(move: BufferedMove): void {
    if (this.buffer.length > 0) {
      if (this.buffer.some((e) => e.cnt === move.cnt)) return;
      if (!GanMoveSync.inRange(this.prevMoveCnt, this.buffer[0].cnt, move.cnt)) return;
      if (move.cnt === ((this.buffer[0].cnt - 1) & 0xff)) this.buffer.unshift(move);
      return;
    }
    if (GanMoveSync.inRange(this.prevMoveCnt, this.lastSeenCnt, move.cnt, false, true)) {
      this.buffer.unshift(move);
    }
  }

  /**
   * Issue a history request, applying csTimer's window alignment: replies are
   * byte-aligned and always start on an odd serial regardless of what was
   * asked for, and the window must never cross the 255 -> 0 edge (moves beyond
   * it come back spoofed as `D`).
   */
  private requestHistory(startMoveCnt: number, numberOfMoves: number): void {
    if (!this.hooks.requestHistory) return;
    let start = startMoveCnt;
    let num = numberOfMoves;
    if (start % 2 === 0) start = (start - 1) & 0xff;
    if (num % 2 === 1) num++;
    num = Math.min(num, start + 1);
    this.hooks.requestHistory(start, num);
  }
}
