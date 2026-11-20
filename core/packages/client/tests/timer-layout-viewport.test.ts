/** @vitest-environment jsdom */
import { act, createElement as h, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_SOLO_LAYOUT } from '@cuberoot/shared/timer';
import { TimerSoloLayoutEditor, type TimerSoloLayoutSettings } from '@cuberoot/timer-ui';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mountEditor(rotated = false, fitted = false) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('innerWidth', 600);
  vi.stubGlobal('innerHeight', 400);
  let settings: TimerSoloLayoutSettings = { soloLayout: { ...DEFAULT_SOLO_LAYOUT }, timerFontScale: 1, scrambleFontScale: 1 };
  if (fitted) settings.soloLayout.timerGap = 200;
  const writes = vi.fn();
  // jsdom has no layout engine. These rectangles model a following preview and
  // an opposite-facing player whose top edge moves upward when digits grow.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const surface = this.closest<HTMLElement>('[data-scale]');
    const previewGap = Number.parseFloat(surface?.style.getPropertyValue('--solo-timer-gap') || '');
    const gap = Number.isFinite(previewGap) ? previewGap : settings.soloLayout.timerGap;
    if (this.matches('.timing-surface-cube-frame')) {
      const scale = parseFloat(surface?.style.getPropertyValue('--solo-cube-scale') || '') || settings.soloLayout.cubeScale;
      return new DOMRect(100, 200 + gap, 100 * scale, 100 * scale);
    }
    if (this.matches('.timer-display-wrap')) {
      const scale = parseFloat((this.querySelector('.timer-display') as HTMLElement).style.fontSize) / 40;
      const top = this.closest('[data-flipped]') ? 20 - (scale - 1) * 100 : 100 + gap;
      const offset = parseFloat(surface?.style.getPropertyValue('--solo-timer-offset-y') || '');
      return new DOMRect(100, top + (Number.isFinite(offset) ? offset : settings.soloLayout.timerOffsetY), 100 * scale, 40 * scale);
    }
    return new DOMRect();
  });
  if (fitted) {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      const preview = this.querySelector('.timing-surface-cube-frame');
      return Math.max(400, preview?.getBoundingClientRect().bottom ?? 0);
    });
  }
  function Harness() {
    const surfaceRef = useRef<HTMLDivElement>(null);
    const [value, setValue] = useState(settings);
    const [docked, setDocked] = useState(false);
    return h('div', { ref: surfaceRef, 'data-scale': value.timerFontScale,
      className: fitted ? 'timer-solo-main' : undefined, 'data-spacing-flow': fitted ? '' : undefined,
      style: fitted ? { '--solo-timer-gap': '40px' } as React.CSSProperties : undefined },
      h('div', { 'data-flipped': rotated ? true : undefined }, h('div', { className: 'timer-display-wrap' },
        h('div', { className: 'timer-display', style: { fontSize: `${40 * value.timerFontScale}px` } }, '0.000'))),
      h('div', { key: docked ? 'footer' : 'inline', className: docked ? 'timer-stage-preview' : undefined },
        h('div', { className: 'timing-surface-cube-frame' })),
      h('button', { onClick: () => setDocked(!docked), 'data-rotate': '' }, 'Rotate'),
      h(TimerSoloLayoutEditor, { surfaceRef, contentKey: 'fixture', language: 'en', onDone() {},
        getSettings: () => settings,
        updateSettings: patch => { settings = { ...settings, ...patch }; writes(settings); setValue(settings); },
      }));
  }
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(h(Harness)));
  const handle = (mode: 'move' | 'size') => host.querySelector<HTMLButtonElement>(`.timer-display-wrap .solo-layout-handle--${mode}`)!;
  const drag = (mode: 'move' | 'size', y: number) => {
    const button = handle(mode);
    button.setPointerCapture = vi.fn();
    button.hasPointerCapture = () => false;
    const send = (type: string, clientY: number) => button.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, button: 0, clientY }), { pointerId: 1 }));
    act(() => { send('pointerdown', 0); send('pointermove', y); send('pointerup', y); });
  };
  return { host, handle, drag, writes, settings: () => settings,
    close() { act(() => root.unmount()); host.remove(); } };
}

it('clamps a large drag before it pushes the following preview below the window, including repeated keys', () => {
  const editor = mountEditor();
  try {
    editor.drag('move', 1000);
    expect(editor.settings().soloLayout.timerGap).toBe(100);
    expect(editor.host.querySelector('.timing-surface-cube-frame')!.getBoundingClientRect().bottom).toBe(400);
    expect(editor.writes).toHaveBeenCalledTimes(1);
    expect(editor.host.querySelector<HTMLElement>('[data-scale]')!.style.getPropertyValue('--solo-timer-gap')).toBe('');
    for (let n = 0; n < 3; n++) act(() => editor.handle('move').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(editor.settings().soloLayout.timerGap).toBe(100);
    act(() => editor.handle('move').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })));
    expect(editor.settings().soloLayout.timerGap).toBe(96);
  } finally { editor.close(); }
});

it('clamps a rotated player at the top edge and permits shrinking back into the window', () => {
  const editor = mountEditor(true);
  try {
    editor.drag('size', -1000);
    expect(editor.settings().timerFontScale).toBe(1.2);
    expect(editor.host.querySelector('.timer-display-wrap')!.getBoundingClientRect().top).toBeCloseTo(0);
    act(() => editor.handle('size').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })));
    expect(editor.settings().timerFontScale).toBe(1.15);
  } finally { editor.close(); }
});

it('moves a single Solo box without changing gaps or moving the preview', () => {
  const editor = mountEditor(false, true);
  try {
    const digits = editor.host.querySelector('.timer-display-wrap')!;
    const preview = editor.host.querySelector('.timing-surface-cube-frame')!;
    const digitsTop = digits.getBoundingClientRect().top;
    const previewTop = preview.getBoundingClientRect().top;
    editor.drag('move', -32);
    expect(editor.settings().soloLayout.timerOffsetY).toBe(-32);
    expect(editor.settings().soloLayout.timerGap).toBe(200);
    expect(digits.getBoundingClientRect().top).toBe(digitsTop - 32);
    expect(preview.getBoundingClientRect().top).toBe(previewTop);
    editor.drag('move', 1000);
    expect(digits.getBoundingClientRect().bottom).toBe(previewTop);
    expect(preview.getBoundingClientRect().top).toBe(previewTop);
  } finally { editor.close(); }
});

it('resizes the region under a trackpad pinch in editors without plain wheel resizing', () => {
  const editor = mountEditor(true);
  try {
    const digits = editor.host.querySelector('.timer-display')!;
    const wheel = (deltaY: number, ctrlKey: boolean) => {
      const event = new WheelEvent('wheel', { deltaY, ctrlKey, bubbles: true, cancelable: true });
      act(() => digits.dispatchEvent(event));
      return event.defaultPrevented;
    };
    expect(wheel(-100, false)).toBe(false);
    expect(editor.writes).not.toHaveBeenCalled();
    expect(wheel(-100, true)).toBe(true);
    expect(editor.settings().timerFontScale).toBe(1.2);
    expect(wheel(10, true)).toBe(true);
    expect(editor.settings().timerFontScale).toBe(1.09);
    expect(editor.settings().soloLayout.cubeScale).toBe(1);
  } finally { editor.close(); }
});

it('resizes only the hovered Solo region on a plain wheel event', () => {
  const editor = mountEditor(false, true);
  try {
    const preview = editor.host.querySelector('.timing-surface-cube-frame')!;
    const wheel = (target: Element, deltaY: number) => {
      const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
      act(() => target.dispatchEvent(event));
      return event.defaultPrevented;
    };
    expect(wheel(editor.host.querySelector('[data-rotate]')!, -120)).toBe(false);
    expect(editor.writes).not.toHaveBeenCalled();
    expect(wheel(preview, -120)).toBe(true);
    expect(editor.settings().soloLayout.cubeScale).toBe(1.13);
    expect(wheel(preview, 120)).toBe(true);
    expect(editor.settings().soloLayout.cubeScale).toBe(1);
    expect(editor.settings().timerFontScale).toBe(1);
  } finally { editor.close(); }
});

it('uses consecutive WebKit pinch scales to resize a cube preview', () => {
  const editor = mountEditor();
  try {
    const preview = editor.host.querySelector('.timing-surface-cube-frame')!;
    const gesture = (type: string, scale: number) => {
      const event = Object.assign(new Event(type, { bubbles: true, cancelable: true }), { scale });
      act(() => preview.dispatchEvent(event));
      return event.defaultPrevented;
    };
    expect(gesture('gesturestart', 1)).toBe(true);
    expect(gesture('gesturechange', 1.1)).toBe(true);
    expect(editor.settings().soloLayout.cubeScale).toBe(1.1);
    expect(gesture('gesturechange', 0.9)).toBe(true);
    expect(editor.settings().soloLayout.cubeScale).toBe(0.9);
    gesture('gestureend', 0.9);
    expect(editor.settings().timerFontScale).toBe(1);
  } finally { editor.close(); }
});

it('uses the visible viewport width and offset when limiting enlargement', () => {
  const editor = mountEditor();
  vi.stubGlobal('visualViewport', { offsetLeft: 80, offsetTop: 0, width: 160, height: 400 });
  try {
    editor.drag('size', 1000);
    expect(editor.settings().timerFontScale).toBe(1.4);
    expect(editor.host.querySelector('.timer-display-wrap')!.getBoundingClientRect().right).toBe(240);
    expect(editor.writes).toHaveBeenCalledTimes(1);
  } finally { editor.close(); }
});

it('resizes a preview after saved gaps have been fitted to a smaller viewport', () => {
  const editor = mountEditor(false, true);
  try {
    const button = editor.host.querySelector('.timing-surface-cube-frame .solo-layout-handle--size')!;
    act(() => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(editor.settings().soloLayout.cubeScale).toBe(1.05);
    expect(editor.settings().soloLayout.timerGap).toBe(200);
    expect(editor.host.querySelector<HTMLElement>('[data-scale]')!.style.getPropertyValue('--solo-timer-gap')).toBe('40px');
  } finally { editor.close(); }
});

it('rebinds resize handles when rotation remounts the preview in the footer', async () => {
  const editor = mountEditor();
  try {
    const original = editor.host.querySelector('.timing-surface-cube-frame');
    await act(async () => editor.host.querySelector<HTMLButtonElement>('[data-rotate]')!.click());
    const preview = editor.host.querySelector('.timer-stage-preview .timing-surface-cube-frame')!;
    expect(preview).not.toBe(original);
    expect(preview.querySelectorAll('.solo-layout-handle--size')).toHaveLength(1);
    act(() => preview.querySelector('.solo-layout-handle--size')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(editor.settings().soloLayout.cubeScale).toBe(1.05);
    expect(editor.writes).toHaveBeenCalledTimes(1);
  } finally { editor.close(); }
});
