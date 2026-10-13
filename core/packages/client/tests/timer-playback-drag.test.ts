// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import PlaybackPanel from '../../timer-ui/src/reconstruct/PlaybackPanel';

vi.mock('@cuberoot/timer-ui/SimCubeView', () => ({ default: () => null }));

it('scrubs continuously between moves, clamps outside the track, and releases the drag', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PlaybackPanel, {
      event: '333', scramble: 'R U', isZh: false, totalMs: 1000,
      moves: [{ m: "U'", ts: 300 }, { m: "R'", ts: 1000 }],
    })));
    const track = host.querySelector<HTMLElement>('.stl-track')!;
    track.getBoundingClientRect = () => ({ left: 100, width: 200 }) as DOMRect;
    track.setPointerCapture = vi.fn();
    track.releasePointerCapture = vi.fn();
    const pointer = async (type: string, x: number, id = 1) => act(async () => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x });
      Object.defineProperty(event, 'pointerId', { value: id });
      track.dispatchEvent(event);
    });
    const counter = () => host.querySelector('.reconstruct-playback-counter')?.textContent;
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Play"]')!.click());
    await pointer('pointerdown', 200);
    expect(host.querySelector('[aria-label="Play"]')).not.toBeNull();
    expect(counter()).toBe('0.50 / 1.00');
    await pointer('pointermove', 240);
    expect(counter()).toBe('0.70 / 1.00');
    expect(host.querySelector<HTMLElement>('.stl-cursor')!.style.left).toBe('70%');
    await pointer('pointermove', 120, 2);
    expect(counter()).toBe('0.70 / 1.00');
    await pointer('pointermove', 50);
    expect(counter()).toBe('0.00 / 1.00');
    await pointer('pointerup', 350);
    expect(counter()).toBe('1.00 / 1.00');
    await pointer('pointermove', 100);
    expect(counter()).toBe('1.00 / 1.00');
    await pointer('pointerdown', 200);
    await pointer('pointercancel', 200);
    await pointer('pointermove', 100);
    expect(counter()).toBe('0.50 / 1.00');
    await act(async () => track.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(counter()).toBe('0.00 / 1.00');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
