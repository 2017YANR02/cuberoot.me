// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkTimerFmcSolvedness,
  createTimerManualEntryDraft,
  parseTimerFmcSolution,
  timerManualEntryCopy,
  validateTimerManualEntry,
  type TimerManualEntryDraft,
  type TimerManualEntryError,
} from '@cuberoot/shared/timer';
import {
  TimerManualEntryModal,
  type TimerManualEntryLabels,
} from '@cuberoot/timer-ui';

function draft(patch: Partial<TimerManualEntryDraft> = {}): TimerManualEntryDraft {
  return { ...createTimerManualEntryDraft('333', "R U R' U'"), ...patch };
}

const labels: TimerManualEntryLabels = {
  attempted: 'Attempted',
  attemptedPlaceholder: 'e.g. 13',
  cancel: 'Cancel',
  comment: 'Comment',
  commentPlaceholder: 'Optional notes',
  error: (error: TimerManualEntryError) => `error:${error}`,
  fmcChecking: (count) => `checking:${count}`,
  fmcComment: 'FMC comment',
  fmcInvalidToken: (token) => `invalid:${token}`,
  fmcMoveCount: 'Move count',
  fmcMoveCountPlaceholder: 'e.g. 26',
  fmcSolved: (count) => `solved:${count}`,
  fmcSolution: 'Solution',
  fmcSolutionPlaceholder: 'e.g. moves',
  fmcUnchecked: (count) => `unchecked:${count}`,
  fmcUnsolved: (count) => `unsolved:${count}`,
  mbldDnf: '9f12c DNF',
  mbldPoints: (points) => `points:${points}`,
  mbldTime: 'MBLD time',
  mbldTimePlaceholder: 'e.g. 58:02',
  penalty: 'Penalty',
  save: 'Save',
  scramble: 'Scramble',
  solved: 'Solved',
  solvedPlaceholder: 'e.g. 11',
  time: 'Time',
  timePlaceholder: 'e.g. 12.34',
  title: 'Manual entry',
};

function setValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('shared timer manual-entry rules', () => {
  it('provides one complete English/Simplified-Chinese copy contract to both hosts', () => {
    expect(timerManualEntryCopy('en')).toMatchObject({
      title: 'Manual entry',
      save: 'Save',
      cancel: 'Cancel',
    });
    expect(timerManualEntryCopy('zh-Hans')).toMatchObject({
      title: '手动录入成绩',
      save: '保存',
      cancel: '取消',
    });
    expect(timerManualEntryCopy('zh-Hans').error('mbld-time-invalid')).toContain('58:02');
  });

  it('covers normal time syntax, every penalty, fallback scramble, and comments', () => {
    expect(validateTimerManualEntry(draft({ time: '12.34' })).value).toMatchObject({
      timeMs: 12_340,
      penalty: 'ok',
      scramble: "R U R' U'",
    });
    expect(validateTimerManualEntry(draft({ time: '1:02.34', penalty: 'DNS' })).value).toMatchObject({
      timeMs: 62_340,
      penalty: 'DNS',
    });
    expect(validateTimerManualEntry(draft({ time: '+2 12.34', penalty: 'DNF' })).value).toMatchObject({
      timeMs: 10_340,
      penalty: '+2',
    });
    expect(validateTimerManualEntry(draft({ time: '12.34+2' })).value).toMatchObject({
      timeMs: 12_340,
      penalty: '+2',
    });
    expect(validateTimerManualEntry(draft({ time: 'DNF', penalty: '+2' })).value?.penalty).toBe('DNF');
    expect(validateTimerManualEntry(draft({ time: 'DNS', penalty: '+2' })).value?.penalty).toBe('DNS');
    expect(validateTimerManualEntry(draft({
      time: '12',
      scramble: '  F2  ',
      comment: '  note  ',
    })).value).toMatchObject({ scramble: 'F2', comment: 'note' });
  });

  it('returns stable error codes for every normal-time failure', () => {
    expect(validateTimerManualEntry(draft()).error).toBe('time-required');
    expect(validateTimerManualEntry(draft({ time: '1:60' })).error).toBe('time-invalid');
    expect(validateTimerManualEntry(draft({ time: '+2 1.99' })).error).toBe('plus-two-under-two');
    expect(validateTimerManualEntry(draft({ time: '0' })).error).toBe('time-invalid');
  });

  it('strictly parses FMC notation and counts OBTM without a second parser', () => {
    expect(parseTimerFmcSolution("Rw U x M // first\nE' S # second")).toEqual({
      kind: 'parsed',
      count: 8,
      normalized: "Rw U x M E' S",
    });
    expect(parseTimerFmcSolution("R U Q R'")).toEqual({ kind: 'invalid', token: 'Q' });
    expect(parseTimerFmcSolution(' // only a comment')).toEqual({ kind: 'empty' });
  });

  it('uses the shared cube-state oracle for FMC solvedness', async () => {
    const inverse = parseTimerFmcSolution("U R U' R'");
    const incomplete = parseTimerFmcSolution("U R U'");
    expect(inverse.kind).toBe('parsed');
    expect(incomplete.kind).toBe('parsed');
    if (inverse.kind !== 'parsed' || incomplete.kind !== 'parsed') return;
    await expect(checkTimerFmcSolvedness("R U R' U'", inverse)).resolves.toBe('solved');
    await expect(checkTimerFmcSolvedness("R U R' U'", incomplete)).resolves.toBe('unsolved');
  });

  it('covers FMC derived count, override, invalid notation, and solution storage', () => {
    const derived = validateTimerManualEntry(draft({
      event: '333fm',
      fmcSolution: "U R U' R'",
      comment: '  transcribed  ',
    }));
    expect(derived.value).toMatchObject({
      timeMs: 4_000,
      penalty: 'ok',
      comment: "U R U' R'\ntranscribed",
    });
    expect(validateTimerManualEntry(draft({ event: '333fm' })).error).toBe('fmc-required');
    expect(validateTimerManualEntry(draft({ event: '333fm', fmcSolution: 'Q' })).error).toBe('fmc-solution-invalid');
    expect(validateTimerManualEntry(draft({ event: '333fm', fmcMoveCount: '-1' })).error).toBe('fmc-move-count-invalid');
    const override = validateTimerManualEntry(draft({
      event: '333fm',
      fmcMoveCount: '26',
      fmcSolution: 'Q',
    }));
    expect(override.value?.timeMs).toBe(26_000);
    expect(override.fmc).toEqual({ kind: 'invalid', token: 'Q' });
  });

  it('validates MBLD and derives points plus 9f12c DNF at exact boundaries', () => {
    const valid = validateTimerManualEntry(draft({
      event: '333mbld', mbldSolved: '2', mbldAttempted: '4', time: '58:02',
    }));
    expect(valid.value).toMatchObject({
      timeMs: 3_482_000,
      penalty: 'ok',
      mbld: { solved: 2, attempted: 4 },
    });
    expect(valid.mbld).toMatchObject({ points: 0, dnf: false, result: '2/4 58:02' });

    const onlyOne = validateTimerManualEntry(draft({
      event: '333mbld', mbldSolved: '1', mbldAttempted: '2', time: '10:00',
    }));
    expect(onlyOne.value?.penalty).toBe('DNF');
    expect(onlyOne.mbld).toMatchObject({ points: 0, dnf: true, result: 'DNF (1/2 10:00)' });

    const negative = validateTimerManualEntry(draft({
      event: '333mbld', mbldSolved: '2', mbldAttempted: '6', time: '10:00',
    }));
    expect(negative.value?.penalty).toBe('DNF');
    expect(negative.mbld?.points).toBe(-2);

    expect(validateTimerManualEntry(draft({
      event: '333mbld', mbldSolved: '2', mbldAttempted: '1', time: '10:00',
    })).error).toBe('mbld-attempted-invalid');
    expect(validateTimerManualEntry(draft({
      event: '333mbld', mbldSolved: '-1', mbldAttempted: '2', time: '10:00',
    })).error).toBe('mbld-solved-invalid');
    expect(validateTimerManualEntry(draft({
      event: '333mbld', mbldSolved: '3', mbldAttempted: '2', time: '10:00',
    })).error).toBe('mbld-solved-exceeds-attempted');
    expect(validateTimerManualEntry(draft({
      event: '333mbld', mbldSolved: '2', mbldAttempted: '2', time: 'DNF',
    })).error).toBe('mbld-time-invalid');
  });
});

describe('shared timer manual-entry modal', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('submits normal DNS with the displayed scramble and returns focus on close', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    await act(async () => root.render(createElement(TimerManualEntryModal, {
      currentScramble: "R U R'",
      event: '333',
      labels,
      onClose,
      onSubmit,
    })));
    await act(async () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    }));
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(document.activeElement).toBe(host.querySelector('input[placeholder="e.g. 12.34"]'));

    await act(async () => {
      setValue(host.querySelector<HTMLInputElement>('input[placeholder="e.g. 12.34"]')!, '12.34');
      host.querySelector<HTMLInputElement>('input[value="DNS"]')!.click();
    });
    await act(async () => host.querySelector<HTMLButtonElement>('.timer-manual-entry__action--primary')!.click());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      event: '333', penalty: 'DNS', scramble: "R U R'", timeMs: 12_340,
    }));

    await act(async () => root.unmount());
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
    root = createRoot(host);
  });

  it('renders FMC validation and rejects a bad token without an override', async () => {
    const onSubmit = vi.fn();
    await act(async () => root.render(createElement(TimerManualEntryModal, {
      currentScramble: "R U R' U'",
      event: '333fm',
      labels,
      onClose: vi.fn(),
      onSubmit,
    })));
    const solution = host.querySelector<HTMLTextAreaElement>('textarea[placeholder="e.g. moves"]')!;
    await act(async () => setValue(solution, 'Q'));
    expect(host.textContent).toContain('invalid:Q');
    expect(host.querySelector<HTMLButtonElement>('.timer-manual-entry__action--primary')!.disabled).toBe(true);

    await act(async () => setValue(solution, "U R U' R'"));
    expect(host.querySelector<HTMLButtonElement>('.timer-manual-entry__action--primary')!.disabled).toBe(false);
    await vi.waitFor(() => expect(host.textContent).toContain('solved:4'));
    await act(async () => host.querySelector<HTMLButtonElement>('.timer-manual-entry__action--primary')!.click());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ timeMs: 4_000, penalty: 'ok' }));
  });

  it('shows and submits a rule-derived MBLD DNF', async () => {
    const onSubmit = vi.fn();
    await act(async () => root.render(createElement(TimerManualEntryModal, {
      currentScramble: 'multi scramble',
      event: '333mbld',
      labels,
      onClose: vi.fn(),
      onSubmit,
    })));
    const inputs = [...host.querySelectorAll<HTMLInputElement>('.timer-manual-entry__input')];
    await act(async () => {
      setValue(inputs[0], '1');
      setValue(inputs[1], '2');
      setValue(inputs[2], '10:00');
    });
    expect(host.textContent).toContain('DNF (1/2 10:00)');
    expect(host.textContent).toContain('points:0');
    expect(host.textContent).toContain('9f12c DNF');
    await act(async () => host.querySelector<HTMLButtonElement>('.timer-manual-entry__action--primary')!.click());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      penalty: 'DNF',
      mbld: { solved: 1, attempted: 2 },
    }));
  });

  it('closes with Escape and traps Tab inside the dialog', async () => {
    const onClose = vi.fn();
    await act(async () => root.render(createElement(TimerManualEntryModal, {
      currentScramble: '',
      event: '333',
      labels,
      onClose,
      onSubmit: vi.fn(),
    })));
    const focusable = [...host.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea')];
    focusable[focusable.length - 1].focus();
    const tab = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab' });
    focusable[focusable.length - 1].dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(focusable[0]);

    const shiftTab = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab',
      shiftKey: true,
    });
    focusable[0].dispatchEvent(shiftTab);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);

    focusable[focusable.length - 1].dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape',
    }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps IME-composed text and Space inside the modal instead of the host timer', async () => {
    const onSubmit = vi.fn();
    await act(async () => root.render(createElement(TimerManualEntryModal, {
      currentScramble: 'R U',
      event: '333',
      labels,
      onClose: vi.fn(),
      onSubmit,
    })));
    const time = host.querySelector<HTMLInputElement>('input[placeholder="e.g. 12.34"]')!;
    const comment = host.querySelector<HTMLTextAreaElement>('textarea[placeholder="Optional notes"]')!;
    const leakedShortcut = vi.fn();
    window.addEventListener('keydown', leakedShortcut);
    try {
      await act(async () => {
        comment.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
        setValue(comment, '中文备注');
        comment.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文备注' }));
        comment.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: ' ',
        }));
        setValue(time, '9.87');
      });
      expect(leakedShortcut).not.toHaveBeenCalled();
      await act(async () => host.querySelector<HTMLButtonElement>('.timer-manual-entry__action--primary')!.click());
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        comment: '中文备注',
        timeMs: 9_870,
      }));
    } finally {
      window.removeEventListener('keydown', leakedShortcut);
    }
  });
});

describe('website manual-entry adapter', () => {
  it('is a thin consumer of shared UI and has no duplicate form state/parser', () => {
    const source = readFileSync(resolve(
      process.cwd(),
      'app/[lang]/timer/_components/ManualEntryModal.tsx',
    ), 'utf8');
    expect(source).toContain("from '@cuberoot/timer-ui'");
    expect(source).toContain('TimerManualEntryModal');
    expect(source).not.toContain('useState');
    expect(source).not.toContain('parseTimerEntry');
    expect(source).not.toContain('checkMbldEntry');
  });

  it('keeps the shared modal scrollable and non-overflowing with a mobile IME', () => {
    const timerUiEntry = import.meta.resolve('@cuberoot/timer-ui');
    const css = readFileSync(new URL('./manual-entry.css', timerUiEntry), 'utf8');
    expect(css).toMatch(/\.timer-manual-entry__dialog \{[\s\S]*?min-width: 0;[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: auto;/);
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toMatch(/@media \(max-width: 480px\)[\s\S]*?max-height: min\(95dvh, 100%\);/);
    expect(css).toMatch(/\.timer-manual-entry__input,[\s\S]*?\.timer-manual-entry__textarea \{[\s\S]*?min-height: 44px;[\s\S]*?font-size: 16px;/);
    expect(css).toMatch(/@media \(max-width: 340px\)[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
  });
});
