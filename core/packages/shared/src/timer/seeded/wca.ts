import * as nx from './nxnxn';
import * as other from './others';
import * as bld from './bld';
import type { Scramble222Mode } from '../scramble-222';

/** The basic timed WCA dispatch used by the seeded worker and native Mini Program. */
const generators = {
  '222': nx.scramble222, '333': nx.scramble333,
  '444': nx.scramble444, '555': nx.scramble555, '666': nx.scramble666, '777': nx.scramble777,
  '333oh': nx.scramble333, '333bld': bld.scramble333Bld,
  '444bld': bld.scramble444Bld, '555bld': bld.scramble555Bld,
  pyra: other.scramblePyra, skewb: other.scrambleSkewb, sq1: other.scrambleSq1,
  mega: other.scrambleMega, clock: other.scrambleClock,
};
export type TimedWcaEvent = keyof typeof generators;
export function isTimedWcaEvent(event: string): event is TimedWcaEvent {
  return Object.hasOwn(generators, event);
}
export function generateTimedWcaScramble(event: TimedWcaEvent, random: () => number, mode?: Scramble222Mode): string {
  return event === '222' ? nx.scramble222(random, mode) : generators[event](random);
}
