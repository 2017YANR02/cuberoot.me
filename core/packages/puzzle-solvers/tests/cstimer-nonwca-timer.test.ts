import { describe, expect, it } from 'vitest';

import {
  CSTIMER_NONWCA_TIMER_EVENTS,
  CSTIMER_NONWCA_TIMER_KEYS,
  generateCstimerNonWcaTimerScramble,
  isCstimerNonWcaTimerEvent,
} from '../src/cstimer-nonwca';

function tokens(scramble: string): string[] {
  return scramble.split(/\s+/).filter(Boolean);
}

describe('shared csTimer non-WCA Timer providers', () => {
  it('locks the complete event-to-upstream identity table', () => {
    expect(CSTIMER_NONWCA_TIMER_EVENTS).toEqual(['kilominx', 'mpyram']);
    expect(CSTIMER_NONWCA_TIMER_KEYS).toEqual({
      kilominx: 'klmso',
      mpyram: 'mpyrso',
    });
    expect(isCstimerNonWcaTimerEvent('kilominx')).toBe(true);
    expect(isCstimerNonWcaTimerEvent('mpyram')).toBe(true);
    expect(isCstimerNonWcaTimerEvent('333')).toBe(false);
  });

  it('generates a non-empty legal Kilominx random-state scramble', () => {
    const scramble = generateCstimerNonWcaTimerScramble('kilominx');
    const moves = tokens(scramble);
    const token = /^(?:U|D|F|B|L|R|DR|DL|BR|BL|DBR|DBL|DFR|DFL)2?'?$/;
    expect(moves.length).toBeGreaterThanOrEqual(10);
    expect(moves.every((move) => token.test(move)), scramble).toBe(true);
    expect(moves.some((move) => /^[A-Z]{2,}/.test(move)), scramble).toBe(true);
  });

  it('generates a non-empty legal Master Pyraminx random-state scramble', () => {
    const scramble = generateCstimerNonWcaTimerScramble('mpyram');
    const moves = tokens(scramble);
    const body = /^(?:U|B|R|L)(?:w)?'?$/;
    const tip = /^[urlb]'?$/;
    expect(moves.length).toBeGreaterThanOrEqual(4);
    expect(moves.every((move) => body.test(move) || tip.test(move)), scramble).toBe(true);
    expect(moves.some((move) => /w/.test(move)), scramble).toBe(true);
  });

  it('rejects a forged event rather than falling back to another puzzle', () => {
    expect(() => generateCstimerNonWcaTimerScramble('333' as 'kilominx')).toThrow(
      'csTimer non-WCA provider cannot generate event: 333',
    );
  });
});
