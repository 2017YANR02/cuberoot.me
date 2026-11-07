/**
 * Reconciling the cube's clock with ours.
 *
 * The property that matters is NOT that timestamps are absolutely correct —
 * it is that the INTERVALS between consecutive moves are, because every
 * downstream metric (TPS, pauses, recognition vs execution, per-phase splits)
 * is a difference between two of them. BLE batches notifications per
 * connection interval, so arrival times cannot carry that information; the
 * cube's own clock can.
 */

import { describe, it, expect } from 'vitest';
import { MoveClock } from '@/app/[lang]/timer/_lib/bluetooth/move_clock';

describe('MoveClock', () => {
  it('does not move the device epoch to the arrival of an untimed history page', () => {
    const clock = new MoveClock();
    expect(clock.stamp(1000, 1000)).toBe(1000);
    expect(clock.stamp(undefined, 5000, { delayed: true })).toBe(1000);
    expect(clock.anchored).toBe(true);
    expect(clock.stamp(1250, 5100, { delayed: true })).toBe(1250);
  });

  it('preserves the device timeline when a history reply arrives seconds late', () => {
    const clock = new MoveClock();
    expect(clock.stamp(1000, 100000)).toBe(100000);
    expect(clock.stamp(1100, 100100)).toBe(100100);
    expect(clock.stamp(1200, 115000, { delayed: true })).toBe(100200);
    expect(clock.stamp(1300, 115000, { delayed: true })).toBe(100300);
    expect(clock.stamp(16000, 115020)).toBe(115000);
    // A firmware restart still resets the anchor, even in recovered history.
    expect(clock.stamp(5, 115100, { delayed: true })).toBe(115100);
  });

  it('recovers true intervals from moves that arrived in one BLE batch', () => {
    const clock = new MoveClock();
    // The cube says these turns were 40 ms apart. The radio delivered all four
    // in a single notification window, so arrival times are ~1 ms apart —
    // this is the exact case that makes arrival-time TPS meaningless.
    const deviceTimes = [10_000, 10_040, 10_080, 10_120];
    const arrivals = [500, 501, 501.5, 502];

    const out = deviceTimes.map((d, i) => clock.stamp(d, arrivals[i]));
    const gaps = out.slice(1).map((t, i) => t - out[i]);

    expect(gaps).toEqual([40, 40, 40]);
  });

  it('anchors to the local clock rather than exposing the device epoch', () => {
    const clock = new MoveClock();
    // A cube counts from its own power-on; that number means nothing to us.
    const first = clock.stamp(9_999_000, 1234);
    expect(first).toBe(1234);
    expect(clock.stamp(9_999_500, 1240)).toBe(1734); // 1234 + 500
  });

  it('falls back to arrival time when the cube sends no clock at all', () => {
    const clock = new MoveClock();
    expect(clock.stamp(undefined, 100)).toBe(100);
    expect(clock.stamp(undefined, 250)).toBe(250);
    expect(clock.anchored).toBe(false);
  });

  it('re-anchors instead of extrapolating across a move with no device time', () => {
    const clock = new MoveClock();
    clock.stamp(1000, 0);
    expect(clock.stamp(1100, 100)).toBe(100);
    // A history-recovered move: the frame reports the turn but not when.
    expect(clock.stamp(undefined, 5000)).toBe(5000);
    // The next timed move must not be measured from the stale anchor, which
    // would place it 4 seconds in the past.
    expect(clock.stamp(1200, 5100)).toBe(5100);
    expect(clock.stamp(1300, 5210)).toBe(5200);
  });

  it('never treats a large arrival delay as a new origin for a valid device clock', () => {
    const clock = new MoveClock();
    clock.stamp(0, 0);
    // Two points cannot distinguish oscillator drift from radio latency.
    // Neither is permission to move the origin of an already-running solve.
    expect(clock.stamp(60_000, 62_500)).toBe(60_000);
    expect(clock.stamp(60_100, 62_600)).toBe(60_100);
  });

  it('preserves device intervals while there is insufficient evidence for rate correction', () => {
    const clock = new MoveClock();
    clock.stamp(0, 0);
    // 100 ms of disagreement is normal BLE latency, not drift. The device
    // interval must win, or the batching problem comes straight back.
    expect(clock.stamp(1000, 1100)).toBe(1000);
    expect(clock.stamp(2000, 2100)).toBe(2000);
  });

  it('refuses a device clock that went backwards or jumped absurdly', () => {
    const clock = new MoveClock();
    clock.stamp(1000, 0);
    clock.stamp(1100, 100);
    // Counter wrap / firmware restart: not distinguishable from a real gap,
    // and trusting it would corrupt every later timestamp.
    expect(clock.stamp(5, 200)).toBe(200);
    expect(clock.stamp(105, 300)).toBe(300);      // re-anchored at 5 -> 200
    // A gap far too large to be a turn interval is likewise not trusted.
    const clock2 = new MoveClock();
    clock2.stamp(0, 0);
    clock2.stamp(100, 100);
    expect(clock2.stamp(10_000_000, 200)).toBe(200);
  });

  it('starts clean after a reset, as on reconnect', () => {
    const clock = new MoveClock();
    clock.stamp(1000, 0);
    clock.stamp(1100, 100);
    clock.reset();
    expect(clock.anchored).toBe(false);
    // A reconnected cube may have restarted its counter; the first move after
    // reset must anchor afresh instead of being placed relative to the old one.
    expect(clock.stamp(50, 9000)).toBe(9000);
  });

  it('keeps sub-millisecond ordering stable for moves in the same millisecond', () => {
    const clock = new MoveClock();
    clock.stamp(1000, 0);
    // Two turns the cube timestamped identically must not go backwards.
    expect(clock.stamp(1000, 10)).toBe(0);
    expect(clock.stamp(1001, 11)).toBe(1);
  });

  it.each([1999, 2000, 2001, 2500])('does not add a late final packet (%i ms) to the result', delay => {
    const clock = new MoveClock();
    const start = clock.stamp(0, 20);
    for (let i = 1; i < 100; i++) clock.stamp(i * 100, 20 + i * 100);
    expect(clock.stamp(10_000, 10_020 + delay) - start).toBe(10_000);
  });

  it.each([0.95, 0.993, 1.007, 1.05])('corrects a learned device rate of %f without moving past timestamps', deviceRate => {
    const clock = new MoveClock();
    let previous = clock.stamp(0, 20);
    let start = 0;
    for (let i = 1; i <= 200; i++) {
      const rateBeforeMove = clock.clockRate;
      const next = clock.stamp(i * 1000 * deviceRate, 20 + i * 1000);
      expect(next - previous).toBeCloseTo(1000 * deviceRate * rateBeforeMove, 7);
      previous = next;
      if (i === 190) start = next;
    }
    expect(clock.clockRate).toBeCloseTo(1 / deviceRate, 10);
    expect(previous - start).toBeCloseTo(10_000, 7);
  });

  it('does not refit partially delivered batches', () => {
    const clock = new MoveClock();
    const mapped = Array.from({ length: 100 }, (_, i) => clock.stamp(i * 100, Math.floor(i / 4) * 400 + 320));
    expect(mapped.slice(1).map((time, i) => time - mapped[i])).toEqual(Array(99).fill(100));
    expect(clock.clockRate).toBe(1);
  });

  it('calibrates irregular turn intervals without relying on the benchmark move grid', () => {
    const clock = new MoveClock();
    const intervals = [43, 167, 81, 209, 56, 144, 93, 207];
    let real = 0;
    clock.stamp(0, 20);
    let first = 0, last = 0;
    for (let i = 0; i < 320; i++) {
      real += intervals[i % intervals.length];
      last = clock.stamp(Math.round(real * 0.993), real + 20);
      if (i === 239) first = last;
    }
    expect(last - first).toBeCloseTo(10_000, 0);
  });

  it('does not follow alternating radio jitter on an accurate device clock', () => {
    const clock = new MoveClock();
    let last = clock.stamp(0, 20);
    for (let i = 1; i <= 300; i++) last = clock.stamp(i * 100, i * 100 + (i % 2 ? 100 : 20));
    expect(clock.clockRate).toBe(1);
    expect(last).toBe(30_020);
  });

  it('keeps fitting invariant to large device and host epochs', () => {
    const intervals = (deviceOrigin: number, localOrigin: number) => {
      const clock = new MoveClock();
      const result: number[] = [];
      for (let i = 0; i <= 200; i++) {
        result.push(clock.stamp(deviceOrigin + i * 1007, localOrigin + i * 1000));
      }
      return { rate: clock.clockRate, span: result[200] - result[190] };
    };
    const original = intervals(0, 0);
    const translated = intervals(4_000_000_000, 1_700_000_000_000);
    expect(translated.rate).toBe(original.rate);
    expect(translated.span).toBeCloseTo(original.span, 3);
  });

  it('does not use delayed history to teach the clock rate and clears calibration on restart', () => {
    const clock = new MoveClock();
    for (let i = 0; i <= 100; i++) clock.stamp(i * 950, i * 1000);
    expect(clock.clockRate).toBeCloseTo(1 / 0.95, 10);
    const rate = clock.clockRate;
    for (let i = 101; i <= 150; i++) clock.stamp(i * 950, 200_000, { delayed: true });
    expect(clock.clockRate).toBe(rate);
    expect(clock.stamp(5, 200_100, { delayed: true })).toBe(200_100);
    expect(clock.clockRate).toBe(1);
    clock.reset();
    expect(clock.clockRate).toBe(1);
    expect(clock.anchored).toBe(false);
  });
});
