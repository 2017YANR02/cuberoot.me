// @vitest-environment jsdom

import LegacyGestureWheel from '@/components/GestureWheel';
import { useGestureWheel as legacyUseGestureWheel } from '@/hooks/useGestureWheel';
import {
  GestureWheel,
  useGestureWheel,
  type GestureWheelHandle,
} from '@cuberoot/timer-ui';
import { readFileSync } from 'node:fs';
import {
  Fragment,
  act,
  createElement,
  createRef,
  useRef,
  type ReactElement,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

interface PointerFixture {
  button?: number;
  pointerId?: number;
  pointerType: 'mouse' | 'touch';
  time: number;
  x: number;
  y: number;
}

function pointerEvent(type: string, fixture: PointerFixture): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: fixture.button ?? 0 },
    clientX: { value: fixture.x },
    clientY: { value: fixture.y },
    pointerId: { value: fixture.pointerId ?? 1 },
    pointerType: { value: fixture.pointerType },
    timeStamp: { value: fixture.time },
  });
  return event;
}

interface HookEffects {
  cancel: Mock<() => void>;
  down: Mock<() => void>;
  fire: Mock<(direction: number) => void>;
  pressCancel: Mock<() => void>;
  up: Mock<() => void>;
}

interface HookHarnessProps {
  active?: boolean;
  canGesture?: boolean;
  effects: HookEffects;
  ignoreButtons?: boolean;
}

function HookHarness({
  active = true,
  canGesture = true,
  effects,
  ignoreButtons = false,
}: HookHarnessProps): ReactElement {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const { wheelRef } = useGestureWheel({
    active,
    surfaceRef,
    canGesture: () => canGesture,
    enabledFor: () => [true, true, false, true, false, true, true, true],
    fireAction: effects.fire,
    onArmCancel: effects.cancel,
    onPressCancel: effects.pressCancel,
    onPressDown: effects.down,
    onPressUp: effects.up,
    ignoreTarget: ignoreButtons
      ? (target) => target instanceof Element && target.closest('button') !== null
      : undefined,
  });

  return createElement(Fragment, null,
    createElement('div', { className: 'fixture-surface', ref: surfaceRef },
      createElement('button', { type: 'button' }, 'host action')),
    createElement(GestureWheel, { isZh: false, ref: wheelRef }),
  );
}

describe('shared GestureWheel UI', () => {
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
    vi.restoreAllMocks();
  });

  it('locks the exact eight slots, direction geometry, icon slot, and bilingual copy', () => {
    act(() => root.render(createElement(GestureWheel, { isZh: false })));
    const wheel = host.querySelector<HTMLElement>('.gesture-wheel')!;
    const items = [...host.querySelectorAll<HTMLElement>('.gesture-wheel-item')];

    expect(wheel.getAttribute('aria-hidden')).toBe('true');
    expect(items).toHaveLength(8);
    expect(items.map((item) => item.querySelector('svg') ? '×' : item.textContent)).toEqual([
      'Next', 'OK', '+2', 'DNF', 'Prev', 'Note', '×', 'Copy',
    ]);
    expect(Number.parseFloat(items[0].style.left)).toBeCloseTo(5.2, 8);
    expect(Number.parseFloat(items[0].style.top)).toBeCloseTo(0, 8);
    expect(Number.parseFloat(items[2].style.left)).toBeCloseTo(0, 8);
    expect(Number.parseFloat(items[2].style.top)).toBeCloseTo(-5.2, 8);
    expect(Number.parseFloat(items[4].style.left)).toBeCloseTo(-5.2, 8);
    expect(Number.parseFloat(items[6].style.top)).toBeCloseTo(5.2, 8);
    expect(items[6].classList.contains('gesture-wheel-item--icon')).toBe(true);
    expect(items[6].querySelector('path')?.getAttribute('d')).toBe(
      'M2.6 2.6 L7.4 7.4 M7.4 2.6 L2.6 7.4',
    );

    act(() => root.render(createElement(GestureWheel, { isZh: true })));
    expect([...host.querySelectorAll<HTMLElement>('.gesture-wheel-item')]
      .map((item) => item.querySelector('svg') ? '×' : item.textContent)).toEqual([
        '下一个', 'OK', '+2', 'DNF', '上一个', '注释', '×', '复制',
      ]);
  });

  it('preserves imperative show/update/hide and never highlights a disabled slot', () => {
    const ref = createRef<GestureWheelHandle>();
    act(() => root.render(createElement(GestureWheel, { isZh: false, ref })));
    const wheel = host.querySelector<HTMLElement>('.gesture-wheel')!;
    const items = [...host.querySelectorAll<HTMLElement>('.gesture-wheel-item')];

    act(() => ref.current!.show(120, 240, [true, false, true, true, true, true, true, true]));
    expect(wheel.classList.contains('is-visible')).toBe(true);
    expect(wheel.style.left).toBe('120px');
    expect(wheel.style.top).toBe('240px');
    expect(wheel.style.getPropertyValue('--wheel-op')).toBe('0');
    expect(items.map((item) => item.classList.contains('disabled'))).toEqual([
      false, true, false, false, false, false, false, false,
    ]);

    act(() => ref.current!.update(1, 0.5));
    expect(items.some((item) => item.classList.contains('hit'))).toBe(false);
    expect(wheel.style.getPropertyValue('--wheel-op')).toBe('0.5');

    act(() => ref.current!.update(2, 0.75));
    expect(items.map((item) => item.classList.contains('hit'))).toEqual([
      false, false, true, false, false, false, false, false,
    ]);

    act(() => ref.current!.hide());
    expect(wheel.classList.contains('is-visible')).toBe(false);
    expect(items.some((item) => item.classList.contains('hit'))).toBe(false);
  });

  it('keeps hidden custom slots absent while retaining the configured icon slot', () => {
    act(() => root.render(createElement(GestureWheel, {
      iconSlot: 7,
      isZh: false,
      labels: ['R', 'UR', 'U', '', 'L', 'DL', 'D', 'DR'],
    })));
    const items = [...host.querySelectorAll<HTMLElement>('.gesture-wheel-item')];
    expect(items).toHaveLength(7);
    expect(items.map((item) => item.querySelector('svg') ? '×' : item.textContent)).toEqual([
      'R', 'UR', 'U', 'L', 'DL', 'D', '×',
    ]);
  });

  it('keeps the former Web imports as identity re-exports', () => {
    expect(LegacyGestureWheel).toBe(GestureWheel);
    expect(legacyUseGestureWheel).toBe(useGestureWheel);
  });
});

describe('shared useGestureWheel pointer lifecycle', () => {
  let host: HTMLDivElement;
  let root: Root;
  let effects: HookEffects;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    effects = {
      cancel: vi.fn<() => void>(),
      down: vi.fn<() => void>(),
      fire: vi.fn<(direction: number) => void>(),
      pressCancel: vi.fn<() => void>(),
      up: vi.fn<() => void>(),
    };
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  function render(props: Omit<HookHarnessProps, 'effects'> = {}): void {
    act(() => root.render(createElement(HookHarness, { ...props, effects })));
  }

  function dispatch(target: Element, type: string, fixture: PointerFixture): boolean {
    let accepted = true;
    act(() => { accepted = target.dispatchEvent(pointerEvent(type, fixture)); });
    return accepted;
  }

  it('keeps a sub-slop mouse press on the normal timing path', () => {
    render();
    const surface = host.querySelector('.fixture-surface')!;
    expect(dispatch(surface, 'pointerdown', { pointerType: 'mouse', time: 100, x: 50, y: 60 })).toBe(false);
    dispatch(surface, 'pointermove', { pointerType: 'mouse', time: 120, x: 59, y: 60 });
    expect(host.querySelector('.gesture-wheel')?.classList.contains('is-visible')).toBe(true);
    dispatch(surface, 'pointerup', { pointerType: 'mouse', time: 140, x: 59, y: 60 });

    expect(effects.down).toHaveBeenCalledTimes(1);
    expect(effects.up).toHaveBeenCalledTimes(1);
    expect(effects.cancel).not.toHaveBeenCalled();
    expect(effects.fire).not.toHaveBeenCalled();
    expect(host.querySelector('.gesture-wheel')?.classList.contains('is-visible')).toBe(false);
  });

  it('turns a mouse drag into the exact direction and cancels timing once', () => {
    render();
    const surface = host.querySelector('.fixture-surface')!;
    dispatch(surface, 'pointerdown', { pointerType: 'mouse', time: 100, x: 100, y: 100 });
    dispatch(surface, 'pointermove', { pointerType: 'mouse', time: 120, x: 170, y: 30 });
    const items = [...host.querySelectorAll<HTMLElement>('.gesture-wheel-item')];
    expect(items[1].classList.contains('hit')).toBe(true);
    dispatch(surface, 'pointerup', { pointerType: 'mouse', time: 130, x: 170, y: 30 });

    expect(effects.down).toHaveBeenCalledTimes(1);
    expect(effects.cancel).toHaveBeenCalledTimes(1);
    expect(effects.fire).toHaveBeenCalledWith(1);
    expect(effects.up).not.toHaveBeenCalled();
  });

  it('treats slow touch drift as a planted hold but a long touch drag as a gesture', () => {
    render();
    const surface = host.querySelector('.fixture-surface')!;
    dispatch(surface, 'pointerdown', { pointerType: 'touch', time: 0, x: 100, y: 100 });
    dispatch(surface, 'pointermove', { pointerType: 'touch', time: 250, x: 130, y: 100 });
    dispatch(surface, 'pointerup', { pointerType: 'touch', time: 300, x: 130, y: 100 });
    expect(effects.up).toHaveBeenCalledTimes(1);
    expect(effects.cancel).not.toHaveBeenCalled();

    dispatch(surface, 'pointerdown', { pointerType: 'touch', time: 400, x: 100, y: 100 });
    dispatch(surface, 'pointermove', { pointerType: 'touch', time: 700, x: 30, y: 30 });
    dispatch(surface, 'pointerup', { pointerType: 'touch', time: 710, x: 30, y: 30 });
    expect(effects.cancel).toHaveBeenCalledTimes(1);
    expect(effects.fire).toHaveBeenCalledWith(3);
    expect(effects.up).toHaveBeenCalledTimes(1);
  });

  it('cancels timing without firing when the drag lands on a disabled direction', () => {
    render();
    const surface = host.querySelector('.fixture-surface')!;
    dispatch(surface, 'pointerdown', { pointerType: 'touch', time: 0, x: 100, y: 100 });
    dispatch(surface, 'pointermove', { pointerType: 'touch', time: 300, x: 100, y: 0 });
    dispatch(surface, 'pointerup', { pointerType: 'touch', time: 310, x: 100, y: 0 });

    expect(effects.cancel).toHaveBeenCalledTimes(1);
    expect(effects.fire).not.toHaveBeenCalled();
    expect(effects.up).not.toHaveBeenCalled();
  });

  it('does not attach while inactive, ignores exempt children, and keeps non-gesture mode timing', () => {
    render({ active: false });
    let surface = host.querySelector('.fixture-surface')!;
    dispatch(surface, 'pointerdown', { pointerType: 'mouse', time: 0, x: 0, y: 0 });
    dispatch(surface, 'pointerup', { pointerType: 'mouse', time: 1, x: 0, y: 0 });
    expect(effects.down).not.toHaveBeenCalled();

    render({ canGesture: false, ignoreButtons: true });
    surface = host.querySelector('.fixture-surface')!;
    const button = host.querySelector('button')!;
    dispatch(button, 'pointerdown', { pointerType: 'mouse', time: 10, x: 5, y: 5 });
    dispatch(button, 'pointerup', { pointerType: 'mouse', time: 11, x: 5, y: 5 });
    expect(effects.down).not.toHaveBeenCalled();

    dispatch(surface, 'pointerdown', { pointerType: 'mouse', time: 20, x: 10, y: 10 });
    dispatch(surface, 'pointermove', { pointerType: 'mouse', time: 30, x: 100, y: 10 });
    dispatch(surface, 'pointerup', { pointerType: 'mouse', time: 40, x: 100, y: 10 });
    expect(effects.down).toHaveBeenCalledTimes(1);
    expect(effects.up).toHaveBeenCalledTimes(1);
    expect(effects.cancel).not.toHaveBeenCalled();
    expect(effects.fire).not.toHaveBeenCalled();
    expect(host.querySelector('.gesture-wheel')?.classList.contains('is-visible')).toBe(false);
  });

  it('cancels a plain press without releasing it and does not re-arm a cancelled gesture', () => {
    render();
    const surface = host.querySelector('.fixture-surface')!;
    dispatch(surface, 'pointerdown', { pointerType: 'touch', time: 0, x: 100, y: 100 });
    dispatch(surface, 'pointercancel', { pointerType: 'touch', time: 20, x: 100, y: 100 });
    expect(effects.pressCancel).toHaveBeenCalledTimes(1);
    expect(effects.up).not.toHaveBeenCalled();

    dispatch(surface, 'pointerdown', { pointerType: 'touch', time: 100, x: 100, y: 100 });
    dispatch(surface, 'pointermove', { pointerType: 'touch', time: 150, x: 200, y: 100 });
    dispatch(surface, 'pointercancel', { pointerType: 'touch', time: 160, x: 200, y: 100 });
    expect(effects.cancel).toHaveBeenCalledTimes(1);
    expect(effects.pressCancel).toHaveBeenCalledTimes(1);
    expect(effects.up).not.toHaveBeenCalled();
    expect(effects.fire).not.toHaveBeenCalled();
    expect(host.querySelector('.gesture-wheel')?.classList.contains('is-visible')).toBe(false);
  });

  it('captures exactly one active pointer and ignores a second finger', () => {
    render();
    const surface = host.querySelector<HTMLElement>('.fixture-surface')!;
    const setCapture = vi.fn();
    const releaseCapture = vi.fn();
    Object.assign(surface, {
      hasPointerCapture: () => true,
      releasePointerCapture: releaseCapture,
      setPointerCapture: setCapture,
    });

    dispatch(surface, 'pointerdown', {
      pointerId: 7, pointerType: 'touch', time: 0, x: 100, y: 100,
    });
    dispatch(surface, 'pointerdown', {
      pointerId: 8, pointerType: 'touch', time: 5, x: 120, y: 100,
    });
    dispatch(surface, 'pointerup', {
      pointerId: 8, pointerType: 'touch', time: 10, x: 120, y: 100,
    });
    expect(effects.down).toHaveBeenCalledTimes(1);
    expect(effects.up).not.toHaveBeenCalled();
    expect(setCapture).toHaveBeenCalledOnce();
    expect(setCapture).toHaveBeenCalledWith(7);

    dispatch(surface, 'pointerup', {
      pointerId: 7, pointerType: 'touch', time: 20, x: 100, y: 100,
    });
    expect(effects.up).toHaveBeenCalledOnce();
    expect(releaseCapture).toHaveBeenCalledWith(7);
  });

  it('cancels and hides an active press when disabled or the window loses focus', () => {
    render();
    let surface = host.querySelector('.fixture-surface')!;
    dispatch(surface, 'pointerdown', { pointerType: 'touch', time: 0, x: 100, y: 100 });
    render({ active: false });
    expect(effects.pressCancel).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.gesture-wheel')?.classList.contains('is-visible')).toBe(false);

    render();
    surface = host.querySelector('.fixture-surface')!;
    dispatch(surface, 'pointerdown', { pointerType: 'touch', time: 10, x: 100, y: 100 });
    act(() => window.dispatchEvent(new Event('blur')));
    expect(effects.pressCancel).toHaveBeenCalledTimes(2);
    expect(effects.up).not.toHaveBeenCalled();
    expect(host.querySelector('.gesture-wheel')?.classList.contains('is-visible')).toBe(false);
  });
});

describe('gesture wheel migration, theme, and i18n guards', () => {
  it('keeps Web paths as thin wrappers and both Web hosts on timer-ui', () => {
    const componentWrapper = readFileSync('components/GestureWheel.tsx', 'utf8');
    const hookWrapper = readFileSync('hooks/useGestureWheel.ts', 'utf8');
    const cssWrapper = readFileSync('components/gesture-wheel.css', 'utf8');
    const solo = readFileSync('app/[lang]/timer/_shell/SoloView.tsx', 'utf8');
    const trainer = readFileSync('app/[lang]/alg/[puzzle]/[set]/run/TrainerRunClient.tsx', 'utf8');

    expect(componentWrapper).toContain("from '@cuberoot/timer-ui'");
    expect(componentWrapper).not.toContain('forwardRef');
    expect(hookWrapper).toContain("from '@cuberoot/timer-ui'");
    expect(hookWrapper).not.toContain('addEventListener');
    expect(cssWrapper.trim().endsWith("@import '@cuberoot/timer-ui/gesture-wheel.css';")).toBe(true);
    expect(cssWrapper).not.toContain('.gesture-wheel {');
    for (const source of [solo, trainer]) {
      expect(source).toContain("from '@cuberoot/timer-ui'");
      expect(source).not.toContain("from '@/components/GestureWheel'");
      expect(source).not.toContain("from '@/hooks/useGestureWheel'");
    }
  });

  it('keeps labels and thresholds in shared contracts and CSS on canonical tokens', () => {
    const timerUiEntry = new URL(import.meta.resolve('@cuberoot/timer-ui'));
    const component = readFileSync(new URL('./GestureWheel.tsx', timerUiEntry), 'utf8');
    const hook = readFileSync(new URL('./useGestureWheel.ts', timerUiEntry), 'utf8');
    const css = readFileSync(new URL('./gesture-wheel.css', timerUiEntry), 'utf8');

    expect(component).toContain('timerGestureActionLabels(isZh)');
    expect(component).not.toMatch(/isZh\s*\?/);
    expect(component).not.toContain("['Next', 'OK', '+2'");
    expect(hook).toContain('timerRadialGestureStarts(');
    expect(hook).toContain('timerRadialGestureDirection(');
    expect(hook).not.toMatch(/\b(?:10|18|44|90|200)\b/);
    expect(css).toContain('var(--accent)');
    expect(css).toContain('var(--popover)');
    expect(css).toContain('var(--border-default)');
    expect(css).toContain('var(--faint-foreground)');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch)\(/i);
  });
});
