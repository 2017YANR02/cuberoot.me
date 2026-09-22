// @vitest-environment jsdom

import { type Solve, type TimerHistoryLocalizedText } from '@cuberoot/shared/timer';
import { TimerSolveDetailModal } from '@cuberoot/timer-ui';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const localize = (copy: TimerHistoryLocalizedText) => copy.en;
const baseSolve: Solve = {
  bld: { memoMs: 4_000 },
  event: '333',
  id: 'solve-1',
  penalty: 'ok',
  scramble: "R U R'",
  stages: { cross: 2_000, f2l: 6_000, oll: 8_000, pll: 10_000 },
  timeMs: 10_000,
  ts: 1_700_000_000_000,
};

describe('shared timer solve detail UI', () => {
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the complete compact detail and binds every real mutation', async () => {
    const onChangeComment = vi.fn();
    const onChangePenalty = vi.fn();
    const onClose = vi.fn();
    const onDelete = vi.fn();
    const onMoveToSession = vi.fn();
    await act(async () => root.render(createElement(TimerSolveDetailModal, {
      formatDate: () => 'Nov 14, 2023, 10:13 PM',
      index: 2,
      localize,
      moveTargets: [{ id: 'session-2', name: 'OH practice' }],
      onChangeComment,
      onChangePenalty,
      onClose,
      onDelete,
      onMoveToSession,
      preview: createElement('span', { 'data-preview': true }, 'preview'),
      solve: {
        ...baseSolve,
        moves: [{ m: 'R', ts: 4_250 }, { m: 'R', ts: 4_800 }],
      },
    })));

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('#3 · 10.00');
    expect(document.body.textContent).toContain('Raw time: 10.00');
    expect(document.body.textContent).toContain('Nov 14, 2023, 10:13 PM');
    expect(document.body.textContent).toContain("R U R'");
    expect(document.body.textContent).toContain('Stage splits');
    expect(document.body.textContent).toContain('Memo / Execution');
    expect(document.body.querySelector('[data-preview]')).not.toBeNull();
    expect(document.body.querySelectorAll('[data-timer-reconstruct-metrics]')).toHaveLength(1);
    expect([...document.body.querySelectorAll('.timer-reconstruct-metric')].map(node => node.textContent)).toEqual([
      '2QTM0.33 tps',
      '0.55sLongest pause1 × >0.5s',
    ]);
    expect(document.body.textContent).toContain('0.33 tps');
    expect(document.activeElement).toBe(document.body.querySelector('[data-history-action-id="solve.detail.penalty"]'));

    const penalty = document.body.querySelector<HTMLSelectElement>('[data-history-action-id="solve.detail.penalty"]')!;
    await act(async () => {
      penalty.value = '+2';
      penalty.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChangePenalty).toHaveBeenCalledWith('+2');

    const move = document.body.querySelector<HTMLSelectElement>('[data-history-action-id="solve.detail.move-session"]')!;
    await act(async () => {
      move.value = 'session-2';
      move.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onMoveToSession).toHaveBeenCalledWith('session-2');

    const comment = document.body.querySelector<HTMLTextAreaElement>('[data-history-action-id="solve.detail.comment"]')!;
    await act(async () => {
      comment.focus();
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(comment, 'PB');
      comment.dispatchEvent(new Event('input', { bubbles: true }));
      comment.blur();
    });
    expect(onChangeComment).toHaveBeenCalledOnce();
    expect(onChangeComment).toHaveBeenCalledWith('PB');

    document.body.querySelector<HTMLButtonElement>('[data-history-action-id="solve.detail.delete"]')!.click();
    expect(onDelete).toHaveBeenCalledOnce();
    document.body.querySelector<HTMLButtonElement>('[data-history-action-id="solve.detail.close"]')!.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps Escape inside an active comment edit and suppresses duplicate report content', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    await act(async () => root.render(createElement(TimerSolveDetailModal, {
      autoFocusComment: true,
      fullHeaderActions: createElement('button', {
        'data-header-action': true,
        type: 'button',
      }, 'header action'),
      index: 0,
      localize,
      onChangeComment: vi.fn(),
      onChangePenalty: vi.fn(),
      onClose,
      onDelete: vi.fn(),
      preview: createElement('span', { 'data-preview': true }, 'preview'),
      report: createElement('div', {
        'data-report': true,
        'data-timer-reconstruct-metrics': true,
      }, 'reconstruction'),
      solve: { ...baseSolve, moves: [{ m: 'R', ts: 4_250 }] },
    })));

    const comment = document.body.querySelector<HTMLTextAreaElement>('[data-history-action-id="solve.detail.comment"]')!;
    expect(document.activeElement).toBe(comment);
    await act(async () => comment.focus());
    comment.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.querySelector('[data-report]')).not.toBeNull();
    expect(document.body.querySelector('[data-preview]')).toBeNull();
    expect(document.body.querySelectorAll('[data-timer-reconstruct-metrics]')).toHaveLength(1);
    expect(document.body.textContent).not.toContain('Scramble:');
    const fullHeader = document.body.querySelector('.timer-solve-detail-full-head .timer-solve-detail-inner')!;
    const penalty = fullHeader.querySelector('.timer-solve-detail-penalty')!;
    const headerActions = fullHeader.querySelector('.timer-solve-detail-header-actions')!;
    const close = fullHeader.querySelector('.timer-solve-detail-close')!;
    expect(headerActions.querySelector('[data-header-action]')).not.toBeNull();
    const headerChildren = [...fullHeader.children];
    expect(headerChildren.indexOf(penalty)).toBeLessThan(headerChildren.indexOf(headerActions));
    expect(headerChildren.indexOf(headerActions)).toBeLessThan(headerChildren.indexOf(close));

    await act(async () => comment.blur());
    await act(async () => document.body.querySelector('[role="dialog"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
    ));
    expect(document.body.querySelector('.timer-solve-detail-overlay')?.classList)
      .toContain('timer-solve-detail-overlay--closing');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(160));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('waits for the full-screen entrance and honors a host-requested animated exit', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const onClose = vi.fn();
    const onEntered = vi.fn();
    const renderDetail = (closeRequested: boolean) => createElement(TimerSolveDetailModal, {
      closeRequested,
      index: 0,
      localize,
      onClose,
      onEntered,
      report: createElement('div', { 'data-report': true }, 'reconstruction'),
      solve: { ...baseSolve, moves: [{ m: 'R', ts: 4_250 }] },
    });

    await act(async () => root.render(renderDetail(false)));
    await act(async () => vi.advanceTimersByTime(40));
    expect(onEntered).not.toHaveBeenCalled();

    const overlay = document.body.querySelector<HTMLElement>('.timer-solve-detail-overlay--full')!;
    await act(async () => vi.advanceTimersByTime(200));
    expect(onEntered).toHaveBeenCalledOnce();

    await act(async () => root.render(renderDetail(true)));
    expect(overlay.classList).toContain('timer-solve-detail-overlay--closing');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(160));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('hides unavailable move targets and disables missing effects', async () => {
    await act(async () => root.render(createElement(TimerSolveDetailModal, {
      index: 0,
      localize: (copy) => copy.zh,
      onClose: vi.fn(),
      solve: { ...baseSolve, moves: [{ m: 'R', ts: 4_250 }] },
    })));
    expect(document.body.textContent).toContain('总计');
    expect([...document.body.querySelectorAll('.timer-reconstruct-metric')].map(node => node.textContent)).toEqual([
      '1QTM0.17 步/秒',
      '0.00s最长停顿0 × >0.5s',
    ]);
    expect(document.body.textContent).not.toContain('total');
    expect(document.body.querySelector('[data-history-action-id="solve.detail.move-session"]')).toBeNull();
    expect(document.body.querySelector<HTMLSelectElement>('[data-history-action-id="solve.detail.penalty"]')?.disabled).toBe(true);
    expect(document.body.querySelector<HTMLTextAreaElement>('[data-history-action-id="solve.detail.comment"]')?.disabled).toBe(true);
    expect(document.body.querySelector<HTMLButtonElement>('[data-history-action-id="solve.detail.delete"]')?.disabled).toBe(true);
  });

  it('traps tab focus and restores the invoking control after unmount', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    await act(async () => root.render(createElement(TimerSolveDetailModal, {
      index: 0,
      localize,
      onChangeComment: vi.fn(),
      onChangePenalty: vi.fn(),
      onClose: vi.fn(),
      onDelete: vi.fn(),
      solve: baseSolve,
    })));

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    const first = dialog.querySelector<HTMLSelectElement>('[data-history-action-id="solve.detail.penalty"]')!;
    const last = dialog.querySelector<HTMLButtonElement>('[data-history-action-id="solve.detail.close"]')!;
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(last);

    await act(async () => root.render(null));
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
