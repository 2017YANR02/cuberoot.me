// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Bulk from '@cuberoot/timer-ui/TimerBulkScrambleModal';
import Bld from '@cuberoot/timer-ui/TimerBldHelperModal';
import { TimerTools } from '@cuberoot/timer-ui/TimerTools';
import { TimerSoloPage, timerSoloModalState } from '@cuberoot/timer-ui/TimerSoloPage';
import { createGeneralSolver } from '@cuberoot/timer-ui/scramble/general-solver';
import { applySequence, parseMoves, solvedCubie } from '@cuberoot/puzzle-solvers/kociemba/cube';

const random = vi.hoisted(() => ({ generate: vi.fn(), reset: vi.fn() }));
vi.mock('@cuberoot/timer-ui/random-scramble', () => ({ createRandomScrambleClient: () => random }));
let root: Root; let container: HTMLDivElement; let width: number; const resize = new Set<() => void>();
const transport = { copy: vi.fn(async () => {}), download: vi.fn(async () => {}) };
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  width = 390; resize.clear(); vi.clearAllMocks();
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('min-width') ? width >= 1024 : width <= 480,
    addEventListener: (_: string, fn: () => void) => resize.add(fn), removeEventListener: (_: string, fn: () => void) => resize.delete(fn) }));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label)!;
const bulkProps = () => ({ defaultEvent: '333' as const, language: 'en' as const, onClose: vi.fn(), transport, randomOptions: { cnMode: 'none' as const, scramble222Mode: 'wca' as const } });
const setNumber = async (n: number) => act(async () => {
  const input = document.querySelector('input[type="number"]')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(n));
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
it('bulk discards an obsolete batch, never exports partial results, and retries', async () => {
  let resolve!: (value: unknown) => void;
  random.generate.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  await act(async () => root.render(createElement(Bulk, bulkProps())));
  await setNumber(2);
  await act(async () => button('Generate').click());
  const signal = random.generate.mock.calls[0][1] as AbortSignal;
  await setNumber(1); expect(signal.aborted).toBe(true);
  await act(async () => resolve({ ok: true, kind: 'generated', scramble: 'old' }));
  expect(document.querySelectorAll('.timer-tool-row')).toHaveLength(0);
  random.generate.mockResolvedValueOnce({ ok: false });
  await act(async () => button('Generate').click());
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  random.generate.mockResolvedValueOnce({ ok: true, kind: 'generated', scramble: 'R U' });
  await act(async () => button('Generate').click());
  expect(document.querySelectorAll('.timer-tool-row')).toHaveLength(1);
  await act(async () => button('Copy all').click());
  expect(transport.copy).toHaveBeenCalledWith('1) R U');
  await act(async () => button('Download .txt').click());
  expect(transport.download).toHaveBeenCalledWith('1) R U', 'cuberoot-scrambles-333-1.txt');
});
it('bulk Back closes its picker before the tool; dragging out does not dismiss', async () => {
  const props = bulkProps(); let dismiss: (() => boolean) | null = null;
  await act(async () => root.render(createElement(Bulk, { ...props, onDismissChange: value => { dismiss = value; } })));
  await act(async () => document.querySelector<HTMLButtonElement>('.pp-trigger')!.click());
  expect(document.querySelector('[role="menu"]')).not.toBeNull();
  await act(async () => { dismiss!(); });
  expect(document.querySelector('[role="menu"]')).toBeNull(); expect(props.onClose).not.toHaveBeenCalled();
  const overlay = document.querySelector('.timer-room-overlay')!;
  await act(async () => {
    document.querySelector('[role="dialog"]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(props.onClose).not.toHaveBeenCalled();
  await act(async () => { dismiss!(); }); expect(props.onClose).toHaveBeenCalledTimes(1);
});
it('BLD preserves per-cube selection and resets it for a new scramble', async () => {
  const props = { event: '333mbld' as const, scramble: 'Solve 1 of 2: R\nSolve 2 of 2: U', isZh: false, onClose: vi.fn() };
  await act(async () => root.render(createElement(Bld, props)));
  const select = document.querySelector<HTMLSelectElement>('#bldh-solve')!;
  expect(select.options).toHaveLength(2);
  await act(async () => { select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(select.value).toBe('1');
  await act(async () => root.render(createElement(Bld, { ...props, scramble: 'Solve 1 of 2: F\nSolve 2 of 2: L' })));
  expect(select.value).toBe('0');
});
it('Solo moves a single solver between topbar and rail, preserving source/timing/footer order', async () => {
  const props = { topbar: { controls: createElement('button', null, 'source') },
    stage: { source: 'configuration', statistics: 'statistics', devices: 'devices' },
    timing: { phase: 'idle' as const, digits: '0.00', colorClass: '', surfaceRef: { current: null } }, solver: createElement('div', { 'data-fixture-solver': true }, 'solver'),
    narrowRecap: createElement('div', { 'data-fixture-recap': true }, 'recap') };
  await act(async () => root.render(createElement(TimerSoloPage, props)));
  expect(container.querySelectorAll('[data-fixture-solver]')).toHaveLength(1);
  expect(container.querySelector('.shell-topbar [data-fixture-solver]')).not.toBeNull();
  expect(container.querySelector('[data-fixture-recap]')).not.toBeNull();
  await act(async () => { width = 1280; resize.forEach(fn => fn()); });
  expect(container.querySelectorAll('[data-fixture-solver]')).toHaveLength(1);
  expect(container.querySelector('.timer-solver-rail [data-fixture-solver]')).not.toBeNull();
  expect(container.querySelector('[data-fixture-recap]')).toBeNull();
  await act(async () => root.render(createElement(TimerSoloPage, { ...props, stage: { ...props.stage, fullscreen: true } })));
  expect(container.querySelector('.timer-solo-topbar--fullscreen')).not.toBeNull();
  expect(container.querySelector('.timer-stage-source')?.hasAttribute('hidden')).toBe(true);
  expect(timerSoloModalState(true, true)).toBe('blocking');
  expect(timerSoloModalState(false, true)).toBe('hints-only');
  expect(timerSoloModalState(false, false)).toBe('none');
});
it('general solver inverts the state-building answer, rejects malformed input, and cancels on reset', async () => {
  const listeners = new Map<string, (event: unknown) => void>(); let sent: { id: number; request: unknown };
  const terminate = vi.fn();
  vi.stubGlobal('Worker', class {
    addEventListener(type: string, listener: (event: unknown) => void) { listeners.set(type, listener); }
    postMessage(message: typeof sent) { sent = message; }
    terminate = terminate;
  });
  const solver = createGeneralSolver();
  const answer = solver.solve('R U F');
  listeners.get('message')!({ data: { id: sent!.id, ok: true, value: { kind: 'scramble', scramble: 'R U F' } } });
  const result = await answer;
  expect(result.solution).toBe("F' U' R'");
  expect(applySequence(solvedCubie(), parseMoves(`R U F ${result.solution}`))).toEqual(solvedCubie());
  await expect(solver.solve('invalid')).rejects.toThrow();
  const pending = solver.solve('R'); const rejected = expect(pending).rejects.toThrow(); solver.reset(); await rejected;
  expect(terminate).toHaveBeenCalledTimes(1);
});

it('tool Escape works from the body after a busy button loses focus', async () => {
  const close = vi.fn();
  await act(async () => root.render(createElement(TimerTools, { tool: 'bulk', event: '333', scramble: 'R', language: 'en', randomOptions: { cnMode: 'none', scramble222Mode: 'wca' }, transport, onClose: close })));
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(close).toHaveBeenCalledTimes(1);
});
it('a late copy cannot mark a different batch as copied', async () => {
  random.generate.mockResolvedValue({ ok: true, kind: 'generated', scramble: 'R' });
  let copied!: () => void;
  transport.copy.mockImplementationOnce(() => new Promise<void>(resolve => { copied = resolve; }));
  await act(async () => root.render(createElement(Bulk, bulkProps())));
  await setNumber(1); await act(async () => button('Generate').click());
  await act(async () => button('Copy all').click());
  await setNumber(2); await act(async () => button('Generate').click());
  await act(async () => copied());
  expect(button('Copy all')).toBeDefined(); expect(button('Copied')).toBeUndefined();
});
