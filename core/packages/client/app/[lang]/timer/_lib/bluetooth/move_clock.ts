/**
 * Turning a smart cube's own clock into timestamps the app can use.
 *
 * Why this exists
 * ---------------
 * The obvious timestamp for a move is "when the notification arrived"
 * (`performance.now()` in the handler). It is also the wrong one. BLE delivers
 * notifications on connection intervals — typically 7.5-30 ms — and a cube
 * turned quickly produces several moves inside one interval, which then all
 * arrive in the same batch. Their arrival times cluster within a millisecond
 * of each other regardless of how far apart the turns actually were.
 *
 * That is fine for "when did the solve end". It is useless for the questions a
 * training platform is built on — how long was the pause before this F2L pair,
 * how much of that OLL was recognition and how much was execution — because
 * those are differences between consecutive moves, which is exactly the
 * quantity the batching destroys.
 *
 * GAN v3/v4 move frames carry a 32-bit millisecond counter from the cube's own
 * clock. The intervals between those are the real turn intervals. What they
 * lack is any relation to our clock, and they drift.
 *
 * What this does
 * --------------
 * Anchors the device clock to the local clock once, then reports
 * `anchorLocal + (deviceTs - anchorDevice)` — local-comparable timestamps with
 * device-clock precision. Drift is corrected by re-anchoring whenever the
 * prediction strays far enough from arrival time that drift, not batching, has
 * to be the explanation.
 *
 * This is csTimer's `updateMoveTimes` (`gancube.js:461-488`) reduced to the
 * part that matters here: it keeps `deviceTime + deviceTimeOffset` and
 * re-syncs when that disagrees with local time by more than 2 s. csTimer
 * additionally linear-fits the two clocks (`bluetoothutil.js:407-475`) to
 * recover a drift *slope*; a fixed 2 s re-anchor is the same idea with a
 * coarser correction, and it is what the analysis layer needs to be correct —
 * intervals within a solve, not absolute agreement across an hour.
 *
 * Falls back to arrival time whenever the device clock is absent or says
 * something impossible, so a brand with no timestamps (or a firmware that
 * reports nonsense) degrades to exactly the old behaviour instead of
 * producing confident garbage.
 */

/**
 * Re-anchor when the device-derived estimate is this far from arrival time.
 * csTimer's threshold, verbatim (`gancube.js:474`). Well above BLE batching
 * jitter (tens of ms) and above any plausible single-notification delay, so
 * crossing it means the clocks have genuinely diverged.
 */
export const RESYNC_THRESHOLD_MS = 2000;

/**
 * Reject a device-clock delta larger than this between consecutive moves.
 * A real gap that long is possible (the user put the cube down), but so is a
 * counter wrap or a unit mismatch, and we cannot tell them apart. Arrival time
 * is right to within a notification's latency in both cases, so use it and
 * re-anchor: the cost of being wrong here is one move's timestamp, versus a
 * whole session of them if a wrapped counter were trusted.
 */
const MAX_PLAUSIBLE_DELTA_MS = 60_000;

export class MoveClock {
  /** Device-clock reading at the anchor point. null until the first stamp. */
  private anchorDevice: number | null = null;
  /** Local-clock reading at the same anchor point. */
  private anchorLocal = 0;
  /** Previous device reading, for plausibility checks. */
  private prevDevice: number | null = null;

  /** True once a device clock has been seen and trusted. */
  get anchored(): boolean {
    return this.anchorDevice !== null;
  }

  /**
   * Timestamp one move.
   *
   * @param deviceTs  the cube's own clock reading in ms, or undefined for a
   *                  brand/frame that carries none.
   * @param localTs   `performance.now()` at notification receipt.
   * @returns a local-clock-comparable timestamp in ms.
   */
  stamp(deviceTs: number | undefined, localTs: number): number {
    if (deviceTs === undefined || !Number.isFinite(deviceTs)) {
      // No device clock: nothing to reconcile, and nothing to keep anchored
      // to either — a later frame that does carry one must re-anchor rather
      // than extrapolate across the gap.
      this.reset();
      return localTs;
    }

    if (this.anchorDevice === null) {
      this.anchorDevice = deviceTs;
      this.anchorLocal = localTs;
      this.prevDevice = deviceTs;
      return localTs;
    }

    const sincePrev = deviceTs - (this.prevDevice ?? deviceTs);
    if (sincePrev < 0 || sincePrev > MAX_PLAUSIBLE_DELTA_MS) {
      // Counter wrapped, firmware restarted, or the units aren't what we
      // think. Re-anchor here and hand back arrival time for this one move.
      this.anchorDevice = deviceTs;
      this.anchorLocal = localTs;
      this.prevDevice = deviceTs;
      return localTs;
    }
    this.prevDevice = deviceTs;

    const estimated = this.anchorLocal + (deviceTs - this.anchorDevice);
    if (Math.abs(estimated - localTs) > RESYNC_THRESHOLD_MS) {
      this.anchorDevice = deviceTs;
      this.anchorLocal = localTs;
      return localTs;
    }
    return estimated;
  }

  /** Drop the anchor — call on disconnect, so a new session starts clean. */
  reset(): void {
    this.anchorDevice = null;
    this.anchorLocal = 0;
    this.prevDevice = null;
  }
}
