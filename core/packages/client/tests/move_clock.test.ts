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
import { MoveClock, RESYNC_THRESHOLD_MS } from '@/app/[lang]/timer/_lib/bluetooth/move_clock';

describe('MoveClock', () => {
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

  it('re-anchors when the two clocks have genuinely drifted apart', () => {
    const clock = new MoveClock();
    clock.stamp(0, 0);
    // Device clock runs slow: after a long session it is behind local time by
    // more than the threshold. Keeping the old anchor would report every
    // subsequent move seconds before it happened.
    const drifted = clock.stamp(60_000, 60_000 + RESYNC_THRESHOLD_MS + 500);
    expect(drifted).toBe(60_000 + RESYNC_THRESHOLD_MS + 500);
    // ...and intervals are correct again from the new anchor.
    expect(clock.stamp(60_100, 62_600)).toBe(60_000 + RESYNC_THRESHOLD_MS + 600);
  });

  it('tolerates drift below the threshold rather than re-anchoring constantly', () => {
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
});
