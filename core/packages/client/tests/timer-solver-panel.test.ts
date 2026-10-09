// @vitest-environment jsdom
import { act, createElement, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TimerSolverPanel from '@cuberoot/timer-ui/TimerSolverPanel';

const fixture = vi.hoisted(() => ({ nested: false, mounts: 0 }));
let reportBlocking: ((blocked: boolean) => void) | undefined;
vi.mock('@cuberoot/timer-ui/TimerSolverBody', () => ({ default: (props: {
  compact: boolean; scramble: string; onDismissChange?(fn: (() => boolean) | null): void;
  onBlockingChange?(blocked: boolean): void;
}) => {
  reportBlocking = props.onBlockingChange;
  useEffect(() => { fixture.mounts++; return () => { fixture.mounts--; }; }, []);
  useEffect(() => {
    props.onDismissChange?.(() => { const open = fixture.nested; fixture.nested = false; return open; });
    return () => props.onDismissChange?.(null);
  }, [props.onDismissChange]);
  return createElement('div', { 'data-solver-body': props.compact ? 'compact' : 'wide' }, props.scramble,
    createElement('input', { 'aria-label': 'solver input' }), createElement('button', null, 'last'));
} }));

let root: Root; let host: HTMLDivElement; let width: number;
let back: (() => boolean) | null; let externalClose: () => void;
let previous: ReturnType<typeof vi.fn<() => void>>; let next: ReturnType<typeof vi.fn<() => void>>;
const registerBack = (fn: (() => boolean) | null) => { back = fn; };
function Harness({ request = 0, ready = false }: { request?: number; ready?: boolean }) {
  const [open, setOpen] = useState(false);
  externalClose = () => setOpen(false);
  return createElement(TimerSolverPanel, { language: 'en', scramble: 'R U', sheetOpen: open, onSheetOpenChange: setOpen,
    autoOpenOnSolve: request, autoCollapseOnReady: ready, onDismissChange: registerBack,
    onPrevScramble: previous, onNextScramble: next });
}
async function click(selector: string) { await act(async () => document.querySelector<HTMLButtonElement>(selector)!.click()); }
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  width = 1280; fixture.nested = false; fixture.mounts = 0; back = null;
  previous = vi.fn(); next = vi.fn(); localStorage.clear();
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('min-width') ? width >= 1024 : width <= 560,
    addEventListener() {}, removeEventListener() {} }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});

it('swipes once, ignores inputs and vertical scrolling, and cancels a drag when nested content opens', async () => {
  width = 390; await act(async () => root.render(createElement(Harness))); await click('.solver-panel-head');
  const sheet = document.querySelector<HTMLElement>('.solver-sheet')!;
  const pointer = async (target: Element, type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    await act(async () => target.dispatchEvent(event));
  };
  await pointer(sheet, 'pointerdown', 0, 0); await pointer(sheet, 'pointermove', 80, 1);
  await pointer(sheet, 'pointermove', 160, 1); expect(next).toHaveBeenCalledTimes(1);
  await pointer(sheet.querySelector('input')!, 'pointerdown', 0, 0); await pointer(sheet, 'pointermove', 80, 1);
  await pointer(sheet, 'pointerdown', 0, 0); await pointer(sheet, 'pointermove', 80, 120);
  expect(next).toHaveBeenCalledTimes(1);
  await pointer(sheet, 'pointerdown', 0, 0); await act(async () => reportBlocking?.(true));
  await pointer(sheet, 'pointermove', 80, 1); await act(async () => reportBlocking?.(false));
  await pointer(sheet, 'pointermove', 160, 1); expect(next).toHaveBeenCalledTimes(1);
  await pointer(sheet, 'pointerdown', 100, 0); await pointer(sheet, 'pointermove', 0, 1);
  expect(previous).toHaveBeenCalledTimes(1);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it('keeps one solver while docking/fullscreen, persists collapse, and does not reopen after browser Back', async () => {
  await act(async () => root.render(createElement(Harness)));
  expect(document.querySelector('.solver-panel-body')).not.toBeNull(); expect(fixture.mounts).toBe(1);
  await click('[aria-label="View solutions fullscreen"]');
  expect(document.querySelector('.solver-panel-body')).toBeNull(); expect(fixture.mounts).toBe(1);
  expect(document.querySelector('[data-solver-body]')?.getAttribute('data-solver-body')).toBe('wide');
  expect(localStorage.getItem('timer.solverHints.full')).toBe('1');
  await act(async () => externalClose());
  expect(document.querySelector('.solver-sheet')).toBeNull(); expect(fixture.mounts).toBe(1);
  expect(localStorage.getItem('timer.solverHints.full')).toBe('0');
  await click('[aria-label="Collapse solutions panel"]');
  expect(fixture.mounts).toBe(0); expect(localStorage.getItem('timer.solverHints.panelOpen')).toBe('0');
});

it('consumes auto-open once and ready-collapse without persisting the automatic collapse', async () => {
  localStorage.setItem('timer.solverHints.panelOpen', '0');
  await act(async () => root.render(createElement(Harness, {request: 1})));
  expect(document.querySelector('.solver-panel-body')).not.toBeNull();
  await click('[aria-label="Collapse solutions panel"]');
  await act(async () => root.render(createElement(Harness, {request: 1})));
  expect(document.querySelector('.solver-panel-body')).toBeNull();
  await act(async () => root.render(createElement(Harness, {request: 2})));
  expect(document.querySelector('.solver-panel-body')).not.toBeNull();
  await act(async () => root.render(createElement(Harness, {request: 2, ready: true})));
  expect(document.querySelector('.solver-panel-body')).toBeNull();
  expect(localStorage.getItem('timer.solverHints.panelOpen')).toBe('0');
});

it('phone uses fullscreen, Back closes nested content first, focus and body scroll restore on close', async () => {
  width = 390;
  await act(async () => root.render(createElement(Harness, {request: 1})));
  expect(document.querySelector('.solver-sheet')).toBeNull();
  const trigger = host.querySelector<HTMLButtonElement>('.solver-panel-head')!; trigger.focus();
  await click('.solver-panel-head');
  expect(document.querySelector('[data-solver-body]')?.getAttribute('data-solver-body')).toBe('compact');
  expect(document.body.style.overflow).toBe('hidden');
  fixture.nested = true;
  await act(async () => { expect(back?.()).toBe(true); });
  expect(fixture.nested).toBe(false); expect(document.querySelector('.solver-sheet')).not.toBeNull();
  await act(async () => { expect(back?.()).toBe(true); });
  expect(document.querySelector('.solver-sheet')).toBeNull(); expect(document.body.style.overflow).toBe('');
  // Trigger remains connected after the portal unmounts.
  expect(document.activeElement).toBe(trigger);
});

it('Escape consumes inner dismiss before outer close, and Tab stays in the full sheet', async () => {
  width = 768; await act(async () => root.render(createElement(Harness))); await click('.solver-panel-head');
  const sheet = document.querySelector<HTMLElement>('.solver-sheet')!;
  expect(document.querySelector('[data-solver-body]')?.getAttribute('data-solver-body')).toBe('wide');
  const buttons = sheet.querySelectorAll<HTMLButtonElement>('button'); buttons[buttons.length - 1].focus();
  await act(async () => buttons[buttons.length - 1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(buttons[0]);
  fixture.nested = true;
  await act(async () => sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('.solver-sheet')).not.toBeNull();
  await act(async () => sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('.solver-sheet')).toBeNull();
});
