/** @vitest-environment jsdom */
import { act, createElement as h, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_SOLO_LAYOUT } from '@cuberoot/shared/timer';
import { TimerSoloLayoutEditor, type TimerSoloLayoutSettings } from '@cuberoot/timer-ui';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mountEditor(rotated = false) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('innerWidth', 600);
  vi.stubGlobal('innerHeight', 400);
  let settings: TimerSoloLayoutSettings = { soloLayout: { ...DEFAULT_SOLO_LAYOUT }, timerFontScale: 1, scrambleFontScale: 1 };
  const writes = vi.fn();
  // jsdom has no layout engine. These rectangles model a following preview and
  // an opposite-facing player whose top edge moves upward when digits grow.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const surface = this.closest<HTMLElement>('[data-scale]');
    const previewGap = Number.parseFloat(surface?.style.getPropertyValue('--solo-timer-gap') || '');
    const gap = Number.isFinite(previewGap) ? previewGap : settings.soloLayout.timerGap;
    if (this.matches('.timing-surface-cube-frame')) {
      return new DOMRect(100, 200 + gap, 100, 100);
    }
    if (this.matches('.timer-display-wrap')) {
      const scale = parseFloat((this.querySelector('.timer-display') as HTMLElement).style.fontSize) / 40;
      const top = this.closest('[data-flipped]') ? 20 - (scale - 1) * 100 : 100 + gap;
      return new DOMRect(100, top, 100 * scale, 40 * scale);
    }
    return new DOMRect();
  });
  function Harness() {
    const surfaceRef = useRef<HTMLDivElement>(null);
    const [value, setValue] = useState(settings);
    return h('div', { ref: surfaceRef, 'data-scale': value.timerFontScale },
      h('div', { 'data-flipped': rotated ? true : undefined }, h('div', { className: 'timer-display-wrap' },
        h('div', { className: 'timer-display', style: { fontSize: `${40 * value.timerFontScale}px` } }, '0.000'))),
      h('div', { className: 'timing-surface-cube-frame' }),
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
