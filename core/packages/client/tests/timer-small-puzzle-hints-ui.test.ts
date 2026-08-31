// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TimerSmallPuzzleHintCopy } from '@cuberoot/shared/timer';

const solveTimerSmallHints = vi.hoisted(() => vi.fn());

vi.mock('@cuberoot/puzzle-solvers/timer-small-hints', async (importOriginal) => ({
  ...await importOriginal<typeof import('@cuberoot/puzzle-solvers/timer-small-hints')>(),
  solveTimerSmallHints,
}));

import { TimerSmallPuzzleHints } from '@cuberoot/timer-ui';

const labels: TimerSmallPuzzleHintCopy = {
  alreadySolved: 'already solved',
  computing: 'Computing…',
  failed: 'Unable to compute hints',
  fullSolve: 'Full solve',
  noSolution: 'no solution',
  perFace: 'Per-face',
  title: '2x2 solver hints',
};

const result = {
  full: { moves: ['R', "U'"], length: 2 },
  faces: [
    { face: 'U', moves: ['R'] },
    { face: 'R', moves: ['R', 'U'] },
  ],
};

describe('shared Timer small-puzzle hints UI', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    solveTimerSmallHints.mockReset();
    solveTimerSmallHints.mockReturnValue(result);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  function render(scramble: string, phase: 'idle' | 'running' = 'idle'): void {
    act(() => root.render(createElement(TimerSmallPuzzleHints, {
      event: '222',
      labels,
      phase,
      scramble,
    })));
  }

  async function flushSolver(): Promise<void> {
    await act(async () => vi.runOnlyPendingTimers());
  }

  it('expands, reports loading, renders exact rows and closes cleanly', async () => {
    render("R U R'");
    const trigger = host.querySelector<HTMLButtonElement>('button')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[aria-busy="true"]')?.textContent).toContain('Computing…');
    await flushSolver();

    expect(solveTimerSmallHints).toHaveBeenCalledWith('222', "R U R'");
    expect(host.querySelectorAll('.timer-small-hints-row')).toHaveLength(3);
    expect(host.textContent).toContain("R U'");

    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.timer-small-hints-body')).toBeNull();
  });

  it('does not rank zero-length face answers and distinguishes them from solved full state', async () => {
    solveTimerSmallHints.mockReturnValueOnce({
      full: { moves: [], length: 0 },
      faces: [
        { face: 'U', moves: [] },
        { face: 'R', moves: ['R'] },
      ],
    });
    render('mixed-empty');
    act(() => host.querySelector<HTMLButtonElement>('button')!.click());
    await flushSolver();

    const rows = [...host.querySelectorAll<HTMLElement>('.timer-small-hints-row')];
    expect(rows[0].textContent).toContain('already solved');
    expect(rows[1].textContent).toContain('—no solution');
    expect(rows[1].classList.contains('is-best')).toBe(false);
    expect(rows[2].classList.contains('is-best')).toBe(true);

    solveTimerSmallHints.mockReturnValueOnce({
      full: { moves: ['R'], length: 1 },
      faces: [
        { face: 'U', moves: [] },
        { face: 'R', moves: [] },
      ],
    });
    render('all-empty');
    await flushSolver();
    const emptyFaceRows = [...host.querySelectorAll<HTMLElement>('.timer-small-hints-row')].slice(1);
    expect(emptyFaceRows.every((row) => !row.classList.contains('is-best'))).toBe(true);
    expect(emptyFaceRows.every((row) => row.textContent?.includes('no solution'))).toBe(true);
  });

  it('shows a real error state when the shared solver throws', async () => {
    solveTimerSmallHints.mockImplementationOnce(() => { throw new Error('bad scramble'); });
    render('bad');
    act(() => host.querySelector<HTMLButtonElement>('button')!.click());
    await flushSolver();

    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Unable to compute hints');
    expect(host.querySelector('.timer-small-hints-row')).toBeNull();
  });

  it('cancels stale work when the scramble changes before computation starts', async () => {
    render('old');
    act(() => host.querySelector<HTMLButtonElement>('button')!.click());
    render('new');
    await flushSolver();

    expect(solveTimerSmallHints).toHaveBeenCalledTimes(1);
    expect(solveTimerSmallHints).toHaveBeenCalledWith('222', 'new');
  });

  it('uses the timer phase contract to hide and disable the control while running', () => {
    render('run', 'running');
    const panel = host.querySelector<HTMLElement>('.timer-small-hints')!;
    const trigger = host.querySelector<HTMLButtonElement>('button')!;
    expect(panel.dataset.timing).toBe('true');
    expect(trigger.disabled).toBe(true);
    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
