/**
 * Turn a smart cube's device clock into timestamps comparable with the host's
 * monotonic clock. BLE notifications can arrive in batches, so their arrival
 * times are not precise enough for timing or reconstruction.
 */

/** A larger jump is treated as a wrap/restart/unit mismatch. */
const MAX_PLAUSIBLE_DELTA_MS = 60_000;

// Bound both memory and per-notification work, even across a long connection.
const MAX_OBSERVATIONS = 512;
const MIN_OBSERVATIONS = 8;
const MIN_FIT_SPAN_MS = 1000;
const MIN_FIT_INTERVAL_MS = 250;
// Reject units/batching masquerading as oscillator drift. This is an estimator
// validity bound, not a brand-specific correction or an accuracy guarantee.
const MIN_RATE = 0.8;
const MAX_RATE = 1.25;

interface Observation { device: number; local: number }
interface Calibration extends Observation { rate: number }

/** An immutable reading, scoped to one uninterrupted device-clock epoch. */
export interface MoveClockSample {
  readonly epoch: number;
  readonly deviceTime: number;
  readonly timestamp: number;
  readonly rate: number;
  /** Affine host-clock estimate, for aligning host-timed gyro with corrected moves. */
  readonly hostTime: number;
}

let nextEpoch = 0;

/** Recompute the entire interval at one rate, without subtracting shifted host anchors. */
export function moveClockElapsed(start: MoveClockSample | undefined, end: MoveClockSample | undefined): number | null {
  if (!start || !end || start.epoch !== end.epoch || end.rate < MIN_RATE || end.rate > MAX_RATE) return null;
  const span = (end.deviceTime - start.deviceTime) * end.rate;
  return Number.isFinite(span) && span >= 0 ? span : null;
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const mid = values.length >>> 1;
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

/** Robust seed followed by centered least squares; absolute epochs never enter sums. */
function clockCalibration(observations: readonly Observation[]): Calibration | null {
  if (observations.length < MIN_OBSERVATIONS) return null;
  const origin = observations[0];
  const points = observations.map(point => ({ x: point.device - origin.device, y: point.local - origin.local }));
  if (points.at(-1)!.x < MIN_FIT_SPAN_MS) return null;

  // Distant pairs avoid dividing radio jitter by one tiny move interval. The
  // median seed resists isolated late packets at either end of the window.
  const lag = Math.floor(points.length / 2);
  const slopes: number[] = [];
  for (let i = lag; i < points.length; i++) {
    const dx = points[i].x - points[i - lag].x;
    if (dx > 0) slopes.push((points[i].y - points[i - lag].y) / dx);
  }
  if (!slopes.length) return null;
  const seed = median(slopes);
  if (seed < MIN_RATE || seed > MAX_RATE) return null;
  const offsets = points.map(point => point.y - seed * point.x);
  const center = median([...offsets]);
  const tolerance = Math.max(5, 4 * median(offsets.map(value => Math.abs(value - center))));
  const kept = points.filter((_, i) => Math.abs(offsets[i] - center) <= tolerance);
  if (kept.length < MIN_OBSERVATIONS || kept.at(-1)!.x - kept[0].x < MIN_FIT_SPAN_MS) return null;

  const meanX = kept.reduce((sum, point) => sum + point.x, 0) / kept.length;
  const meanY = kept.reduce((sum, point) => sum + point.y, 0) / kept.length;
  let xx = 0, xy = 0;
  for (const point of kept) {
    xx += (point.x - meanX) ** 2;
    xy += (point.x - meanX) * (point.y - meanY);
  }
  const rate = xy / xx;
  if (!Number.isFinite(rate) || rate < MIN_RATE || rate > MAX_RATE) return null;
  const residualSquares = kept.reduce((sum, point) => sum + ((point.y - meanY) - rate * (point.x - meanX)) ** 2, 0);
  // Do not teach an otherwise accurate clock to follow ordinary radio jitter.
  // This residual-based noise gate is not a confidence guarantee: correlated
  // latency can still be indistinguishable from clock-rate error.
  const noise = Math.sqrt(residualSquares / (kept.length - 2) / xx);
  const acceptedRate = Math.abs(rate - 1) <= 3 * noise ? 1 : rate;
  return { device: origin.device,
    local: origin.local + median(kept.map(point => point.y - acceptedRate * point.x)), rate: acceptedRate };
}

export interface MoveClockStampOptions { delayed?: boolean }

export class MoveClock {
  private prevDevice: number | null = null;
  private mapped = 0;
  private rate = 1;
  private observations: Observation[] = [];
  private lastFitDevice: number | null = null;
  private epoch = 0;
  private calibration: Calibration | null = null;
  private lastSample: MoveClockSample | undefined;

  get sample(): MoveClockSample | undefined { return this.lastSample; }

  /** Host milliseconds per device millisecond, applied only to future intervals. */
  get clockRate(): number { return this.rate; }

  get anchored(): boolean {
    return this.prevDevice !== null;
  }

  stamp(deviceTs: number | undefined, localTs: number, options?: MoveClockStampOptions): number {
    this.lastSample = undefined;
    if (deviceTs === undefined || !Number.isFinite(deviceTs)) {
      // An untimed historical turn is not a device-clock reset. Keep the last
      // known instant as an estimate until a timed neighbour arrives; stamping
      // it at reply arrival would shift every following turn into the future.
      if (options?.delayed && this.prevDevice !== null) {
        return this.mapped;
      }
      this.reset();
      return localTs;
    }

    const sincePrev = deviceTs - (this.prevDevice ?? deviceTs);
    if (this.prevDevice === null || sincePrev < 0 || sincePrev > MAX_PLAUSIBLE_DELTA_MS) {
      this.reset();
      this.prevDevice = deviceTs;
      this.mapped = localTs;
      if (!options?.delayed) this.observe(deviceTs, localTs);
      this.capture(deviceTs);
      return localTs;
    }
    this.prevDevice = deviceTs;
    // Integrate calibrated intervals. Changing the rate must never move the
    // origin: an already-recorded solve start belongs to this same timeline.
    // In particular a late final notification cannot add its delay to a solve,
    // nor can its newly estimated rate affect the interval it just delivered.
    this.mapped += sincePrev * this.rate;
    if (!options?.delayed) this.observe(deviceTs, localTs);
    this.capture(deviceTs);
    return this.mapped;
  }

  private capture(deviceTime: number): void {
    const fit = this.calibration;
    this.lastSample = { epoch: this.epoch, deviceTime, timestamp: this.mapped, rate: this.rate,
      hostTime: fit ? fit.local + (deviceTime - fit.device) * fit.rate : this.mapped };
  }

  private observe(device: number, local: number): void {
    const previous = this.observations.at(-1);
    if (previous && (local < previous.local || device <= previous.device)) return;
    // Several turns delivered together have only one independent host sample.
    if (previous?.local === local) this.observations[this.observations.length - 1] = { device, local };
    else this.observations.push({ device, local });
    if (this.observations.length > MAX_OBSERVATIONS) this.observations.shift();
    if (this.lastFitDevice !== null && device - this.lastFitDevice < MIN_FIT_INTERVAL_MS) return;
    this.lastFitDevice = device;
    // The newest sample may still be followed by other turns from the same
    // notification. Fit completed observations only, never a partial batch.
    const calibration = clockCalibration(this.observations.slice(0, -1));
    if (calibration !== null) {
      this.calibration = calibration;
      this.rate = calibration.rate;
    }
  }

  reset(): void {
    this.prevDevice = null;
    this.mapped = 0;
    this.rate = 1;
    this.observations = [];
    this.lastFitDevice = null;
    this.epoch = ++nextEpoch;
    this.calibration = null;
    this.lastSample = undefined;
  }
}
