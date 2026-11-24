import { timerSupportsSmartCubeAutoTiming } from '@cuberoot/shared/timer/event-catalog';
import { EVENTS } from '@cuberoot/shared/timer/types';
import { watchEvents } from './watch-events';
import { summarize } from '@cuberoot/shared/timer/stats';
import { timerSoloStatRailRows } from '@cuberoot/shared/timer/solo-layout';
import type { Solve } from '@cuberoot/shared/timer/types';
import { createWatchCubeBridge } from '@cuberoot/app-ui/watch-cube';
import './watch-runtime-base64';
// Minimal host scheduler; deadlines use the monotonic clock supplied by watchOS.
let now = 0, nextTimer = 0;
const timers = new Map<number, { at: number; callback: (...args: unknown[]) => void; args: unknown[] }>();
Object.assign(globalThis, {
  setTimeout(callback: (...args: unknown[]) => void, delay = 0, ...args: unknown[]) {
    const id = ++nextTimer; timers.set(id, { at: now + Math.max(0, delay), callback, args }); return id;
  },
  clearTimeout(id: number) { timers.delete(id); },
});
const bridge = createWatchCubeBridge();
(globalThis as unknown as { WatchCube: typeof bridge }).WatchCube = {
  dispatch(input) {
    if (typeof input.now === 'number') now = input.now;
    bridge.dispatch(input);
    for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(...timer.args); }
  },
  drain: bridge.drain,
  scramblePreview: bridge.scramblePreview,
  supportsDevice: bridge.supportsDevice,
  normalizeMac: bridge.normalizeMac,
};

// The host supplies only timing fields, keeping recordings and preview images out of the JS call.
Object.assign(globalThis, {
  watchEvents,
  smartCubeEvents: EVENTS.filter(event => timerSupportsSmartCubeAutoTiming(event.id)).map(event => event.id),
  watchTimerStats(solves: Solve[]) {
    return JSON.stringify(timerSoloStatRailRows(summarize(solves, solves[0]?.event)));
  },
});
