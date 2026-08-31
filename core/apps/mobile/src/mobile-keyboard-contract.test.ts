// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  resolveKeymap,
  timerKeyDownDecision,
  timerKeyUpDecision,
  type TimerKeyDownContext,
} from '@cuberoot/shared/timer';
import { timerKeyboardTargetContext } from '@cuberoot/timer-ui';

const app = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
const controller = readFileSync(join(
  process.cwd(),
  'src',
  'hooks',
  'use-timer-controller.ts',
), 'utf8');

const base: Omit<TimerKeyDownContext, 'input' | 'phase' | 'timingEnabled'> = {
  bldMemoActive: false,
  keymap: resolveKeymap(undefined),
  modal: 'none',
  multiStageActive: false,
  solveCount: 9,
  target: { noTimerRegion: false, select: false, textEntry: false },
};

describe('Mobile shared keyboard integration', () => {
  it('uses the exact Web decision table for fixed controls and default bindings', () => {
    expect(timerKeyDownDecision({
      ...base,
      input: { code: 'Space' },
      phase: 'idle',
      timingEnabled: false,
    }).command).toEqual({ id: 'next-scramble' });
    expect(timerKeyDownDecision({
      ...base,
      input: { code: 'KeyQ' },
      phase: 'running',
      timingEnabled: true,
    }).command).toEqual({ id: 'press-down', warmupSound: false });
    expect(timerKeyDownDecision({
      ...base,
      input: { code: 'Escape' },
      phase: 'stopped',
      timingEnabled: true,
    }).command).toEqual({ id: 'reset' });
    expect(timerKeyDownDecision({
      ...base,
      input: { code: 'KeyZ' },
      phase: 'stopped',
      timingEnabled: true,
    }).command).toEqual({ id: 'delete-last' });
    expect(timerKeyDownDecision({
      ...base,
      input: { code: 'KeyD', shiftKey: true },
      phase: 'stopped',
      timingEnabled: true,
    }).command).toEqual({ id: 'toggle-dns' });
    expect(timerKeyDownDecision({
      ...base,
      input: { code: 'Digit3' },
      phase: 'stopped',
      timingEnabled: true,
    }).command).toEqual({ id: 'open-solve', offsetFromLast: 3 });
    expect(timerKeyUpDecision({
      input: { code: 'Space' },
      modalOpen: false,
      target: base.target,
      timingEnabled: true,
    }).command).toEqual({ id: 'press-up' });
  });

  it('shares one DOM target classifier and removes the controller keyboard copy', () => {
    const input = document.createElement('input');
    const noTimer = document.createElement('button');
    noTimer.dataset.noTimer = '';
    expect(timerKeyboardTargetContext(input)).toMatchObject({ textEntry: true });
    expect(timerKeyboardTargetContext(noTimer)).toMatchObject({ noTimerRegion: true });

    expect(app).toContain('timerKeyDownDecision({');
    expect(app).toContain('timerKeyUpDecision({');
    expect(app).toContain('keymap: keymapRef.current');
    expect(app).toContain('target: timerKeyboardTargetContext(event.target)');
    expect(app).toContain('const attemptCanStart = timerCanStartAttempt({');
    expect(app).toContain('canStart: attemptCanStart');
    expect(controller).toContain('timerCanHandleAttemptPress(machineRef.current.phase, canStartRef.current)');
    for (const id of [
      'delete-last',
      'toggle-plus2',
      'toggle-dnf',
      'toggle-dns',
      'next-scramble',
      'prev-scramble',
      'toggle-fullscreen',
      'open-solve',
    ]) expect(app).toContain(`case '${id}'`);
    expect(controller).not.toContain("addEventListener('keydown'");
    expect(controller).not.toContain('eventTargetsControl');
  });
});
