import * as nx from './nxnxn';
import * as other from './others';
import * as bld from './bld';
import { rngFor } from './seeded_rng';
import { applyColorNeutral, isCnEligible, type CnMode } from '../color-neutral';
import { formatTimerCompoundScramble, TIMER_COMPOUND_SCRAMBLE_CHILDREN } from '../compound-scramble';
import type { Scramble222Mode } from '../scramble-222';
import type { TimerSeedTicket } from '../sync-seed';

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

export type SeededBasicWcaEvent = TimedWcaEvent | '333fm' | '333mbld';
export function isSeededBasicWcaEvent(event: string): event is SeededBasicWcaEvent {
  return isTimedWcaEvent(event) || event === '333fm' || event === '333mbld';
}

export interface SeededBasicWcaScrambleRequest {
  event: SeededBasicWcaEvent;
  ticket: TimerSeedTicket;
  scramble222Mode?: Scramble222Mode;
  cnMode?: CnMode;
}

export function generateBasicWcaScramble(event: SeededBasicWcaEvent, random: () => number, mode?: Scramble222Mode): string {
  return event === '333mbld'
    ? formatTimerCompoundScramble(event, TIMER_COMPOUND_SCRAMBLE_CHILDREN[event].map(child => generateTimedWcaScramble(child, random, mode)), random)
    : generateTimedWcaScramble(event === '333fm' ? '333' : event, random, mode);
}

/** Shared deterministic branch for the basic WCA project catalog. */
export function generateSeededBasicWcaScramble({ event, ticket, scramble222Mode, cnMode }: SeededBasicWcaScrambleRequest): string {
  const random = rngFor(ticket.seed, ticket.index);
  const scramble = generateBasicWcaScramble(event, random, scramble222Mode);
  if (!scramble.trim()) throw new Error('Empty seeded scramble');
  return isCnEligible(event) ? applyColorNeutral(scramble, cnMode ?? 'none', random) : scramble;
}
