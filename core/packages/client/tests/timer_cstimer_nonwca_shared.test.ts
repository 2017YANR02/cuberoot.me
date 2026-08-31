import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  CSTIMER_NONWCA_TIMER_EVENTS,
  CSTIMER_NONWCA_TIMER_KEYS,
} from '@cuberoot/puzzle-solvers/cstimer-nonwca';
import {
  NON_WCA_EVENT_IDS,
  cstimerKeyForEvent,
  isNonWcaEvent,
} from '@/app/[lang]/timer/_lib/scramble/nonwca';

const workerSource = readFileSync(new URL(
  '../app/[lang]/timer/_lib/scramble/cstimer-nonwca-shared.worker.ts',
  import.meta.url,
), 'utf8');
const adapterSource = readFileSync(new URL(
  '../app/[lang]/timer/_lib/scramble/nonwca.ts',
  import.meta.url,
), 'utf8');

describe('Web shared Kilominx/Master Pyraminx provider adapter', () => {
  it('keeps exact Timer and csTimer identities', () => {
    expect(CSTIMER_NONWCA_TIMER_EVENTS).toEqual(['kilominx', 'mpyram']);
    expect(CSTIMER_NONWCA_TIMER_KEYS).toEqual({
      kilominx: 'klmso',
      mpyram: 'mpyrso',
    });
    for (const event of CSTIMER_NONWCA_TIMER_EVENTS) {
      expect(isNonWcaEvent(event)).toBe(true);
      expect(NON_WCA_EVENT_IDS).toContain(event);
      expect(cstimerKeyForEvent(event)).toBe(CSTIMER_NONWCA_TIMER_KEYS[event]);
    }
  });

  it('keeps the Web worker a thin adapter over the package provider', () => {
    expect(workerSource).toContain("from '@cuberoot/puzzle-solvers/cstimer-nonwca'");
    expect(workerSource).toContain('generateCstimerNonWcaTimerScramble(event)');
    expect(workerSource).not.toContain("getScramble('klmso'");
    expect(workerSource).not.toContain("getScramble('mpyrso'");
    expect(adapterSource).not.toContain("key: 'klmso'");
    expect(adapterSource).not.toContain("key: 'mpyrso'");
  });
});
