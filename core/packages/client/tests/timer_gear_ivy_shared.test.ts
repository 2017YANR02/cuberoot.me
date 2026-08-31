import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { generateGearTimerScramble, solveGear } from '@cuberoot/puzzle-solvers/gear';
import { generateIvyTimerScramble, solveIvy } from '@cuberoot/puzzle-solvers/ivy';
import { generateTimerScramble } from '@cuberoot/shared/timer';
import {
  NON_WCA_EVENT_IDS,
  cstimerKeyForEvent,
  isNonWcaEvent,
} from '@/app/[lang]/timer/_lib/scramble/nonwca';

const gearAdapter = readFileSync(new URL('../lib/gear-solver.ts', import.meta.url), 'utf8');
const ivyAdapter = readFileSync(new URL('../lib/ivy-solver.ts', import.meta.url), 'utf8');
const webDispatcher = readFileSync(
  new URL('../app/[lang]/timer/_lib/scramble/index.ts', import.meta.url),
  'utf8',
);

describe('Web/Mobile shared Gear and Ivy Timer providers', () => {
  it('keeps the former Web solver entries as thin public-package adapters', () => {
    expect(gearAdapter).toContain("export * from '@cuberoot/puzzle-solvers/gear'");
    expect(ivyAdapter).toContain("export * from '@cuberoot/puzzle-solvers/ivy'");
    expect(gearAdapter).not.toContain('function buildGraph');
    expect(ivyAdapter).not.toContain('function buildGraph');
  });

  it('keeps csTimer spellings for storage/oracles without running a second production worker', () => {
    expect(cstimerKeyForEvent('gear')).toBe('gearso');
    expect(cstimerKeyForEvent('ivy')).toBe('ivyso');
    expect(isNonWcaEvent('gear')).toBe(false);
    expect(isNonWcaEvent('ivy')).toBe(false);
    expect(NON_WCA_EVENT_IDS).not.toContain('gear');
    expect(NON_WCA_EVENT_IDS).not.toContain('ivy');
  });

  it('makes the Web dispatcher and shared Mobile runtime consume identical generators', async () => {
    expect(webDispatcher).toContain('gear:    generateGearTimerScramble');
    expect(webDispatcher).toContain('ivy:     generateIvyTimerScramble');
    const gearSample = 0.25;
    const expectedGear = generateGearTimerScramble(() => gearSample);
    await expect(generateTimerScramble({ event: 'gear' }, { random: () => gearSample }))
      .resolves.toEqual({
        ok: true,
        event: 'gear',
        kind: 'generated',
        provider: 'small-puzzle-random-state',
        scramble: expectedGear,
      });
    expect(solveGear(expectedGear).length).toBe(4);

    const ivySample = 0.5;
    const expectedIvy = generateIvyTimerScramble(() => ivySample);
    await expect(generateTimerScramble({ event: 'ivy' }, { random: () => ivySample }))
      .resolves.toEqual({
        ok: true,
        event: 'ivy',
        kind: 'generated',
        provider: 'small-puzzle-random-state',
        scramble: expectedIvy,
      });
    expect(solveIvy(expectedIvy).length).toBe(6);
  });
});
