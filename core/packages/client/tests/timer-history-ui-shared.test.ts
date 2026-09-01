// @vitest-environment jsdom

import {
  TIMER_HISTORY_QUICK_ACTION_IDS,
  TIMER_HISTORY_TAG_IDS,
  projectRollingStats,
  type Solve,
  type TimerHistoryTagId,
  type TimerHistoryQuickActionId,
} from '@cuberoot/shared/timer';
import {
  TimerHistoryCommentEditor,
  TimerHistoryCompareActions,
  TimerHistoryCompareModal,
  TimerHistoryCompareStatus,
  TimerHistoryColumnsHeader,
  TimerHistoryDayDivider,
  TimerHistoryRow,
  TimerHistoryRollingCells,
  TimerHistoryTagBadges,
  TimerHistoryTagFilter,
  TimerInfoToast,
  type TimerHistoryQuickMenuLabels,
  type TimerHistoryCompareLabels,
  type TimerHistoryRowQuickMenu,
} from '@cuberoot/timer-ui';
import { readFileSync } from 'node:fs';
import { act, createElement, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HistoryPanel from '../app/[lang]/timer/_components/HistoryPanel';

const labelsEn: TimerHistoryQuickMenuLabels = {
  actions: {
    'history.quick.penalty-ok': 'OK',
    'history.quick.penalty-plus-two': '+2',
    'history.quick.penalty-dnf': 'DNF',
    'history.quick.penalty-dns': 'DNS',
    'history.quick.comment': 'Comment',
    'history.quick.copy-scramble': 'Copy scramble',
    'history.quick.delete': 'Delete',
  },
  actionTitles: { 'history.quick.penalty-dns': 'Did Not Start' },
  menu: 'More actions',
};

const labelsZh: TimerHistoryQuickMenuLabels = {
  actions: {
    'history.quick.penalty-ok': '无罚时',
    'history.quick.penalty-plus-two': '加两秒',
    'history.quick.penalty-dnf': '未完成',
    'history.quick.penalty-dns': '未开始',
    'history.quick.comment': '评论',
    'history.quick.copy-scramble': '复制打乱',
    'history.quick.delete': '删除',
  },
  menu: '更多操作',
};

function makeSolve(overrides: Partial<Solve> = {}): Solve {
  return {
    event: '333',
    id: 'solve-1',
    penalty: '+2',
    scramble: 'R U R\' U\'',
    timeMs: 12_340,
    ts: 1,
    ...overrides,
  };
}

function touchEvent(type: string, x = 100, y = 120): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' || type === 'touchcancel'
      ? []
      : [{ clientX: x, clientY: y }],
  });
  return event;
}

async function nextFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
}

describe('shared TimerHistoryRow DOM and interaction contract', () => {
  let host: HTMLDivElement;
  let root: Root;
  let originalVisualViewport: PropertyDescriptor | undefined;
  let originalClientWidth: PropertyDescriptor | undefined;
  let originalClientHeight: PropertyDescriptor | undefined;
  let originalScrollWidth: PropertyDescriptor | undefined;
  let originalScrollHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    originalClientWidth = Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth');
    originalClientHeight = Object.getOwnPropertyDescriptor(document.documentElement, 'clientHeight');
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 320 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 500 });
    originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        height: 500,
        offsetLeft: 0,
        offsetTop: 0,
        width: 320,
      }),
    });
    originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
    originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() { return this.classList?.contains('timer-history-quick-panel') ? 500 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() { return this.classList?.contains('timer-history-quick-panel') ? 700 : 0; },
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('timer-history-row')) {
        return {
          bottom: 492, height: 44, left: 270, right: 318, top: 448, width: 48,
          x: 270, y: 448, toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        bottom: 700, height: 700, left: 0, right: 500, top: 0, width: 500,
        x: 0, y: 0, toJSON: () => ({}),
      } as DOMRect;
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.querySelectorAll('.timer-history-quick-panel, .timer-history-quick-backdrop')
      .forEach(node => node.remove());
    if (originalVisualViewport) Object.defineProperty(window, 'visualViewport', originalVisualViewport);
    else Reflect.deleteProperty(window, 'visualViewport');
    if (originalClientWidth) Object.defineProperty(document.documentElement, 'clientWidth', originalClientWidth);
    else Reflect.deleteProperty(document.documentElement, 'clientWidth');
    if (originalClientHeight) Object.defineProperty(document.documentElement, 'clientHeight', originalClientHeight);
    else Reflect.deleteProperty(document.documentElement, 'clientHeight');
    if (originalScrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
    if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function renderRow(
    quickMenu: TimerHistoryRowQuickMenu,
    overrides: Partial<Parameters<typeof TimerHistoryRow>[0]> = {},
  ): Promise<HTMLButtonElement> {
    await act(async () => root.render(createElement(TimerHistoryRow, {
      index: 4,
      onActivate: vi.fn(),
      quickMenu,
      resultExtras: createElement('span', { 'data-extra': true }, 'PR'),
      solve: makeSolve(),
      trailing: createElement('span', { 'data-trailing': true }, 'ao5'),
      ...overrides,
    })));
    return host.querySelector<HTMLButtonElement>('.timer-history-row')!;
  }

  async function openPopup(row: HTMLButtonElement): Promise<HTMLDivElement> {
    await act(async () => row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 315,
      clientY: 490,
    })));
    await nextFrame();
    return document.querySelector<HTMLDivElement>('.timer-history-quick-popup')!;
  }

  it('renders one canonical row and the exact seven clamped, focusable quick actions', async () => {
    const onChangePenalty = vi.fn();
    const onComment = vi.fn();
    const onCopyScramble = vi.fn();
    const onDelete = vi.fn();
    const onActivate = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const row = await renderRow({
      labels: labelsEn,
      onChangePenalty,
      onComment,
      onCopyScramble,
      onDelete,
      variant: 'popup',
    }, { onActivate });

    expect(row.type).toBe('button');
    expect(row.querySelector('.idx')?.textContent).toBe('5');
    expect(row.querySelector('.time')?.textContent).toBe('14.34(+2), PR');
    expect(row.querySelector('[data-trailing]')?.textContent).toBe('ao5');
    expect(row.getAttribute('aria-haspopup')).toBe('menu');
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(row.getAttribute('aria-pressed')).toBeNull();

    let panel = await openPopup(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(host.contains(panel)).toBe(false);
    expect(panel.getAttribute('aria-label')).toBe('More actions');
    expect([...panel.querySelectorAll<HTMLElement>('[data-history-action-id]')]
      .map(item => item.dataset.historyActionId)).toEqual(TIMER_HISTORY_QUICK_ACTION_IDS);
    expect([...panel.querySelectorAll<HTMLElement>('.timer-history-quick-label')]
      .map(item => item.textContent)).toEqual([
        'OK', '+2', 'DNF', 'DNS', 'Comment', 'Copy scramble', 'Delete',
      ]);
    expect(panel.querySelector('[data-history-action-id="history.quick.penalty-plus-two"]')
      ?.getAttribute('aria-pressed')).toBe('true');
    expect(panel.querySelector('[data-history-action-id="history.quick.penalty-dns"]')
      ?.getAttribute('title')).toBe('Did Not Start');
    expect({
      left: panel.style.left,
      maxHeight: panel.style.maxHeight,
      top: panel.style.top,
      visibility: panel.style.visibility,
      width: panel.style.width,
    }).toEqual({
      left: '8px', maxHeight: '484px', top: '8px', visibility: 'visible', width: '304px',
    });
    expect(document.activeElement).toBe(panel.querySelector('[role="menuitem"]'));
    await act(async () => panel.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'End',
    })));
    expect(document.activeElement).toBe(panel.querySelector('[data-history-action-id="history.quick.delete"]'));

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'Escape',
    })));
    expect(document.querySelector('.timer-history-quick-popup')).toBeNull();
    expect(document.activeElement).toBe(row);

    panel = await openPopup(row);
    await act(async () => panel.querySelector<HTMLButtonElement>(
      '[data-history-action-id="history.quick.penalty-dns"]',
    )!.click());
    expect(onChangePenalty).toHaveBeenCalledTimes(1);
    expect(onChangePenalty).toHaveBeenCalledWith(expect.objectContaining({ id: 'solve-1' }), 'DNS');
    expect(document.querySelector('.timer-history-quick-popup')).toBeNull();

    panel = await openPopup(row);
    await act(async () => panel.querySelector<HTMLButtonElement>(
      '[data-history-action-id="history.quick.delete"]',
    )!.click());
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'solve-1' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('omits unbound fake actions, localizes injected copy, and closes on outside/resize', async () => {
    const onComment = vi.fn();
    const row = await renderRow({ labels: labelsZh, onComment, variant: 'popup' });
    let panel = await openPopup(row);
    expect(panel.getAttribute('aria-label')).toBe('更多操作');
    expect([...panel.querySelectorAll<HTMLElement>('[data-history-action-id]')]
      .map(item => [item.dataset.historyActionId, item.textContent])).toEqual([
        ['history.quick.comment', '评论'],
      ]);
    expect(panel.textContent).not.toContain('Comment');

    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(document.querySelector('.timer-history-quick-popup')).toBeNull();

    panel = await openPopup(row);
    expect(panel).not.toBeNull();
    await act(async () => window.dispatchEvent(new Event('resize')));
    expect(document.querySelector('.timer-history-quick-popup')).toBeNull();

    const noEffectRow = await renderRow({ labels: labelsZh, variant: 'popup' });
    const accepted = noEffectRow.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, clientX: 10, clientY: 10,
    }));
    expect(accepted).toBe(true);
    expect(document.querySelector('.timer-history-quick-popup')).toBeNull();
  });

  it('lets a native host close the shared menu through the controlled overlay contract', async () => {
    const onOpenChange = vi.fn();
    const quickMenu = {
      labels: labelsEn,
      onComment: vi.fn(),
      onOpenChange,
      open: false,
      variant: 'sheet' as const,
      viewportBottomInset: 64,
    };
    let row = await renderRow(quickMenu);
    await act(async () => row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 120,
    })));
    expect(onOpenChange).toHaveBeenCalledWith(true, {
      id: 'timer.history-quick-menu',
      reason: 'trigger',
    });
    expect(document.querySelector('.timer-history-quick-sheet')).toBeNull();

    row = await renderRow({ ...quickMenu, open: true });
    await nextFrame();
    expect(document.querySelector('.timer-history-quick-sheet')).not.toBeNull();

    await renderRow({ ...quickMenu, open: false });
    expect(document.querySelector('.timer-history-quick-sheet')).toBeNull();
  });

  it('uses the same menu DOM as a long-press sheet, respects bottom chrome, and cancels on drift', async () => {
    vi.useFakeTimers();
    const onActivate = vi.fn();
    const row = await renderRow({
      labels: labelsEn,
      onComment: vi.fn(),
      variant: 'sheet',
      viewportBottomInset: 64,
    }, { onActivate });

    await act(async () => row.dispatchEvent(touchEvent('touchstart')));
    await act(async () => vi.advanceTimersByTime(450));
    const sheet = document.querySelector<HTMLDivElement>('.timer-history-quick-sheet')!;
    const backdrop = document.querySelector<HTMLDivElement>('.timer-history-quick-backdrop')!;
    expect(sheet).not.toBeNull();
    expect(sheet.style.maxHeight).toBe('420px');
    expect(backdrop.style.paddingBottom).toBe('64px');
    expect(sheet.textContent).toContain('#5 · 14.34');

    await act(async () => row.dispatchEvent(touchEvent('touchend')));
    await act(async () => row.click());
    expect(onActivate).not.toHaveBeenCalled();
    await act(async () => backdrop.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(document.querySelector('.timer-history-quick-sheet')).toBeNull();

    await act(async () => row.dispatchEvent(touchEvent('touchstart', 100, 120)));
    await act(async () => row.dispatchEvent(touchEvent('touchmove', 120, 120)));
    await act(async () => vi.advanceTimersByTime(450));
    expect(document.querySelector('.timer-history-quick-sheet')).toBeNull();
  });
});

describe('shared history comment and undo surfaces', () => {
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

  it('preserves exact comment text and saves once, only on blur', async () => {
    const onBlurSave = vi.fn();
    const onEditingChange = vi.fn();
    await act(async () => root.render(createElement(TimerHistoryCommentEditor, {
      ariaLabel: 'Comment',
      onBlurSave,
      onEditingChange,
      value: 'old',
    })));
    const textarea = host.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(textarea.maxLength).toBe(-1);
    await act(async () => textarea.focus());
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
        textarea,
        '  first\nsecond  ',
      );
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onBlurSave).not.toHaveBeenCalled();
    await act(async () => textarea.blur());
    expect(onBlurSave).toHaveBeenCalledTimes(1);
    expect(onBlurSave).toHaveBeenCalledWith('  first\nsecond  ');
    expect(onEditingChange.mock.calls.map(([editing]) => editing)).toEqual([true, false]);
    expect(host.querySelector('button')).toBeNull();

    await act(async () => textarea.focus());
    await act(async () => textarea.blur());
    expect(onBlurSave).toHaveBeenCalledTimes(1);
  });

  it('owns the five-second lifecycle and invokes Undo before dismissing', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    await act(async () => root.render(createElement(TimerInfoToast, {
      message: 'Solve deleted',
      onDismiss: () => calls.push('dismiss'),
      onUndo: () => calls.push('undo'),
      undoLabel: 'Undo',
      viewportBottomInset: 64,
    })));
    const toast = host.querySelector<HTMLElement>('[role="status"]')!;
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(toast.textContent).toBe('Solve deletedUndo');
    expect(toast.style.getPropertyValue('--timer-info-toast-bottom-inset')).toBe('64px');
    await act(async () => toast.querySelector<HTMLButtonElement>('button')!.click());
    expect(calls).toEqual(['undo', 'dismiss']);

    await act(async () => root.render(createElement(TimerInfoToast, {
      actionBusy: true,
      actionDisabled: true,
      message: 'Saving',
      onDismiss: () => undefined,
      onUndo: () => undefined,
      undoLabel: 'Retry',
    })));
    const busyToast = host.querySelector<HTMLElement>('[role="status"]')!;
    expect(busyToast.getAttribute('aria-busy')).toBe('true');
    expect(busyToast.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);

    calls.length = 0;
    await act(async () => root.render(createElement(TimerInfoToast, {
      message: 'Copied',
      onDismiss: () => calls.push('timeout'),
      undoLabel: 'Undo',
    })));
    await act(async () => vi.advanceTimersByTime(4_999));
    expect(calls).toEqual([]);
    await act(async () => vi.advanceTimersByTime(1));
    expect(calls).toEqual(['timeout']);
  });
});

describe('shared history tag surfaces', () => {
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

  it('renders the canonical bilingual filter order and toggles a real button', async () => {
    const onToggle = vi.fn();
    await act(async () => root.render(createElement(TimerHistoryTagFilter, {
      language: 'zh',
      legend: '标签',
      onToggle,
      selected: new Set<TimerHistoryTagId>(['pb-single']),
    })));
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.map((button) => button.dataset.historyTagId)).toEqual(TIMER_HISTORY_TAG_IDS);
    expect(buttons.map((button) => button.textContent)).toEqual([
      'PB', 'PB ao5', 'PB ao12', '跳O', '跳P', 'DNF', 'DNS', '+2',
    ]);
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => buttons[5]!.click());
    expect(onToggle).toHaveBeenCalledWith('dnf');
  });

  it('hides result-redundant tags and exposes the complete compact label', async () => {
    await act(async () => root.render(createElement(TimerHistoryTagBadges, {
      language: 'en',
      tagIds: ['pb-single', 'pb-ao5', 'pb-ao12', 'oll-skip', 'dnf', 'plus2'],
    })));
    const group = host.querySelector<HTMLElement>('[role="group"]')!;
    expect(group.getAttribute('aria-label')).toBe('PB, PB ao5, PB ao12, OLL skip');
    expect(group.title).toBe('PB, PB ao5, PB ao12, OLL skip');
    expect([...group.querySelectorAll<HTMLElement>('.timer-history-tag-item')]
      .map((item) => item.dataset.tagId)).toEqual(['pb-single', 'pb-ao5', 'pb-ao12', 'oll-skip']);
    expect(group.querySelector('.timer-history-tag-overflow')?.textContent).toBe('+2');
    expect(group.querySelector<HTMLElement>('.timer-history-tag-overflow')?.title)
      .toBe('PB, PB ao5, PB ao12, OLL skip');
  });

  it('keeps PB tags visible before skip tags on narrow history rows', async () => {
    await act(async () => root.render(createElement(TimerHistoryTagBadges, {
      language: 'en',
      tagIds: ['oll-skip', 'pll-skip', 'pb-single', 'pb-ao5'],
    })));
    expect([...host.querySelectorAll<HTMLElement>('.timer-history-tag-item')]
      .map(item => item.dataset.tagId)).toEqual([
      'pb-single', 'pb-ao5', 'oll-skip', 'pll-skip',
    ]);
  });

  it('renders one shared header, semantic day divider, and event-aware rolling cells', async () => {
    const solves = [10_000, 20_000, 30_000].map((timeMs, index) => makeSolve({
      id: `rolling-${index}`,
      penalty: 'ok',
      timeMs,
      ts: index + 1,
    }));
    const projection = projectRollingStats(solves, ['mo3']);
    await act(async () => root.render(createElement('div', {},
      createElement(TimerHistoryColumnsHeader, {
        picker: createElement('button', { type: 'button' }, 'mo3'),
        resultLabel: 'Time',
      }),
      createElement(TimerHistoryDayDivider, { countLabel: '3', day: '2026-09-01' }),
      createElement(TimerHistoryRollingCells, {
        columns: ['mo3'],
        event: '333',
        index: 2,
        projection,
      }),
    )));
    expect(host.querySelector('.timer-history-columns-head')?.textContent).toBe('#Timemo3');
    expect(host.querySelector('h2 time')?.getAttribute('datetime')).toBe('2026-09-01');
    expect(host.querySelector('[data-stat="mo3"]')?.getAttribute('aria-label'))
      .toBe('; mo3: 20.00, PB');
    expect(host.querySelector('[data-stat="mo3"] [aria-hidden="true"]')?.textContent)
      .toBe('20.00');
  });

  it('moves matching ao PB tags into columns and restores them after replacement', async () => {
    await act(async () => root.render(createElement(TimerHistoryTagBadges, {
      language: 'en',
      rollingColumns: ['ao5'],
      tagIds: ['pb-single', 'pb-ao5', 'pb-ao12'],
    })));
    expect([...host.querySelectorAll<HTMLElement>('[data-tag-id]')]
      .map(item => item.dataset.tagId)).toEqual(['pb-single', 'pb-ao12']);

    await act(async () => root.render(createElement(TimerHistoryTagBadges, {
      language: 'en',
      rollingColumns: ['ao50'],
      tagIds: ['pb-single', 'pb-ao5', 'pb-ao12'],
    })));
    expect([...host.querySelectorAll<HTMLElement>('[data-tag-id]')]
      .map(item => item.dataset.tagId)).toEqual(['pb-single', 'pb-ao5', 'pb-ao12']);
  });

  it('formats FMC rolling means as moves and leaves MBLD rows in the two-column layout', async () => {
    const fmc = [25_000, 26_000, 26_000].map((timeMs, index) => makeSolve({
      event: '333fm',
      id: `fmc-${index}`,
      penalty: 'ok',
      timeMs,
      ts: index + 1,
    }));
    await act(async () => root.render(createElement(TimerHistoryRollingCells, {
      columns: ['mo3'],
      event: '333fm',
      index: 2,
      projection: projectRollingStats(fmc, ['mo3']),
    })));
    expect(host.querySelector('[data-stat="mo3"]')?.getAttribute('aria-label'))
      .toBe('; mo3: 25.67, PB');

    await act(async () => root.render(createElement(TimerHistoryRow, {
      index: 0,
      onActivate: vi.fn(),
      solve: makeSolve({ event: '333mbld', mbld: { attempted: 13, solved: 11 } }),
      trailing: undefined,
    })));
    expect(host.querySelector('.timer-history-row')?.classList.contains('timer-history-row--with-trailing'))
      .toBe(false);
  });
});

describe('history UI reuse, i18n, theme, and overflow guards', () => {
  it('keeps Web as a thin host and removes its duplicate row/menu/comment/toast implementations', () => {
    const history = readFileSync('app/[lang]/timer/_components/HistoryPanel.tsx', 'utf8');
    const detail = readFileSync('app/[lang]/timer/_components/SolveModal.tsx', 'utf8');
    const solo = readFileSync('app/[lang]/timer/_shell/SoloView.tsx', 'utf8');
    const timerCss = readFileSync('app/[lang]/timer/timer.css', 'utf8');
    const shellCss = readFileSync('app/[lang]/timer/_shell/shell.css', 'utf8');

    expect(history).toContain("from '@cuberoot/timer-ui'");
    expect(history).toContain('<TimerHistoryRow');
    expect(history).toContain('className="history-search-count" role="status"');
    expect(history).toContain('onChangePenalty:');
    expect(history).toContain('onCopyScramble:');
    expect(history).toContain('onDelete:');
    expect(history).not.toContain('LONG_PRESS_MS');
    expect(history).not.toContain('row-quick-');
    expect(detail).toContain('<TimerSolveDetailModal');
    expect(detail).not.toContain('<textarea');
    expect(solo).toContain('<TimerInfoToast');
    expect(solo).toContain('key={infoToast.sequence}');
    expect(solo).not.toContain('shell-info-toast');
    expect(shellCss).not.toContain('.row-quick-');
    expect(shellCss).not.toContain('.shell-info-toast');
    expect(timerCss).not.toContain('.comment-textarea');
  });

  it('derives quick actions from shared contracts and keeps shared CSS token-only and clamped', () => {
    const timerUiEntry = new URL(import.meta.resolve('@cuberoot/timer-ui'));
    const component = readFileSync(new URL('./TimerHistoryRow.tsx', timerUiEntry), 'utf8');
    const toast = readFileSync(new URL('./TimerInfoToast.tsx', timerUiEntry), 'utf8');
    const rowCss = readFileSync(new URL('./history-row.css', timerUiEntry), 'utf8');
    const columnsCss = readFileSync(new URL('./history-columns.css', timerUiEntry), 'utf8');
    const toastCss = readFileSync(new URL('./info-toast.css', timerUiEntry), 'utf8');
    const tagCss = readFileSync(new URL('./history-tags.css', timerUiEntry), 'utf8');

    expect(component).toContain('TIMER_HISTORY_QUICK_ACTION_CONTRACTS');
    expect(component).toContain('timerHistoryQuickActionStates({');
    for (const actionId of TIMER_HISTORY_QUICK_ACTION_IDS as readonly TimerHistoryQuickActionId[]) {
      expect(component).not.toContain(`'${actionId}'`);
    }
    expect(component).not.toMatch(/\bisZh\b/);
    expect(toast).not.toContain("'Undo'");
    expect(rowCss).toContain('anchored-panel: clamped');
    expect(rowCss).toContain('max-width: calc(100vw - 16px)');
    expect(rowCss).toContain('env(safe-area-inset-bottom)');
    expect(rowCss).toMatch(/\.timer-history-row\s*\{[\s\S]*?min-height: 44px/);
    expect(columnsCss).toMatch(/@media \(max-width: 480px\)[\s\S]*?grid-row: 2/);
    expect(columnsCss).toContain('grid-auto-columns: minmax(0, 1fr)');
    expect(rowCss).toMatch(/\.timer-history-quick-sheet\s*\{[\s\S]*?align-self: flex-end/);
    expect(toastCss).toContain('env(safe-area-inset-bottom)');
    expect(tagCss).toMatch(/@media \(max-width: 480px\)[\s\S]*?\.timer-history-tag-item:nth-of-type\(n \+ 3\)/);
    expect(tagCss).toMatch(/\.timer-history-tag-filter-option\s*\{[\s\S]*?padding: 2px 8px/);
    expect(tagCss).toMatch(/@media \(max-width: 480px\)[\s\S]*?min-height: 44px/);
    for (const css of [rowCss, columnsCss, toastCss, tagCss]) {
      expect(css).toMatch(/var\(--(?:foreground|popover|card|border-default|ring|shell-divider|background)/);
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch)\(/i);
    }
  });
});

describe('shared TimerHistoryCompare UI', () => {
  let host: HTMLDivElement;
  let root: Root;
  const labels: TimerHistoryCompareLabels = {
    bBetter: 'B better',
    bWorse: 'B worse',
    cancel: 'Cancel',
    close: 'Close',
    compareSelected: 'Compare these 2',
    delta: 'Delta',
    deltaDirection: 'Delta (B − A)',
    eventName: () => '3×3',
    greenMeansBetter: 'Green = B better',
    htm: 'HTM',
    locale: 'en',
    moves: 'moves',
    noStageA: 'A missing',
    noStageB: 'B missing',
    noStageBoth: 'Both missing',
    selected: (count) => `${count}/2 selected`,
    stage: { cross: 'Cross', f2l: 'F2L', oll: 'OLL', pll: 'PLL' },
    tie: 'tie',
    title: 'Compare solves',
    total: 'Total',
    tps: 'TPS',
  };
  const stageSegments = (crossMs: number): NonNullable<Solve['stageSegments']> => ({
    crossDoneMs: crossMs,
    f2lDoneMs: null,
    ollDoneMs: null,
    solvedMs: null,
    crossMs,
    f2lMs: null,
    ollMs: null,
    pllMs: null,
    crossHtm: 1,
    f2lHtm: null,
    ollHtm: null,
    pllHtm: null,
    crossSide: 'D-cross',
    ollCase: null,
    pllCase: null,
  });

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.querySelectorAll('.timer-history-compare-backdrop').forEach((node) => node.remove());
  });

  it('shares the exact selection status and accessible action controls', async () => {
    const onCancel = vi.fn();
    const onCompare = vi.fn();
    await act(async () => root.render(createElement('div', null,
      createElement(TimerHistoryCompareStatus, { count: 1, labels }),
      createElement(TimerHistoryCompareActions, {
        canCompare: false, labels, onCancel, onCompare,
      }),
    )));
    expect(host.querySelector('[role="status"]')?.textContent).toBe('1/2 selected');
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.map((button) => button.textContent)).toEqual(['Cancel', 'Compare these 2']);
    expect(buttons[1]?.disabled).toBe(true);
    await act(async () => buttons[0]?.click());
    expect(onCancel).toHaveBeenCalledOnce();
    await act(async () => root.render(createElement(TimerHistoryCompareActions, {
      canCompare: true, labels, onCancel, onCompare,
    })));
    const compare = host.querySelectorAll<HTMLButtonElement>('button')[1]!;
    expect(compare.disabled).toBe(false);
    await act(async () => compare.click());
    expect(onCompare).toHaveBeenCalledOnce();
  });

  it('renders canonical results, missing-stage state, backdrop dismissal, Escape and focus restoration', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();
    await act(async () => root.render(createElement(TimerHistoryCompareModal, {
      labels,
      onClose,
      solveA: makeSolve({ id: 'a', penalty: '+2', timeMs: 10_000, ts: 1 }),
      solveB: makeSolve({ id: 'b', penalty: 'DNS', timeMs: 0, ts: 2 }),
    })));
    const dialog = document.querySelector<HTMLElement>('.timer-history-compare-modal')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.textContent).toContain('12.00');
    expect(dialog.textContent).toContain('DNS');
    expect(dialog.textContent).toContain('Both missing');
    expect(document.activeElement?.textContent).toBe('Close');

    await act(async () => dialog.click());
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => document.querySelector<HTMLElement>('.timer-history-compare-backdrop')!.click());
    expect(onClose).toHaveBeenCalledOnce();
    onClose.mockClear();
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(onClose).toHaveBeenCalledOnce();
    await act(async () => root.render(null));
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('uses event semantics for FMC and MBLD total deltas', async () => {
    await act(async () => root.render(createElement(TimerHistoryCompareModal, {
      labels,
      onClose: vi.fn(),
      solveA: makeSolve({ event: '333fm', id: 'a', penalty: 'ok', timeMs: 27_000, ts: 1 }),
      solveB: makeSolve({ event: '333fm', id: 'b', penalty: 'ok', timeMs: 29_000, ts: 2 }),
    })));
    let delta = document.querySelectorAll<HTMLElement>('.timer-history-compare-summary')[2]!
      .querySelector('strong')!.textContent;
    expect(delta).toBe('+2 moves');

    await act(async () => root.render(createElement(TimerHistoryCompareModal, {
      labels,
      onClose: vi.fn(),
      solveA: makeSolve({
        event: '333mbld', id: 'a', mbld: { solved: 11, attempted: 13 },
        penalty: 'ok', timeMs: 3_000_000, ts: 1,
      }),
      solveB: makeSolve({
        event: '333mbld', id: 'b', mbld: { solved: 10, attempted: 13 },
        penalty: 'ok', timeMs: 2_900_000, ts: 2,
      }),
    })));
    delta = document.querySelectorAll<HTMLElement>('.timer-history-compare-summary')[2]!
      .querySelector('strong')!.textContent;
    expect(delta).toBe('B worse');

    await act(async () => root.render(createElement(TimerHistoryCompareModal, {
      labels,
      onClose: vi.fn(),
      solveA: makeSolve({ event: '333mbld', id: 'a', penalty: 'ok', timeMs: 1_000, ts: 1 }),
      solveB: makeSolve({ event: '333mbld', id: 'b', penalty: 'ok', timeMs: 2_000, ts: 2 }),
    })));
    delta = document.querySelectorAll<HTMLElement>('.timer-history-compare-summary')[2]!
      .querySelector('strong')!.textContent;
    expect(delta).toBe('—');
  });

  it('keeps the exact integer-ms tie boundary for total and stage deltas', async () => {
    const renderWithDifference = async (difference: number) => {
      await act(async () => root.render(createElement(TimerHistoryCompareModal, {
        labels,
        onClose: vi.fn(),
        solveA: makeSolve({
          id: 'a', penalty: 'ok', stageSegments: stageSegments(10_004),
          timeMs: 10_004, ts: 1,
        }),
        solveB: makeSolve({
          id: 'b', penalty: 'ok', stageSegments: stageSegments(10_004 + difference),
          timeMs: 10_004 + difference, ts: 2,
        }),
      })));
      return {
        stage: document.querySelector('.timer-history-compare-cell--delta')?.textContent,
        total: document.querySelectorAll<HTMLElement>('.timer-history-compare-summary')[2]
          ?.querySelector('strong')?.textContent,
      };
    };
    expect(await renderWithDifference(4)).toMatchObject({ stage: expect.stringContaining('tie'), total: 'tie' });
    expect(await renderWithDifference(5)).toMatchObject({ stage: expect.stringContaining('+0.01s'), total: '+0.01s' });
  });

  it('hides an open comparison before passive cleanup when session/event context changes', async () => {
    let layoutText = '';
    let layoutDialogText: string | null = null;
    function Probe({ historyContextKey, solves }: { historyContextKey: string; solves: Solve[] }) {
        useLayoutEffect(() => {
          layoutText = document.body.textContent ?? '';
          layoutDialogText = document.querySelector('.timer-history-compare-modal')?.textContent ?? null;
        }, [historyContextKey]);
        return createElement(HistoryPanel, {
          historyContextKey,
          isZh: false,
          onRowClick: vi.fn(),
          solves,
        });
    }
    const renderPanel = (historyContextKey: string, solves: Solve[]) => (
      createElement(Probe, { historyContextKey, solves })
    );
    const first = [
      makeSolve({ id: 'same-a', penalty: 'ok', timeMs: 10_000, ts: 1 }),
      makeSolve({ id: 'same-b', penalty: 'ok', timeMs: 20_000, ts: 2 }),
    ];
    await act(async () => root.render(renderPanel('session-a|333', first)));
    const compareToggle = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === 'Compare')!;
    await act(async () => compareToggle.click());
    const rows = [...host.querySelectorAll<HTMLButtonElement>('.timer-history-row')];
    await act(async () => { rows[0]!.click(); rows[1]!.click(); });
    const open = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === 'Compare these 2')!;
    await act(async () => open.click());
    expect(document.body.textContent).toContain('Compare solves');

    layoutText = '';
    layoutDialogText = 'not-cleared';
    await act(async () => root.render(renderPanel('session-b|333', [
      makeSolve({ id: 'same-a', penalty: 'ok', timeMs: 59_000, ts: 3 }),
      makeSolve({ id: 'same-b', penalty: 'ok', timeMs: 58_000, ts: 4 }),
    ])));
    expect(layoutText).not.toContain('Compare solves');
    expect(layoutDialogText).toBeNull();
  });

  it('keeps Web on one compare component with token-only overflow-safe CSS', () => {
    const web = readFileSync('app/[lang]/timer/_components/HistoryPanel.tsx', 'utf8');
    const timerUiEntry = new URL(import.meta.resolve('@cuberoot/timer-ui'));
    const css = readFileSync(new URL('./history-compare.css', timerUiEntry), 'utf8');
    expect(web).toContain('<TimerHistoryCompareModal');
    expect(css).toContain('overflow-x: hidden');
    expect(css).toContain('@media (max-width: 340px)');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch)\(/i);
  });
});
