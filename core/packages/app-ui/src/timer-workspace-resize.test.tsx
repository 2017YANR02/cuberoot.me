// @vitest-environment jsdom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TimerWorkspace } from '@cuberoot/timer-ui';
import { TimerSoloPage } from '@cuberoot/timer-ui/TimerSoloPage';

let root: Root;
let host: HTMLDivElement;
let workspaceWidth: number;
const observers = new Set<{ callback: ResizeObserverCallback; targets: Set<Element> }>();
const notifyResize = () => observers.forEach(observer => observer.callback([], {} as ResizeObserver));
const dockWidth = (side: 'left' | 'right') => {
  const workspace = host.querySelector<HTMLElement>('.timer-workspace')!;
  if (side === 'left' && !workspace.querySelector('.solver-panel[data-open="true"]')) return 0;
  return Number.parseFloat(workspace.style.getPropertyValue(`--timer-${side}-dock-width`)) || (side === 'left' ? 380 : 480);
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  workspaceWidth = 1800;
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('ResizeObserver', class {
    entry: { callback: ResizeObserverCallback; targets: Set<Element> };
    constructor(callback: ResizeObserverCallback) { this.entry = { callback, targets: new Set() }; observers.add(this.entry); }
    observe(target: Element) { this.entry.targets.add(target); }
    disconnect() { observers.delete(this.entry); }
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('timer-workspace') ? workspaceWidth : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = this.classList.contains('timer-solver-rail') ? dockWidth('left')
      : this.classList.contains('timer-workspace-panel') ? dockWidth('right') : workspaceWidth;
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: 600, width, height: 600, toJSON() {} };
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  expect(observers.size).toBe(0);
  host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

async function drag(side: 'left' | 'right', delta: number) {
  const handle = host.querySelector<HTMLElement>(`.timer-workspace-divider--${side}`)!;
  handle.setPointerCapture = vi.fn(); handle.hasPointerCapture = () => false;
  const pointer = async (type: string, clientX: number) => act(async () => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    handle.dispatchEvent(event);
  });
  await pointer('pointerdown', 0);
  await pointer('pointermove', side === 'left' ? delta : -delta);
  await pointer('pointerup', side === 'left' ? delta : -delta);
}

it('reclamps both user-resized docks after shrinking, reopening, and leaving wide mode', async () => {
  const render = async (open = true, active = true) => act(async () => root.render(
    <TimerWorkspace active={active} recap={<section>Recap</section>}>
      {active && <TimerSoloPage topbar={{ controls: null }} stage={{}}
        timing={{ phase: 'idle', digits: '0.00', colorClass: '', surfaceRef: createRef() }}
        solver={<div className="solver-panel" data-open={open} data-layout="rail" />} />}
    </TimerWorkspace>,
  ));
  await render();
  await drag('left', 220); await drag('right', 220);
  expect([dockWidth('left'), dockWidth('right')]).toEqual([600, 700]);
  const workspace = host.querySelector<HTMLElement>('.timer-workspace')!;
  const left = host.querySelector('.timer-solver-rail')!;
  expect([...observers].some(observer => observer.targets.has(workspace) && observer.targets.has(left))).toBe(true);
  for (const width of [1200, 951, 800]) {
    workspaceWidth = width;
    await act(async () => notifyResize());
    expect(workspaceWidth - dockWidth('left') - dockWidth('right')).toBeGreaterThanOrEqual(320);
    expect(Math.min(dockWidth('left'), dockWidth('right'))).toBeGreaterThanOrEqual(240);
    const styles = workspace.getAttribute('style');
    await act(async () => notifyResize());
    expect(workspace.getAttribute('style')).toBe(styles);
  }
  workspaceWidth = 1200;
  await render(false); await drag('right', 1000);
  expect(dockWidth('right')).toBe(880);
  await render(true); await act(async () => notifyResize());
  expect(workspaceWidth - dockWidth('left') - dockWidth('right')).toBeGreaterThanOrEqual(320);
  await render(true, false);
  expect(observers.size).toBe(0);
});
