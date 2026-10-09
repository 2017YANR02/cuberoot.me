// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TimerStepSolve from '@cuberoot/timer-ui/TimerStepSolve';
import TimerSolverHints from '@cuberoot/timer-ui/TimerSolverHints';
import { METHOD_REGISTRY } from '@cuberoot/puzzle-solvers/timer-333-step';
import { solveMega } from '@cuberoot/puzzle-solvers/timer-mega-hints';
import { __megaSelfCheck } from '@cuberoot/puzzle-solvers/timer-mega-state';
import { sq1MoveCounts } from '@cuberoot/shared/sq1-metrics';

vi.mock('@cuberoot/timer-ui/CuberReconPlayer', () => ({ default: (props: { scramble: string; alg: string }) =>
  createElement('div', { 'data-player-setup': props.scramble, 'data-player-alg': props.alg }) }));
vi.mock('@cuberoot/puzzle-solvers/timer-333-step', async (original) => {
  const actual = await original<typeof import('@cuberoot/puzzle-solvers/timer-333-step')>();
  const result = (scramble: string) => ({ totalMoves: 2, stages: [
    { head: 'Cross', moves: [scramble], failed: false }, { head: 'F2L-1', moves: ['U'], failed: false },
  ] });
  return { ...actual, solveByMethodId: vi.fn((scramble: string) => result(scramble)),
    scheduleTimer333StepSolve: (request: { scramble: string }, publish: (value: unknown) => void, schedule: (run: () => void) => () => void) =>
      schedule(() => publish({ status: 'ready', result: result(request.scramble) })),
  };
});
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  onmessageerror?: () => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor(readonly url: string) { FakeWorker.instances.push(this); }
}

describe('complete shared solver hints', () => {
  let host: HTMLDivElement; let root: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    FakeWorker.instances = [];
    localStorage.clear();
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('keeps six methods, raw stage setup, and hides cached results immediately when changing scramble', async () => {
    await act(async () => root.render(createElement(TimerStepSolve, { scramble: 'R', isZh: false })));
    await act(async () => host.querySelector<HTMLButtonElement>('.stepsolve-head')!.click());
    await act(async () => vi.runOnlyPendingTimers());
    expect(host.querySelectorAll('.stepsolve-tab')).toHaveLength(METHOD_REGISTRY.length);
    await act(async () => host.querySelectorAll<HTMLButtonElement>('.stepsolve-row')[1].click());
    expect(host.querySelector('[data-player-setup]')?.getAttribute('data-player-setup')).toBe('R R');
    expect(host.querySelector('[data-player-alg]')?.getAttribute('data-player-alg')).toBe('U');
    await act(async () => root.render(createElement(TimerStepSolve, { scramble: 'F', isZh: false })));
    expect(host.querySelector('[data-player-alg]')).toBeNull();
    await act(async () => vi.runOnlyPendingTimers());
    expect(host.querySelector('[data-player-setup]')?.getAttribute('data-player-setup')).toBe('F');
    expect(host.querySelector('[data-player-alg]')?.getAttribute('data-player-alg')).toBe('F U');
    await act(async () => host.querySelectorAll<HTMLButtonElement>('.stepsolve-tab')[1].click());
    await act(async () => vi.runOnlyPendingTimers());
    const otherMethodPlayer = host.querySelector('[data-player-alg]');
    await act(async () => host.querySelectorAll<HTMLButtonElement>('.stepsolve-tab')[0].click());
    expect(host.querySelector('[data-player-alg]')).not.toBe(otherMethodPlayer);
  });

  it('lets host Back close comparison first and restores focus without closing the hint panel', async () => {
    let dismiss: (() => boolean) | null = null;
    await act(async () => root.render(createElement(TimerStepSolve, { scramble: 'R', isZh: false,
      onDismissChange: next => { dismiss = next; } })));
    await act(async () => host.querySelector<HTMLButtonElement>('.stepsolve-head')!.click());
    const trigger = host.querySelector<HTMLButtonElement>('.stepsolve-compare')!;
    trigger.focus();
    await act(async () => trigger.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Method comparison');
    await act(async () => { expect(dismiss!()).toBe(true); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(host.querySelector('.stepsolve-body')).not.toBeNull();
    expect(dismiss!()).toBe(false);
  });

  it('terminates SQ1 work on switch/close and never shows the old answer for a new scramble', async () => {
    await act(async () => root.render(createElement(TimerSolverHints, { event: 'sq1', scramble: '(1,0)', isZh: false })));
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    const first = FakeWorker.instances[0];
    expect(first.url).toBe('/tools/cstimer-scramble/scrambler.worker.js');
    expect(first.postMessage).toHaveBeenCalledWith({ id: 1, op: 'solve', key: 'sqrs', scramble: '(1,0)' });
    await act(async () => root.render(createElement(TimerSolverHints, { event: 'sq1', scramble: '(0,1)', isZh: false })));
    expect(first.terminate).toHaveBeenCalledOnce();
    await act(async () => first.onmessage?.({ data: { id: 1, result: 'OLD' } }));
    expect(host.textContent).not.toContain('OLD');
    const second = FakeWorker.instances[1];
    await act(async () => second.onmessage?.({ data: { id: 1, result: '(0,-1)' } }));
    expect(host.textContent).toContain('(0,-1)');
    expect(second.terminate).toHaveBeenCalledOnce();
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(host.textContent).not.toContain('(0,-1)');
  });

  it('surfaces SQ1 timeout instead of an indefinite loading state', async () => {
    await act(async () => root.render(createElement(TimerSolverHints, { event: 'sq1', scramble: '/', isZh: false })));
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    await act(async () => vi.advanceTimersByTimeAsync(90_000));
    expect(host.textContent).toContain('No solution found');
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it('retains SQ1 metric conventions and the existing Megaminx state invariants', () => {
    expect(sq1MoveCounts('(1,2) / (0,-1)')).toEqual({ twist: 1, wca: 3, face: 4, slices: 1, turns: 2, nonIdentityTurns: 2, doubleTurns: 1 });
    expect(__megaSelfCheck()).toBe(true);
    expect(solveMega('')).toEqual({ total: 132, misplaced: 0, solvedPercent: 100 });
    expect(solveMega("R++ R-- U U'")).toEqual({ total: 132, misplaced: 0, solvedPercent: 100 });
  });
});
