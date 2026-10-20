/**
 * Turn a smart cube's device clock into timestamps comparable with the host's
 * monotonic clock. BLE notifications can arrive in batches, so their arrival
 * times are not precise enough for timing or reconstruction.
 */

/** csTimer's re-anchor threshold (`gancube.js:474`). */
export const RESYNC_THRESHOLD_MS = 2000;

/** A larger jump is treated as a wrap/restart/unit mismatch. */
const MAX_PLAUSIBLE_DELTA_MS = 60_000;

export interface MoveClockStampOptions { delayed?: boolean }

export class MoveClock {
  private anchorDevice: number | null = null;
  private anchorLocal = 0;
  private prevDevice: number | null = null;

  get anchored(): boolean {
    return this.anchorDevice !== null;
  }

  stamp(deviceTs: number | undefined, localTs: number, options?: MoveClockStampOptions): number {
    if (deviceTs === undefined || !Number.isFinite(deviceTs)) {
      // An untimed historical turn is not a device-clock reset. Keep the last
      // known instant as an estimate until a timed neighbour arrives; stamping
      // it at reply arrival would shift every following turn into the future.
      if (options?.delayed && this.anchorDevice !== null && this.prevDevice !== null) {
        return this.anchorLocal + this.prevDevice - this.anchorDevice;
      }
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
      this.anchorDevice = deviceTs;
      this.anchorLocal = localTs;
      this.prevDevice = deviceTs;
      return localTs;
    }
    this.prevDevice = deviceTs;

    const estimated = this.anchorLocal + (deviceTs - this.anchorDevice);
    // Recovered history describes past turns. Its reply latency is not clock
    // drift; preserve the existing anchor for the whole unblocked batch.
    if (!options?.delayed && Math.abs(estimated - localTs) > RESYNC_THRESHOLD_MS) {
      this.anchorDevice = deviceTs;
      this.anchorLocal = localTs;
      return localTs;
    }
    return estimated;
  }

  reset(): void {
    this.anchorDevice = null;
    this.anchorLocal = 0;
    this.prevDevice = null;
  }
}
