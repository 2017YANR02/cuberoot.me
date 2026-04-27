/**
 * Scramble dispatcher — picks the right generator per event id.
 *
 * Round 1B will fill in the BLD/relay/CFOP-step/training generators in
 * sibling files (bld.ts, relay.ts, cfop_step.ts, training.ts). This dispatcher
 * forwards to those when present, falling back to plain 3x3 random-move for
 * unknown events so the UI never produces an empty scramble.
 */

import type { EventId } from '../types';
import {
  scramble222,
  scramble333,
  scramble444,
  scramble555,
  scramble666,
  scramble777,
} from './nxnxn';
import {
  scramblePyra,
  scrambleSkewb,
  scrambleSq1,
  scrambleMega,
  scrambleClock,
} from './others';
import { applyColorNeutral, isCnEligible } from './cn';
import { getSettings } from '../settings';

// Round 1B will export these — soft import via dynamic require so absent files
// don't break the build. We use a runtime registry instead.
type Gen = (rng: () => number) => string;
const REG: Partial<Record<EventId, Gen>> = {
  '222':   scramble222,
  '333':   scramble333,
  '444':   scramble444,
  '555':   scramble555,
  '666':   scramble666,
  '777':   scramble777,
  pyra:    scramblePyra,
  skewb:   scrambleSkewb,
  sq1:     scrambleSq1,
  mega:    scrambleMega,
  clock:   scrambleClock,
  '333oh': scramble333,
  '333fm': scramble333,
  '333mr': scramble333,
};

/**
 * Register a generator for an event. Used by Round 1B modules at import time
 * to plug in BLD/relay/CFOP/training scrambles without modifying this file.
 */
export function registerScramble(event: EventId, gen: Gen): void {
  REG[event] = gen;
}

export function generateScramble(event: EventId, rng: () => number = Math.random): string {
  const gen = REG[event];
  const raw = gen ? gen(rng) : scramble333(rng);
  // Apply color-neutral rotation prefix for 3x3-shaped events.
  if (!isCnEligible(event)) return raw;
  const mode = getSettings().cnMode;
  return applyColorNeutral(raw, mode, rng);
}

/**
 * Mulberry32 — small deterministic PRNG, useful for tests.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import './register';
